import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { recordLessonAttendance } from "@/lib/lesson-attendance";
import { teacherAttendanceSchema } from "@/lib/lesson-attendance-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("lesson:write-feedback");
    const { id } = await params;
    const input = teacherAttendanceSchema.parse(await request.json());
    return ok(await recordLessonAttendance({ lessonId: id, ...input }, { userId: session.user.id }));
  } catch (error) { return handleApiError(error); }
}
