"use client";

import { Clipboard, KeyRound, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { FormEvent, useMemo, useState, useEffect } from "react";
import type { AdminCampus, AdminStudent, AdminTeacher, AdminTuitionPackage } from "@/components/dashboard/admin-types";
import { StudentRecordPanel } from "@/components/dashboard/student-record-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { formatHours, safeAdminError } from "@/lib/admin-localization";
import { apiErrorCode } from "@/lib/localized-error";
import {
  studentDeletionReasonOptions,
  type StudentDeletionReasonCode
} from "@/lib/student-deletion-reasons";
import { reconcileSelectedStudent, reconcileStudentList } from "@/lib/student-record-mutation";

type StudentApiPackage = {
  id: string;
  packageName: string;
  lessonDurationMinutes?: number;
  totalLessons: number;
  consumedLessons: number;
  remainingLessons: number;
  expiresAt: string;
  isActive: boolean;
};

type StudentApiResponse = {
  id: string;
  studentNumber: string;
  fullName: string;
  age: number;
  phone: string;
  wechat: string | null;
  guardianName: string | null;
  goal: string | null;
  teacherId: string | null;
  teacher?: { displayName?: string } | null;
  campusId: string | null;
  campus?: { name?: string } | null;
  enrolledAt: string;
  updatedAt: string;
  user: AdminStudent["user"];
  totalHours: number | string;
  consumedHours: number | string;
  remainingHours: number | string;
  studentPackages: StudentApiPackage[];
  temporaryPassword?: string;
};

function mapStudent(data: StudentApiResponse): AdminStudent {
  return {
    id: data.id,
    studentNumber: data.studentNumber,
    name: data.fullName,
    age: data.age,
    phone: data.phone,
    wechat: data.wechat,
    guardianName: data.guardianName,
    goal: data.goal,
    teacherId: data.teacherId,
    teacherName: data.teacher?.displayName ?? "-",
    campusId: data.campusId,
    campusName: data.campus?.name ?? "-",
    enrolledAt: data.enrolledAt,
    updatedAt: data.updatedAt,
    user: data.user,
    totalHours: Number(data.totalHours),
    consumedHours: Number(data.consumedHours),
    remainingHours: Number(data.remainingHours),
    packages: data.studentPackages
  };
}

export function StudentManager({
  locale,
  initialStudents,
  teachers,
  packages,
  campuses
}: {
  locale: Locale;
  initialStudents: AdminStudent[];
  teachers: AdminTeacher[];
  packages: AdminTuitionPackage[];
  campuses: AdminCampus[];
}) {
  const [students, setStudents] = useState(initialStudents);
  useEffect(() => setStudents(initialStudents), [initialStudents]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [adding, setAdding] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"GENERATED" | "MANUAL">("GENERATED");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [changingTeacherStudent, setChangingTeacherStudent] = useState<AdminStudent | null>(null);
  const [nextTeacherId, setNextTeacherId] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<AdminStudent | null>(null);
  const [deleteReasonCode, setDeleteReasonCode] = useState<StudentDeletionReasonCode>(studentDeletionReasonOptions[0].code);
  const [deleting, setDeleting] = useState(false);
  const matchingPackages = useMemo(
    () => packages.filter((item) => item.teacherId === teacherId && item.isActive),
    [packages, teacherId]
  );
  const visibleStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US");
    if (!query) return students;
    return students.filter((student) => [student.studentNumber, student.name, student.phone]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  }, [locale, search, students]);

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");

    const payload = {
      name: String(form.get("name")),
      age: Number(form.get("age")),
      guardianName: String(form.get("guardianName") || ""),
      phone: String(form.get("phone")),
      wechat: String(form.get("wechat") || ""),
      goal: String(form.get("goal") || ""),
      teacherId: teacherId || undefined,
      campusId: String(form.get("campusId") || "") || undefined,
      email: String(form.get("email") || "") || undefined,
      passwordMode,
      password: passwordMode === "MANUAL" ? String(form.get("password")) : undefined,
      tuitionPackageId: String(form.get("tuitionPackageId") || "") || undefined
    };

    const response = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(safeAdminError(locale, "新增学员失败，请检查填写内容后重试。", apiErrorCode(body), "Student creation failed."));
      return;
    }

    setStudents((current) => [mapStudent(body.data), ...current]);
    setTemporaryPassword(body.data.temporaryPassword ?? "");
    setAdding(false);
    const emailTrackingAvailable = body.data.emailTrackingAvailable === true;
    setMessage(body.data.emailSent === true
      ? emailTrackingAvailable
        ? locale === "zh" ? "\u5b66\u5458\u8d44\u6599\u4e0e\u8d26\u53f7\u5df2\u540c\u6b65\u4fdd\u5b58\uff0c\u4e34\u65f6\u5bc6\u7801\u90ae\u4ef6\u5df2\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\uff0c\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u5df2\u5efa\u7acb\u3002" : "Student profile and account saved. The email provider accepted the message and local tracking is available."
        : locale === "zh" ? "\u5b66\u5458\u8d44\u6599\u4e0e\u8d26\u53f7\u5df2\u540c\u6b65\u4fdd\u5b58\uff0c\u90ae\u4ef6\u670d\u52a1\u5df2\u63a5\u53d7\u53d1\u9001\u8bf7\u6c42\uff0c\u4f46\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u4e0d\u53ef\u7528\u3002" : "Student profile and account saved. The email provider accepted the message, but local tracking is unavailable."
      : locale === "zh" ? "\u5b66\u5458\u8d44\u6599\u4e0e\u8d26\u53f7\u5df2\u540c\u6b65\u4fdd\u5b58\uff0c\u4f46\u90ae\u4ef6\u672a\u80fd\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\u3002" : "Student profile and account saved, but the email provider did not accept the message.");
  }

  async function resetPassword(student: AdminStudent) {
    if (!student.user?.email) {
      setMessage(locale === "zh" ? "该学员还没有登录账号，请先创建账号。" : "This student does not have a login account yet.");
      return;
    }

    setMessage("");
    const response = await fetch(`/api/admin/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: student.user.email, passwordMode: "GENERATED" })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(safeAdminError(locale, "重置密码失败，请稍后重试。", apiErrorCode(body), "Password reset failed."));
      return;
    }

    setTemporaryPassword(body.data.temporaryPassword ?? "");
    setStudents((items) =>
      items.map((item) =>
        item.id === student.id && item.user
          ? { ...item, user: { ...item.user, mustChangePassword: true, currentTemporaryPassword: body.data.temporaryPassword ?? item.user.currentTemporaryPassword } }
          : item
      )
    );
    const emailTrackingAvailable = body.data.emailTrackingAvailable === true;
    setMessage(body.data.emailSent === true
      ? emailTrackingAvailable
        ? locale === "zh" ? "\u5df2\u751f\u6210\u65b0\u7684 6 \u4f4d\u6570\u5b57\u4e34\u65f6\u5bc6\u7801\uff0c\u90ae\u4ef6\u5df2\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\uff0c\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u5df2\u5efa\u7acb\u3002" : "A new temporary password was generated, accepted by the email provider, and recorded for local tracking."
        : locale === "zh" ? "\u5df2\u751f\u6210\u65b0\u7684 6 \u4f4d\u6570\u5b57\u4e34\u65f6\u5bc6\u7801\uff0c\u90ae\u4ef6\u670d\u52a1\u5df2\u63a5\u53d7\u53d1\u9001\u8bf7\u6c42\uff0c\u4f46\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u4e0d\u53ef\u7528\u3002" : "A new temporary password was generated and accepted by the email provider, but local tracking is unavailable."
      : locale === "zh" ? "\u5df2\u751f\u6210\u65b0\u7684 6 \u4f4d\u6570\u5b57\u4e34\u65f6\u5bc6\u7801\uff0c\u4f46\u90ae\u4ef6\u672a\u80fd\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\u3002" : "A new temporary password was generated, but the email provider did not accept the message.");
  }

  async function changeTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const student = changingTeacherStudent;
    if (!student || !nextTeacherId || nextTeacherId === student.teacherId || savingTeacher) return;
    const selectedTeacher = teachers.find((item) => item.id === nextTeacherId);
    if (!selectedTeacher) return;
    setSavingTeacher(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacher.id })
      });
      const body = await response.json();
      if (!response.ok) throw new Error("Teacher change failed");
      const patch = {
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name,
        updatedAt: String(body.data.student.updatedAt)
      };
      setStudents((items) => items.map((item) => item.id === student.id ? { ...item, ...patch } : item));
      setSelectedStudent((current) => current?.id === student.id ? { ...current, ...patch } : current);
      setChangingTeacherStudent(null);
      setMessage(locale === "zh" ? "学员老师已更换。排课需使用新老师名下的可用课包。" : "Teacher updated. Scheduling requires an available package for the new teacher.");
    } catch {
      setMessage(safeAdminError(locale, "更换老师失败，请稍后重试。", undefined, "Unable to change the teacher."));
    } finally {
      setSavingTeacher(false);
    }
  }

  async function remove() {
    if (!deletingStudent || deleting) return;
    const student = deletingStudent;
    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/admin/students/${student.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE", reasonCode: deleteReasonCode })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(safeAdminError(locale, "删除失败，请刷新页面后重试。", apiErrorCode(body), "Delete failed."));
      setDeleting(false);
      return;
    }

    setStudents((items) => items.filter((item) => item.id !== student.id));
    setDeletingStudent(null);
    setDeleting(false);
    const emailTrackingAvailable = body.data.emailTrackingAvailable === true;
    setMessage(body.data.emailSent === true
      ? emailTrackingAvailable
        ? locale === "zh" ? "\u5b66\u5458\u3001\u5173\u8054\u8d26\u53f7\u4e0e\u8bfe\u52a1\u6570\u636e\u5df2\u6c38\u4e45\u5220\u9664\uff0c\u901a\u77e5\u90ae\u4ef6\u5df2\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\uff0c\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u5df2\u5efa\u7acb\u3002" : "Student and linked account deleted. The email provider accepted the notification and local tracking is available."
        : locale === "zh" ? "\u5b66\u5458\u3001\u5173\u8054\u8d26\u53f7\u4e0e\u8bfe\u52a1\u6570\u636e\u5df2\u6c38\u4e45\u5220\u9664\uff0c\u90ae\u4ef6\u670d\u52a1\u5df2\u63a5\u53d7\u53d1\u9001\u8bf7\u6c42\uff0c\u4f46\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u4e0d\u53ef\u7528\u3002" : "Student and linked account deleted. The email provider accepted the notification, but local tracking is unavailable."
      : locale === "zh" ? "\u5b66\u5458\u3001\u5173\u8054\u8d26\u53f7\u4e0e\u8bfe\u52a1\u6570\u636e\u5df2\u6c38\u4e45\u5220\u9664\uff0c\u4f46\u901a\u77e5\u90ae\u4ef6\u672a\u80fd\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\u3002" : "Student and linked account deleted, but the email provider did not accept the notification.");
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{locale === "zh" ? "学员与账号" : "Students and accounts"}</h2>
          <p className="mt-1 text-xs text-piano/45">
            {locale === "zh" ? "账号由管理端创建。临时密码为 6 位数字，用户首次改密后后台不再显示。" : "Accounts are created by the admin. Temporary passwords are numeric and hidden after first change."}
          </p>
        </div>
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus size={16} />
          {locale === "zh" ? "新增学员" : "Add student"}
        </Button>
      </div>

      <Input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder={locale === "zh" ? "按学员编号、姓名或电话搜索" : "Search number, name, or phone"} />

      {adding ? (
        <form onSubmit={createStudent} className="glass-surface grid gap-3 rounded-[24px] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="name" required minLength={2} placeholder={locale === "zh" ? "学员姓名" : "Student name"} />
          <Input name="age" type="number" min={3} max={90} required defaultValue={8} />
          <Input name="guardianName" placeholder={locale === "zh" ? "监护人" : "Guardian"} />
          <Input name="phone" required minLength={6} placeholder={locale === "zh" ? "电话" : "Phone"} />
          <Input name="wechat" placeholder={locale === "zh" ? "微信" : "WeChat"} />
          <Input name="email" type="email" placeholder={locale === "zh" ? "登录邮箱（留空则不建号）" : "Login email (optional)"} />
          <select name="campusId" defaultValue={campuses[0]?.id} className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm">
            {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
          </select>
          <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm">
            <option value="">{locale === "zh" ? "暂不安排老师" : "No teacher yet"}</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
          <select name="tuitionPackageId" className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm">
            <option value="">{locale === "zh" ? "暂不分配课包" : "No package yet"}</option>
            {matchingPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={passwordMode} onChange={(event) => setPasswordMode(event.target.value as "GENERATED" | "MANUAL")} className="h-12 rounded-full border border-white/40 bg-white/65 px-4 text-sm">
            <option value="GENERATED">{locale === "zh" ? "自动生成 6 位数字密码" : "Generate password"}</option>
            <option value="MANUAL">{locale === "zh" ? "手动设置数字密码" : "Manual password"}</option>
          </select>
          {passwordMode === "MANUAL" ? <Input name="password" type="password" inputMode="numeric" pattern="\d{6,}" minLength={6} required placeholder={locale === "zh" ? "6 位数字以上" : "6+ digits"} /> : null}
          <Input name="goal" className="sm:col-span-2" placeholder={locale === "zh" ? "学习目标" : "Learning goal"} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit"><UserPlus size={15} />{locale === "zh" ? "保存并同步" : "Save and sync"}</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}><X size={15} />{locale === "zh" ? "取消" : "Cancel"}</Button>
          </div>
        </form>
      ) : null}

      {temporaryPassword ? (
        <div className="rounded-[20px] border border-gold/25 bg-[#fffaf0] p-4">
          <p className="text-sm font-medium">{locale === "zh" ? "当前生成的临时密码" : "Current temporary password"}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 break-all rounded-[14px] bg-white px-4 py-3 text-sm">{temporaryPassword}</code>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(temporaryPassword)}><Clipboard size={15} />{locale === "zh" ? "复制" : "Copy"}</Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-piano/60">{message}</p> : null}

      <div className="overflow-x-auto rounded-[22px] border border-piano/[0.06] bg-white/52">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs text-piano/45">
            <tr>
              {[locale === "zh" ? "学员" : "Student", locale === "zh" ? "账号" : "Account", locale === "zh" ? "老师 / 校区" : "Teacher / Campus", locale === "zh" ? "课包余额" : "Balance", locale === "zh" ? "操作" : "Actions"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student) => (
              <tr key={student.id} className="border-t border-piano/[0.05]">
                <td className="px-4 py-3">
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-piano/42">{student.studentNumber}</p>
                  <p className="text-xs text-piano/42">{student.phone}</p>
                </td>
                <td className="px-4 py-3">
                  {student.user ? (
                    <>
                      <p>{student.user.email}</p>
                      {student.user.currentTemporaryPassword ? <p className="text-xs text-piano/55">{locale === "zh" ? "当前临时密码" : "Current temporary password"} · <span className="font-mono">{student.user.currentTemporaryPassword}</span></p> : null}
                      <p className="text-xs text-gold">{student.user.mustChangePassword ? (locale === "zh" ? "待首次改密" : "Password change due") : (locale === "zh" ? "已启用" : "Active")}</p>
                    </>
                  ) : <span className="text-piano/40">{locale === "zh" ? "未创建" : "Not created"}</span>}
                </td>
                <td className="px-4 py-3">
                  <p>{student.teacherName}</p>
                  <p className="text-xs text-piano/42">{student.campusName}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{student.packages.reduce((sum, pkg) => sum + pkg.remainingLessons, 0)} {locale === "zh" ? "课时" : "lessons"}</p>
                  <p className="text-xs text-piano/42">{formatHours(student.remainingHours, locale)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedStudent(student)}>
                      {locale === "zh" ? "档案与日志" : "Record and timeline"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setNextTeacherId(teachers.find((teacher) => teacher.id !== student.teacherId)?.id ?? "");
                      setChangingTeacherStudent(student);
                    }} disabled={!teachers.some((teacher) => teacher.id !== student.teacherId)}>
                      {locale === "zh" ? "更换老师" : "Change teacher"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resetPassword(student)} disabled={!student.user}>
                      <KeyRound size={14} />
                      {locale === "zh" ? "重置密码" : "Reset password"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setDeleteReasonCode(studentDeletionReasonOptions[0].code);
                      setDeletingStudent(student);
                    }}>
                      <Trash2 size={14} />
                      {locale === "zh" ? "删除" : "Delete"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StudentRecordPanel
        student={selectedStudent}
        campuses={campuses}
        locale={locale}
        open={selectedStudent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null);
        }}
        onStudentChanged={(patch) => {
          setStudents((items) => reconcileStudentList(items, patch));
          setSelectedStudent((current) => reconcileSelectedStudent(current, patch));
        }}
      />

      <Dialog open={changingTeacherStudent !== null} onOpenChange={(open) => {
        if (!open && !savingTeacher) setChangingTeacherStudent(null);
      }}>
        <DialogContent closeLabel={locale === "zh" ? "关闭更换老师" : "Close teacher change"}>
          <DialogTitle>{locale === "zh" ? "更换学员老师" : "Change student teacher"}</DialogTitle>
          <DialogDescription className="mt-2">
            {locale === "zh"
              ? "已安排课程和原老师名下的课包不会自动转移。更换后，给新老师排课需要其名下的可用课包。"
              : "Existing lessons and packages stay with the previous teacher. New lessons require a package for the new teacher."}
          </DialogDescription>
          <form onSubmit={changeTeacher} className="mt-5 grid gap-4">
            <p className="text-sm">{changingTeacherStudent?.name} · {changingTeacherStudent?.teacherName}</p>
            <label className="grid gap-2 text-sm font-medium">
              <span>{locale === "zh" ? "新老师" : "New teacher"}</span>
              <select value={nextTeacherId} onChange={(event) => setNextTeacherId(event.target.value)} required className="h-12 rounded-full border border-piano/15 bg-white px-4 text-sm">
                {teachers.filter((teacher) => teacher.id !== changingTeacherStudent?.teacherId).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setChangingTeacherStudent(null)} disabled={savingTeacher}>{locale === "zh" ? "取消" : "Cancel"}</Button>
              <Button type="submit" disabled={savingTeacher || !nextTeacherId}>{savingTeacher ? <Loader2 size={15} className="animate-spin" /> : null}{locale === "zh" ? "确认更换" : "Confirm change"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingStudent !== null} onOpenChange={(open) => {
        if (!open && !deleting) setDeletingStudent(null);
      }}>
        <DialogContent className="w-[calc(100vw-24px)] max-w-lg rounded-[24px] border border-white/70 bg-white/88 p-6 shadow-[0_28px_90px_rgba(5,5,5,0.18)] backdrop-blur-[28px] sm:p-7">
          <DialogTitle>{locale === "zh" ? `确认删除 ${deletingStudent?.name ?? ""}` : `Delete ${deletingStudent?.name ?? ""}`}</DialogTitle>
          <DialogDescription className="mt-2 pr-10 leading-6">
            {locale === "zh" ? "关联登录账号与课务数据将一并删除。系统会根据所选原因，以委婉措辞通知用户。" : "The linked login account and lesson data will also be deleted. The member will receive a considerate notice."}
          </DialogDescription>
          <label className="mt-6 grid gap-2 text-sm font-medium">
            <span>{locale === "zh" ? "删除原因" : "Reason"}</span>
            <select
              value={deleteReasonCode}
              onChange={(event) => setDeleteReasonCode(event.target.value as StudentDeletionReasonCode)}
              className="h-12 rounded-full border border-piano/15 bg-white/80 px-4 text-sm outline-none focus:ring-2 focus:ring-gold/35"
            >
              {studentDeletionReasonOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label[locale]}</option>
              ))}
            </select>
          </label>
          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeletingStudent(null)}>
              {locale === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button type="button" disabled={deleting} onClick={remove}>
              <Trash2 size={14} />
              {deleting ? (locale === "zh" ? "正在删除..." : "Deleting...") : (locale === "zh" ? "确认删除" : "Delete permanently")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
