"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Locale } from "@/i18n/routing";
import { apiErrorCode } from "@/lib/localized-error";
import { formatTeachingStatus, safeTeachingError } from "@/lib/teaching-localization";

const attendanceStatuses = ["ATTENDED", "STUDENT_ABSENT", "STUDENT_LEAVE", "TEACHER_ADJUSTED"] as const;
type AttendanceStatus = (typeof attendanceStatuses)[number];

export type TeacherLessonRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  topic: string;
  studentName: string;
  studentNumber: string;
  classroomName: string | null;
  attendance: { status: string; note: string | null } | null;
  feedback: { focus: string | null; feedback: string | null; homework: string | null } | null;
};

function initialAttendanceStatus(status: string | undefined): AttendanceStatus {
  return attendanceStatuses.includes(status as AttendanceStatus) ? status as AttendanceStatus : "ATTENDED";
}

function copy(locale: Locale, zh: string, en: string, ja = en) {
  return locale === "zh" ? zh : locale === "ja" ? ja : en;
}

async function responseErrorCode(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return apiErrorCode(body);
}

export function ClassroomRecordDialog({ locale, lesson }: { locale: Locale; lesson: TeacherLessonRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(() => initialAttendanceStatus(lesson.attendance?.status));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const attendanceLocked = lesson.attendance !== null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const focus = String(form.get("focus") ?? "").trim();
    const feedback = String(form.get("feedback") ?? "").trim();
    const homework = String(form.get("homework") ?? "").trim();
    const note = String(form.get("internalNote") ?? "").trim();

    try {
      const attendanceResponse = await fetch(`/api/teacher/lessons/${lesson.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: attendanceStatus, ...(note ? { note } : {}) })
      });
      if (!attendanceResponse.ok) {
        const code = await responseErrorCode(attendanceResponse);
        throw new Error(safeTeachingError(locale, "考勤登记失败，请稍后重试。", code, "Attendance could not be saved. Please try again."));
      }

      if (focus || feedback || homework) {
        const feedbackResponse = await fetch("/api/lesson-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, focus, feedback, homework })
        });
        if (!feedbackResponse.ok) {
          const code = await responseErrorCode(feedbackResponse);
          throw new Error(safeTeachingError(locale, "考勤已登记，但课堂评价保存失败，请重试。", code, "Attendance was saved, but feedback could not be saved. Please try again."));
        }
      }

      setMessage(copy(locale, "课堂记录已保存。", "Classroom record saved.", "レッスン記録を保存しました。"));
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : safeTeachingError(locale, "课堂记录保存失败，请稍后重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) { setMessage(""); setIsError(false); } }}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Check size={14} aria-hidden="true" />
          {lesson.attendance ? copy(locale, "补充记录", "Update record", "記録を追加") : copy(locale, "登记课堂", "Record lesson", "レッスンを記録")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={copy(locale, "关闭对话框", "Close dialog", "ダイアログを閉じる")}
        className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-2xl overflow-y-auto rounded-[24px] border border-white/70 bg-[#f8f8f5]/95 p-5 shadow-[0_24px_80px_rgba(5,5,5,0.2)] sm:p-7"
      >
        <DialogTitle>{copy(locale, "课堂记录", "Classroom record", "レッスン記録")}</DialogTitle>
        <DialogDescription className="mt-2 pr-10">{lesson.studentName} · {lesson.studentNumber} · {lesson.topic}</DialogDescription>

        <form onSubmit={submit} className="mt-6 grid gap-5">
          <fieldset disabled={attendanceLocked || submitting}>
            <legend className="text-sm font-medium">{copy(locale, "考勤状态", "Attendance", "出欠状況")}</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {attendanceStatuses.map((status) => (
                <label key={status} className="relative">
                  <input className="peer sr-only" type="radio" name="attendanceStatus" value={status} checked={attendanceStatus === status} onChange={() => setAttendanceStatus(status)} />
                  <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-piano/10 bg-white/60 px-3 text-center text-xs font-medium text-piano/60 transition peer-checked:border-piano peer-checked:bg-piano peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-disabled:cursor-not-allowed peer-disabled:opacity-65">
                    {formatTeachingStatus(status, locale)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea name="focus" label={copy(locale, "课堂重点（选填）", "Lesson focus (optional)", "レッスン重点（任意）")} defaultValue={lesson.feedback?.focus ?? ""} maxLength={240} />
            <TextArea name="feedback" label={copy(locale, "课堂评价（选填）", "Class feedback (optional)", "レッスン評価（任意）")} defaultValue={lesson.feedback?.feedback ?? ""} maxLength={1500} />
            <TextArea name="homework" label={copy(locale, "课后作业（选填）", "Homework (optional)", "宿題（任意）")} defaultValue={lesson.feedback?.homework ?? ""} maxLength={1500} />
            <TextArea name="internalNote" label={copy(locale, "内部备注（选填）", "Internal note (optional)", "内部メモ（任意）")} defaultValue={lesson.attendance?.note ?? ""} maxLength={800} disabled={attendanceLocked} />
          </div>

          {message ? <p role={isError ? "alert" : "status"} className={isError ? "text-sm text-red-700" : "text-sm text-piano/60"}>{message}</p> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>{copy(locale, "取消", "Cancel", "キャンセル")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              {submitting ? copy(locale, "保存中", "Saving", "保存中") : copy(locale, "保存课堂记录", "Save classroom record", "レッスン記録を保存")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextArea({ name, label, defaultValue, maxLength, disabled = false }: { name: string; label: string; defaultValue: string; maxLength: number; disabled?: boolean }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea name={name} defaultValue={defaultValue} maxLength={maxLength} disabled={disabled} rows={4} className="min-h-28 w-full resize-y rounded-[18px] border border-piano/10 bg-white/70 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-piano/30 focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60" />
    </label>
  );
}
