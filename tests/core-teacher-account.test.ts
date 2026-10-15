import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  hash: vi.fn(),
  generateTemporaryPassword: vi.fn(),
  encryptTemporaryPassword: vi.fn(),
  sendAccountApprovedNotification: vi.fn(),
  sendPasswordResetNotification: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: dependencies.prisma }));
vi.mock("bcryptjs", () => ({ hash: dependencies.hash }));
vi.mock("@/lib/temporary-password", () => ({
  generateTemporaryPassword: dependencies.generateTemporaryPassword
}));
vi.mock("@/lib/temporary-password-vault", () => ({
  encryptTemporaryPassword: dependencies.encryptTemporaryPassword
}));
vi.mock("@/lib/mail", () => ({
  sendAccountApprovedNotification: dependencies.sendAccountApprovedNotification,
  sendPasswordResetNotification: dependencies.sendPasswordResetNotification
}));

import {
  CORE_TEACHER_SLUGS,
  createCoreTeacherAccount,
  resetCoreTeacherPassword,
  setTeacherAccountActive
} from "@/lib/core-teacher-account";

type TestTeacher = {
  id: string;
  slug: string;
  displayName: string;
  userId: string | null;
  isCoreTeacher: boolean;
  user: { id: string; email: string; isActive: boolean; isProtected: boolean } | null;
};

const teacher: TestTeacher = {
  id: "teacher-1",
  slug: "teacher-one",
  displayName: "Li Teacher",
  userId: null,
  isCoreTeacher: true,
  user: null
};

const safeAccountSelect = {
  id: true,
  email: true,
  isActive: true,
  isProtected: true,
  preferredLocale: true
};

function transactionStore(current: TestTeacher = teacher) {
  return {
    teacherProfile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ ...current, userId: "user-1" })
    },
    user: {
      create: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "li@example.com",
        isActive: true,
        isProtected: true
      }),
      update: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "li@example.com",
        isActive: false,
        isProtected: true
      })
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
  };
}

