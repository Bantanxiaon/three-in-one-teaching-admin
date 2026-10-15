import { ApiError } from "@/lib/api-response";
import { getRedis } from "@/lib/redis";

const SHORT_LIMIT = 5;
const DAILY_LIMIT = 20;
const SHORT_TTL_SECONDS = 10 * 60;
const DAILY_TTL_SECONDS = 24 * 60 * 60;

const CONSUME_SCRIPT = `
  local priorDecision = redis.call('GET', KEYS[1])
  if priorDecision == 'allowed' then return {1, 0, 0, 0} end
  if priorDecision == 'blocked' then return {1, 1, 0, 0} end

  local shortCount = redis.call('INCR', KEYS[2])
  if shortCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end

  local dailyCount = redis.call('INCR', KEYS[3])
  if dailyCount == 1 then redis.call('EXPIRE', KEYS[3], ARGV[4]) end

  local blocked = 0
  local decision = 'allowed'
  if shortCount > tonumber(ARGV[1]) or dailyCount > tonumber(ARGV[2]) then
    blocked = 1
    decision = 'blocked'
  end

  redis.call('SET', KEYS[1], decision, 'EX', ARGV[4], 'NX')
  return {0, blocked, shortCount, dailyCount}
`;

type MiniRateLimitResult = {
  replay: boolean;
  blocked: boolean;
  shortCount: number;
  dailyCount: number;
};

type RedisEvalClient = {
  eval(
    script: string,
    keyCount: number,
    ...keysAndArguments: string[]
  ): Promise<unknown>;
};

export type MiniRateLimitStore = {
  consume(identityHash: string, idempotencyKey: string): Promise<MiniRateLimitResult>;
};

function serviceUnavailable() {
  return new ApiError(
    "SERVICE_TEMPORARILY_UNAVAILABLE",
    "Booking protection is temporarily unavailable.",
    503
  );
}

function isFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function decodeRedisResult(result: unknown): MiniRateLimitResult | null {
  if (!Array.isArray(result) || result.length !== 4) {
    return null;
  }

  const [replay, blocked, shortCount, dailyCount] = result;
  if (
    !isFlag(replay)
    || !isFlag(blocked)
    || !isNonNegativeInteger(shortCount)
    || !isNonNegativeInteger(dailyCount)
  ) {
    return null;
  }

  return {
    replay: replay === 1,
    blocked: blocked === 1,
    shortCount,
    dailyCount
  };
}

export function createRedisMiniRateLimitStore(redis: RedisEvalClient): MiniRateLimitStore {
  return {
    async consume(identityHash, idempotencyKey) {
      let rawResult: unknown;
      try {
        rawResult = await redis.eval(
          CONSUME_SCRIPT,
          3,
          `mini:submit:idempotency:${identityHash}:${idempotencyKey}`,
          `mini:submit:10m:${identityHash}`,
          `mini:submit:24h:${identityHash}`,
          String(SHORT_LIMIT),
          String(DAILY_LIMIT),
          String(SHORT_TTL_SECONDS),
          String(DAILY_TTL_SECONDS)
        );
      } catch {
        throw serviceUnavailable();
      }

      const result = decodeRedisResult(rawResult);
      if (!result) {
        throw serviceUnavailable();
      }

      return result;
    }
  };
}

type MemoryEntry = {
  count: number;
  expiresAt: number;
  decision?: "allowed" | "blocked";
};

export function createMemoryMiniRateLimitStore(now: () => number = Date.now) {
  const entries = new Map<string, MemoryEntry>();

  function getLiveEntry(key: string, timestamp: number) {
    const current = entries.get(key);
    if (!current || current.expiresAt <= timestamp) {
      entries.delete(key);
      return undefined;
    }
    return current;
  }

  function increment(key: string, ttlSeconds: number, timestamp: number) {
    const current = getLiveEntry(key, timestamp);
    if (current) {
      current.count += 1;
      return current.count;
    }

    entries.set(key, {
      count: 1,
      expiresAt: timestamp + ttlSeconds * 1_000
    });
    return 1;
  }

  const store: MiniRateLimitStore & { count(key: string): number } = {
    async consume(identityHash, idempotencyKey) {
      const timestamp = now();
      const replayKey = `mini:submit:idempotency:${identityHash}:${idempotencyKey}`;
      const priorDecision = getLiveEntry(replayKey, timestamp)?.decision;
      if (priorDecision) {
        return {
          replay: true,
          blocked: priorDecision === "blocked",
          shortCount: 0,
          dailyCount: 0
        };
      }

      const shortCount = increment(`mini:submit:10m:${identityHash}`, SHORT_TTL_SECONDS, timestamp);
      const dailyCount = increment(`mini:submit:24h:${identityHash}`, DAILY_TTL_SECONDS, timestamp);
      const blocked = shortCount > SHORT_LIMIT || dailyCount > DAILY_LIMIT;

      entries.set(replayKey, {
        count: 1,
        expiresAt: timestamp + DAILY_TTL_SECONDS * 1_000,
        decision: blocked ? "blocked" : "allowed"
      });

      return { replay: false, blocked, shortCount, dailyCount };
    },
    count(key) {
      return getLiveEntry(key, now())?.count ?? 0;
    }
  };

  return store;
}

const developmentStore = createMemoryMiniRateLimitStore();

export async function enforceMiniSubmissionLimit(
  identityHash: string,
  idempotencyKey: string,
  store?: MiniRateLimitStore
): Promise<void> {
  let activeStore = store;

  if (!activeStore) {
    const redis = getRedis();
    if (redis) {
      activeStore = createRedisMiniRateLimitStore(redis);
    } else if (process.env.NODE_ENV === "production") {
      throw serviceUnavailable();
    } else {
      activeStore = developmentStore;
    }
  }

  const result = await activeStore.consume(identityHash, idempotencyKey);
  if (result.blocked || result.shortCount > SHORT_LIMIT || result.dailyCount > DAILY_LIMIT) {
    throw new ApiError(
      "RATE_LIMITED",
      "Too many booking attempts. Please try again later.",
      429
    );
  }
}
