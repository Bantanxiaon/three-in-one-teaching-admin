import type { Locale } from "@/i18n/routing";
import { formatAdminRole } from "@/lib/admin-localization";

export const lifecycleReasonLabels = {
  ADDRESS_CHANGED: { zh: "地址变更", en: "Address changed" },
  SCHEDULE_CHANGED: { zh: "时间安排变更", en: "Schedule changed" },
  TEACHER_ARRANGEMENT: { zh: "师资安排", en: "Teacher arrangement" },
  COURSE_STAGE_CHANGED: { zh: "课程阶段调整", en: "Course stage changed" },
  CLASSROOM_RESOURCE: { zh: "教室资源安排", en: "Classroom resource" },
  RECORD_CORRECTION: { zh: "档案更正", en: "Record correction" },
  OTHER: { zh: "其他", en: "Other" }
} as const;

const unknownLifecycleReasonLabels: Record<Locale, string> = {
  zh: "其他调整",
  en: "Other adjustment",
  ja: "その他の調整"
};

export function getLifecycleReasonLabel(reasonCode: string | null, locale: Locale) {
  if (!reasonCode) return null;
  return lifecycleReasonLabels[reasonCode as keyof typeof lifecycleReasonLabels]?.[locale === "zh" ? "zh" : "en"]
    ?? unknownLifecycleReasonLabels[locale];
}

export function getLifecycleActorLabel(actorName: string | null, locale: Locale, actorRole?: string | null) {
  if (actorRole === "ADMIN" || actorRole === "SUPER_ADMIN") return formatAdminRole(actorRole, locale);
  const name = actorName?.trim();
  if (name && name !== "?") return name;
  if (actorRole === "MANAGER" || actorRole === "TEACHER" || actorRole === "STUDENT") return formatAdminRole(actorRole, locale);
  return locale === "zh" ? "系统" : "System";
}

export function formatLifecycleDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatLocalDateInputValue(value: Date, timeZone?: string) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  };
  if (timeZone) options.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
