import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { addMonthsClamped, calculatePackageHours } from "@/lib/operations";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { studentAdminCreateSchema } from "@/lib/student-admin-schemas";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";
import { allocateStudentNumber } from "@/lib/student-number";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { encryptTemporaryPassword, revealStudentTemporaryPasswords } from "@/lib/temporary-password-vault";
import { sendAccountApprovedNotification } from "@/lib/mail";

const safeStudentInclude = {
  user: { select: { id: true, email: true, mustChangePassword: true, currentTemporaryPassword: true } },
  teacher: { select: { id: true, displayName: true, slug: true } },
  campus: { select: { id: true, name: true, city: true } },
  studentPackages: {
    select: {
      id: true,
      packageName: true,
      lessonDurationMinutes: true,
      totalLessons: true,
      consumedLessons: true,
      remainingLessons: true,
      purchasedAt: true,
      expiresAt: true,
      isActive: true
    },
    orderBy: { purchasedAt: "desc" as const }
  }
} satisfies Prisma.StudentProfileInclude;

export async function GET() {
  try {
    const session = await requireApiPermission("admin:read");
    const students = await prisma.studentProfile.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: safeStudentInclude
    });
    return ok(revealStudentTemporaryPasswords(students, session.user.role));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("admin:write");
    const input = studentAdminCreateSchema.parse(await request.json());
    const accountEmail = input.email?.toLowerCase();
    const temporaryPassword = accountEmail
      ? input.passwordMode === "GENERATED" ? generateTemporaryPassword() : input.password
      : undefined;
    const passwordHash = temporaryPassword ? await hash(temporaryPassword, 12) : undefined;
    const storedTemporaryPassword = temporaryPassword ? encryptTemporaryPassword(temporaryPassword) : undefined;

    const student = await runSerializableTransaction(prisma, async (tx) => {
      const studentNumber = await allocateStudentNumber(tx, input.campusId);
      const enrolledAt = input.enrolledAt ?? new Date();
      const tuitionPackage = input.tuitionPackageId
        ? await tx.tuitionPackage.findFirst({
            where: { id: input.tuitionPackageId, teacherId: input.teacherId, isActive: true }
          })
        : null;
      if (input.tuitionPackageId && !tuitionPackage) {
        throw new Error("The selected tuition package is unavailable for this teacher.");
      }
      const packageHours = tuitionPackage
        ? calculatePackageHours(tuitionPackage.lessonCount, tuitionPackage.lessonDurationMinutes)
        : 0;

      const user = accountEmail && passwordHash
        ? await tx.user.create({
            data: {
              email: accountEmail,
              name: input.name,
              phone: input.phone,
              wechat: input.wechat,
              passwordHash,
              currentTemporaryPassword: storedTemporaryPassword,
              role: Role.STUDENT,
              mustChangePassword: true
            }
          })
        : null;

      const created = await tx.studentProfile.create({
        data: {
          userId: user?.id,
          fullName: input.name,
          age: input.age,
          guardianName: input.guardianName,
          phone: input.phone,
          wechat: input.wechat,
          goal: input.goal,
          teacherId: input.teacherId,
          campusId: input.campusId,
          studentNumber,
          enrolledAt,
          totalHours: packageHours,
          remainingHours: packageHours
        }
      });

      await recordStudentLifecycleEvent(tx, {
        studentId: created.id,
        studentNumber,
        actorId: session.user.id,
        eventType: studentLifecycleEventTypes.enrolled,
        afterState: { campusId: input.campusId, enrolledAt: enrolledAt.toISOString() }
      });

      if (user) {
        await recordStudentLifecycleEvent(tx, {
          studentId: created.id,
          studentNumber,
          actorId: session.user.id,
          eventType: studentLifecycleEventTypes.accountCreated,
          afterState: { userId: user.id }
        });
      }

      if (tuitionPackage) {
        const studentPackage = await tx.studentPackage.create({
          data: {
            studentId: created.id,
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
        });
        await recordStudentLifecycleEvent(tx, {
          studentId: created.id,
          studentNumber,
          actorId: session.user.id,
          eventType: studentLifecycleEventTypes.packageAssigned,
          afterState: { studentPackageId: studentPackage.id, tuitionPackageId: tuitionPackage.id }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "student.create",
          entity: "StudentProfile",
          entityId: created.id,
          metadata: { accountCreated: Boolean(user), tuitionPackageId: tuitionPackage?.id ?? null }
        }
      });
      return tx.studentProfile.findUniqueOrThrow({ where: { id: created.id }, include: safeStudentInclude });
    });

    let emailSent = false;
    let emailTrackingAvailable = false;
    if (accountEmail && temporaryPassword) {
      try {
        const mail = await sendAccountApprovedNotification({
          to: accountEmail,
          name: input.name,
          email: accountEmail,
          studentNumber: student.studentNumber,
          temporaryPassword,
          locale: "zh"
        });
        emailSent = mail.status === "accepted";
        emailTrackingAvailable = mail.status === "accepted" && mail.trackingAvailable;
      } catch {
        console.error("Student account email failed");
      }
    }

    const visibleStudent = revealStudentTemporaryPasswords([student], session.user.role)[0];
    return ok({ ...visibleStudent, temporaryPassword: temporaryPassword, emailSent, emailTrackingAvailable }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
