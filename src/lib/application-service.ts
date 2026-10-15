import { BookingStatus, Prisma, PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import type { ApplicationSubmissionInput } from "@/lib/application-schemas";
import { sendAccountApprovedNotification, sendAccountDeletedNotification } from "@/lib/mail";
import { sendAccountReadyWechat, sendAccountStatusWechatToRecipient } from "@/lib/wechat-notifications";
import { addMonthsClamped, calculatePackageHours } from "@/lib/operations";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";
import { allocateStudentNumber } from "@/lib/student-number";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { encryptTemporaryPassword } from "@/lib/temporary-password-vault";

export type WechatSubscriptionMetadata = {
  wechatRecipientCiphertext: string;
  wechatSubscriptionTemplateIds: string[];
  wechatSubscriptionUpdatedAt: Date;
};

export type WechatSubscriptionMetadataFactory = () => WechatSubscriptionMetadata | undefined;

function toEmailLocale(locale: string): "zh" | "en" | "ja" {
  return locale === "en" || locale === "ja" ? locale : "zh";
}

export function toApplicationCreateData(
  input: ApplicationSubmissionInput,
  wechatSubscription?: WechatSubscriptionMetadata
): Prisma.AccountApplicationUncheckedCreateInput {
  const common = {
    role: input.role,
    idempotencyKey: input.idempotencyKey,
    name: input.name,
    phone: input.phone,
    wechat: input.wechat || null,
    email: input.email || null,
    locale: input.locale
  } as const;

  if (input.role === "STUDENT") {
    return {
      ...common,
      age: input.age,
      guardianName: input.guardianName || null,
      campusId: input.campusId,
      learningStage: input.learningStage,
      goal: input.goal,
      preferredDates: input.preferredDates as Prisma.InputJsonValue,
      ...(wechatSubscription ?? {})
    };
  }

  return {
    ...common,
    city: input.city,
    teachingYears: input.teachingYears,
    education: input.education,
    specialties: input.specialties,
    philosophy: input.philosophy,
    preferredContact: input.preferredContact,
    ...(wechatSubscription ?? {})
  };
}

type ApplicationStore = {
  findUnique: (args: {
    where: { idempotencyKey: string };
    select: { id: true; status: true };
  }) => Promise<{ id: string; status: BookingStatus } | null>;
  create: (args: {
    data: Prisma.AccountApplicationUncheckedCreateInput;
    select: { id: true; status: true };
  }) => Promise<{ id: string; status: BookingStatus }>;
};

const defaultApplicationStore: ApplicationStore = {
  findUnique: (args) => prisma.accountApplication.findUnique(args),
  create: (args) => prisma.accountApplication.create(args)
};

function hasPrismaErrorCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function createApplicationIdempotently(
  input: ApplicationSubmissionInput,
  store: ApplicationStore = defaultApplicationStore,
  getWechatSubscription?: WechatSubscriptionMetadataFactory
) {
  const lookup = {
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, status: true } as const
  };
  const existing = await store.findUnique(lookup);
  if (existing) return { application: existing, created: false } as const;

  try {
    const wechatSubscription = getWechatSubscription?.();
    const application = await store.create({
      data: toApplicationCreateData(input, wechatSubscription),
      select: lookup.select
    });
    return { application, created: true } as const;
  } catch (error) {
    if (!hasPrismaErrorCode(error, "P2002")) throw error;
    const concurrentApplication = await store.findUnique(lookup);
    if (!concurrentApplication) throw error;
    return { application: concurrentApplication, created: false } as const;
  }
}

export type ApproveApplicationInput = {
  applicationId: string;
  actorId: string;
  email: string;
  passwordMode: "GENERATED" | "MANUAL";
  password?: string;
  campusId?: string;
  teacherId?: string;
  tuitionPackageId?: string;
  teacherTitle?: string;
};

function assertTemporaryPassword(password: string | undefined): asserts password is string {
  if (!password || !/^\d{6,}$/.test(password)) {
    throw new Error("A temporary password of at least 6 digits is required.");
  }
}

