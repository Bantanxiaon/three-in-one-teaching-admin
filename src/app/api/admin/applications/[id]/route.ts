import { z } from "zod";
import { permanentlyDeleteApplication } from "@/lib/application-service";
import { requireApiPermission } from "@/lib/api-auth";
import { fail, handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({ status: z.enum(["PENDING", "REVIEWING", "DECLINED", "ARCHIVED"]), notes: z.string().trim().max(1500).optional() });
const deleteSchema = z.object({ confirmation: z.string(), reason: z.string().trim().min(4).max(500), deleteLinkedAccount: z.boolean().default(false) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = reviewSchema.parse(await request.json());
    const application = await prisma.accountApplication.update({
      where: { id },
      data: { status: input.status, reviewerNotes: input.notes, reviewerId: session.user.id, reviewedAt: new Date() }
    });
    await prisma.auditLog.create({ data: { actorId: session.user.id, action: "application.review", entity: "AccountApplication", entityId: id, metadata: { status: input.status } } });
    return ok(application);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = deleteSchema.parse(await request.json());
    if (input.confirmation !== "DELETE") return fail("DELETE_CONFIRMATION_REQUIRED", "Type DELETE to permanently remove this application.", 422);
    return ok(await permanentlyDeleteApplication({ applicationId: id, actorId: session.user.id, reason: input.reason, deleteLinkedAccount: input.deleteLinkedAccount }));
  } catch (error) {
    return handleApiError(error);
  }
}
