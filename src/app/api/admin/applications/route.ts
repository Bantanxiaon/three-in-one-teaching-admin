import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireApiPermission("admin:read");
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");
    const applications = await prisma.accountApplication.findMany({
      where: {
        role: role === "STUDENT" || role === "TEACHER" ? role : undefined,
        status: status && ["PENDING", "REVIEWING", "CONFIRMED", "DECLINED", "ARCHIVED"].includes(status) ? status as "PENDING" : undefined
      },
      include: { reviewer: { select: { id: true, name: true } }, approvedUser: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok(applications);
  } catch (error) {
    return handleApiError(error);
  }
}
