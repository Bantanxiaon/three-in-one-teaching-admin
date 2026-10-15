import { Role, type Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import type { Locale } from "@/i18n/routing";
import { ApiError } from "@/lib/api-response";
import { CORE_TEACHER_SLUGS } from "@/lib/core-teacher-account-dto";
import { sendAccountApprovedNotification, sendPasswordResetNotification } from "@/lib/mail";
import { sendPasswordResetWechat } from "@/lib/wechat-notifications";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { encryptTemporaryPassword } from "@/lib/temporary-password-vault";

export { CORE_TEACHER_SLUGS } from "@/lib/core-teacher-account-dto";

type CoreTeacherSlug = (typeof CORE_TEACHER_SLUGS)[number];
type CoreTeacherAccountStore = Pick<Prisma.TransactionClient, "teacherProfile" | "user" | "auditLog">;

type CreateCoreTeacherAccountInput = {
  teacherId: string;
  email: string;
  preferredLocale: Locale;
  actorId: string;
};

type SetTeacherAccountActiveInput = {
  teacherId: string;
  isActive: boolean;
  actorId: string;
};

type ResetCoreTeacherPasswordInput = {
  teacherId: string;
  actorId: string;
};

const accountSelect = {
  id: true,
  email: true,
  isActive: true,
  isProtected: true,
  preferredLocale: true
} as const;

function toEmailLocale(locale: string): Locale {
  return locale === "en" || locale === "ja" ? locale : "zh";
}

async function findCoreTeacher(tx: CoreTeacherAccountStore, teacherId: string) {
  const teacher = await tx.teacherProfile.findUniqueOrThrow({
    where: { id: teacherId },
    include: { user: { select: accountSelect } }
  });
  if (!teacher.isCoreTeacher || !CORE_TEACHER_SLUGS.includes(teacher.slug as CoreTeacherSlug)) {
    throw new ApiError("CORE_TEACHER_REQUIRED", "Only approved core teacher profiles can receive these accounts.", 422);
  }
  return teacher;
}

function createPasswordMaterial() {
  const temporaryPassword = generateTemporaryPassword();
  if (!/^\d{6}$/.test(temporaryPassword)) {
    throw new Error("Temporary password generation must return exactly six digits.");
  }
  return { temporaryPassword };
}

async function completePasswordMaterial(temporaryPassword: string) {
  const [passwordHash, currentTemporaryPassword] = await Promise.all([
    hash(temporaryPassword, 12),
    Promise.resolve(encryptTemporaryPassword(temporaryPassword))
  ]);
  return { passwordHash, currentTemporaryPassword };
}

async function sendTemporaryPassword(
  input: { email: string; name: string; temporaryPassword: string; locale: Locale },
  notification: "ACCOUNT_APPROVED" | "PASSWORD_RESET",
  failureMessage: string
) {
  try {
    const mailInput = {
      to: input.email,
      name: input.name,
      temporaryPassword: input.temporaryPassword,
      locale: input.locale
    };
    const mail = notification === "PASSWORD_RESET"
      ? await sendPasswordResetNotification(mailInput)
      : await sendAccountApprovedNotification({ ...mailInput, email: input.email });
    return {
      accepted: mail.status === "accepted",
      trackingAvailable: mail.status === "accepted" && mail.trackingAvailable
    };
  } catch {
    console.error(failureMessage);
    return { accepted: false, trackingAvailable: false };
  }
}

export async function createCoreTeacherAccount(input: CreateCoreTeacherAccountInput) {
  const email = input.email.trim().toLowerCase();
  const { temporaryPassword } = createPasswordMaterial();
  const passwordMaterial = await completePasswordMaterial(temporaryPassword);
  const result = await runSerializableTransaction(prisma, async (tx) => {
    const teacher = await findCoreTeacher(tx, input.teacherId);
    if (teacher.userId) {
      throw new ApiError("TEACHER_ACCOUNT_EXISTS", "This teacher profile already has a linked account.", 409);
    }

    const user = await tx.user.create({
      data: {
        email,
        name: teacher.displayName,
        passwordHash: passwordMaterial.passwordHash,
        currentTemporaryPassword: passwordMaterial.currentTemporaryPassword,
        role: Role.TEACHER,
        mustChangePassword: true,
        isActive: true,
        isProtected: true,
        preferredLocale: input.preferredLocale
      },
      select: accountSelect
    });
    const updatedTeacher = await tx.teacherProfile.update({
      where: { id: teacher.id },
      data: { userId: user.id }
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "teacher.account.create",
        entity: "TeacherProfile",
        entityId: teacher.id,
        metadata: { slug: teacher.slug, userId: user.id, email, isProtected: true }
      }
    });
    return { teacher: updatedTeacher, user, name: teacher.displayName };
  });

  const emailDelivery = await sendTemporaryPassword({
    email,
    name: result.name,
    temporaryPassword,
    locale: input.preferredLocale
  }, "ACCOUNT_APPROVED", "Core teacher account email failed");
  return { teacher: result.teacher, user: result.user, temporaryPassword, emailAccepted: emailDelivery.accepted, emailTrackingAvailable: emailDelivery.trackingAvailable };
}

