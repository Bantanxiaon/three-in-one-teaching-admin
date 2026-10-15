import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryMiniRateLimitStore,
  createRedisMiniRateLimitStore,
  enforceMiniSubmissionLimit
} from "@/lib/mini-program-rate-limit";

type EvalCommand = (
  script: string,
  keyCount: number,
  ...keysAndArguments: string[]
) => Promise<unknown>;

function createRedisStoreWithResult(result: unknown) {
  const evalCommand = vi.fn<EvalCommand>().mockResolvedValue(result);
  return {
    evalCommand,
    store: createRedisMiniRateLimitStore({ eval: evalCommand })
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Mini Program submission rate limiting", () => {
  it("does not count an allowed retry with the same idempotency key twice", async () => {
    const store = createMemoryMiniRateLimitStore();

    await enforceMiniSubmissionLimit("identity", "same-key", store);
    await expect(enforceMiniSubmissionLimit("identity", "same-key", store)).resolves.toBeUndefined();

    expect(store.count("mini:submit:10m:identity")).toBe(1);
    expect(store.count("mini:submit:24h:identity")).toBe(1);
  });

  it("blocks the sixth unique request inside ten minutes", async () => {
    const store = createMemoryMiniRateLimitStore();

    for (let index = 0; index < 5; index += 1) {
      await enforceMiniSubmissionLimit("identity", `key-${index}`, store);
    }

    await expect(enforceMiniSubmissionLimit("identity", "key-5", store)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429
    });
  });

  it("replays a blocked idempotency key as blocked without incrementing counters", async () => {
    const store = createMemoryMiniRateLimitStore();
    for (let index = 0; index < 5; index += 1) {
      await enforceMiniSubmissionLimit("identity", `key-${index}`, store);
    }

    await expect(enforceMiniSubmissionLimit("identity", "blocked-key", store)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
    expect(store.count("mini:submit:10m:identity")).toBe(6);
    expect(store.count("mini:submit:24h:identity")).toBe(6);

    await expect(enforceMiniSubmissionLimit("identity", "blocked-key", store)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
    expect(store.count("mini:submit:10m:identity")).toBe(6);
    expect(store.count("mini:submit:24h:identity")).toBe(6);
  });

  it("blocks the twenty-first unique request inside twenty-four hours", async () => {
    let now = 0;
    const store = createMemoryMiniRateLimitStore(() => now);

    for (let index = 0; index < 20; index += 1) {
      await enforceMiniSubmissionLimit("identity", `key-${index}`, store);
      now += 600_001;
    }

    await expect(enforceMiniSubmissionLimit("identity", "key-20", store)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429
    });
    expect(store.count("mini:submit:10m:identity")).toBe(1);
    expect(store.count("mini:submit:24h:identity")).toBe(21);
  });

  it("keeps the short-window expiry fixed to the first request", async () => {
    let now = 0;
    const store = createMemoryMiniRateLimitStore(() => now);
    for (let index = 0; index < 5; index += 1) {
      await enforceMiniSubmissionLimit("identity", `key-${index}`, store);
      now += 100_000;
    }

    now = 599_999;
    await expect(enforceMiniSubmissionLimit("identity", "blocked-key", store)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });

    now = 600_001;
    await expect(enforceMiniSubmissionLimit("identity", "after-expiry", store)).resolves.toBeUndefined();
    expect(store.count("mini:submit:10m:identity")).toBe(1);
    expect(store.count("mini:submit:24h:identity")).toBe(7);
  });

  it("resets daily counters and idempotency decisions after twenty-four hours", async () => {
    let now = 0;
    const store = createMemoryMiniRateLimitStore(() => now);
    for (let index = 0; index < 5; index += 1) {
      await enforceMiniSubmissionLimit("identity", `key-${index}`, store);
    }
    await expect(enforceMiniSubmissionLimit("identity", "blocked-key", store)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });

    now = 86_400_001;
    await expect(enforceMiniSubmissionLimit("identity", "blocked-key", store)).resolves.toBeUndefined();
    expect(store.count("mini:submit:10m:identity")).toBe(1);
    expect(store.count("mini:submit:24h:identity")).toBe(1);
  });

  it("passes Redis keys and arguments in the Lua contract order", async () => {
    const { evalCommand, store } = createRedisStoreWithResult([0, 0, 1, 1]);

    await expect(store.consume("identity", "request-key")).resolves.toEqual({
      replay: false,
      blocked: false,
      shortCount: 1,
      dailyCount: 1
    });

    expect(evalCommand).toHaveBeenCalledOnce();
    const call = evalCommand.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) {
      throw new Error("Expected Redis eval to be called.");
    }
    const [script, keyCount, ...keysAndArguments] = call;
    expect(script).toContain("redis.call('GET', KEYS[1])");
    expect(script).toContain("redis.call('INCR', KEYS[2])");
    expect(script).toContain("redis.call('INCR', KEYS[3])");
    expect(script).toContain("redis.call('SET', KEYS[1]");
    expect(keyCount).toBe(3);
    expect(keysAndArguments).toEqual([
      "mini:submit:idempotency:identity:request-key",
      "mini:submit:10m:identity",
      "mini:submit:24h:identity",
      "5",
      "20",
      "600",
      "86400"
    ]);
  });

  it.each([
    {
      description: "allowed replay",
      tuple: [1, 0, 0, 0],
      expected: { replay: true, blocked: false, shortCount: 0, dailyCount: 0 }
    },
    {
      description: "blocked replay",
      tuple: [1, 1, 0, 0],
      expected: { replay: true, blocked: true, shortCount: 0, dailyCount: 0 }
    }
  ])("decodes a Redis $description decision", async ({ tuple, expected }) => {
    const { store } = createRedisStoreWithResult(tuple);

    await expect(store.consume("identity", "request-key")).resolves.toEqual(expected);
  });

  it.each([
    ["empty tuple", []],
    ["wrong tuple length", [0, 0, 1]],
    ["invalid replay flag", [2, 0, 1, 1]],
    ["invalid blocked flag", [0, -1, 1, 1]],
    ["negative count", [0, 0, -1, 1]],
    ["fractional count", [0, 0, 1, 1.5]],
    ["NaN count", [0, 0, Number.NaN, 1]]
  ])("fails closed for a Redis %s", async (_description, tuple) => {
    const { store } = createRedisStoreWithResult(tuple);

    await expect(store.consume("identity", "request-key")).rejects.toMatchObject({
      code: "SERVICE_TEMPORARILY_UNAVAILABLE",
      status: 503,
      message: "Booking protection is temporarily unavailable."
    });
  });

  it("normalizes Redis transport errors without exposing driver details", async () => {
    const evalCommand = vi.fn<EvalCommand>().mockRejectedValue(
      new Error("private Redis driver connection details")
    );
    const store = createRedisMiniRateLimitStore({ eval: evalCommand });

    await expect(store.consume("identity", "request-key")).rejects.toMatchObject({
      code: "SERVICE_TEMPORARILY_UNAVAILABLE",
      status: 503,
      message: "Booking protection is temporarily unavailable."
    });
  });

  it("fails closed in production when Redis is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "");

    await expect(enforceMiniSubmissionLimit("identity", "request-key")).rejects.toMatchObject({
      code: "SERVICE_TEMPORARILY_UNAVAILABLE",
      status: 503
    });
  });
});
