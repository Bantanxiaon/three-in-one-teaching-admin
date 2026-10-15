import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { tuitionPackageSchema, tuitionPackageUpdateSchema } from "@/lib/tuition-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = tuitionPackageUpdateSchema.parse(await request.json());
    const tuitionPackage = await prisma.$transaction(async (tx) => {
      const current = await tx.tuitionPackage.findUniqueOrThrow({ where: { id } });
      tuitionPackageSchema.parse({ ...current, ...input });
      const updated = await tx.tuitionPackage.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "tuition-package.update",
          entity: "TuitionPackage",
          entityId: id,
          metadata: { fields: Object.keys(input) }
        }
      });
      return updated;
    });
    return ok(tuitionPackage);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const deleted = await prisma.$transaction(async (tx) => {
      const tuitionPackage = await tx.tuitionPackage.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "tuition-package.delete",
          entity: "TuitionPackage",
          entityId: id,
          metadata: { teacherId: tuitionPackage.teacherId, name: tuitionPackage.name }
        }
      });
      return tuitionPackage;
    });
    return ok({ id: deleted.id });
  } catch (error) {
    return handleApiError(error);
  }
}
