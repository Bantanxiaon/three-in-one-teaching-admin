import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPortalPath } from "@/lib/dashboard";
import type { Locale } from "@/i18n/routing";

export default async function PortalIndex({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  redirect(getPortalPath(session.user.role, locale, session.user.mustChangePassword));
}
