import { applicationSchema, toApplicationSubmission } from "@/lib/application-schemas";
import { createApplicationIdempotently } from "@/lib/application-service";
import { fail, handleApiError, ok } from "@/lib/api-response";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendApplicantConfirmation, sendApplicationNotification } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const webInput = applicationSchema.parse(await request.json());
    const remoteIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const verification = await verifyTurnstile(webInput.turnstileToken, remoteIp, fetch, undefined, webInput.humanChallengeAnswer);
    if (!verification.success) return fail("HUMAN_VERIFICATION_FAILED", "Please complete human verification and try again.", 403);

    const input = toApplicationSubmission(webInput);
    const result = await createApplicationIdempotently(input);
    if (result.created) {
      try {
        await sendApplicationNotification(input);
      } catch (error) {
        console.error("Application email notification failed", error instanceof Error ? error.message : "unknown");
      }
      try {
        await sendApplicantConfirmation(input);
      } catch (error) {
        console.error("Applicant confirmation email failed", error instanceof Error ? error.message : "unknown");
      }
    }

    return ok(
      { id: result.application.id, status: result.application.status },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
