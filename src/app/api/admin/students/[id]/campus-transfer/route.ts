import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { transferStudentCampus } from "@/lib/student-lifecycle";
import { campusTransferSchema } from "@/lib/student-lifecycle-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = campusTransferSchema.parse(await request.json());
    const result = await prisma.$transaction((tx) => transferStudentCampus({ ...input, studentId: id }, session.user.id, tx));
    return ok({
      id,
      campusId: result.campusId,
      campusName: result.campusName,
      enrolledAt: result.enrolledAt.toISOString(),
      updatedAt: result.updatedAt.toISOString()
    });
  } catch (error) { return handleApiError(error); }
}
