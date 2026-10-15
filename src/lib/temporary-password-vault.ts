import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Role } from "@/lib/rbac";

const algorithm = "aes-256-gcm";
const prefix = "tpv1";
const developmentFallbackKey = Buffer.from(
  "7f4c2e6a1b9d8f30517263445566778899aabbccddeeff001122334455667788",
  "hex"
);
const productionKeyError =
  "TEMPORARY_PASSWORD_ENCRYPTION_KEY must be a base64-encoded 32-byte secret in production.";

function decodeConfiguredKey(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error(productionKeyError);
  }

  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64") !== normalized) {
    throw new Error(productionKeyError);
  }
  return key;
}

function getEncryptionKey() {
  const configured = process.env.TEMPORARY_PASSWORD_ENCRYPTION_KEY;
  if (configured?.trim()) return decodeConfiguredKey(configured);
  if (process.env.NODE_ENV === "production") throw new Error(productionKeyError);
  return developmentFallbackKey;
}

function decodeEnvelopePart(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid envelope");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("invalid envelope");
  return decoded;
}

export function encryptTemporaryPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(prefix));
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [prefix, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTemporaryPassword(value: string) {
  if (!value.startsWith(`${prefix}.`)) return value;

  try {
    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== prefix) throw new Error("invalid envelope");
    const iv = decodeEnvelopePart(parts[1]);
    const tag = decodeEnvelopePart(parts[2]);
    const ciphertext = decodeEnvelopePart(parts[3]);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error("invalid envelope");

    const decipher = createDecipheriv(algorithm, getEncryptionKey(), iv);
    decipher.setAAD(Buffer.from(prefix));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Temporary password ciphertext is invalid.");
  }
}

export function revealTemporaryPassword(value: string | null, role: Role) {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return null;
  return value === null ? null : decryptTemporaryPassword(value);
}

export function revealStudentTemporaryPasswords<
  T extends { user: { currentTemporaryPassword: string | null } | null }
>(students: T[], role: Role): T[] {
  return students.map((student) => {
    if (!student.user) return student;
    return {
      ...student,
      user: {
        ...student.user,
        currentTemporaryPassword: revealTemporaryPassword(student.user.currentTemporaryPassword, role)
      }
    } as T;
  });
}
