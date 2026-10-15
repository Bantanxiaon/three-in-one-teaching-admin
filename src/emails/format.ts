import type { ApplicationSubmissionInput } from "@/lib/application-schemas";
import type { EmailLocale } from "@/emails/types";

type StudentSubmission = Extract<ApplicationSubmissionInput, { role: "STUDENT" }>;

const periodLabels: Record<StudentSubmission["preferredDates"][number]["period"], string> = {
  MORNING: "\u4e0a\u5348 / Morning",
  AFTERNOON: "\u4e0b\u5348 / Afternoon",
  EVENING: "\u665a\u4e0a / Evening"
};

export function formatPreferredDates(items: StudentSubmission["preferredDates"], locale?: EmailLocale) {
  const japanesePeriodLabels = { MORNING: "午前", AFTERNOON: "午後", EVENING: "夜" } as const;
  return items.map((item) => `${item.date} ${locale === "ja" ? japanesePeriodLabels[item.period] : periodLabels[item.period]}`).join(" / ");
}

export function formatCampus(campusId: StudentSubmission["campusId"], locale?: EmailLocale) {
  if (locale === "ja") return campusId === "beijing" ? "北京校" : "広州校";
  return campusId === "beijing" ? "\u5317\u4eac / Beijing" : "\u5e7f\u5dde / Guangzhou";
}
