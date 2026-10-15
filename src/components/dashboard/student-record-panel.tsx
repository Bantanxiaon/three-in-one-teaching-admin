"use client";

import { SHANGHAI_TIME_ZONE } from "@/lib/teaching-time";

import { ArrowRight, CalendarDays, History, Landmark, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AdminCampus, AdminStudent, StudentLifecycleEventView } from "@/components/dashboard/admin-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { apiErrorCode, apiErrorSource, safeLocalizedError } from "@/lib/localized-error";
import { formatTeachingStatus } from "@/lib/teaching-localization";
import {
  formatLocalDateInputValue,
  formatLifecycleDateTime,
  getLifecycleActorLabel,
  getLifecycleReasonLabel,
  lifecycleReasonLabels
} from "@/lib/student-lifecycle-view";
import {
  parseStudentRecordPatch,
  runStudentRecordMutation,
  type StudentRecordPatch
} from "@/lib/student-record-mutation";

const eventLabels: Record<string, { zh: string; en: string }> = {
  ENROLLED: { zh: "完成入学", en: "Enrolled" },
  ENROLLMENT_DATE_CHANGED: { zh: "更正入学日期", en: "Enrollment date corrected" },
  CAMPUS_TRANSFERRED: { zh: "校区转移", en: "Campus transferred" },
  TEACHER_CHANGED: { zh: "调整教师", en: "Teacher changed" },
  PROFILE_UPDATED: { zh: "更新档案", en: "Profile updated" },
  PACKAGE_ASSIGNED: { zh: "分配课包", en: "Package assigned" },
  LESSON_SCHEDULED: { zh: "安排课程", en: "Lesson scheduled" },
  LESSON_UPDATED: { zh: "更新课程", en: "Lesson updated" },
  LESSON_COMPLETED: { zh: "完成课程", en: "Lesson completed" },
  LESSON_CANCELLED: { zh: "取消课程", en: "Lesson cancelled" },
  LESSON_REVERSED: { zh: "撤销课程", en: "Lesson reversed" },
  ACCOUNT_CREATED: { zh: "创建账户", en: "Account created" },
  PASSWORD_RESET: { zh: "重置密码", en: "Password reset" },
  ACCOUNT_DELETED: { zh: "删除账户", en: "Account deleted" },
  ATTENDANCE_RECORDED: { zh: "登记出勤", en: "Attendance recorded" },
  ABSENCE_DECIDED: { zh: "完成缺勤核销", en: "Absence reviewed" }
};

const stateLabels: Record<string, { zh: string; en: string }> = {
  campusName: { zh: "校区", en: "Campus" },
  enrolledAt: { zh: "入学日期", en: "Enrollment date" },
  teacherName: { zh: "教师", en: "Teacher" },
  lessonId: { zh: "课程", en: "Lesson" },
  status: { zh: "出勤结果", en: "Attendance" },
  reconciliationDecision: { zh: "核销结果", en: "Review decision" },
  decision: { zh: "核销结果", en: "Review decision" }
};

const decisionLabels: Record<string, { zh: string; en: string }> = {
  PENDING: { zh: "待处理", en: "Pending" },
  CONSUME: { zh: "核销本节", en: "Consumed" },
  WAIVE: { zh: "不核销", en: "Waived" }
};

const growthRecordError = {
  zh: "学员成长记录加载失败，请稍后重试。",
  en: "Unable to load student growth records.",
  ja: "生徒の成長記録を読み込めませんでした。もう一度お試しください。"
} as const;

const transferError = {
  zh: "转校操作失败，请稍后重试。",
  en: "Campus transfer failed. Please try again.",
  ja: "校舎変更に失敗しました。もう一度お試しください。"
} as const;

const enrollmentError = {
  zh: "入学日期更正失败，请稍后重试。",
  en: "Enrollment correction failed. Please try again.",
  ja: "入学日の修正に失敗しました。もう一度お試しください。"
} as const;

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeZone: SHANGHAI_TIME_ZONE }).format(new Date(value));
}

function EventState({ state, locale }: { state: Record<string, unknown> | null; locale: Locale }) {
  if (!state) return null;
  const entries = Object.entries(state).filter(([, value]) => value != null && value !== "");
  if (!entries.length) return null;

  return <div className="grid gap-1 text-xs text-piano/55">{entries.map(([key, value]) => {
    const language = locale === "zh" ? "zh" : "en";
    const label = stateLabels[key]?.[language] ?? (locale === "zh" ? "记录信息" : key);
    const display = key === "status" && typeof value === "string"
      ? formatTeachingStatus(value, locale)
      : (key === "decision" || key === "reconciliationDecision") && typeof value === "string"
        ? decisionLabels[value]?.[language] ?? (locale === "zh" ? "未知结果" : value)
        : key.endsWith("At") && typeof value === "string" ? formatDate(value, locale) : String(value);
    return <p key={key}><span className="font-medium text-piano/70">{label}</span>: {display}</p>;
  })}</div>;
}

