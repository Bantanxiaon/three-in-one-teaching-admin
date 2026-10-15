import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({ status: z.enum(["PENDING", "REVIEWING", "CONFIRMED", "DECLINED", "ARCHIVED"]), notes: z.string().trim().max(1200).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const booking = await prisma.accountApplication.update({ where: { id }, data: { status: input.status, reviewerNotes: input.notes, reviewerId: session.user.id, reviewedAt: new Date() } });
    return ok(booking);
  } catch (error) { return handleApiError(error); }
}
