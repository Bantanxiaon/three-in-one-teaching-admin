import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentAdminCreateSchema, studentAdminUpdateSchema, studentDeleteSchema } from "@/lib/student-admin-schemas";

const profile = {
  name: "周宁",
  age: 11,
  phone: "10000000000",
  wechat: "zhou-guardian",
  teacherId: "cm1234567890123456789012",
  campusId: "beijing"
};

describe("student administration contracts", () => {
  it("allows a profile-only record and validates account creation choices", () => {
    expect(studentAdminCreateSchema.parse(profile).name).toBe("周宁");
    expect(studentAdminCreateSchema.parse({
      ...profile,
      email: "student@example.com",
      passwordMode: "GENERATED",
      tuitionPackageId: "tuition-li-12"
    }).passwordMode).toBe("GENERATED");

    expect(() => studentAdminCreateSchema.parse({ ...profile, tuitionPackageId: "tuition-li-12" })).toThrow();
    expect(() => studentAdminCreateSchema.parse({
      ...profile,
      email: "student@example.com",
      passwordMode: "MANUAL",
      password: "abc123"
    })).toThrow();
    expect(studentAdminCreateSchema.parse({
      ...profile,
      email: "student@example.com",
      passwordMode: "MANUAL",
      password: "123456"
    }).password).toBe("123456");
    expect(() => studentAdminCreateSchema.parse({
      ...profile,
      email: "student@example.com",
      password: "ManualPass2026!"
    })).toThrow();
    expect(() => studentAdminCreateSchema.parse({ ...profile, campusId: undefined })).toThrow();
    expect(studentAdminCreateSchema.parse({
      ...profile,
      enrolledAt: "2026-07-11T00:00:00.000Z"
    }).enrolledAt).toEqual(new Date("2026-07-11T00:00:00.000Z"));
    expect(() => studentAdminCreateSchema.parse({ ...profile, enrolledAt: null })).toThrow();
  });

  it("requires a meaningful student update", () => {
    expect(() => studentAdminUpdateSchema.parse({})).toThrow();
    expect(studentAdminUpdateSchema.parse({ phone: "10000000002" }).phone).toBe("10000000002");
    expect(() => studentAdminUpdateSchema.parse({ password: "123456" })).toThrow();
    expect(studentAdminUpdateSchema.parse({ passwordMode: "MANUAL", password: "234567" }).password).toBe("234567");
    expect(() => studentAdminUpdateSchema.parse({ passwordMode: "MANUAL", password: "23456a" })).toThrow();
    expect(() => studentAdminUpdateSchema.parse({ phone: "10000000002", enrolledAt: "2026-07-11T00:00:00.000Z" })).toThrow();
  });

  it("synchronizes account, profile, package, deletion, and audit operations transactionally", () => {
    const collection = readFileSync("src/app/api/admin/students/route.ts", "utf8");
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");
    const source = `${collection}\n${detail}`;

    expect(source).toContain("$transaction");
    expect(source).toContain("user.create");
    expect(source).toContain("studentPackage.create");
    expect(source).toContain("mustChangePassword: true");
    expect(source).toContain("currentTemporaryPassword");
    expect(source).toContain("auditLog.create");
    expect(detail).toContain('confirmation !== "DELETE"');
    expect(detail).toContain("user.delete");
    expect(detail).toContain("sendAccountDeletedNotification");
    expect(detail).toContain("include: { user:");
  });

  it("uses a selected deletion reason code instead of free-form text", () => {
    expect(studentDeleteSchema.parse({
      confirmation: "DELETE",
      reasonCode: "COURSE_COMPLETED"
    }).reasonCode).toBe("COURSE_COMPLETED");
    expect(() => studentDeleteSchema.parse({
      confirmation: "DELETE",
      reasonCode: "UNSUPPORTED"
    })).toThrow();
    expect(() => studentDeleteSchema.parse({
      confirmation: "DELETE",
      reason: "退学"
    })).toThrow();
  });

  it("assigns numbers and records lifecycle events during admin creation", () => {
    const source = readFileSync("src/app/api/admin/students/route.ts", "utf8");

    expect(source).toContain("runSerializableTransaction");
    expect(source).toContain("allocateStudentNumber");
    expect(source).toContain("studentNumber");
    expect(source).toContain("enrolledAt");
    expect(source).toContain("recordStudentLifecycleEvent");
  });

  it("guards null student numbers before making the column required", () => {
    const migration = readFileSync(
      "prisma/migrations/20260711170000_enforce_student_number_required/migration.sql",
      "utf8"
    );
    const nullGuard = migration.indexOf('WHERE "studentNumber" IS NULL');
    const requiredConstraint = migration.indexOf('ALTER COLUMN "studentNumber" SET NOT NULL');

    expect(migration).toContain("RAISE EXCEPTION");
    expect(nullGuard).toBeGreaterThan(-1);
    expect(requiredConstraint).toBeGreaterThan(-1);
    expect(nullGuard).toBeLessThan(requiredConstraint);
  });

  it("never selects private prices for the student management response", () => {
    const source = readFileSync("src/app/api/admin/students/route.ts", "utf8");
    expect(source).not.toContain("originalUnitPriceCents: true");
    expect(source).not.toContain("unitPriceCents: true");
  });

  it("preserves the existing top-level student response contract", () => {
    const source = readFileSync("src/app/api/admin/students/route.ts", "utf8");
    expect(source).toContain("return ok({ ...visibleStudent, temporaryPassword:");
    expect(source).toContain("revealStudentTemporaryPasswords([student], session.user.role)");
    expect(source).not.toContain("return ok({\n      student,");
  });

  it("clears the visible temporary password after the user sets a permanent password", () => {
    const source = readFileSync("src/app/api/account/change-password/route.ts", "utf8");
    expect(source).toContain("currentTemporaryPassword: null");
  });

  it("routes campus and enrollment changes through audited lifecycle commands", () => {
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");
    const transfer = readFileSync("src/app/api/admin/students/[id]/campus-transfer/route.ts", "utf8");
    const enrollment = readFileSync("src/app/api/admin/students/[id]/enrollment/route.ts", "utf8");
    const events = readFileSync("src/app/api/admin/students/[id]/events/route.ts", "utf8");

    expect(detail).toContain("USE_CAMPUS_TRANSFER");
    expect(detail).not.toContain("enrolledAt:");
    expect(transfer).toContain('requireApiPermission("admin:write")');
    expect(transfer).toContain("transferStudentCampus");
    expect(enrollment).toContain('requireApiPermission("admin:write")');
    expect(enrollment).toContain("correctStudentEnrollmentDate");
    expect(events).toContain('requireApiPermission("admin:read")');
    expect(events).toContain("take: 100");
    expect(events).toContain('orderBy: [{ createdAt: "desc" }, { id: "desc" }]');
    expect(events).toContain("actor: { select: { name: true, role: true } }");
  });

  it("records each generic update lifecycle event and snapshots identity before deletion", () => {
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");

    expect(detail).toContain('import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle"');
    expect(detail).toContain("studentLifecycleEventTypes.passwordReset");
    expect(detail).toContain("studentLifecycleEventTypes.teacherChanged");
    expect(detail).toContain("studentLifecycleEventTypes.packageAssigned");
    expect(detail).toContain("studentLifecycleEventTypes.profileUpdated");
    expect(detail).toContain("studentLifecycleEventTypes.accountDeleted");
    expect(detail).toContain("studentNumber: student.studentNumber");
    expect(detail.indexOf("studentLifecycleEventTypes.accountDeleted")).toBeLessThan(detail.indexOf("tx.studentProfile.delete"));
  });

  it("loads, compares, writes, and emits generic update events in one serializable transaction", () => {
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");
    const transactionStart = detail.indexOf("runSerializableTransaction(prisma, async (tx) =>");
    const currentLoad = detail.indexOf("const current = await tx.studentProfile.findUniqueOrThrow");
    const profileChanged = detail.indexOf("const profileChanged =");
    const teacherChanged = detail.indexOf("const teacherChanged =");
    const profileWrite = detail.indexOf("const updated = await tx.studentProfile.update");
    const lifecycleWrite = detail.indexOf("studentLifecycleEventTypes.profileUpdated");

    expect(detail).toContain('import { runSerializableTransaction } from "@/lib/serializable-transaction"');
    expect(transactionStart).toBeGreaterThan(-1);
    expect(currentLoad).toBeGreaterThan(transactionStart);
    expect(profileChanged).toBeGreaterThan(currentLoad);
    expect(teacherChanged).toBeGreaterThan(currentLoad);
    expect(profileWrite).toBeGreaterThan(profileChanged);
    expect(lifecycleWrite).toBeGreaterThan(profileWrite);
    expect(detail.lastIndexOf("sendPasswordResetNotification")).toBeGreaterThan(detail.indexOf("const effectiveEmail"));
  });

  it("records a secret-free password reset account-state snapshot", () => {
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");
    const passwordEvent = detail.indexOf("if (passwordHash)");
    const start = detail.indexOf("await recordStudentLifecycleEvent(tx", passwordEvent);
    const block = detail.slice(start, detail.indexOf("if (teacherChanged)", start));

    expect(block).toContain("studentLifecycleEventTypes.passwordReset");
    expect(block).toContain("studentLifecycleEventTypes.accountCreated");
    expect(block).toContain("beforeState:");
    expect(block).toContain("afterState:");
    expect(block).toContain("userId:");
    expect(block).toContain("mustChangePassword:");
    expect(block).not.toContain("passwordHash");
    expect(block).not.toContain("temporaryPassword");
  });

  it("sends account-ready WeChat only for first account creation after the transaction", () => {
    const detail = readFileSync("src/app/api/admin/students/[id]/route.ts", "utf8");
    const transactionEnd = detail.indexOf("const { student, current, temporaryPassword } = result");
    const wechatCall = detail.indexOf("await sendAccountReadyWechat");

    expect(detail).toMatch(/import\s*\{[\s\S]*?sendAccountReadyWechat[\s\S]*?\}\s*from\s*"@\/lib\/wechat-notifications"/);
    expect(wechatCall).toBeGreaterThan(transactionEnd);
    expect(detail).toContain("if (!current.userId && student.userId)");
    expect(detail).toContain("approvedUserId: student.userId");
    expect(detail).toContain("studentNumber: student.studentNumber");
    expect(detail).toContain('console.error("Manual account ready WeChat notification failed")');
    expect(detail).not.toContain("console.error(error");
  });
});
