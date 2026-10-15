import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { decideAbsentLesson } from "@/lib/lesson-attendance";
import { absenceDecisionSchema } from "@/lib/lesson-attendance-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("lesson:reconcile");
    const { id } = await params;
    const input = absenceDecisionSchema.parse(await request.json());
    return ok(await decideAbsentLesson({ lessonId: id, ...input }, { userId: session.user.id }));
  } catch (error) { return handleApiError(error); }
}
