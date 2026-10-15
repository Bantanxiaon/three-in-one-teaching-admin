import { ApiError, handleApiError, ok } from "@/lib/api-response";
import { applyResendDeliveryEvent, verifyResendWebhook, type EmailDeliveryEventStore } from "@/lib/email-delivery";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new ApiError("EMAIL_WEBHOOK_NOT_CONFIGURED", "Email delivery tracking is not configured.", 503);

    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? ""
    };
    const event = verifyResendWebhook({ payload: await request.text(), headers, secret });
    const result = await applyResendDeliveryEvent(event, prisma as unknown as EmailDeliveryEventStore);
    return ok(result);
  } catch (error) {
    return handleApiError(error, { logUnknownError: () => console.error("Email delivery webhook failed") });
  }
}
