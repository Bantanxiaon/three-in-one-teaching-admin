import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { correctStudentEnrollmentDate } from "@/lib/student-lifecycle";
import { enrollmentCorrectionSchema } from "@/lib/student-lifecycle-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = enrollmentCorrectionSchema.parse(await request.json());
    const result = await prisma.$transaction((tx) => correctStudentEnrollmentDate({ ...input, studentId: id }, session.user.id, tx));
    return ok({
      id,
      campusId: result.campusId,
      campusName: result.campusName,
      enrolledAt: result.enrolledAt.toISOString(),
      updatedAt: result.updatedAt.toISOString()
    });
  } catch (error) { return handleApiError(error); }
}
