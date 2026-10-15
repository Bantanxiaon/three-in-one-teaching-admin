import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

function getOriginCampusId(afterState: unknown) {
  if (!afterState || typeof afterState !== "object" || Array.isArray(afterState)) return null;
  const campusId = (afterState as { campusId?: unknown }).campusId;
  return typeof campusId === "string" ? campusId : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission("admin:read");
    const { id } = await params;
    const [events, enrollmentEvent] = await Promise.all([
      prisma.studentLifecycleEvent.findMany({
        where: { studentId: id },
        select: {
          id: true,
          eventType: true,
          reasonCode: true,
          beforeState: true,
          afterState: true,
          note: true,
          createdAt: true,
          actor: { select: { name: true, role: true } }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100
      }),
      prisma.studentLifecycleEvent.findFirst({
        where: { studentId: id, eventType: "ENROLLED" },
        select: { afterState: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      })
    ]);
    return ok({ events, originCampusId: getOriginCampusId(enrollmentEvent?.afterState) });
  } catch (error) { return handleApiError(error); }
}
