import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyMiniProgramLogin } from "@/lib/mini-program-auth";

const options = {
  appId: "wx-test",
  appSecret: "server-secret",
  identitySalt: "hash-salt"
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Mini Program login verification", () => {
  it("exchanges the code through the official no-store jscode2session request", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      openid: "openid-1",
      session_key: "secret-session"
    }), { status: 200 }));

    await verifyMiniProgramLogin("one-time-code", { ...options, fetcher });

    expect(fetcher).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetcher.mock.calls[0];
    expect(requestUrl).toEqual(expect.any(String));
    if (typeof requestUrl !== "string") {
      throw new Error("Expected the WeChat request URL to be a string.");
    }
    const url = new URL(requestUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://api.weixin.qq.com/sns/jscode2session");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      appid: "wx-test",
      secret: "server-secret",
      js_code: "one-time-code",
      grant_type: "authorization_code"
    });
    expect(requestInit).toMatchObject({ cache: "no-store", signal: timeoutSignal });
    expect(timeout).toHaveBeenCalledWith(8_000);
  });

  it("returns the server-internal identity hash and OpenID", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      openid: "openid-1",
      session_key: "secret-session"
    }), { status: 200 }));

    const first = await verifyMiniProgramLogin("one-time-code", { ...options, fetcher });
    const second = await verifyMiniProgramLogin("another-code", { ...options, fetcher });

    expect(first).toEqual({
      identityHash: "a3829867bc24e1b40ff1625e5a9e93e7dcfdccfb42a4a4f721aeb05385a22f79",
      openId: "openid-1"
    });
    expect(second).toEqual(first);
    expect(Object.keys(first)).toEqual(["identityHash", "openId"]);
    expect(first).not.toHaveProperty("sessionKey");
  });

  it("rejects an invalid one-time code with a typed authentication error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errcode: 40029,
      errmsg: "invalid code"
    }), { status: 200 }));

    await expect(verifyMiniProgramLogin("bad-code", { ...options, fetcher })).rejects.toMatchObject({
      code: "WECHAT_SESSION_INVALID",
      status: 401
    });
  });

  it("fails with a typed service error when server configuration is missing", async () => {
    vi.stubEnv("WECHAT_MINI_APP_ID", "");
    vi.stubEnv("WECHAT_MINI_APP_SECRET", "");
    vi.stubEnv("WECHAT_MINI_IDENTITY_SALT", "");
    const fetcher = vi.fn();

    await expect(verifyMiniProgramLogin("one-time-code", { fetcher })).rejects.toMatchObject({
      code: "MINI_PROGRAM_NOT_CONFIGURED",
      status: 503
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps an upstream HTTP failure to a typed service error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("upstream unavailable", { status: 502 }));

    await expect(verifyMiniProgramLogin("one-time-code", { ...options, fetcher })).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503
    });
  });

  it("maps an upstream transport failure to a typed service error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("private transport details"));

    await expect(verifyMiniProgramLogin("one-time-code", { ...options, fetcher })).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503,
      message: "WeChat verification is temporarily unavailable."
    });
  });

  it("maps a malformed upstream response to a typed service error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(verifyMiniProgramLogin("one-time-code", { ...options, fetcher })).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503
    });
  });

  it.each([
    ["an empty object", {}],
    ["a zero errcode without required fields", { errcode: 0 }],
    ["a missing session key", { openid: "openid-1" }],
    ["a missing openid", { session_key: "secret-session" }]
  ])("maps %s envelope to a typed service error", async (_description, payload) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(verifyMiniProgramLogin("one-time-code", { ...options, fetcher })).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503,
      message: "WeChat verification is temporarily unavailable."
    });
  });

  it("accepts an explicit successful errcode with a complete session payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errcode: 0,
      openid: "openid-1",
      session_key: "secret-session"
    }), { status: 200 }));

    await expect(verifyMiniProgramLogin("one-time-code", { ...options, fetcher })).resolves.toEqual({
      identityHash: "a3829867bc24e1b40ff1625e5a9e93e7dcfdccfb42a4a4f721aeb05385a22f79",
      openId: "openid-1"
    });
  });
});
