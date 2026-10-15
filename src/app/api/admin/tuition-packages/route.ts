import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { tuitionPackageSchema } from "@/lib/tuition-schemas";

export async function GET() {
  try {
    await requireApiPermission("admin:read");
    const packages = await prisma.tuitionPackage.findMany({
      include: { teacher: { select: { id: true, displayName: true, slug: true } } },
      orderBy: [{ teacher: { displayName: "asc" } }, { sortOrder: "asc" }, { lessonCount: "asc" }]
    });
    return ok(packages);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("admin:write");
    const input = tuitionPackageSchema.parse(await request.json());
    const tuitionPackage = await prisma.$transaction(async (tx) => {
      const created = await tx.tuitionPackage.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "tuition-package.create",
          entity: "TuitionPackage",
          entityId: created.id,
          metadata: { teacherId: created.teacherId, name: created.name }
        }
      });
      return created;
    });
    return ok(tuitionPackage, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
