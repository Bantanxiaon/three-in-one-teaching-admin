import type { Locale } from "@/i18n/routing";

type TeachingCopy = Record<Locale, string>;

const teachingStatuses: Record<string, TeachingCopy> = {
  SCHEDULED: { zh: "已排课", en: "Scheduled", ja: "予定済み" },
  COMPLETED: { zh: "已完成", en: "Completed", ja: "完了" },
  CANCELLED: { zh: "已取消", en: "Cancelled", ja: "キャンセル済み" },
  RESCHEDULED: { zh: "已调课", en: "Rescheduled", ja: "日程変更済み" },
  PENDING: { zh: "待登记", en: "Pending", ja: "未登録" },
  ATTENDED: { zh: "已出勤", en: "Attended", ja: "出席" },
  STUDENT_ABSENT: { zh: "学员缺席", en: "Student absent", ja: "生徒欠席" },
  STUDENT_LEAVE: { zh: "学员请假", en: "Student leave", ja: "生徒休暇" },
  TEACHER_ADJUSTED: { zh: "教师调整", en: "Teacher adjusted", ja: "講師都合の変更" }
};

const unknownStatus: TeachingCopy = {
  zh: "未知状态",
  en: "Unknown status",
  ja: "不明な状態"
};

const teachingApiErrors: Record<string, TeachingCopy> = {
  ATTENDANCE_STATUS_CONFLICT: {
    zh: "该课程已登记考勤，请刷新后查看。",
    en: "Attendance has already been recorded for this lesson. Refresh to view it.",
    ja: "このレッスンの出欠はすでに登録されています。更新してご確認ください。"
  },
  LESSON_NOT_OWNED: {
    zh: "只能登记本人负责课程的课堂记录。",
    en: "You can only record lessons assigned to you.",
    ja: "担当しているレッスンのみ記録できます。"
  }
};

export function formatTeachingStatus(value: string, locale: Locale) {
  return (teachingStatuses[value] ?? unknownStatus)[locale];
}

export function safeTeachingError(locale: Locale, chineseMessage: string, errorCode?: string, englishMessage = "The request could not be completed. Please try again.") {
  if (errorCode && teachingApiErrors[errorCode]) return teachingApiErrors[errorCode][locale];
  if (locale === "zh") return chineseMessage;
  if (locale === "ja") return "操作を完了できませんでした。もう一度お試しください。";
  return englishMessage;
}
