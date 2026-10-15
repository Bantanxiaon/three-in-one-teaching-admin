import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false
    });
  }

  return globalForRedis.redis;
}
