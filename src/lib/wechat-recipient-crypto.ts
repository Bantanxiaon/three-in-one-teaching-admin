import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptionResult =
  | { status: "encrypted"; ciphertext: string }
  | { status: "skipped"; reason: "not_configured" };

type DecryptionResult =
  | { status: "decrypted"; openId: string }
  | { status: "skipped"; reason: "not_configured" };

const ENCRYPTION_ERROR = "WeChat recipient encryption configuration error.";
const DECRYPTION_ERROR = "WeChat recipient decryption failed.";

function encryptionKey(value: string | undefined) {
  if (!value?.trim()) return undefined;

  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error(ENCRYPTION_ERROR);
  }
  return key;
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(DECRYPTION_ERROR);
  const decoded = Buffer.from(value, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== value) throw new Error(DECRYPTION_ERROR);
  return decoded;
}

export function encryptWechatRecipient(openId: string, keyValue = process.env.WECHAT_NOTIFICATION_ENCRYPTION_KEY): EncryptionResult {
  const key = encryptionKey(keyValue);
  if (!key) return { status: "skipped", reason: "not_configured" };

  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(openId, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      status: "encrypted",
      ciphertext: `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`
    };
  } catch {
    throw new Error(ENCRYPTION_ERROR);
  }
}

export function decryptWechatRecipient(ciphertext: string, keyValue = process.env.WECHAT_NOTIFICATION_ENCRYPTION_KEY): DecryptionResult {
  const key = encryptionKey(keyValue);
  if (!key) return { status: "skipped", reason: "not_configured" };

  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 4) throw new Error(DECRYPTION_ERROR);
    const [version, ivValue, tagValue, ciphertextValue] = parts;
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error(DECRYPTION_ERROR);
    const iv = fromBase64Url(ivValue);
    const tag = fromBase64Url(tagValue);
    const encrypted = fromBase64Url(ciphertextValue);
    if (iv.length !== 12 || tag.length !== 16) throw new Error(DECRYPTION_ERROR);

    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const openId = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return { status: "decrypted", openId };
  } catch {
    throw new Error(DECRYPTION_ERROR);
  }
}
