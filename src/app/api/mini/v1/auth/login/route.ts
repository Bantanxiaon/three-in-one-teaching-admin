import { handleApiError, ok } from "@/lib/api-response";
import { createMiniSession } from "@/lib/mini-session";

export async function POST(request: Request) {
  try {
    const session = await createMiniSession(await request.json(), request);
    return ok(session, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
