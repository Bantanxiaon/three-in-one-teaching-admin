import { handleApiError, ok } from "@/lib/api-response";
import { deleteMiniSession } from "@/lib/mini-session";

export async function POST(request: Request) {
  try {
    return ok(await deleteMiniSession(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
