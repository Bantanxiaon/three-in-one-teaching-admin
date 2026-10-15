import { createHmac } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";

const WECHAT_SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const WECHAT_TIMEOUT_MS = 8_000;

const responseSchema = z.object({
  openid: z.string().min(1).optional(),
  session_key: z.string().min(1).optional(),
  errcode: z.number().optional(),
  errmsg: z.string().optional()
});

type Options = {
  appId?: string;
  appSecret?: string;
  identitySalt?: string;
  fetcher?: typeof fetch;
};

function serviceUnavailable() {
  return new ApiError(
    "WECHAT_SERVICE_UNAVAILABLE",
    "WeChat verification is temporarily unavailable.",
    503
  );
}

export async function verifyMiniProgramLogin(
  code: string,
  options: Options = {}
): Promise<{ identityHash: string; openId: string }> {
  const appId = options.appId ?? process.env.WECHAT_MINI_APP_ID;
  const appSecret = options.appSecret ?? process.env.WECHAT_MINI_APP_SECRET;
  const identitySalt = options.identitySalt ?? process.env.WECHAT_MINI_IDENTITY_SALT;
  const fetcher = options.fetcher ?? fetch;

  if (!appId || !appSecret || !identitySalt) {
    throw new ApiError(
      "MINI_PROGRAM_NOT_CONFIGURED",
      "Mini Program verification is unavailable.",
      503
    );
  }

  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: code,
    grant_type: "authorization_code"
  });

  let response: Response;
  try {
    response = await fetcher(`${WECHAT_SESSION_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(WECHAT_TIMEOUT_MS),
      cache: "no-store"
    });
  } catch {
    throw serviceUnavailable();
  }

  if (!response.ok) {
    throw serviceUnavailable();
  }

  let rawPayload: unknown;
  try {
    rawPayload = await response.json();
  } catch {
    throw serviceUnavailable();
  }

  const parsedPayload = responseSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    throw serviceUnavailable();
  }

  const payload = parsedPayload.data;
  if (payload.errcode !== undefined && payload.errcode !== 0) {
    throw new ApiError(
      "WECHAT_SESSION_INVALID",
      "Please retry WeChat verification.",
      401
    );
  }

  if (!payload.openid || !payload.session_key) {
    throw serviceUnavailable();
  }

  return {
    identityHash: createHmac("sha256", identitySalt).update(payload.openid).digest("hex"),
    openId: payload.openid
  };
}
