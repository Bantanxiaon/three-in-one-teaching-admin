"use client";

import { KeyRound, LoaderCircle, Mail, Pause, Play, ShieldCheck, UserPlus, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import type { ProtectedTeacherAccountCommand, ProtectedTeacherAccountView } from "@/components/dashboard/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { safeAdminError } from "@/lib/admin-localization";
import { apiErrorCode } from "@/lib/localized-error";

const coreTeacherSlugs = ["teacher-one", "teacher-two", "teacher-three"] as const;

type AccountResult = {
  teacherId: string;
  message: string;
  temporaryPassword?: string;
  emailAccepted?: boolean;
  emailTrackingAvailable?: boolean;
};

type AccountResponse = {
  data?: ProtectedTeacherAccountCommand;
};

async function responseBody(response: Response): Promise<AccountResponse> {
  try {
    return await response.json() as AccountResponse;
  } catch {
    return {};
  }
}

export function CoreTeacherAccountPanel({ locale, initialTeachers }: { locale: Locale; initialTeachers: ProtectedTeacherAccountView[] }) {
  const [teachers, setTeachers] = useState(initialTeachers);
  useEffect(() => setTeachers(initialTeachers), [initialTeachers]);
  const [pendingByTeacher, setPendingByTeacher] = useState<Record<string, true>>({});
  const [resultsByTeacher, setResultsByTeacher] = useState<Record<string, AccountResult>>({});
  const [errorsByTeacher, setErrorsByTeacher] = useState<Record<string, string>>({});
  const inFlightTeachers = useRef(new Set<string>());
  const zh = locale === "zh";
  const coreTeachers = useMemo(() => coreTeacherSlugs
    .map((slug) => teachers.find((teacher) => teacher.slug === slug))
    .filter((teacher): teacher is ProtectedTeacherAccountView => Boolean(teacher)), [teachers]);

  function updateAccount(teacherId: string, data: ProtectedTeacherAccountCommand) {
    setTeachers((current) => current.map((teacher) => teacher.id === teacherId ? {
      ...teacher,
      account: {
        maskedEmail: data.maskedEmail,
        isActive: data.isActive,
        isProtected: data.isProtected
      }
    } : teacher));
  }

  function beginTeacherRequest(teacherId: string) {
    if (inFlightTeachers.current.has(teacherId)) return false;
    inFlightTeachers.current.add(teacherId);
    setPendingByTeacher((current) => ({ ...current, [teacherId]: true }));
    setResultsByTeacher((current) => {
      const next = { ...current };
      delete next[teacherId];
      return next;
    });
    setErrorsByTeacher((current) => {
      const next = { ...current };
      delete next[teacherId];
      return next;
    });
    return true;
  }

  function finishTeacherRequest(teacherId: string) {
    inFlightTeachers.current.delete(teacherId);
    setPendingByTeacher((current) => {
      const next = { ...current };
      delete next[teacherId];
      return next;
    });
  }

  function setTeacherError(teacherId: string, message: string) {
    setErrorsByTeacher((current) => ({ ...current, [teacherId]: message }));
  }

  function clearTeacherResult(teacherId: string) {
    setResultsByTeacher((current) => {
      const next = { ...current };
      delete next[teacherId];
      return next;
    });
  }

  async function createAccount(event: FormEvent<HTMLFormElement>, teacher: ProtectedTeacherAccountView) {
    event.preventDefault();
    if (!beginTeacherRequest(teacher.id)) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const response = await fetch(`/api/admin/teachers/${teacher.id}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, preferredLocale: locale })
      });
      const body = await responseBody(response);
      const data = body.data;
      if (!response.ok || !data || data.teacher.id !== teacher.id || !/^\d{6}$/.test(data.temporaryPassword ?? "")) {
        setTeacherError(teacher.id, safeAdminError(locale, "教师账号创建失败，请检查邮箱后重试。", apiErrorCode(body), "Teacher account creation failed."));
        return;
      }
      updateAccount(teacher.id, data);
      setResultsByTeacher((current) => ({ ...current, [teacher.id]: {
        teacherId: teacher.id,
        message: zh ? "教师账号已创建。" : "Teacher account created.",
        temporaryPassword: data.temporaryPassword,
        emailAccepted: data.emailAccepted === true,
        emailTrackingAvailable: data.emailTrackingAvailable === true
      } }));
    } catch {
      setTeacherError(teacher.id, safeAdminError(locale, "教师账号创建失败，请稍后重试。", undefined, "Teacher account creation failed."));
    } finally {
      finishTeacherRequest(teacher.id);
    }
  }

  async function runAction(teacher: ProtectedTeacherAccountView, action: "SUSPEND" | "RESUME" | "RESET_PASSWORD") {
    if (!beginTeacherRequest(teacher.id)) return;
    try {
      const response = await fetch(`/api/admin/teachers/${teacher.id}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await responseBody(response);
      const data = body.data;
      const temporaryPassword = data?.temporaryPassword;
      const validReset = action !== "RESET_PASSWORD" || /^\d{6}$/.test(temporaryPassword ?? "");
      if (!response.ok || !data || data.teacher.id !== teacher.id || !validReset) {
        setTeacherError(teacher.id, safeAdminError(locale, "教师账号操作失败，请稍后重试。", apiErrorCode(body), "Teacher account update failed."));
        return;
      }
      updateAccount(teacher.id, data);
      setResultsByTeacher((current) => ({ ...current, [teacher.id]: {
        teacherId: teacher.id,
        message: action === "RESET_PASSWORD"
          ? (zh ? "密码已重置。" : "Password reset.")
          : action === "SUSPEND"
            ? (zh ? "登录已暂停。" : "Login paused.")
            : (zh ? "登录已恢复。" : "Login restored."),
        temporaryPassword,
        emailAccepted: action === "RESET_PASSWORD" ? data.emailAccepted === true : undefined,
        emailTrackingAvailable: action === "RESET_PASSWORD" ? data.emailTrackingAvailable === true : undefined
      } }));
    } catch {
      setTeacherError(teacher.id, safeAdminError(locale, "教师账号操作失败，请稍后重试。", undefined, "Teacher account update failed."));
    } finally {
      finishTeacherRequest(teacher.id);
    }
  }

  return (
    <section className="min-w-0" aria-label={zh ? "核心教师账号管理" : "Core teacher account management"}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-piano/[0.08] pb-5">
        <div>
          <h2 className="text-xl font-semibold">{zh ? "核心教师账号" : "Core teacher accounts"}</h2>
          <p className="mt-1 text-sm text-piano/50">{zh ? "核心教师资料永久保留，可管理登录状态与密码。" : "Core profiles remain protected while login access and passwords can be managed."}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-piano/50"><ShieldCheck size={15} aria-hidden="true" />{zh ? "永久保护" : "Permanently protected"}</span>
      </header>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-3">
        {coreTeachers.map((teacher) => {
          const account = teacher.account;
          const pending = Boolean(pendingByTeacher[teacher.id]);
          const teacherResult = resultsByTeacher[teacher.id] ?? null;
          const teacherError = errorsByTeacher[teacher.id] ?? "";
          return (
            <article key={teacher.id} className="min-w-0 rounded-[8px] border border-piano/[0.08] bg-white/52 p-5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{teacher.displayName}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-piano/48">{teacher.title}</p>
                </div>
                <span className="shrink-0 text-xs text-piano/45">{teacher.students} {zh ? "位学员" : "students"}</span>
              </div>

              {!account ? (
                <form className="mt-5 grid gap-3" onSubmit={(event) => void createAccount(event, teacher)}>
                  <label className="grid min-w-0 gap-1.5 text-sm">
                    <span>{zh ? "账号邮箱" : "Account email"}</span>
                    <Input name="email" type="email" required autoComplete="off" aria-label={zh ? `${teacher.displayName}账号邮箱` : `${teacher.displayName} account email`} placeholder={zh ? "请输入登录邮箱" : "Enter login email"} />
                  </label>
                  <Button type="submit" size="sm" className="w-full" disabled={pending}>
                    {pending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
                    {zh ? "创建教师账号" : "Create teacher account"}
                  </Button>
                </form>
              ) : (
                <div className="mt-5 min-w-0">
                  <div className="grid gap-2 text-sm">
                    <p className="flex min-w-0 items-center gap-2"><Mail size={14} className="shrink-0" aria-hidden="true" /><span className="truncate">{account.maskedEmail}</span></p>
                    <p className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${account.isActive ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />{account.isActive ? (zh ? "可登录" : "Active") : (zh ? "已暂停" : "Paused")}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant="outline" className="min-w-0 px-3" aria-label={account.isActive ? (zh ? "暂停登录" : "Pause login") : (zh ? "恢复登录" : "Restore login")} disabled={pending} onClick={() => void runAction(teacher, account.isActive ? "SUSPEND" : "RESUME")}>
                      {account.isActive ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      {account.isActive ? (zh ? "暂停登录" : "Pause") : (zh ? "恢复登录" : "Restore")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="min-w-0 px-3" aria-label={zh ? "重置密码" : "Reset password"} disabled={pending} onClick={() => void runAction(teacher, "RESET_PASSWORD")}>
                      {pending ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />}
                      {zh ? "重置密码" : "Reset"}
                    </Button>
                  </div>
                </div>
              )}

              {teacherError ? <p role="alert" className="mt-4 text-sm text-red-700">{teacherError}</p> : null}
              {teacherResult ? (
                <div className="mt-5 border-t border-piano/[0.08] pt-4 text-sm" role="status">
                  <p className="font-medium">{teacherResult.message}</p>
                  {teacherResult.emailAccepted !== undefined ? <p className="mt-2 text-xs text-piano/55">{teacherResult.emailAccepted
                    ? teacherResult.emailTrackingAvailable
                      ? (zh ? "邮件服务已接受发送请求，最终送达状态请在邮件状态中查看。" : "The email provider accepted the request; final delivery is tracked separately.")
                      : (zh ? "邮件服务已接受发送请求，但本地追踪记录不可用，请勿依赖邮件状态查询最终送达。" : "The email provider accepted the request, but local tracking is unavailable.")
                    : (zh ? "邮件服务未接受发送请求，请另行安全告知临时密码。" : "The email provider did not accept the request; share the temporary password securely.")}</p> : null}
                  {teacherResult.temporaryPassword ? <div className="mt-3 flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-[6px] bg-piano/[0.05] px-3 py-2 font-mono">{teacherResult.temporaryPassword}</code><Button type="button" size="icon" variant="ghost" aria-label={zh ? "我已记录临时密码" : "Dismiss temporary password"} onClick={() => clearTeacherResult(teacher.id)}><X size={16} aria-hidden="true" /></Button></div> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
