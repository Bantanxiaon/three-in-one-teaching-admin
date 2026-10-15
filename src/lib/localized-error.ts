import type { Locale } from "@/i18n/routing";

type LocalizedErrorCopy = Readonly<Record<Locale, string>>;

const apiBusinessErrorCopy: Record<string, LocalizedErrorCopy> = {
  STUDENT_CHANGED: {
    zh: "学员档案已被其他人更新，请刷新后重试。",
    en: "The student record was updated by someone else. Refresh and try again.",
    ja: "生徒記録は別のユーザーによって更新されました。更新してもう一度お試しください。"
  },
  SAME_CAMPUS: {
    zh: "该学员已在当前校区。",
    en: "The student is already assigned to this campus.",
    ja: "この生徒はすでにこの校舎に所属しています。"
  },
  STUDENT_CAMPUS_REQUIRED: {
    zh: "转校前需先设置学员当前校区。",
    en: "Set the student's current campus before transferring.",
    ja: "校舎を変更する前に、生徒の現在の校舎を設定してください。"
  },
  ABSENCE_ATTENDANCE_REQUIRED: {
    zh: "请先登记缺勤记录，再进行核销。",
    en: "Record the absence before reviewing it.",
    ja: "確認する前に欠席記録を登録してください。"
  },
  ABSENCE_DECISION_NOT_ALLOWED: {
    zh: "只有学员缺席或请假记录可以核销。",
    en: "Only student absences or leave records can be reviewed.",
    ja: "生徒の欠席または休暇記録のみ確認できます。"
  },
  ABSENCE_DECISION_CONFLICT: {
    zh: "该缺勤记录已按其他决定完成核销。",
    en: "This absence was already reconciled with a different decision.",
    ja: "この欠席記録は別の決定ですでに処理されています。"
  }
};

class TrustedLocalizedError extends Error {
  constructor(readonly copy: LocalizedErrorCopy) {
    super("Trusted localized business error");
    this.name = "TrustedLocalizedError";
  }
}

class ApiErrorCodeSource extends Error {
  constructor(readonly code?: string) {
    super("API error code source");
    this.name = "ApiErrorCodeSource";
  }
}

export function apiErrorCode(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body)) return undefined;
  const error = body.error;
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code.trim() || undefined : undefined;
}

export function apiErrorSource(code: unknown) {
  return new ApiErrorCodeSource(typeof code === "string" ? code : undefined);
}

export function trustedLocalizedError(copy: LocalizedErrorCopy) {
  return new TrustedLocalizedError(copy);
}

export function safeLocalizedError(locale: Locale, fallback: LocalizedErrorCopy, source?: unknown) {
  if (source instanceof TrustedLocalizedError) return source.copy[locale];
  if (source instanceof ApiErrorCodeSource && source.code) {
    return apiBusinessErrorCopy[source.code]?.[locale] ?? fallback[locale];
  }
  return fallback[locale];
}
