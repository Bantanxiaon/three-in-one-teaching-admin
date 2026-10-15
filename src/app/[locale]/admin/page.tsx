import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import type { Locale } from "@/i18n/routing";
import { formatAdminRole } from "@/lib/admin-localization";
import { adminTabs, loadAdminMetrics, loadAdminTabData, type AdminTab } from "@/lib/admin-workspace-data";
import { requireRole } from "@/lib/guards";
import { canAccess } from "@/lib/rbac";

export default async function AdminPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const session = await requireRole(locale, ["MANAGER", "ADMIN", "SUPER_ADMIN"]);
  const canManageProtectedAccounts = canAccess(session.user.role, "protected-account:manage");
  const requestedTab = typeof query.tab === "string" ? query.tab : "overview";
  const requestedAdminTab: AdminTab = adminTabs.includes(requestedTab as AdminTab) ? requestedTab as AdminTab : "overview";
  const activeTab: AdminTab = requestedAdminTab === "teacher-accounts" && !canManageProtectedAccounts ? "overview" : requestedAdminTab;

  const [metrics, tabData] = await Promise.all([
    loadAdminMetrics(),
    loadAdminTabData(activeTab, session.user.role)
  ]);

  const base = `/${locale}/admin`;
  const items = [
    { label: locale === "zh" ? "控制台" : "Command", href: base, icon: "dashboard" as const },
    { label: locale === "zh" ? "申请审核" : "Applications", href: `${base}?tab=applications`, icon: "settings" as const },
    { label: locale === "zh" ? "学员管理" : "Students", href: `${base}?tab=students`, icon: "students" as const },
    { label: locale === "zh" ? "排课" : "Schedule", href: `${base}?tab=schedule`, icon: "calendar" as const },
    { label: locale === "zh" ? "出勤核销" : "Attendance review", href: `${base}?tab=attendance`, icon: "settings" as const },
    { label: locale === "zh" ? "课价" : "Tuition", href: `${base}?tab=tuition`, icon: "practice" as const },
    ...(canManageProtectedAccounts ? [{ label: locale === "zh" ? "教师账号" : "Teacher accounts", href: `${base}?tab=teacher-accounts`, icon: "students" as const }] : []),
    { label: locale === "zh" ? "邮件状态" : "Email status", href: `${base}?tab=email`, icon: "settings" as const }
  ];

  return (
    <AdminDashboard
      locale={locale}
      name={session.user.name && session.user.name.trim() !== "?" ? session.user.name : formatAdminRole(session.user.role, locale)}
      role={formatAdminRole(session.user.role, locale)}
      items={items}
      initialTab={activeTab}
      initialTabData={tabData}
      initialMetrics={metrics}
      canManageProtectedAccounts={canManageProtectedAccounts}
    />
  );
}
