import { handleApiError, ok } from "@/lib/api-response";
import { requireMiniSession } from "@/lib/mini-session";

export async function GET(request: Request) {
  try {
    const session = await requireMiniSession(request);
    return ok({ expiresAt: session.expiresAt, user: session.user }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
