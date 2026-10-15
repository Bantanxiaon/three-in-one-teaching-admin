import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  applicationSchema,
  applicationSubmissionSchema,
  studentApplicationSchema,
  teacherApplicationSchema,
  toApplicationSubmission
} from "@/lib/application-schemas";
import type { ApplicationInput } from "@/lib/application-schemas";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { requiresLoginTurnstile } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { approveApplication, createApplicationIdempotently, permanentlyDeleteApplication } from "@/lib/application-service";
import { decryptTemporaryPassword } from "@/lib/temporary-password-vault";
import type { PrismaClient } from "@prisma/client";

const emailDependencies = vi.hoisted(() => ({
  sendAccountApprovedNotification: vi.fn().mockResolvedValue({ status: "skipped" as const, reason: "no_recipient" as const }),
  sendAccountDeletedNotification: vi.fn().mockResolvedValue({ status: "accepted" as const, providerMessageId: "email-provider-1" })
}));

const wechatDependencies = vi.hoisted(() => ({
  sendAccountReadyWechat: vi.fn().mockResolvedValue({ status: "skipped" as const, reason: "no_recipient" as const })
}));

vi.mock("@/lib/mail", () => ({
  sendAccountApprovedNotification: emailDependencies.sendAccountApprovedNotification,
  sendAccountDeletedNotification: emailDependencies.sendAccountDeletedNotification
}));

vi.mock("@/lib/wechat-notifications", () => ({
  sendAccountReadyWechat: wechatDependencies.sendAccountReadyWechat
}));

const preferredDates = [
  { date: "2099-06-28", period: "MORNING" as const },
  { date: "2099-06-29", period: "EVENING" as const }
];

const validStudent: ApplicationInput = {
  role: "STUDENT",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  turnstileToken: "verified-token",
  consent: true,
  name: "林悦",
  age: 12,
  guardianName: "林女士",
  phone: "10000000000",
  wechat: "lin-parent",
  email: "lin@example.com",
  campusId: "beijing",
  learningStage: "INTERMEDIATE",
  goal: "希望建立稳定的演奏技术与更完整的音乐表达。",
  preferredDates,
  locale: "zh" as const
};

const validTeacher = {
  role: "TEACHER" as const,
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  turnstileToken: "verified-token",
  consent: true as const,
  name: "示例教师一",
  phone: "10000000000",
  wechat: "teacher-li",
  email: "teacher@example.com",
  city: "北京",
  teachingYears: 8,
  education: "钢琴演奏专业背景，持续从事一对一钢琴教学。",
  specialties: "中级演奏、音色塑造与舞台表达",
  philosophy: "让技术最终服务于声音与表达。",
  preferredContact: "工作日下午",
  locale: "zh" as const
};

describe("application schemas", () => {
  it("allows adult applicants without a guardian and optional WeChat, while keeping the guardian required for minors", () => {
    expect(studentApplicationSchema.safeParse({ ...validStudent, age: 18, guardianName: "", wechat: "", goal: "学琴" }).success).toBe(true);
    expect(studentApplicationSchema.safeParse({ ...validStudent, age: 17, guardianName: "", wechat: "" }).success).toBe(false);
    expect(studentApplicationSchema.safeParse({ ...validStudent, goal: "学" }).success).toBe(false);
    expect(teacherApplicationSchema.safeParse({ ...validTeacher, wechat: "" }).success).toBe(true);
    expect(teacherApplicationSchema.parse({ ...validTeacher, wechat: undefined }).wechat).toBe("");
  });

  it("strips the route verification credential while preserving the valid domain submission", () => {
    const submission = toApplicationSubmission(validStudent);

    expect(submission).toEqual(applicationSubmissionSchema.parse(validStudent));
    expect(submission).not.toHaveProperty("turnstileToken");
    expect(submission).toMatchObject({
      role: "STUDENT",
      idempotencyKey: validStudent.idempotencyKey,
      name: validStudent.name,
      email: "lin@example.com",
      campusId: validStudent.campusId,
      preferredDates: validStudent.preferredDates
    });
  });

  it("accepts complete student and teacher applications", () => {
    expect(studentApplicationSchema.safeParse(validStudent).success).toBe(true);
    expect(teacherApplicationSchema.safeParse(validTeacher).success).toBe(true);
    expect(applicationSchema.safeParse(validTeacher).success).toBe(true);
  });

  it("requires a guardian for a minor student", () => {
    expect(studentApplicationSchema.safeParse({ ...validStudent, guardianName: "" }).success).toBe(false);
  });

  it("requires a student email so confirmations can reach the applicant", () => {
    expect(studentApplicationSchema.safeParse({ ...validStudent, email: "" }).success).toBe(false);
  });

  it("limits dates to three future selections", () => {
    expect(studentApplicationSchema.safeParse({ ...validStudent, preferredDates: [...preferredDates, preferredDates[0], preferredDates[1]] }).success).toBe(false);
    expect(studentApplicationSchema.safeParse({ ...validStudent, preferredDates: [{ date: "2020-01-01", period: "MORNING" }] }).success).toBe(false);
  });
});