function useTransaction(store: ReturnType<typeof transactionStore>, order?: string[]) {
  dependencies.prisma.$transaction.mockImplementation(async (operation: (tx: typeof store) => Promise<unknown>) => {
    const result = await operation(store);
    order?.push("commit");
    return result;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.hash.mockResolvedValue("password-hash");
  dependencies.generateTemporaryPassword.mockReturnValue("654321");
  dependencies.encryptTemporaryPassword.mockReturnValue("encrypted-password");
  dependencies.sendAccountApprovedNotification.mockResolvedValue({ status: "accepted", providerMessageId: "email-provider-1", trackingAvailable: false });
  dependencies.sendPasswordResetNotification.mockResolvedValue({ status: "accepted", providerMessageId: "email-provider-1", trackingAvailable: false });
});

describe("core teacher account commands", () => {
  it("creates a protected teacher user and links the existing profile", async () => {
    const store = transactionStore();
    useTransaction(store);

    await createCoreTeacherAccount({
      teacherId: teacher.id,
      email: "LI@example.com",
      preferredLocale: "zh",
      actorId: "admin-1"
    });

    expect(CORE_TEACHER_SLUGS).toEqual(["teacher-one", "teacher-two", "teacher-three"]);
    expect(store.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "li@example.com",
        name: "Li Teacher",
        role: "TEACHER",
        mustChangePassword: true,
        isActive: true,
        isProtected: true,
        preferredLocale: "zh"
      }),
      select: safeAccountSelect
    });
    expect(store.teacherProfile.update).toHaveBeenCalledWith({
      where: { id: teacher.id },
      data: { userId: "user-1" }
    });
    expect(store.auditLog.create).toHaveBeenCalledOnce();
    expect(dependencies.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
  });

  it("rejects a slug outside the three approved core teachers", async () => {
    const store = transactionStore({ ...teacher, slug: "guest-teacher" });
    useTransaction(store);

    await expect(createCoreTeacherAccount({
      teacherId: teacher.id,
      email: "teacher@example.com",
      preferredLocale: "zh",
      actorId: "admin-1"
    })).rejects.toMatchObject({ code: "CORE_TEACHER_REQUIRED", status: 422 });
    expect(store.user.create).not.toHaveBeenCalled();
  });

  it("rejects a profile that already has a linked account", async () => {
    const store = transactionStore({
      ...teacher,
      userId: "user-existing",
      user: { id: "user-existing", email: "existing@example.com", isActive: true, isProtected: true }
    });
    useTransaction(store);

    await expect(createCoreTeacherAccount({
      teacherId: teacher.id,
      email: "teacher@example.com",
      preferredLocale: "zh",
      actorId: "admin-1"
    })).rejects.toMatchObject({ code: "TEACHER_ACCOUNT_EXISTS", status: 409 });
    expect(store.user.create).not.toHaveBeenCalled();
  });

  it("never unsets isProtected while suspending login", async () => {
    const linkedTeacher = {
      ...teacher,
      userId: "user-1",
      user: { id: "user-1", email: "li@example.com", isActive: true, isProtected: true }
    };
    const store = transactionStore(linkedTeacher);
    useTransaction(store);

    const result = await setTeacherAccountActive({
      teacherId: teacher.id,
      isActive: false,
      actorId: "admin-1"
    });

    expect(store.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
      select: safeAccountSelect
    });
    expect(JSON.stringify(store.user.update.mock.calls[0])).not.toContain('"isProtected":false');
    expect(result.user).toMatchObject({ isActive: false, isProtected: true });
  });

  it("returns one six-digit temporary password without storing plaintext", async () => {
    const order: string[] = [];
    const store = transactionStore();
    useTransaction(store, order);
    dependencies.sendAccountApprovedNotification.mockImplementation(async () => {
      order.push("mail");
      return { status: "accepted", providerMessageId: "email-provider-1", trackingAvailable: false };
    });

    const result = await createCoreTeacherAccount({
      teacherId: teacher.id,
      email: "li@example.com",
      preferredLocale: "en",
      actorId: "admin-1"
    });

    expect(result.temporaryPassword).toMatch(/^\d{6}$/);
    expect(result.emailAccepted).toBe(true);
    expect(result.emailTrackingAvailable).toBe(false);
    expect(dependencies.generateTemporaryPassword).toHaveBeenCalledOnce();
    expect(dependencies.hash).toHaveBeenCalledWith("654321", 12);
    expect(dependencies.encryptTemporaryPassword).toHaveBeenCalledWith("654321");
    const createData = store.user.create.mock.calls[0][0].data;
    expect(createData.passwordHash).toBe("password-hash");
    expect(createData.currentTemporaryPassword).toBe("encrypted-password");
    expect(JSON.stringify(createData)).not.toContain("654321");
    expect(JSON.stringify(store.auditLog.create.mock.calls[0])).not.toMatch(/654321|password-hash|encrypted-password/);
    expect(order).toEqual(["commit", "mail"]);
  });

  it("reuses one temporary password across a serializable P2034 retry", async () => {
    const firstAttempt = transactionStore();
    const secondAttempt = transactionStore();
    let attempt = 0;
    dependencies.prisma.$transaction.mockImplementation(async (
      operation: (tx: typeof firstAttempt) => Promise<unknown>,
      options: { isolationLevel: string }
    ) => {
      expect(options).toEqual({ isolationLevel: "Serializable" });
      const store = attempt === 0 ? firstAttempt : secondAttempt;
      const result = await operation(store);
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
      return result;
    });

    const result = await createCoreTeacherAccount({
      teacherId: teacher.id,
      email: "li@example.com",
      preferredLocale: "zh",
      actorId: "admin-1"
    });

    expect(dependencies.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(dependencies.generateTemporaryPassword).toHaveBeenCalledOnce();
    expect(dependencies.hash).toHaveBeenCalledOnce();
    expect(dependencies.encryptTemporaryPassword).toHaveBeenCalledOnce();
    expect(firstAttempt.user.create.mock.calls[0][0].data).toMatchObject({
      passwordHash: "password-hash",
      currentTemporaryPassword: "encrypted-password"
    });
    expect(secondAttempt.user.create.mock.calls[0][0].data).toMatchObject({
      passwordHash: "password-hash",
      currentTemporaryPassword: "encrypted-password"
    });
    expect(result.temporaryPassword).toBe("654321");
    expect(dependencies.sendAccountApprovedNotification).toHaveBeenCalledOnce();
  });

  it("resets a linked account with the same protected password flow", async () => {
    const linkedTeacher = {
      ...teacher,
      userId: "user-1",
      user: { id: "user-1", email: "li@example.com", isActive: false, isProtected: true }
    };
    const store = transactionStore(linkedTeacher);
    useTransaction(store);

    const result = await resetCoreTeacherPassword({ teacherId: teacher.id, actorId: "admin-1" });

    expect(store.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "password-hash",
        currentTemporaryPassword: "encrypted-password",
        mustChangePassword: true
      },
      select: safeAccountSelect
    });
    expect(dependencies.sendPasswordResetNotification).toHaveBeenCalledWith({
      to: "li@example.com",
      name: "Li Teacher",
      temporaryPassword: "654321",
      locale: "zh"
    });
    expect(dependencies.sendAccountApprovedNotification).not.toHaveBeenCalled();
    expect(result).toMatchObject({ temporaryPassword: "654321", emailAccepted: true, emailTrackingAvailable: false });
  });
});
