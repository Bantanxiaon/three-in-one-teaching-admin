import { describe, expect, it, vi } from "vitest";
import { authorizeCredentials, isLoginBlocked } from "@/lib/credential-auth";

function dependencies(overrides: Partial<Parameters<typeof authorizeCredentials>[2]> = {}) {
  return {
    findUser: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Lin Yue",
      email: "lin@example.com",
      image: null,
      role: "STUDENT",
      mustChangePassword: true,
      isActive: true,
      passwordHash: "stored-hash"
    }),
    comparePassword: vi.fn().mockResolvedValue(true),
    getFailures: vi.fn().mockResolvedValue(0),
    recordFailure: vi.fn().mockResolvedValue(1),
    clearFailures: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("credential authorization limits", () => {
  it("blocks an account before password comparison after the failure ceiling", async () => {
    const deps = dependencies({
      getFailures: vi.fn(async (key: string) => key.startsWith("account:") ? 8 : 0)
    });

    await expect(authorizeCredentials(
      { email: "LIN@example.com", password: "123456" },
      new Request("https://chenyin.example/login", { headers: { "x-forwarded-for": "203.0.113.8" } }),
      deps
    )).resolves.toBeNull();
    expect(deps.findUser).not.toHaveBeenCalled();
    expect(deps.comparePassword).not.toHaveBeenCalled();
  });

  it("records invalid credentials against the normalized account and first forwarded address", async () => {
    const deps = dependencies({ comparePassword: vi.fn().mockResolvedValue(false) });

    await expect(authorizeCredentials(
      { email: " LIN@Example.com ", password: "654321" },
      new Request("https://chenyin.example/login", {
        headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" }
      }),
      deps
    )).resolves.toBeNull();

    expect(deps.recordFailure).toHaveBeenCalledTimes(2);
    expect(deps.recordFailure).toHaveBeenCalledWith("account:lin@example.com");
    expect(deps.recordFailure).toHaveBeenCalledWith("origin:203.0.113.8");
  });

  it("clears both failure counters after successful authentication", async () => {
    const deps = dependencies();
    const result = await authorizeCredentials(
      { email: "lin@example.com", password: "123456" },
      new Request("https://chenyin.example/login", { headers: { "x-real-ip": "198.51.100.4" } }),
      deps
    );

    expect(result).toMatchObject({ id: "user-1", email: "lin@example.com", role: "STUDENT" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(deps.clearFailures).toHaveBeenCalledTimes(2);
    expect(deps.clearFailures).toHaveBeenCalledWith("account:lin@example.com");
    expect(deps.clearFailures).toHaveBeenCalledWith("origin:198.51.100.4");
  });

  it("uses a stable unknown-origin bucket when proxy headers are absent", async () => {
    const deps = dependencies({ comparePassword: vi.fn().mockResolvedValue(false) });
    await authorizeCredentials(
      { email: "lin@example.com", password: "123456" },
      new Request("https://chenyin.example/login"),
      deps
    );
    expect(deps.recordFailure).toHaveBeenCalledWith("origin:unknown");
  });

  it("performs one dummy password comparison for a missing user before generic failure", async () => {
    const deps = dependencies({ findUser: vi.fn().mockResolvedValue(null) });

    await expect(authorizeCredentials(
      { email: "missing@example.com", password: "123456" },
      new Request("https://chenyin.example/login"),
      deps
    )).resolves.toBeNull();

    expect(deps.comparePassword).toHaveBeenCalledOnce();
    expect(deps.comparePassword).toHaveBeenCalledWith(
      "123456",
      expect.stringMatching(/^\$2[aby]\$12\$/)
    );
    expect(deps.recordFailure).toHaveBeenCalledTimes(2);
    expect(deps.clearFailures).not.toHaveBeenCalled();
  });

  it("returns the same generic failure for a suspended account with a valid password", async () => {
    const deps = dependencies({
      findUser: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Lin Yue",
        email: "lin@example.com",
        image: null,
        role: "STUDENT",
        mustChangePassword: false,
        isActive: false,
        passwordHash: "stored-hash"
      })
    });

    await expect(authorizeCredentials(
      { email: "lin@example.com", password: "123456" },
      new Request("https://chenyin.example/login"),
      deps
    )).resolves.toBeNull();
    expect(deps.comparePassword).toHaveBeenCalledOnce();
    expect(deps.comparePassword).toHaveBeenCalledWith("123456", "stored-hash");
    expect(deps.recordFailure).toHaveBeenCalledTimes(2);
    expect(deps.clearFailures).not.toHaveBeenCalled();
  });

  it("blocks at eight failures", () => {
    expect(isLoginBlocked(7)).toBe(false);
    expect(isLoginBlocked(8)).toBe(true);
  });
});
