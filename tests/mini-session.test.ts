import { describe, expect, it, vi } from "vitest";
import {
  MINI_SESSION_DURATION_MS,
  createMiniSession,
  deleteMiniSession,
  requireMiniSession,
  type MiniSessionDependencies,
} from "@/lib/mini-session";

const now = new Date("2026-07-14T00:00:00.000Z");
const token = `mini_${"a".repeat(43)}`;

function dependencies(overrides: Partial<MiniSessionDependencies> = {}): MiniSessionDependencies {
  return {
    now: () => now,
    createToken: () => token,
    authorize: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "晨音学员",
      email: "student@example.com",
      role: "STUDENT",
      mustChangePassword: false,
    }),
    createSession: vi.fn().mockResolvedValue(undefined),
    findSession: vi.fn().mockResolvedValue({
      sessionToken: token,
      expires: new Date(now.getTime() + MINI_SESSION_DURATION_MS),
      user: {
        id: "user-1",
        name: "晨音学员",
        email: "student@example.com",
        role: "STUDENT",
        mustChangePassword: false,
        isActive: true,
        preferredLocale: "zh",
        student: { id: "student-1", studentNumber: "CHBJ0103", fullName: "晨音学员" },
        teacher: null,
      },
    }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    pruneExpiredSessions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function authorizedRequest(path = "me") {
  return new Request(`https://studio.example.com/api/mini/v1/auth/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("Mini Program persistent sessions", () => {
  it("creates a 30-day session in the website session store", async () => {
    const deps = dependencies();
    const request = new Request("https://studio.example.com/api/mini/v1/auth/login", { method: "POST" });

    await expect(createMiniSession({ email: "student@example.com", password: "123456" }, request, deps)).resolves.toEqual({
      token,
      expiresAt: "2026-08-13T00:00:00.000Z",
      user: {
        id: "user-1",
        name: "晨音学员",
        email: "student@example.com",
        role: "STUDENT",
        mustChangePassword: false,
        workspace: "student",
      },
    });
    expect(deps.pruneExpiredSessions).toHaveBeenCalledWith("user-1", now);
    expect(deps.createSession).toHaveBeenCalledWith({
      sessionToken: token,
      userId: "user-1",
      expires: new Date("2026-08-13T00:00:00.000Z"),
    });
  });

  it("rejects invalid credentials without creating a session", async () => {
    const deps = dependencies({ authorize: vi.fn().mockResolvedValue(null) });
    const request = new Request("https://studio.example.com/api/mini/v1/auth/login", { method: "POST" });

    await expect(createMiniSession({ email: "student@example.com", password: "000000" }, request, deps)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
    });
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("restores the linked student and workspace from the shared database session", async () => {
    const deps = dependencies();

    await expect(requireMiniSession(authorizedRequest(), deps)).resolves.toMatchObject({
      token,
      user: {
        role: "STUDENT",
        workspace: "student",
        student: { studentNumber: "CHBJ0103" },
      },
    });
  });

  it("maps teacher and administrator roles to their own workspaces", async () => {
    for (const [role, workspace] of [["TEACHER", "teacher"], ["MANAGER", "admin"], ["ADMIN", "admin"], ["SUPER_ADMIN", "admin"]] as const) {
      const deps = dependencies();
      vi.mocked(deps.findSession).mockResolvedValue({
        sessionToken: token,
        expires: new Date(now.getTime() + MINI_SESSION_DURATION_MS),
        user: {
          id: "user-1",
          name: "用户",
          email: "user@example.com",
          role,
          mustChangePassword: false,
          isActive: true,
          preferredLocale: "zh",
          student: null,
          teacher: role === "TEACHER" ? { id: "teacher-1", slug: "teacher-one", displayName: "示例教师一" } : null,
        },
      });

      await expect(requireMiniSession(authorizedRequest(), deps)).resolves.toMatchObject({ user: { role, workspace } });
    }
  });

  it.each([
    ["an expired session", true, new Date(now.getTime() - 1)],
    ["a deactivated account", false, new Date(now.getTime() + MINI_SESSION_DURATION_MS)],
  ])("invalidates %s", async (_label, activeWhenExpired, expires) => {
    const deps = dependencies();
    const current = await deps.findSession(token);
    if (!current) throw new Error("Missing test session");
    vi.mocked(deps.findSession).mockResolvedValue({
      ...current,
      expires,
      user: { ...current.user, isActive: activeWhenExpired },
    });

    await expect(requireMiniSession(authorizedRequest(), deps)).rejects.toMatchObject({
      code: "MINI_SESSION_EXPIRED",
      status: 401,
    });
    expect(deps.deleteSession).toHaveBeenCalledWith(token);
  });

  it("requires a well-formed bearer token", async () => {
    const deps = dependencies();
    const request = new Request("https://studio.example.com/api/mini/v1/auth/me");

    await expect(requireMiniSession(request, deps)).rejects.toMatchObject({
      code: "MINI_SESSION_REQUIRED",
      status: 401,
    });
    expect(deps.findSession).not.toHaveBeenCalled();
  });

  it("removes the same shared session on logout", async () => {
    const deps = dependencies();

    await expect(deleteMiniSession(authorizedRequest("logout"), deps)).resolves.toEqual({ signedOut: true });
    expect(deps.deleteSession).toHaveBeenCalledWith(token);
  });
});