describe("application security", () => {
  it("does not create or overwrite WeChat subscription metadata for an existing idempotency key", async () => {
    const create = vi.fn();
    const store = {
      findUnique: vi.fn().mockResolvedValue({ id: "application-1", status: "PENDING" }),
      create
    };

    const metadataFactory = vi.fn(() => ({
      wechatRecipientCiphertext: "v1.private",
      wechatSubscriptionTemplateIds: ["booking-template"],
      wechatSubscriptionUpdatedAt: new Date("2026-07-12T00:00:00.000Z")
    }));

    await expect(createApplicationIdempotently(
      toApplicationSubmission(validStudent),
      store,
      metadataFactory
    )).resolves.toMatchObject({ application: { id: "application-1" }, created: false });

    expect(create).not.toHaveBeenCalled();
    expect(metadataFactory).not.toHaveBeenCalled();
  });

  it("persists encrypted WeChat subscription metadata only when creating a new application", async () => {
    const created = { id: "application-1", status: "PENDING" as const };
    const store = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(created)
    };
    const metadata = {
      wechatRecipientCiphertext: "v1.encrypted-recipient",
      wechatSubscriptionTemplateIds: ["booking-template"],
      wechatSubscriptionUpdatedAt: new Date("2026-07-12T00:00:00.000Z")
    };

    const metadataFactory = vi.fn(() => metadata);

    await expect(createApplicationIdempotently(toApplicationSubmission(validStudent), store, metadataFactory)).resolves.toEqual({
      application: created,
      created: true
    });

    expect(metadataFactory).toHaveBeenCalledOnce();
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining(metadata)
    }));
  });

  it("generates fixed six-digit temporary passwords", () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^\d{6}$/);
    expect(password).not.toMatch(/[A-Za-z]/);
  });

  it("requires Turnstile after three login failures", () => {
    expect(requiresLoginTurnstile(2)).toBe(false);
    expect(requiresLoginTurnstile(3)).toBe(true);
  });

  it("trusts only the server-side Turnstile response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));
    const result = await verifyTurnstile("client-token", undefined, fetcher, "test-secret");
    expect(result.success).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("allows the signed local human check only outside production", async () => {
    const fetcher = vi.fn();
    const originalNodeEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "development");
    await expect(verifyTurnstile("local-human-check", undefined, fetcher, "test-secret")).resolves.toEqual({
      success: true,
      errorCodes: []
    });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  });
});

