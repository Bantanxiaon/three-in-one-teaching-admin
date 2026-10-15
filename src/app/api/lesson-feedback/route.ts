import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { saveLessonFeedback } from "@/lib/lesson-feedback-service";
import { lessonFeedbackSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("lesson:write-feedback");
    const input = lessonFeedbackSchema.parse(await request.json());
    const result = await saveLessonFeedback(input, session.user.id);
    return ok(result, { status: result.saved ? 201 : 200 });
  } catch (error) { return handleApiError(error); }
}
