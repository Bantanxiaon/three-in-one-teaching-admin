import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { requireApiPermission } from "@/lib/api-auth";
import { ApiError, fail, handleApiError, ok } from "@/lib/api-response";
import { addMonthsClamped, calculatePackageHours } from "@/lib/operations";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { studentAdminUpdateSchema, studentDeleteSchema } from "@/lib/student-admin-schemas";
import { getStudentDeletionReason } from "@/lib/student-deletion-reasons";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { encryptTemporaryPassword } from "@/lib/temporary-password-vault";
import { sendAccountApprovedNotification, sendAccountDeletedNotification, sendPasswordResetNotification } from "@/lib/mail";
import {
  sendAccountReadyWechat,
  sendAccountStatusWechatToRecipient,
  sendPasswordResetWechat
} from "@/lib/wechat-notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = studentAdminUpdateSchema.parse(await request.json());
    const accountEmail = input.email?.toLowerCase();
    const result = await runSerializableTransaction(prisma, async (tx) => {
      const current = await tx.studentProfile.findUniqueOrThrow({ where: { id }, include: { user: true } });
      if (input.campusId !== undefined && input.campusId !== current.campusId) {
        throw new ApiError("USE_CAMPUS_TRANSFER", "Use the campus transfer command to change a student's campus.", 422);
      }
      const passwordMode = input.passwordMode ?? (!current.userId && accountEmail ? "GENERATED" : undefined);
      if (passwordMode && !current.userId && !accountEmail) {
        throw new ApiError("ACCOUNT_EMAIL_REQUIRED", "Enter an email before creating login credentials.", 422);
      }
      const temporaryPassword = passwordMode
        ? passwordMode === "GENERATED" ? generateTemporaryPassword() : input.password
        : undefined;
      const passwordHash = temporaryPassword ? await hash(temporaryPassword, 12) : undefined;
      const storedTemporaryPassword = temporaryPassword ? encryptTemporaryPassword(temporaryPassword) : undefined;
      const profileChanged =
        (input.name !== undefined && input.name !== current.fullName) ||
        (input.age !== undefined && input.age !== current.age) ||
        (input.guardianName !== undefined && input.guardianName !== current.guardianName) ||
        (input.phone !== undefined && input.phone !== current.phone) ||
        (input.wechat !== undefined && input.wechat !== current.wechat) ||
        (input.goal !== undefined && input.goal !== current.goal);
      const teacherChanged = input.teacherId !== undefined && input.teacherId !== current.teacherId;
      let userId = current.userId;
      if (current.userId) {
        if (accountEmail || passwordHash) {
          await tx.user.update({
            where: { id: current.userId },
            data: {
              email: accountEmail,
              passwordHash,
              currentTemporaryPassword: storedTemporaryPassword,
              mustChangePassword: passwordHash ? true : undefined
            }
          });
        }
      } else if (accountEmail && passwordHash) {
        const user = await tx.user.create({
          data: {
            email: accountEmail,
            name: input.name ?? current.fullName,
            phone: input.phone ?? current.phone,
            wechat: input.wechat ?? current.wechat,
            passwordHash,
            currentTemporaryPassword: storedTemporaryPassword,
            role: Role.STUDENT,
            mustChangePassword: true
          }
        });
        userId = user.id;
      }

      if (input.tuitionPackageId && !userId) {
        throw new Error("Create the student's login account before assigning a tuition package.");
      }
      const effectiveTeacherId = input.teacherId ?? current.teacherId;
      const tuitionPackage = input.tuitionPackageId
        ? await tx.tuitionPackage.findFirst({
            where: { id: input.tuitionPackageId, teacherId: effectiveTeacherId ?? undefined, isActive: true }
          })
        : null;
      if (input.tuitionPackageId && (!tuitionPackage || !effectiveTeacherId)) {
        throw new Error("The selected tuition package is unavailable for this teacher.");
      }
      const packageHours = tuitionPackage
        ? calculatePackageHours(tuitionPackage.lessonCount, tuitionPackage.lessonDurationMinutes)
        : 0;

      const updated = await tx.studentProfile.update({
        where: { id },
        data: {
          userId,
          fullName: input.name,
          age: input.age,
          guardianName: input.guardianName,
          phone: input.phone,
          wechat: input.wechat,
          goal: input.goal,
          teacherId: input.teacherId,
          totalHours: tuitionPackage ? { increment: packageHours } : undefined,
          remainingHours: tuitionPackage ? { increment: packageHours } : undefined
        }
      });

      const studentPackage = tuitionPackage
        ? await tx.studentPackage.create({
          data: {
            studentId: id,
            teacherId: tuitionPackage.teacherId,
            tuitionPackageId: tuitionPackage.id,
            packageName: tuitionPackage.name,
            lessonDurationMinutes: tuitionPackage.lessonDurationMinutes,
            totalLessons: tuitionPackage.lessonCount,
            remainingLessons: tuitionPackage.lessonCount,
            originalUnitPriceCents: tuitionPackage.originalUnitPriceCents,
            unitPriceCents: tuitionPackage.unitPriceCents,
            expiresAt: addMonthsClamped(new Date(), tuitionPackage.validityMonths)
          }
        })
        : null;

      if (passwordHash) {
        await recordStudentLifecycleEvent(tx, {
          studentId: updated.id,
          studentNumber: updated.studentNumber,
          actorId: session.user.id,
          eventType: current.userId
            ? studentLifecycleEventTypes.passwordReset
            : studentLifecycleEventTypes.accountCreated,
          beforeState: {
            userId: current.userId,
            profileUserId: current.userId,
            mustChangePassword: current.user?.mustChangePassword ?? false
          },
          afterState: {
            userId,
            profileUserId: updated.userId,
            mustChangePassword: true
          }
        });
      }
      if (teacherChanged) {
        await recordStudentLifecycleEvent(tx, {
          studentId: updated.id,
          studentNumber: current.studentNumber,
          actorId: session.user.id,
          eventType: studentLifecycleEventTypes.teacherChanged,
          beforeState: { teacherId: current.teacherId },
          afterState: { teacherId: updated.teacherId }
        });
      }
      if (studentPackage) {
        await recordStudentLifecycleEvent(tx, {
          studentId: updated.id,
          studentNumber: current.studentNumber,
          actorId: session.user.id,
          eventType: studentLifecycleEventTypes.packageAssigned,
          afterState: { packageId: studentPackage.id, tuitionPackageId: studentPackage.tuitionPackageId }
        });
      }
      if (profileChanged) {
        await recordStudentLifecycleEvent(tx, {
          studentId: updated.id,
          studentNumber: current.studentNumber,
          actorId: session.user.id,
          eventType: studentLifecycleEventTypes.profileUpdated,
          beforeState: {
            name: current.fullName,
            age: current.age,
            guardianName: current.guardianName,
            phone: current.phone,
            wechat: current.wechat,
            goal: current.goal
          },
          afterState: {
            name: updated.fullName,
            age: updated.age,
            guardianName: updated.guardianName,
            phone: updated.phone,
            wechat: updated.wechat,
            goal: updated.goal
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "student.update",
          entity: "StudentProfile",
          entityId: id,
          metadata: { fields: Object.keys(input), accountCreated: !current.userId && Boolean(userId), tuitionPackageId: tuitionPackage?.id ?? null }
        }
      });
      return { student: updated, current, temporaryPassword };
    });

    const { student, current, temporaryPassword } = result;
    const effectiveEmail = accountEmail ?? current.user?.email ?? null;
    let emailSent = false;
    let emailTrackingAvailable = false;
    if (temporaryPassword && effectiveEmail) {
      try {
        const mailInput = {
          to: effectiveEmail,
          name: input.name ?? current.fullName,
          temporaryPassword,
          locale: "zh" as const
        };
        const mail = current.userId
          ? await sendPasswordResetNotification(mailInput)
          : await sendAccountApprovedNotification({ ...mailInput, email: effectiveEmail, studentNumber: student.studentNumber });
        emailSent = mail.status === "accepted";
        emailTrackingAvailable = mail.status === "accepted" && mail.trackingAvailable;
      } catch {
        console.error("Student password email failed");
      }
    }
    if (!current.userId && student.userId) {
      try {
        await sendAccountReadyWechat({
          approvedUserId: student.userId,
          studentNumber: student.studentNumber,
          name: input.name ?? current.fullName,
          locale: "zh"
        });
      } catch {
        console.error("Manual account ready WeChat notification failed");
      }
    } else if (temporaryPassword && current.userId) {
      try {
        await sendPasswordResetWechat({
          approvedUserId: current.userId,
          accountRef: student.studentNumber,
          name: input.name ?? current.fullName,
          locale: "zh"
        });
      } catch {
        console.error("Student password reset WeChat notification failed");
      }
    }

    return ok({
      student,
      temporaryPassword,
      emailSent,
      emailTrackingAvailable
    });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = studentDeleteSchema.parse(await request.json());
    if (input.confirmation !== "DELETE") {
      return fail("DELETE_CONFIRMATION_REQUIRED", "Type DELETE to permanently remove this student and login account.", 422);
    }
    const reason = getStudentDeletionReason(input.reasonCode, "zh");
    const deleted = await prisma.$transaction(async (tx) => {
      const student = await tx.studentProfile.findUniqueOrThrow({
        where: { id },
        include: { user: { select: { id: true, email: true, name: true, preferredLocale: true } } }
      });
      const notificationRecipient = student.userId
        ? await tx.wechatNotificationBinding.findUnique({ where: { userId: student.userId } }).then((binding) => binding ? ({
            id: binding.userId,
            approvedUserId: binding.userId,
            grantOwner: "account" as const,
            wechatRecipientCiphertext: binding.recipientCiphertext,
            wechatSubscriptionTemplateIds: binding.subscriptionTemplateIds
          }) : null)
        : null;
      if (student.userId) {
        await tx.accountApplication.updateMany({
          where: { approvedUserId: student.userId },
          data: { approvedUserId: null }
        });
      }
      await recordStudentLifecycleEvent(tx, {
        studentId: student.id,
        studentNumber: student.studentNumber,
        actorId: session.user.id,
        eventType: studentLifecycleEventTypes.accountDeleted,
        reasonCode: input.reasonCode,
        beforeState: { name: student.fullName, linkedAccountDeleted: Boolean(student.userId) }
      });
      await tx.studentProfile.delete({ where: { id } });
      if (student.userId) await tx.user.delete({ where: { id: student.userId } });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "student.delete",
          entity: "StudentProfile",
          entityId: id,
          metadata: { reasonCode: input.reasonCode, reason, name: student.fullName, linkedAccountDeleted: Boolean(student.userId) }
        }
      });
      return {
        id,
        email: student.user?.email ?? null,
        name: student.fullName,
        studentNumber: student.studentNumber,
        reason,
        approvedUserId: student.userId,
        locale: (student.user?.preferredLocale === "en" || student.user?.preferredLocale === "ja"
          ? student.user.preferredLocale
          : "zh") as "zh" | "en" | "ja",
        notificationRecipient
      };
    });
    let emailSent = false;
    let emailTrackingAvailable = false;
    if (deleted.email) {
      try {
        const mail = await sendAccountDeletedNotification({
          to: deleted.email,
          name: deleted.name,
          reason: deleted.reason,
          locale: deleted.locale
        });
        emailSent = mail.status === "accepted";
        emailTrackingAvailable = mail.status === "accepted" && mail.trackingAvailable;
      } catch {
        console.error("Student deletion email failed");
      }
    }
    if (deleted.approvedUserId && deleted.notificationRecipient) {
      try {
        await sendAccountStatusWechatToRecipient({
          approvedUserId: deleted.approvedUserId,
          recipient: deleted.notificationRecipient,
          accountRef: deleted.studentNumber,
          name: deleted.name,
          reason: deleted.reason,
          locale: deleted.locale
        });
      } catch {
        console.error("Student deletion WeChat notification failed");
      }
    }
    return ok({ id, emailSent, emailTrackingAvailable });
  } catch (error) { return handleApiError(error); }
}
