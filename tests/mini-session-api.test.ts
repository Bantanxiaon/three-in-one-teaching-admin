import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-response";

const dependencies = vi.hoisted(() => ({
  createMiniSession: vi.fn(),
  requireMiniSession: vi.fn(),
  deleteMiniSession: vi.fn(),
}));

vi.mock("@/lib/mini-session", () => dependencies);

import { POST as login } from "@/app/api/mini/v1/auth/login/route";
import { GET as me } from "@/app/api/mini/v1/auth/me/route";
import { POST as logout } from "@/app/api/mini/v1/auth/logout/route";

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.createMiniSession.mockResolvedValue({
    token: "mini_token",
    expiresAt: "2026-08-13T00:00:00.000Z",
    user: { id: "user-1", role: "STUDENT", workspace: "student" },
  });
  dependencies.requireMiniSession.mockResolvedValue({
    token: "mini_token",
    expiresAt: "2026-08-13T00:00:00.000Z",
    user: { id: "user-1", email: "student@example.com", role: "STUDENT", workspace: "student" },
  });
  dependencies.deleteMiniSession.mockResolvedValue({ signedOut: true });
});

describe("Mini Program session API", () => {
  it("creates a no-store session without returning credential material", async () => {
    const request = new Request("https://studio.example.com/api/mini/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@example.com", password: "123456" }),
    });
    const response = await login(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dependencies.createMiniSession).toHaveBeenCalledWith({ email: "student@example.com", password: "123456" }, request);
    expect(body.data.user.workspace).toBe("student");
    expect(JSON.stringify(body)).not.toContain("123456");
  });

  it("returns the current shared account and linked profile", async () => {
    const request = new Request("https://studio.example.com/api/mini/v1/auth/me", {
      headers: { authorization: "Bearer mini_token" },
    });
    const response = await me(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dependencies.requireMiniSession).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toMatchObject({
      data: { user: { email: "student@example.com", role: "STUDENT", workspace: "student" } },
    });
  });

  it("maps an expired session to a Chinese 401 response", async () => {
    dependencies.requireMiniSession.mockRejectedValue(new ApiError("MINI_SESSION_EXPIRED", "登录状态已失效，请重新登录。", 401));
    const response = await me(new Request("https://studio.example.com/api/mini/v1/auth/me"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: "MINI_SESSION_EXPIRED", message: "登录状态已失效，请重新登录。" },
    });
  });

  it("deletes the server session on logout", async () => {
    const request = new Request("https://studio.example.com/api/mini/v1/auth/logout", {
      method: "POST",
      headers: { authorization: "Bearer mini_token" },
    });
    const response = await logout(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dependencies.deleteMiniSession).toHaveBeenCalledWith(request);
    await expect(response.json()).resolves.toEqual({ ok: true, data: { signedOut: true } });
  });
});
