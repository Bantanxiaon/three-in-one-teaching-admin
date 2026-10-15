import type Redis from "ioredis";
import { getRedis } from "@/lib/redis";

const LOGIN_FAILURE_TTL_SECONDS = 15 * 60;
const LOGIN_FAILURE_THRESHOLD = 3;
const developmentFailures = new Map<string, { count: number; expiresAt: number }>();

export function requiresLoginTurnstile(failures: number) {
  return failures >= LOGIN_FAILURE_THRESHOLD;
}

export async function getLoginFailures(identifier: string, redis: Redis | null = getRedis()) {
  const key = `login-failures:${identifier.toLowerCase()}`;
  if (redis) return Number(await redis.get(key) ?? 0);

  const current = developmentFailures.get(key);
  if (!current || current.expiresAt <= Date.now()) {
    developmentFailures.delete(key);
    return 0;
  }
  return current.count;
}

export async function recordLoginFailure(identifier: string, redis: Redis | null = getRedis()) {
  const key = `login-failures:${identifier.toLowerCase()}`;
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOGIN_FAILURE_TTL_SECONDS);
    return count;
  }

  const current = await getLoginFailures(identifier, null);
  const count = current + 1;
  developmentFailures.set(key, { count, expiresAt: Date.now() + LOGIN_FAILURE_TTL_SECONDS * 1000 });
  return count;
}

export async function clearLoginFailures(identifier: string, redis: Redis | null = getRedis()) {
  const key = `login-failures:${identifier.toLowerCase()}`;
  if (redis) await redis.del(key);
  developmentFailures.delete(key);
}
