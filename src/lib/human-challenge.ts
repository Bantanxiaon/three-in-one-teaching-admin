import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const challengeTtlMs = 5 * 60 * 1000;

function secretValue(secret = process.env.AUTH_SECRET ?? process.env.TURNSTILE_SECRET_KEY) {
  if (!secret || secret.length < 16) throw new Error("Human verification secret is not configured.");
  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string, secret?: string) {
  return createHmac("sha256", secretValue(secret)).update(payload, "utf8").digest("base64url");
}

export function createHumanChallenge(now = Date.now(), secret?: string) {
  const left = randomInt(2, 10);
  const right = randomInt(2, 10);
  const expiresAt = now + challengeTtlMs;
  const payload = `${left}.${right}.${expiresAt}.${randomBytes(12).toString("hex")}`;
  return {
    token: `${encode(payload)}.${sign(payload, secret)}`,
    question: `${left} + ${right} = ?`,
    expiresAt
  };
}

export function verifyHumanChallenge(token: string, answer: number, now = Date.now(), secret?: string) {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;
    const payload = decode(encodedPayload);
    const [leftText, rightText, expiresText] = payload.split(".");
    const left = Number(leftText);
    const right = Number(rightText);
    const expiresAt = Number(expiresText);
    if (!Number.isInteger(left) || !Number.isInteger(right) || !Number.isInteger(expiresAt) || expiresAt < now || expiresAt > now + challengeTtlMs) return false;
    const expected = sign(payload, secret);
    const actualBytes = Buffer.from(signature, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return false;
    return Number.isInteger(answer) && answer === left + right;
  } catch {
    return false;
  }
}
