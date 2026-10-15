import { requireApiPermission } from "@/lib/api-auth";
import { fail, handleApiError, ok } from "@/lib/api-response";
import { loadAdminMetrics } from "@/lib/admin-workspace-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireApiPermission("admin:read");
    if (session.user.mustChangePassword) return fail("PASSWORD_CHANGE_REQUIRED", "Change your password first.", 403);
    return ok(await loadAdminMetrics(), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
