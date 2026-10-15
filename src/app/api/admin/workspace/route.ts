import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { fail, handleApiError, ok } from "@/lib/api-response";
import { adminTabs, loadAdminTabData, type AdminTab } from "@/lib/admin-workspace-data";
import { canAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiPermission("admin:read");
    if (session.user.mustChangePassword) return fail("PASSWORD_CHANGE_REQUIRED", "Change your password first.", 403);
    const requestedTab = request.nextUrl.searchParams.get("tab");
    if (!requestedTab || !adminTabs.includes(requestedTab as AdminTab)) {
      return fail("INVALID_TAB", "Unknown admin tab.", 400);
    }
    const tab = requestedTab as AdminTab;
    if (tab === "teacher-accounts" && !canAccess(session.user.role, "protected-account:manage")) {
      return fail("FORBIDDEN", "Missing permission.", 403);
    }
    return ok(await loadAdminTabData(tab, session.user.role), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
