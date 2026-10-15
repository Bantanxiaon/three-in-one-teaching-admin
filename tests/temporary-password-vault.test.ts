import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptTemporaryPassword,
  encryptTemporaryPassword,
  revealTemporaryPassword
} from "@/lib/temporary-password-vault";

const testKey = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("temporary password vault", () => {
  it("encrypts with an authenticated randomized envelope", () => {
    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", testKey);

    const first = encryptTemporaryPassword("123456");
    const second = encryptTemporaryPassword("123456");

    expect(first).toMatch(/^tpv1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(first).not.toContain("123456");
    expect(second).not.toBe(first);
    expect(decryptTemporaryPassword(first)).toBe("123456");
    expect(decryptTemporaryPassword(second)).toBe("123456");
  });

  it("rejects tampered authenticated ciphertext without returning it", () => {
    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", testKey);
    const encrypted = encryptTemporaryPassword("123456");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptTemporaryPassword(tampered)).toThrow("Temporary password ciphertext is invalid.");
  });

  it("reads legacy plaintext values", () => {
    expect(decryptTemporaryPassword("654321")).toBe("654321");
  });

  it("reveals current passwords only to administrators", () => {
    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", testKey);
    const encrypted = encryptTemporaryPassword("123456");

    expect(revealTemporaryPassword(encrypted, "ADMIN")).toBe("123456");
    expect(revealTemporaryPassword(encrypted, "SUPER_ADMIN")).toBe("123456");
    expect(revealTemporaryPassword("654321", "ADMIN")).toBe("654321");
    expect(revealTemporaryPassword(encrypted, "MANAGER")).toBeNull();
    expect(revealTemporaryPassword("tpv1.not-valid", "MANAGER")).toBeNull();
    expect(revealTemporaryPassword(null, "ADMIN")).toBeNull();
  });

  it("requires a dedicated valid production key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", "");
    expect(() => encryptTemporaryPassword("123456")).toThrow(
      "TEMPORARY_PASSWORD_ENCRYPTION_KEY must be a base64-encoded 32-byte secret in production."
    );

    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", "not-base64");
    expect(() => encryptTemporaryPassword("123456")).toThrow(
      "TEMPORARY_PASSWORD_ENCRYPTION_KEY must be a base64-encoded 32-byte secret in production."
    );
  });

  it("uses an explicit fallback only outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TEMPORARY_PASSWORD_ENCRYPTION_KEY", "");

    const encrypted = encryptTemporaryPassword("123456");
    expect(decryptTemporaryPassword(encrypted)).toBe("123456");
  });
});
