"use client";

import { CalendarPlus, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { FormEvent, useMemo, useState, useEffect } from "react";
import type { AdminClassroom, AdminLesson, AdminStudent, AdminTeacher } from "@/components/dashboard/admin-types";
import { ScheduleDatePicker } from "@/components/dashboard/schedule-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { formatLessonStatus, formatMinutes, safeAdminError } from "@/lib/admin-localization";
import { apiErrorCode } from "@/lib/localized-error";

export function LessonScheduler({ locale, initialLessons, students, teachers, classrooms }: { locale: Locale; initialLessons: AdminLesson[]; students: AdminStudent[]; teachers: AdminTeacher[]; classrooms: AdminClassroom[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  useEffect(() => setLessons(initialLessons), [initialLessons]);
  const [studentId, setStudentId] = useState(students.find((item) => item.teacherId)?.id ?? "");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const student = students.find((item) => item.id === studentId);
  const teacher = teachers.find((item) => item.id === student?.teacherId);
  const availableClassrooms = useMemo(() => classrooms.filter((room) => !student?.campusId || room.campusId === student.campusId), [classrooms, student?.campusId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const start = selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours, minutes) : new Date(Number.NaN);
    const duration = Number(form.get("duration"));
    const end = new Date(start.getTime() + duration * 60_000);
    if (!student?.teacherId || Number.isNaN(start.getTime())) { setMessage(locale === "zh" ? "请选择已安排老师的学员和有效时间。" : "Choose a student with a teacher and a valid time."); setSaving(false); return; }
    const payload = { studentId: student.id, teacherId: student.teacherId, campusId: student.campusId ?? undefined, classroomId: String(form.get("classroomId") || "") || undefined, startsAt: start.toISOString(), endsAt: end.toISOString(), topic: String(form.get("topic")) };
    try {
      const response = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(safeAdminError(locale, "排课失败，请检查时间、老师与教室是否冲突。", apiErrorCode(body), "Scheduling failed."));
      const room = classrooms.find((item) => item.id === body.data.classroomId);
      const lesson: AdminLesson = { id: body.data.id, studentId: student.id, studentName: student.name, teacherId: student.teacherId, teacherName: teacher?.name ?? "—", classroomId: body.data.classroomId, classroomName: room?.name ?? "—", startsAt: body.data.startsAt, endsAt: body.data.endsAt, status: body.data.status, topic: body.data.topic };
      setLessons((items) => [...items, lesson].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setMessage(locale === "zh" ? "课程已保存并完成冲突检查。" : "Lesson saved after conflict checks.");
      formElement.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : safeAdminError(locale, "排课失败，请稍后重试。")); }
    finally { setSaving(false); }
  }

  async function updateStatus(lesson: AdminLesson, status: "COMPLETED" | "CANCELLED") {
    setMessage("");
    const response = await fetch(`/api/lessons/${lesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const body = await response.json();
    if (!response.ok) { setMessage(safeAdminError(locale, "课程状态更新失败，请稍后重试。", apiErrorCode(body), "Lesson update failed.")); return; }
    setLessons((items) => items.map((item) => item.id === lesson.id ? { ...item, status: body.data.status } : item));
  }

  return <div className="grid gap-5"><form onSubmit={create} className="glass-surface grid gap-3 rounded-[24px] p-4 sm:grid-cols-2 xl:grid-cols-6"><select value={studentId} onChange={(event) => setStudentId(event.target.value)} required className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm xl:col-span-2"><option value="">{locale === "zh" ? "选择学员" : "Select student"}</option>{students.map((student) => <option key={student.id} value={student.id} disabled={!student.teacherId}>{student.studentNumber} · {student.name} · {student.teacherName}</option>)}</select><div className="flex h-12 items-center rounded-full border border-white/40 bg-white/45 px-4 text-sm text-piano/55">{teacher?.name ?? (locale === "zh" ? "老师随学员自动匹配" : "Teacher follows student")}</div><select name="classroomId" className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm"><option value="">{locale === "zh" ? "暂不指定教室" : "No room"}</option>{availableClassrooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.piano}</option>)}</select><ScheduleDatePicker locale={locale} date={selectedDate} onDateChange={setSelectedDate} time={selectedTime} onTimeChange={setSelectedTime} /><select name="duration" defaultValue="45" className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm">{[30, 45, 60, 90].map((minutes) => <option value={minutes} key={minutes}>{formatMinutes(minutes, locale)}</option>)}</select><Input name="topic" required minLength={2} className="sm:col-span-2 xl:col-span-4" placeholder={locale === "zh" ? "课程主题" : "Lesson topic"} /><Button type="submit" disabled={saving || !student?.teacherId} className="sm:col-span-2 xl:col-span-2">{saving ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />}{locale === "zh" ? "保存排课" : "Schedule lesson"}</Button></form>{message ? <p role="status" className="text-sm text-piano/60">{message}</p> : null}<div className="overflow-x-auto rounded-[22px] border border-piano/[0.06] bg-white/52"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs text-piano/45"><tr>{[locale === "zh" ? "日期与时间" : "Date and time", locale === "zh" ? "学员 / 老师" : "Student / Teacher", locale === "zh" ? "主题 / 教室" : "Topic / Room", locale === "zh" ? "状态" : "Status", locale === "zh" ? "操作" : "Actions"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{lessons.map((lesson) => <tr key={lesson.id} className="border-t border-piano/[0.05]"><td className="px-4 py-3"><p className="font-medium">{new Date(lesson.startsAt).toLocaleDateString(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US")}</p><p className="mt-1 flex items-center gap-1 text-xs text-piano/45"><Clock3 size={12} />{new Date(lesson.startsAt).toLocaleTimeString(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}</p></td><td className="px-4 py-3"><p>{lesson.studentName}</p><p className="text-xs text-piano/42">{lesson.teacherName}</p></td><td className="px-4 py-3"><p>{lesson.topic}</p><p className="text-xs text-piano/42">{lesson.classroomName}</p></td><td className="px-4 py-3"><span className="rounded-full bg-piano/[0.06] px-2.5 py-1 text-xs">{formatLessonStatus(lesson.status, locale)}</span></td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" onClick={() => updateStatus(lesson, "COMPLETED")} disabled={lesson.status === "COMPLETED"}><CheckCircle2 size={14} />{locale === "zh" ? "完成" : "Complete"}</Button><Button size="sm" variant="outline" onClick={() => updateStatus(lesson, "CANCELLED")} disabled={lesson.status === "CANCELLED"}><XCircle size={14} />{locale === "zh" ? "取消" : "Cancel"}</Button></div></td></tr>)}{!lessons.length ? <tr><td colSpan={5} className="px-4 py-14 text-center text-piano/40">{locale === "zh" ? "暂无课程安排" : "No lessons scheduled"}</td></tr> : null}</tbody></table></div></div>;
}