export async function setTeacherAccountActive(input: SetTeacherAccountActiveInput) {
  return runSerializableTransaction(prisma, async (tx) => {
    const teacher = await findCoreTeacher(tx, input.teacherId);
    if (!teacher.userId || !teacher.user) {
      throw new ApiError("TEACHER_ACCOUNT_REQUIRED", "This teacher profile does not have a linked account.", 409);
    }
    const user = await tx.user.update({
      where: { id: teacher.userId },
      data: { isActive: input.isActive },
      select: accountSelect
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.isActive ? "teacher.account.resume" : "teacher.account.suspend",
        entity: "TeacherProfile",
        entityId: teacher.id,
        metadata: { slug: teacher.slug, userId: teacher.userId, isActive: input.isActive }
      }
    });
    return { teacher, user };
  });
}

export async function resetCoreTeacherPassword(input: ResetCoreTeacherPasswordInput) {
  const { temporaryPassword } = createPasswordMaterial();
  const passwordMaterial = await completePasswordMaterial(temporaryPassword);
  const result = await runSerializableTransaction(prisma, async (tx) => {
    const teacher = await findCoreTeacher(tx, input.teacherId);
    if (!teacher.userId || !teacher.user) {
      throw new ApiError("TEACHER_ACCOUNT_REQUIRED", "This teacher profile does not have a linked account.", 409);
    }
    const user = await tx.user.update({
      where: { id: teacher.userId },
      data: {
        passwordHash: passwordMaterial.passwordHash,
        currentTemporaryPassword: passwordMaterial.currentTemporaryPassword,
        mustChangePassword: true
      },
      select: accountSelect
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "teacher.account.password_reset",
        entity: "TeacherProfile",
        entityId: teacher.id,
        metadata: { slug: teacher.slug, userId: teacher.userId, mustChangePassword: true }
      }
    });
    return {
      teacher,
      user,
      name: teacher.displayName,
      email: teacher.user.email,
      preferredLocale: teacher.user.preferredLocale
    };
  });

  const emailDelivery = await sendTemporaryPassword({
    email: result.email,
    name: result.name,
    temporaryPassword,
    locale: toEmailLocale(result.preferredLocale)
  }, "PASSWORD_RESET", "Core teacher password reset email failed");
  try {
    await sendPasswordResetWechat({
      approvedUserId: result.user.id,
      accountRef: result.teacher.slug,
      name: result.name,
      locale: toEmailLocale(result.preferredLocale)
    });
  } catch {
    console.error("Core teacher password reset WeChat notification failed");
  }
  return { teacher: result.teacher, user: result.user, temporaryPassword, emailAccepted: emailDelivery.accepted, emailTrackingAvailable: emailDelivery.trackingAvailable };
}
