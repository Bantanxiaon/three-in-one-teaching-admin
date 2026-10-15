import { fail, ok } from "@/lib/api-response";
import { createHumanChallenge } from "@/lib/human-challenge";

export async function GET() {
  try {
    return ok(createHumanChallenge());
  } catch {
    return fail("HUMAN_VERIFICATION_UNAVAILABLE", "Human verification is temporarily unavailable.", 503);
  }
}