export async function approveApplication(input: ApproveApplicationInput, client: PrismaClient = prisma) {
  const temporaryPassword = input.passwordMode === "GENERATED" ? generateTemporaryPassword() : input.password;
  assertTemporaryPassword(temporaryPassword);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hash(temporaryPassword, 12);
  const storedTemporaryPassword = encryptTemporaryPassword(temporaryPassword);

  const result = await runSerializableTransaction(client, async (tx) => {
    const application = await tx.accountApplication.findUnique({ where: { id: input.applicationId } });
    if (!application) throw new Error("Application not found.");
    if (application.approvedUserId || application.status === "CONFIRMED") throw new Error("Application has already been approved.");

    const user = await tx.user.create({
      data: {
        email,
        name: application.name,
        phone: application.phone,
        wechat: application.wechat,
        passwordHash,
        currentTemporaryPassword: storedTemporaryPassword,
        role: application.role === "STUDENT" ? Role.STUDENT : Role.TEACHER,
        mustChangePassword: true
      }
    });

    if (application.role === "STUDENT") {
      if (!input.teacherId || !input.tuitionPackageId || !input.campusId || application.age == null) {
        throw new Error("Student approval requires a teacher, package, campus, and age.");
      }
      const tuitionPackage = await tx.tuitionPackage.findFirst({
        where: { id: input.tuitionPackageId, teacherId: input.teacherId, isActive: true }
      });
      if (!tuitionPackage) throw new Error("The selected tuition package is unavailable for this teacher.");
      const packageHours = calculatePackageHours(tuitionPackage.lessonCount, tuitionPackage.lessonDurationMinutes);
      const studentNumber = await allocateStudentNumber(tx, input.campusId);
      const enrolledAt = new Date();

      const student = await tx.studentProfile.create({
        data: {
          userId: user.id,
          teacherId: input.teacherId,
          campusId: input.campusId,
          fullName: application.name,
          age: application.age,
          guardianName: application.guardianName,
          phone: application.phone,
          wechat: application.wechat,
          goal: application.goal,
          studentNumber,
          enrolledAt,
          totalHours: packageHours,
          remainingHours: packageHours
        }
      });

      await recordStudentLifecycleEvent(tx, {
        studentId: student.id,
        studentNumber,
        actorId: input.actorId,
        eventType: studentLifecycleEventTypes.enrolled,
        afterState: { campusId: input.campusId, enrolledAt: enrolledAt.toISOString() }
      });
      await recordStudentLifecycleEvent(tx, {
        studentId: student.id,
        studentNumber,
        actorId: input.actorId,
        eventType: studentLifecycleEventTypes.accountCreated,
        afterState: { userId: user.id }
      });

      const studentPackage = await tx.studentPackage.create({
        data: {
          studentId: student.id,
          teacherId: input.teacherId,
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
        studentId: student.id,
        studentNumber,
        actorId: input.actorId,
        eventType: studentLifecycleEventTypes.packageAssigned,
        afterState: { studentPackageId: studentPackage.id, tuitionPackageId: tuitionPackage.id }
      });
    } else {
      const slugRoot = application.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || "teacher";
      await tx.teacherProfile.create({
        data: {
          userId: user.id,
          slug: `${slugRoot}-${application.id.slice(-6)}`,
          displayName: application.name,
          title: input.teacherTitle?.trim() || "钢琴导师",
          avatarUrl: "",
          heroImageUrl: "",
          bio: application.education || "",
          philosophy: application.philosophy || "",
          specialties: application.specialties ? [application.specialties] : [],
          awards: [],
          campusId: input.campusId || null
        }
      });
    }

    const approved = await tx.accountApplication.update({
      where: { id: application.id },
      data: {
        status: "CONFIRMED",
        approvedUserId: user.id,
        approvedAt: new Date(),
        reviewedAt: new Date(),
        reviewerId: input.actorId
      }
    });

    if (application.wechatRecipientCiphertext) {
      await tx.wechatNotificationBinding.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          recipientCiphertext: application.wechatRecipientCiphertext,
          subscriptionTemplateIds: application.wechatSubscriptionTemplateIds
        },
        update: {
          recipientCiphertext: application.wechatRecipientCiphertext,
          subscriptionTemplateIds: application.wechatSubscriptionTemplateIds
        }
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "application.approve",
        entity: "AccountApplication",
        entityId: application.id,
        metadata: { role: application.role, accountEmail: email }
      }
    });

    const approvedStudent = application.role === "STUDENT"
      ? await tx.studentProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { studentNumber: true, enrolledAt: true } })
      : null;
    return {
      application: approved,
      user: { id: user.id, email: user.email, role: user.role, currentTemporaryPassword: temporaryPassword },
      studentNumber: approvedStudent?.studentNumber,
      enrolledAt: approvedStudent?.enrolledAt
    };
  });

  let emailSent = false;
  let emailTrackingAvailable = false;
  try {
    const mail = await sendAccountApprovedNotification({
      to: email,
      name: result.application.name,
      email,
      studentNumber: result.studentNumber,
      temporaryPassword,
      locale: toEmailLocale(result.application.locale)
    });
    emailSent = mail.status === "accepted";
    emailTrackingAvailable = mail.status === "accepted" && mail.trackingAvailable;
  } catch {
    console.error("Account approval email failed");
  }

  if (result.user.role === Role.STUDENT && result.studentNumber) {
    try {
      await sendAccountReadyWechat({
        approvedUserId: result.user.id,
        studentNumber: result.studentNumber,
        name: result.application.name,
        locale: result.application.locale === "en" ? "en" : "zh"
      });
    } catch {
      console.error("Account ready WeChat notification failed");
    }
  }

  return { ...result, temporaryPassword, emailSent, emailTrackingAvailable };
}