describe("student application approval contracts", () => {
  it("assigns a number and lifecycle events inside the approval transaction", () => {
    const source = readFileSync("src/lib/application-service.ts", "utf8");

    expect(source).toContain("runSerializableTransaction");
    expect(source).toContain("allocateStudentNumber");
    expect(source).toContain("studentNumber");
    expect(source).toContain("enrolledAt");
    expect(source).toContain("recordStudentLifecycleEvent");
  });

  it("allocates and records student approval lifecycle events inside its transaction", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    wechatDependencies.sendAccountReadyWechat.mockRejectedValueOnce(new Error(
      "openid-private access-token-private student@example.com 10000000000 123456"
    ));
    const lifecycleCreate = vi.fn().mockResolvedValue({ id: "event-1" });
    const studentProfileCreate = vi.fn().mockResolvedValue({ id: "student-1" });
    const studentPackageCreate = vi.fn().mockResolvedValue({ id: "student-package-1" });
    const userCreate = vi.fn().mockResolvedValue({ id: "user-1", email: "student@example.com", role: "STUDENT", currentTemporaryPassword: "123456" });
    const tx = {
      accountApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          role: "STUDENT",
          status: "PENDING",
          approvedUserId: null,
          name: "Lin Yue",
          phone: "10000000000",
          wechat: "lin-parent",
          age: 12,
          guardianName: "Ms Lin",
          goal: "Build stable technique.",
          education: null,
          philosophy: null,
          specialties: null,
          locale: "en"
        }),
        update: vi.fn().mockResolvedValue({ id: "application-1", name: "Lin Yue", locale: "en", status: "CONFIRMED" })
      },
      user: { create: userCreate },
      tuitionPackage: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tuition-1",
          teacherId: "teacher-1",
          name: "Twelve lessons",
          lessonCount: 12,
          lessonDurationMinutes: 45,
          originalUnitPriceCents: 120000,
          unitPriceCents: 108000,
          validityMonths: 6
        })
      },
      campus: { findUnique: vi.fn().mockResolvedValue({ city: "BEIJING" }) },
      studentNumberCounter: { update: vi.fn().mockResolvedValue({ lastValue: 103 }) },
      studentProfile: {
        create: studentProfileCreate,
        findUniqueOrThrow: vi.fn().mockResolvedValue({ studentNumber: "CYBJ0103", enrolledAt: new Date("2026-07-11T00:00:00.000Z") })
      },
      studentLifecycleEvent: { create: lifecycleCreate },
      studentPackage: { create: studentPackageCreate },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const transaction = vi.fn(async (operation: (store: typeof tx) => Promise<unknown>) => operation(tx));
    const client = { $transaction: transaction } as unknown as PrismaClient;

    const result = await approveApplication({
      applicationId: "application-1",
      actorId: "admin-1",
      email: "student@example.com",
      passwordMode: "MANUAL",
      password: "123456",
      campusId: "campus-bj",
      teacherId: "teacher-1",
      tuitionPackageId: "tuition-1"
    }, client);

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.campus.findUnique).toHaveBeenCalledWith({ where: { id: "campus-bj" }, select: { city: true } });
    expect(tx.studentNumberCounter.update).toHaveBeenCalledOnce();
    expect(studentProfileCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ studentNumber: "CYBJ0103" })
    }));
    expect(lifecycleCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        studentId: "student-1",
        studentNumber: "CYBJ0103",
        actorId: "admin-1",
        eventType: "ENROLLED",
        afterState: expect.objectContaining({ campusId: "campus-bj" })
      })
    });
    expect(lifecycleCreate).toHaveBeenNthCalledWith(2, {
      data: { studentId: "student-1", studentNumber: "CYBJ0103", actorId: "admin-1", eventType: "ACCOUNT_CREATED", afterState: { userId: "user-1" } }
    });
    expect(lifecycleCreate).toHaveBeenNthCalledWith(3, {
      data: {
        studentId: "student-1",
        studentNumber: "CYBJ0103",
        actorId: "admin-1",
        eventType: "PACKAGE_ASSIGNED",
        afterState: { studentPackageId: "student-package-1", tuitionPackageId: "tuition-1" }
      }
    });
    expect(emailDependencies.sendAccountApprovedNotification).toHaveBeenCalledWith(expect.objectContaining({
      email: "student@example.com",
      studentNumber: "CYBJ0103"
    }));
    const storedTemporaryPassword = userCreate.mock.calls[0][0].data.currentTemporaryPassword;
    expect(storedTemporaryPassword).not.toBe("123456");
    expect(decryptTemporaryPassword(storedTemporaryPassword)).toBe("123456");
    expect(wechatDependencies.sendAccountReadyWechat).toHaveBeenCalledWith({
      approvedUserId: "user-1",
      studentNumber: "CYBJ0103",
      name: "Lin Yue",
      locale: "en"
    });
    expect(error).toHaveBeenCalledWith("Account ready WeChat notification failed");
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/openid-private|access-token-private|student@example.com|10000000000|123456/);
    expect(result).toMatchObject({ studentNumber: "CYBJ0103", enrolledAt: new Date("2026-07-11T00:00:00.000Z") });
    error.mockRestore();
  });

  it("rejects an already approved application before creating a second account or number", async () => {
    const userCreate = vi.fn();
    const counterUpdate = vi.fn();
    const tx = {
      accountApplication: {
        findUnique: vi.fn().mockResolvedValue({ id: "application-1", approvedUserId: "user-1", status: "CONFIRMED" })
      },
      user: { create: userCreate },
      studentNumberCounter: { update: counterUpdate }
    };
    const client = {
      $transaction: vi.fn(async (operation: (store: typeof tx) => Promise<unknown>) => operation(tx))
    } as unknown as PrismaClient;

    await expect(approveApplication({
      applicationId: "application-1",
      actorId: "admin-1",
      email: "student@example.com",
      passwordMode: "MANUAL",
      password: "123456"
    }, client)).rejects.toThrow("Application has already been approved.");

    expect(userCreate).not.toHaveBeenCalled();
    expect(counterUpdate).not.toHaveBeenCalled();
  });

  it("never sends account-ready WeChat for a teacher approval", async () => {
    wechatDependencies.sendAccountReadyWechat.mockClear();
    const tx = {
      accountApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-teacher",
          role: "TEACHER",
          status: "PENDING",
          approvedUserId: null,
          name: "Teacher Li",
          phone: "10000000000",
          wechat: "teacher-li",
          education: "Conservatory",
          philosophy: "Patient teaching",
          specialties: "Classical",
          locale: "zh"
        }),
        update: vi.fn().mockResolvedValue({ id: "application-teacher", name: "Teacher Li", locale: "zh", status: "CONFIRMED" })
      },
      user: {
        create: vi.fn().mockResolvedValue({
          id: "teacher-user", email: "teacher@example.com", role: "TEACHER", currentTemporaryPassword: "123456"
        })
      },
      teacherProfile: { create: vi.fn().mockResolvedValue({ id: "teacher-profile" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const client = {
      $transaction: vi.fn(async (operation: (store: typeof tx) => Promise<unknown>) => operation(tx))
    } as unknown as PrismaClient;

    await expect(approveApplication({
      applicationId: "application-teacher",
      actorId: "admin-1",
      email: "teacher@example.com",
      passwordMode: "MANUAL",
      password: "123456",
      teacherTitle: "Piano Teacher"
    }, client)).resolves.toMatchObject({ studentNumber: undefined });

    expect(tx.teacherProfile.create).toHaveBeenCalledOnce();
    expect(wechatDependencies.sendAccountReadyWechat).not.toHaveBeenCalled();
  });
});

