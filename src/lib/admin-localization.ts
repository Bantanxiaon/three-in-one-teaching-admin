import type { Locale } from "@/i18n/routing";

type Copy = Record<Locale, string>;

function localized(copy: Copy, locale: Locale) {
  return copy[locale] ?? copy.en;
}

const roles: Record<string, Copy> = {
  STUDENT: { zh: "学员", en: "Student", ja: "生徒" },
  TEACHER: { zh: "教师", en: "Teacher", ja: "講師" },
  MANAGER: { zh: "课程经理", en: "Manager", ja: "マネージャー" },
  ADMIN: { zh: "管理员", en: "Admin", ja: "管理者" },
  SUPER_ADMIN: { zh: "管理员", en: "Admin", ja: "管理者" }
};

const applicationStatuses: Record<string, Copy> = {
  PENDING: { zh: "待审核", en: "Pending", ja: "審査待ち" },
  REVIEWING: { zh: "审核中", en: "Reviewing", ja: "審査中" },
  CONFIRMED: { zh: "已批准", en: "Approved", ja: "承認済み" },
  DECLINED: { zh: "未通过", en: "Declined", ja: "見送り" },
  ARCHIVED: { zh: "已归档", en: "Archived", ja: "アーカイブ済み" }
};

const lessonStatuses: Record<string, Copy> = {
  SCHEDULED: { zh: "已排课", en: "Scheduled", ja: "予定済み" },
  COMPLETED: { zh: "已完成", en: "Completed", ja: "完了" },
  CANCELLED: { zh: "已取消", en: "Cancelled", ja: "キャンセル" },
  RESCHEDULED: { zh: "已调课", en: "Rescheduled", ja: "日程変更済み" }
};

const emailDeliveryStatuses: Record<string, Copy> = {
  ACCEPTED: { zh: "服务商已受理", en: "Accepted", ja: "受付済み" },
  SENT: { zh: "发送中", en: "Sent", ja: "送信済み" },
  DELAYED: { zh: "投递延迟", en: "Delayed", ja: "配信遅延" },
  DELIVERED: { zh: "已送达", en: "Delivered", ja: "配信済み" },
  BOUNCED: { zh: "已退信", en: "Bounced", ja: "不達" },
  FAILED: { zh: "发送失败", en: "Failed", ja: "送信失敗" },
  COMPLAINED: { zh: "被标记为垃圾邮件", en: "Spam complaint", ja: "迷惑メール報告" },
  SUPPRESSED: { zh: "已停止投递", en: "Suppressed", ja: "配信停止" }
};

function enumFallback(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function localizedFallback(value: string, locale: Locale, chineseFallback: string) {
  return locale === "zh" ? chineseFallback : enumFallback(value);
}

export function formatAdminRole(value: string, locale: Locale) {
  return roles[value] ? localized(roles[value], locale) : localizedFallback(value, locale, "未知身份");
}

export function formatApplicationRole(value: string, locale: Locale) {
  return formatAdminRole(value, locale);
}

export function formatApplicationStatus(value: string, locale: Locale) {
  return applicationStatuses[value] ? localized(applicationStatuses[value], locale) : localizedFallback(value, locale, "未知状态");
}

export function formatLessonStatus(value: string, locale: Locale) {
  return lessonStatuses[value] ? localized(lessonStatuses[value], locale) : localizedFallback(value, locale, "未知状态");
}

export function formatEmailDeliveryStatus(value: string, locale: Locale) {
  return emailDeliveryStatuses[value] ? localized(emailDeliveryStatuses[value], locale) : localizedFallback(value, locale, "未知状态");
}

export function formatMinutes(value: number, locale: Locale) {
  if (locale === "zh") return `${value} 分钟`;
  if (locale === "ja") return `${value}分`;
  return `${value} min`;
}

export function formatHours(value: number, locale: Locale) {
  if (locale === "zh") return `${value} 小时`;
  if (locale === "ja") return `${value}時間`;
  return `${value} h`;
}

const adminApiErrors: Record<string, Copy> = {
  TEACHER_ACCOUNT_EXISTS: {
    zh: "该教师已绑定账号，请刷新后重试。",
    en: "This teacher already has an account. Refresh and try again.",
    ja: "この講師にはすでにアカウントがあります。更新してもう一度お試しください。"
  },
  TEACHER_ACCOUNT_REQUIRED: {
    zh: "该教师尚未绑定账号，请先创建教师账号。",
    en: "This teacher does not have an account yet.",
    ja: "この講師にはまだアカウントがありません。"
  },
  CORE_TEACHER_REQUIRED: {
    zh: "仅可管理三位核心教师的账号。",
    en: "Only core teacher accounts can be managed here.",
    ja: "ここでは主要講師のアカウントのみ管理できます。"
  },
  FORBIDDEN: {
    zh: "当前账号没有执行此操作的权限。",
    en: "Your account cannot perform this action.",
    ja: "現在のアカウントにはこの操作を行う権限がありません。"
  }
};

export function safeAdminError(locale: Locale, chineseFallback: string, errorCode?: string, englishFallback = "The request could not be completed.") {
  const mapped = errorCode ? adminApiErrors[errorCode] : undefined;
  if (mapped) return localized(mapped, locale);
  if (locale === "zh") return chineseFallback;
  if (locale === "ja") return "操作を完了できませんでした。しばらくしてからもう一度お試しください。";
  return englishFallback;
}
