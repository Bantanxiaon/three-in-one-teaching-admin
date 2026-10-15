import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAnyRole, type Role } from "@/lib/rbac";
import type { Locale } from "@/i18n/routing";

export async function requireRole(locale: Locale, allowedRoles: Role[]) {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  if (session.user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }

  if (!hasAnyRole(role, allowedRoles)) redirect(`/${locale}/login`);

  return session;
}