describe("approved application deletion lifecycle", () => {
  it("records a secret-free account deletion before removing the linked student profile and user", async () => {
    const lifecycleCreate = vi.fn().mockResolvedValue({ id: "event-1" });
    const studentDelete = vi.fn().mockResolvedValue({ id: "student-1" });
    const userDelete = vi.fn().mockResolvedValue({ id: "user-1" });
    const tx = {
      accountApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          role: "STUDENT",
          approvedUserId: "user-1",
          email: "student@example.com",
          name: "Lin Yue"
        }),
        delete: vi.fn().mockResolvedValue({ id: "application-1" })
      },
      wechatNotificationBinding: { findUnique: vi.fn().mockResolvedValue(null) },
      studentProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "student-1",
          studentNumber: "CYBJ0103",
          userId: "user-1"
        }),
        delete: studentDelete
      },
      studentLifecycleEvent: { create: lifecycleCreate },
      user: { delete: userDelete },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const transaction = vi.fn((operation: (store: typeof tx) => Promise<unknown>) => operation(tx));
    const client = { $transaction: transaction } as unknown as PrismaClient;

    await expect(permanentlyDeleteApplication({
      applicationId: "application-1",
      actorId: "admin-1",
      reason: "Duplicate approved application",
      deleteLinkedAccount: true
    }, client)).resolves.toEqual({ id: "application-1", emailSent: true });

    expect(tx.studentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true, studentNumber: true, userId: true }
    });
    expect(lifecycleCreate).toHaveBeenCalledWith({
      data: {
        studentId: "student-1",
        studentNumber: "CYBJ0103",
        actorId: "admin-1",
        eventType: "ACCOUNT_DELETED",
        beforeState: { userId: "user-1", profileUserId: "user-1", linkedAccountDeleted: true },
        note: "Duplicate approved application"
      }
    });
    expect(lifecycleCreate.mock.invocationCallOrder[0]).toBeLessThan(studentDelete.mock.invocationCallOrder[0]);
    expect(lifecycleCreate.mock.invocationCallOrder[0]).toBeLessThan(userDelete.mock.invocationCallOrder[0]);
    expect(studentDelete).toHaveBeenCalledWith({ where: { id: "student-1" } });
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(emailDependencies.sendAccountDeletedNotification).toHaveBeenCalledWith({
      to: "student@example.com",
      name: "Lin Yue",
      reason: "Duplicate approved application",
      locale: "zh"
    });
    expect(emailDependencies.sendAccountDeletedNotification.mock.invocationCallOrder[0]).toBeGreaterThan(transaction.mock.invocationCallOrder[0]);
    expect(JSON.stringify(lifecycleCreate.mock.calls[0])).not.toMatch(/name|email|phone|password/i);
  });
});
