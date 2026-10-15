"use client";

import { SHANGHAI_TIME_ZONE } from "@/lib/teaching-time";

import { CheckCircle2, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import type { AdminPendingAbsence } from "@/components/dashboard/admin-types";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { apiErrorCode, apiErrorSource, safeLocalizedError } from "@/lib/localized-error";
import { formatTeachingStatus } from "@/lib/teaching-localization";

const reasonLabels: Record<Locale, string[]> = {
  zh: ["监护人确认缺席", "已批准请假", "教师或校方调整", "特殊情况处理"],
  en: ["Absence confirmed by guardian", "Approved leave", "Teacher or school adjustment", "Special-case decision"],
  ja: ["保護者が欠席を確認", "承認済みの休暇", "講師または教室都合", "特別対応"]
};

type AttendanceApiResult = {
  attendance?: { lessonId?: string; reconciliationDecision?: string };
};

const decisionError = {
  zh: "出勤核销失败，请稍后重试。",
  en: "Attendance review failed. Please try again.",
  ja: "出欠確認に失敗しました。もう一度お試しください。"
} as const;

function dateLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US";
}

function matchesAttendanceResult(
  result: AttendanceApiResult,
  expectedLessonId: string,
  expectedDecision: "CONSUME" | "WAIVE"
) {
  const attendance = result.attendance;
  return attendance?.lessonId === expectedLessonId && attendance.reconciliationDecision === expectedDecision;
}

export function AttendanceReviewPanel({ locale, initialAbsences }: { locale: Locale; initialAbsences: AdminPendingAbsence[] }) {
  const [absences, setAbsences] = useState(initialAbsences);
  useEffect(() => setAbsences(initialAbsences), [initialAbsences]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pendingLessonIds, setPendingLessonIds] = useState<Record<string, true>>({});
  const [error, setError] = useState("");
  const labels = reasonLabels[locale];
  const zh = locale === "zh";

  async function decide(absence: AdminPendingAbsence, decision: "CONSUME" | "WAIVE") {
    if (pendingLessonIds[absence.lessonId]) return;
    const action = decision === "CONSUME"
      ? (zh ? "核销本节" : "Consume this lesson")
      : (zh ? "不核销" : "Waive this lesson");
    const confirmed = window.confirm(zh
      ? `确认对 ${absence.studentName} 执行“${action}”？操作会写入审计记录。`
      : `Confirm “${action}” for ${absence.studentName}? This action will be audited.`);
    if (!confirmed) return;

    setPendingLessonIds((current) => ({ ...current, [absence.lessonId]: true }));
    setError("");
    try {
      const note = reasons[absence.lessonId] ?? labels[0];
      const response = await fetch(`/api/admin/lessons/${absence.lessonId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note })
      });
      const body: unknown = await response.json();
      if (!response.ok) throw apiErrorSource(apiErrorCode(body));
      const data = body && typeof body === "object" && "data" in body ? body.data : undefined;
      if (!matchesAttendanceResult((data ?? {}) as AttendanceApiResult, absence.lessonId, decision)) {
        throw new Error(decisionError[locale]);
      }
      setAbsences((current) => current.filter((row) => row.lessonId !== absence.lessonId));
    } catch (caught: unknown) {
      setError(safeLocalizedError(locale, decisionError, caught));
    } finally {
      setPendingLessonIds((current) => {
        const next = { ...current };
        delete next[absence.lessonId];
        return next;
      });
    }
  }

  return (
    <section className="min-w-0" aria-label={zh ? "出勤核销" : "Attendance review"}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-piano/[0.08] pb-5">
        <div>
          <h2 className="text-xl font-semibold">{zh ? "出勤核销" : "Attendance review"}</h2>
          <p className="mt-1 text-sm text-piano/50">{zh ? "处理教师登记的待确认缺勤记录" : "Review absences recorded by teachers"}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-piano/50"><ShieldCheck size={15} aria-hidden="true" />{zh ? "操作将保留审计记录" : "Actions are audited"}</span>
      </header>

      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {!absences.length ? <p className="border-b border-piano/[0.07] py-12 text-center text-sm text-piano/45">{zh ? "暂无待处理缺勤记录" : "No pending absences"}</p> : null}
      <ul className="divide-y divide-piano/[0.07] border-b border-piano/[0.07]">
        {absences.map((absence) => {
          const pending = Boolean(pendingLessonIds[absence.lessonId]);
          return <li key={absence.lessonId} className="grid min-w-0 gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{absence.studentName}</h3><span className="text-xs text-piano/45">{absence.studentNumber}</span><span className="text-xs font-medium text-gold">{formatTeachingStatus(absence.attendanceStatus, locale)}</span></div>
              <p className="mt-2 text-sm text-piano/55">{new Date(absence.startsAt).toLocaleString(dateLocale(locale), { timeZone: SHANGHAI_TIME_ZONE, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="mt-1 text-xs text-piano/42">{zh ? "授课教师" : "Teacher"}: {absence.teacherName}</p>
            </div>
            <label className="grid min-w-0 gap-1.5 text-sm"><span>{zh ? "核销原因" : "Decision reason"}</span><select className="h-11 min-w-0 rounded-[8px] border border-piano/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold" value={reasons[absence.lessonId] ?? labels[0]} onChange={(event) => setReasons((current) => ({ ...current, [absence.lessonId]: event.target.value }))} disabled={pending}>{labels.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2 sm:flex lg:justify-end">
              <Button type="button" size="sm" className="min-w-0 px-3" disabled={pending} onClick={() => void decide(absence, "CONSUME")}>{pending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}{zh ? "核销本节" : "Consume"}</Button>
              <Button type="button" size="sm" variant="outline" className="min-w-0 px-3" disabled={pending} onClick={() => void decide(absence, "WAIVE")}><XCircle size={15} aria-hidden="true" />{zh ? "不核销" : "Waive"}</Button>
            </div>
          </li>;
        })}
      </ul>
    </section>
  );
}
