import { handleApiError, ok } from "@/lib/api-response";
import {
  miniNotificationSubscriptionSchema,
  saveMiniNotificationSubscriptions
} from "@/lib/mini-notification-subscriptions";
import { requireMiniSession } from "@/lib/mini-session";

export async function POST(request: Request) {
  try {
    const session = await requireMiniSession(request);
    const input = miniNotificationSubscriptionSchema.parse(await request.json());
    return ok(await saveMiniNotificationSubscriptions(session.user.id, input), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