export function StudentRecordPanel({
  student,
  campuses,
  locale,
  open,
  onOpenChange,
  onStudentChanged
}: {
  student: AdminStudent | null;
  campuses: AdminCampus[];
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentChanged: (patch: StudentRecordPatch) => void;
}) {
  const [events, setEvents] = useState<StudentLifecycleEventView[]>([]);
  const [eventsIdentity, setEventsIdentity] = useState<string | null>(null);
  const [originCampusId, setOriginCampusId] = useState<string | null>(null);
  const [originCampusIdentity, setOriginCampusIdentity] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState("");
  const [eventsErrorIdentity, setEventsErrorIdentity] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [reasonCode, setReasonCode] = useState<keyof typeof lifecycleReasonLabels>("ADDRESS_CHANGED");
  const [enrollmentDate, setEnrollmentDate] = useState("");
  const [commandMessage, setCommandMessage] = useState("");
  const [pendingMutations, setPendingMutations] = useState<Record<string, "transfer" | "enrollment">>({});
  const activeRecordRef = useRef<string | null>(null);
  const mutationKeysRef = useRef(new Set<string>());
  const studentId = student?.id ?? null;
  const studentCampusId = student?.campusId ?? "";
  const studentEnrolledAt = student?.enrolledAt ?? "";
  const studentUpdatedAt = student?.updatedAt ?? "";
  const requestIdentity = open && studentId ? `${studentId}:${studentUpdatedAt}` : null;
  const submitting = studentId ? pendingMutations[studentId] ?? null : null;

  const selectedCampus = useMemo(
    () => campuses.find((campus) => campus.id === selectedCampusId),
    [campuses, selectedCampusId]
  );
  const timelineEvents = eventsIdentity === requestIdentity ? events : [];
  const timelineError = eventsErrorIdentity === requestIdentity ? eventsError : "";
  const originCampusName = useMemo(
    () => originCampusIdentity === requestIdentity ? campuses.find((campus) => campus.id === originCampusId)?.name ?? "-" : "-",
    [campuses, originCampusId, originCampusIdentity, requestIdentity]
  );

  useEffect(() => {
    activeRecordRef.current = requestIdentity;
    setEvents([]);
    setEventsIdentity(requestIdentity);
    setOriginCampusId(null);
    setOriginCampusIdentity(requestIdentity);
    setEventsError("");
    setEventsErrorIdentity(requestIdentity);
    setEventsLoading(false);
    if (!studentId || !open) return;
    setSelectedCampusId(campuses.find((campus) => campus.id !== studentCampusId)?.id ?? "");
    setEnrollmentDate(dateInputValue(studentEnrolledAt));
    setCommandMessage("");
    return () => {
      if (activeRecordRef.current === requestIdentity) activeRecordRef.current = null;
    };
  }, [campuses, open, requestIdentity, studentCampusId, studentEnrolledAt, studentId]);

  useEffect(() => {
    if (!studentId || !open || !requestIdentity) return;
    const controller = new AbortController();
    const isCurrentRequest = () => !controller.signal.aborted && activeRecordRef.current === requestIdentity;
    setEventsLoading(true);
    setEvents([]);
    setEventsIdentity(requestIdentity);
    setOriginCampusId(null);
    setOriginCampusIdentity(requestIdentity);
    setEventsError("");
    setEventsErrorIdentity(requestIdentity);

    void (async () => {
      try {
        const response = await fetch(`/api/admin/students/${studentId}/events`, { signal: controller.signal });
        const body: unknown = await response.json();
        if (!isCurrentRequest()) return;
        if (!response.ok) throw apiErrorSource(apiErrorCode(body));
        if (!body || typeof body !== "object" || !("data" in body) || !body.data || typeof body.data !== "object") {
          throw new Error("Invalid student growth record response");
        }
        const data = body.data as { events?: unknown; originCampusId?: unknown };
        setEvents(Array.isArray(data.events) ? data.events as StudentLifecycleEventView[] : []);
        setEventsIdentity(requestIdentity);
        setOriginCampusId(typeof data.originCampusId === "string" ? data.originCampusId : null);
        setOriginCampusIdentity(requestIdentity);
      } catch (error: unknown) {
        if (isCurrentRequest()) {
          setEventsError(safeLocalizedError(locale, growthRecordError, error));
          setEventsErrorIdentity(requestIdentity);
        }
      } finally {
        if (isCurrentRequest()) setEventsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [locale, open, requestIdentity, studentId]);

  if (!student) return null;

  async function transferCampus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student || !selectedCampus || selectedCampus.id === student.campusId || !requestIdentity) return;
    const form = new FormData(event.currentTarget);
    const targetStudent = student;
    const targetCampus = selectedCampus;
    const isCurrentCommand = () => activeRecordRef.current === requestIdentity;
    setCommandMessage("");
    const result = await runStudentRecordMutation({
      studentId: targetStudent.id,
      inFlight: mutationKeysRef.current,
      onPendingChange: (pending) => setPendingMutations((current) => {
        if (pending) return { ...current, [targetStudent.id]: "transfer" };
        const next = { ...current };
        delete next[targetStudent.id];
        return next;
      }),
      execute: async () => {
        const response = await fetch(`/api/admin/students/${targetStudent.id}/campus-transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campusId: targetCampus.id,
            reasonCode,
            note: String(form.get("note") || "") || undefined,
            expectedUpdatedAt: targetStudent.updatedAt
          })
        });
        const body: unknown = await response.json();
        if (!response.ok) throw apiErrorSource(apiErrorCode(body));
        if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Invalid student record response");
        return parseStudentRecordPatch(body.data);
      },
      onCommitted: onStudentChanged
    });
    if (result.status === "failed" && isCurrentCommand()) {
      setCommandMessage(safeLocalizedError(locale, transferError, result.error));
    }
  }

  async function correctEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student || !enrollmentDate || !requestIdentity) return;
    const targetStudent = student;
    const targetEnrollmentDate = enrollmentDate;
    const isCurrentCommand = () => activeRecordRef.current === requestIdentity;
    setCommandMessage("");
    const result = await runStudentRecordMutation({
      studentId: targetStudent.id,
      inFlight: mutationKeysRef.current,
      onPendingChange: (pending) => setPendingMutations((current) => {
        if (pending) return { ...current, [targetStudent.id]: "enrollment" };
        const next = { ...current };
        delete next[targetStudent.id];
        return next;
      }),
      execute: async () => {
        const response = await fetch(`/api/admin/students/${targetStudent.id}/enrollment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrolledAt: new Date(`${targetEnrollmentDate}T00:00:00.000Z`).toISOString(),
            expectedUpdatedAt: targetStudent.updatedAt
          })
        });
        const body: unknown = await response.json();
        if (!response.ok) throw apiErrorSource(apiErrorCode(body));
        if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Invalid student record response");
        return parseStudentRecordPatch(body.data);
      },
      onCommitted: onStudentChanged
    });
    if (result.status === "failed" && isCurrentCommand()) {
      setCommandMessage(safeLocalizedError(locale, enrollmentError, result.error));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      activeRecordRef.current = null;
      setEvents([]);
      setEventsError("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent closeLabel={locale === "zh" ? "关闭学员成长记录" : "Close student growth record"} className="w-[calc(100vw-24px)] max-w-none max-h-[calc(100vh-24px)] overflow-y-auto rounded-[20px] border border-white/70 bg-white/88 p-5 shadow-[0_28px_90px_rgba(5,5,5,0.22)] backdrop-blur-[28px] sm:max-w-3xl sm:p-7">
        <DialogTitle>{locale === "zh" ? "学员档案与成长记录" : "Student profile and growth record"}</DialogTitle>
        <DialogDescription className="mt-1 pr-10">{locale === "zh" ? "档案修改将保留可追溯的学员成长记录。" : "Record corrections are preserved in the student growth record."}</DialogDescription>

        <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label={locale === "zh" ? "学员档案" : "Student record"}>
          <div className="border-b border-piano/10 pb-3"><p className="text-xs text-piano/45">{locale === "zh" ? "学员编号" : "Student number"}</p><p className="mt-1 font-medium">{student.studentNumber}</p></div>
          <div className="border-b border-piano/10 pb-3"><p className="text-xs text-piano/45">{locale === "zh" ? "入学日期" : "Enrollment date"}</p><p className="mt-1 font-medium">{formatDate(student.enrolledAt, locale)}</p></div>
          <div className="border-b border-piano/10 pb-3"><p className="text-xs text-piano/45">{locale === "zh" ? "原始校区" : "Origin campus"}</p><p className="mt-1 font-medium">{originCampusName}</p></div>
          <div className="border-b border-piano/10 pb-3"><p className="text-xs text-piano/45">{locale === "zh" ? "当前校区" : "Current campus"}</p><p className="mt-1 font-medium">{student.campusName}</p></div>
        </section>

        <section className="mt-6 grid gap-6 border-t border-piano/10 pt-6 lg:grid-cols-2">
          <form onSubmit={transferCampus} className="grid gap-3">
            <div className="flex items-center gap-2"><Landmark size={16} aria-hidden="true" /><h3 className="font-medium">{locale === "zh" ? "转移校区" : "Transfer campus"}</h3></div>
            <label className="grid gap-1 text-sm"><span>{locale === "zh" ? "目标校区" : "Destination campus"}</span><select value={selectedCampusId} onChange={(event) => setSelectedCampusId(event.target.value)} className="h-12 rounded-full border border-piano/15 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold">{campuses.filter((campus) => campus.id !== student.campusId).map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span>{locale === "zh" ? "转移原因" : "Transfer reason"}</span><select name="reasonCode" value={reasonCode} onChange={(event) => setReasonCode(event.target.value as keyof typeof lifecycleReasonLabels)} className="h-12 rounded-full border border-piano/15 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold">{Object.entries(lifecycleReasonLabels).map(([code, label]) => <option key={code} value={code}>{label[locale === "zh" ? "zh" : "en"]}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span>{locale === "zh" ? "备注（可选）" : "Note (optional)"}</span><textarea name="note" maxLength={500} className="min-h-24 resize-y rounded-[14px] border border-piano/15 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold" /></label>
            <p className="flex items-center gap-2 text-sm text-piano/55">{student.campusName} <ArrowRight size={14} aria-hidden="true" /> {selectedCampus?.name ?? "-"}</p>
            <Button type="submit" size="sm" className="justify-self-start" disabled={!selectedCampus || submitting !== null}>{submitting === "transfer" ? <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{locale === "zh" ? "确认转移" : "Confirm transfer"}</Button>
          </form>

          <form onSubmit={correctEnrollment} className="grid content-start gap-3">
            <div className="flex items-center gap-2"><CalendarDays size={16} aria-hidden="true" /><h3 className="font-medium">{locale === "zh" ? "更正入学日期" : "Correct enrollment date"}</h3></div>
            <label className="grid gap-1 text-sm"><span>{locale === "zh" ? "入学日期" : "Enrollment date"}</span><Input type="date" value={enrollmentDate} max={formatLocalDateInputValue(new Date())} onChange={(event) => setEnrollmentDate(event.target.value)} required /></label>
            <Button type="submit" size="sm" variant="outline" className="justify-self-start" disabled={!enrollmentDate || submitting !== null}>{submitting === "enrollment" ? <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{locale === "zh" ? "保存更正" : "Save correction"}</Button>
          </form>
        </section>

        {commandMessage ? <p role="status" className="mt-4 text-sm text-piano/60">{commandMessage}</p> : null}

        <section className="mt-6 border-t border-piano/10 pt-6" aria-label={locale === "zh" ? "学员成长记录" : "Student growth record"}>
          <div className="flex items-center gap-2"><History size={16} aria-hidden="true" /><h3 className="font-medium">{locale === "zh" ? "学员成长记录" : "Student growth record"}</h3></div>
          {eventsLoading ? <p className="mt-3 text-sm text-piano/55">{locale === "zh" ? "正在加载成长记录..." : "Loading growth record..."}</p> : null}
          {timelineError ? <p role="alert" className="mt-3 text-sm text-red-700">{timelineError}</p> : null}
          {!eventsLoading && !timelineError && !timelineEvents.length ? <p className="mt-3 text-sm text-piano/55">{locale === "zh" ? "暂无学员成长记录。" : "No student growth records yet."}</p> : null}
          <ol className="mt-3 grid gap-3">{timelineEvents.map((item) => {
            const label = eventLabels[item.eventType] ?? { zh: "记录更新", en: item.eventType };
            const actor = getLifecycleActorLabel(item.actor?.name ?? null, locale, item.actor?.role);
            const reason = getLifecycleReasonLabel(item.reasonCode, locale);
            return <li key={item.id} className="border-l-2 border-gold/50 pl-3"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-sm font-medium">{label[locale === "zh" ? "zh" : "en"]}</p><time className="text-xs text-piano/45" dateTime={item.createdAt}>{formatLifecycleDateTime(item.createdAt, locale)}</time></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-piano/50"><p><span className="font-medium text-piano/65">{locale === "zh" ? "操作人" : "Actor"}</span>: {actor}</p>{reason ? <p><span className="font-medium text-piano/65">{locale === "zh" ? "原因" : "Reason"}</span>: {reason}</p> : null}</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><EventState state={item.beforeState} locale={locale} /><EventState state={item.afterState} locale={locale} /></div>{item.note ? <p className="mt-2 text-xs text-piano/55">{item.note}</p> : null}</li>;
          })}</ol>
        </section>
      </DialogContent>
    </Dialog>
  );
}
