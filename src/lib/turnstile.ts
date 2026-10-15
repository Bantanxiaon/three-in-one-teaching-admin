import { verifyHumanChallenge } from "@/lib/human-challenge";

export type TurnstileResult = {
  success: boolean;
  errorCodes: string[];
};

export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
  fetcher: typeof fetch = fetch,
  secret = process.env.TURNSTILE_SECRET_KEY,
  humanChallengeAnswer?: number
): Promise<TurnstileResult> {
  if (token.startsWith("human-challenge:")) {
    return {
      success: verifyHumanChallenge(
        token.slice("human-challenge:".length),
        humanChallengeAnswer ?? Number.NaN,
        Date.now(),
        process.env.AUTH_SECRET ?? secret
      ),
      errorCodes: ["human-challenge"]
    };
  }

  if (token === "local-human-check" && process.env.NODE_ENV !== "production") {
    return { success: true, errorCodes: [] };
  }

  if (!token || !secret) {
    return { success: false, errorCodes: [!secret ? "missing-secret" : "missing-token"] };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body
    });
    const result = await response.json() as { success?: boolean; "error-codes"?: string[] };
    return { success: result.success === true, errorCodes: result["error-codes"] ?? [] };
  } catch {
    return { success: false, errorCodes: ["verification-unavailable"] };
  }
}
