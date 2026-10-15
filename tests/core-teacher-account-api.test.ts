import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  createCoreTeacherAccount: vi.fn(),
  setTeacherAccountActive: vi.fn(),
  resetCoreTeacherPassword: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({ requireApiPermission: dependencies.requireApiPermission }));
vi.mock("@/lib/core-teacher-account", () => ({
  createCoreTeacherAccount: dependencies.createCoreTeacherAccount,
  setTeacherAccountActive: dependencies.setTeacherAccountActive,
  resetCoreTeacherPassword: dependencies.resetCoreTeacherPassword
}));

import * as accountRoute from "@/app/api/admin/teachers/[id]/account/route";

const context = { params: Promise.resolve({ id: "teacher-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.requireApiPermission.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  dependencies.createCoreTeacherAccount.mockResolvedValue({
    user: { id: "user-1", email: "li@example.com", isActive: true, isProtected: true, passwordHash: "must-not-leak", currentTemporaryPassword: "encrypted-secret" },
    teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一", userId: "user-1", biography: "future-model-field" },
    temporaryPassword: "654321",
    emailAccepted: true
  });
  dependencies.setTeacherAccountActive.mockResolvedValue({
    user: { id: "user-1", email: "li@example.com", isActive: false, isProtected: true, passwordHash: "must-not-leak" },
    teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一", userId: "user-1", biography: "future-model-field" }
  });
  dependencies.resetCoreTeacherPassword.mockResolvedValue({
    user: { id: "user-1", email: "li@example.com", isActive: true, isProtected: true, currentTemporaryPassword: "encrypted-secret" },
    teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一", userId: "user-1", biography: "future-model-field" },
    temporaryPassword: "123456",
    emailAccepted: false
  });
});

describe("core teacher account API", () => {
  it("creates an account through the unified administrator permission", async () => {
    const response = await accountRoute.POST(new Request("http://localhost/api/admin/teachers/teacher-1/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: " li@example.com " })
    }), context);

    expect(response.status).toBe(201);
    expect(dependencies.requireApiPermission).toHaveBeenCalledWith("protected-account:manage");
    expect(dependencies.createCoreTeacherAccount).toHaveBeenCalledWith({
      teacherId: "teacher-1",
      email: "li@example.com",
      preferredLocale: "zh",
      actorId: "admin-1"
    });
    const body = await response.json();
    expect(body.data).toEqual({
      teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一" },
      maskedEmail: "l***@example.com",
      isActive: true,
      isProtected: true,
      temporaryPassword: "654321",
      emailAccepted: true
    });
    expect(JSON.stringify(body)).not.toMatch(/li@example\.com|must-not-leak|encrypted-secret|future-model-field|userId|biography/);
  });

  it.each([
    ["SUSPEND", false],
    ["RESUME", true]
  ] as const)("dispatches %s without changing protection", async (action, isActive) => {
    dependencies.setTeacherAccountActive.mockResolvedValueOnce({
      user: { id: "user-1", email: "li@example.com", isActive, isProtected: true, passwordHash: "must-not-leak" },
      teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一", userId: "user-1", biography: "future-model-field" }
    });
    const response = await accountRoute.PATCH(new Request("http://localhost/api/admin/teachers/teacher-1/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    }), context);

    expect(response.status).toBe(200);
    expect(dependencies.requireApiPermission).toHaveBeenCalledWith("protected-account:manage");
    expect(dependencies.setTeacherAccountActive).toHaveBeenCalledWith({
      teacherId: "teacher-1",
      isActive,
      actorId: "admin-1"
    });
    const body = await response.json();
    expect(body.data).toEqual({
      teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一" },
      maskedEmail: "l***@example.com",
      isActive,
      isProtected: true
    });
  });

  it("dispatches RESET_PASSWORD and reports provider acceptance only", async () => {
    const response = await accountRoute.PATCH(new Request("http://localhost/api/admin/teachers/teacher-1/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_PASSWORD" })
    }), context);
    const body = await response.json();

    expect(dependencies.resetCoreTeacherPassword).toHaveBeenCalledWith({
      teacherId: "teacher-1",
      actorId: "admin-1"
    });
    expect(body.data.emailAccepted).toBe(false);
    expect(body.data).toEqual({
      teacher: { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一" },
      maskedEmail: "l***@example.com",
      isActive: true,
      isProtected: true,
      temporaryPassword: "123456",
      emailAccepted: false
    });
    expect(JSON.stringify(body)).not.toMatch(/li@example\.com|encrypted-secret|future-model-field|emailDelivered|userId|biography/);
  });

  it("does not expose a delete handler", () => {
    expect(accountRoute).not.toHaveProperty("DELETE");
  });

  it.each(["POST", "PATCH"] as const)("returns 403 before %s can expose a temporary password to MANAGER", async (method) => {
    dependencies.requireApiPermission.mockRejectedValueOnce(new Error("Missing permission: protected-account:manage"));
    const request = new Request("http://localhost/api/admin/teachers/teacher-1/account", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method === "POST" ? { email: "li@example.com" } : { action: "RESET_PASSWORD" })
    });

    const response = method === "POST"
      ? await accountRoute.POST(request, context)
      : await accountRoute.PATCH(request, context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).not.toHaveProperty("data.temporaryPassword");
    expect(dependencies.createCoreTeacherAccount).not.toHaveBeenCalled();
    expect(dependencies.setTeacherAccountActive).not.toHaveBeenCalled();
    expect(dependencies.resetCoreTeacherPassword).not.toHaveBeenCalled();
  });
});