export async function permanentlyDeleteApplication(input: { applicationId: string; actorId: string; reason: string; deleteLinkedAccount: boolean }, client: PrismaClient = prisma) {
  const deleted = await client.$transaction(async (tx) => {
    const application = await tx.accountApplication.findUnique({ where: { id: input.applicationId } });
    if (!application) throw new Error("Application not found.");
    const notificationBinding = application.approvedUserId
      ? await tx.wechatNotificationBinding.findUnique({ where: { userId: application.approvedUserId } })
      : null;
    const linkedStudent = input.deleteLinkedAccount && application.approvedUserId && application.role === "STUDENT"
      ? await tx.studentProfile.findUnique({
          where: { userId: application.approvedUserId },
          select: { id: true, studentNumber: true, userId: true }
        })
      : null;
    if (input.deleteLinkedAccount && application.approvedUserId && application.role === "STUDENT" && !linkedStudent) {
      throw new Error("The approved student profile linked to this application was not found.");
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "application.delete",
        entity: "AccountApplication",
        entityId: application.id,
        metadata: { reason: input.reason, name: application.name, role: application.role, deleteLinkedAccount: input.deleteLinkedAccount }
      }
    });
    if (linkedStudent) {
      await recordStudentLifecycleEvent(tx, {
        studentId: linkedStudent.id,
        studentNumber: linkedStudent.studentNumber,
        actorId: input.actorId,
        eventType: studentLifecycleEventTypes.accountDeleted,
        beforeState: {
          userId: application.approvedUserId,
          profileUserId: linkedStudent.userId,
          linkedAccountDeleted: true
        },
        note: input.reason
      });
    }
    await tx.accountApplication.delete({ where: { id: application.id } });
    if (input.deleteLinkedAccount && application.approvedUserId) {
      if (linkedStudent) await tx.studentProfile.delete({ where: { id: linkedStudent.id } });
      await tx.user.delete({ where: { id: application.approvedUserId } });
    }
    return {
      id: application.id,
      recipient: application.email,
      name: application.name,
      studentNumber: linkedStudent?.studentNumber ?? null,
      reason: input.reason,
      locale: application.locale,
      linkedAccountDeleted: Boolean(input.deleteLinkedAccount && application.approvedUserId),
      approvedUserId: application.approvedUserId,
      notificationRecipient: application.approvedUserId && notificationBinding ? {
        id: notificationBinding.userId,
        approvedUserId: application.approvedUserId,
        grantOwner: "account" as const,
        wechatRecipientCiphertext: notificationBinding.recipientCiphertext,
        wechatSubscriptionTemplateIds: notificationBinding.subscriptionTemplateIds
      } : null
    };
  });

  let emailSent = false;
  let emailTrackingAvailable = false;
  if (deleted.recipient && deleted.linkedAccountDeleted) {
    try {
      const mail = await sendAccountDeletedNotification({
        to: deleted.recipient,
        name: deleted.name,
        reason: deleted.reason,
        locale: toEmailLocale(deleted.locale)
      });
      emailSent = mail.status === "accepted";
      emailTrackingAvailable = mail.status === "accepted" && mail.trackingAvailable;
    } catch {
      console.error("Application deletion email failed");
    }
  }

  if (deleted.linkedAccountDeleted && deleted.approvedUserId && deleted.notificationRecipient) {
    try {
      await sendAccountStatusWechatToRecipient({
        approvedUserId: deleted.approvedUserId,
        recipient: deleted.notificationRecipient,
        accountRef: deleted.studentNumber ?? undefined,
        name: deleted.name,
        reason: deleted.reason,
        locale: toEmailLocale(deleted.locale)
      });
    } catch {
      console.error("Application deletion WeChat notification failed");
    }
  }

  return { id: deleted.id, emailSent, emailTrackingAvailable };
}
