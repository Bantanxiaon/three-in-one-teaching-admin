import type { Locale } from "@/i18n/routing";
import type { Role } from "@/lib/rbac";

export function getUtilizationRate(consumed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((consumed / total) * 100)));
}

export function formatCurrency(amountCents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    currencyDisplay: locale === "en" ? "symbol" : "narrowSymbol",
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

export function getPortalPath(role: Role, locale: Locale, mustChangePassword = false) {
  if (mustChangePassword) return `/${locale}/change-password`;
  if (role === "STUDENT") return `/${locale}/portal/student`;
  if (role === "TEACHER") return `/${locale}/portal/teacher`;
  if (["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) return `/${locale}/admin`;
  return `/${locale}`;
}
