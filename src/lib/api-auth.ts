import { auth } from "@/lib/auth";
import { assertPermission, type Permission } from "@/lib/rbac";

export async function requireApiPermission(permission: Permission) {
  const session = await auth();
  assertPermission(session?.user?.role, permission);
  return session!;
}
