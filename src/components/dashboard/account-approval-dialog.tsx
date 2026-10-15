"use client";

import { Check, Clipboard, KeyRound, Loader2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import type { AdminApplication, AdminCampus, AdminTeacher, AdminTuitionPackage } from "@/components/dashboard/admin-types";
import { formatApplicationRole, safeAdminError } from "@/lib/admin-localization";
import { apiErrorCode } from "@/lib/localized-error";

export function AccountApprovalDialog({ locale, application, teachers, packages, campuses, onClose, onApproved }: { locale: Locale; application: AdminApplication; teachers: AdminTeacher[]; packages: AdminTuitionPackage[]; campuses: AdminCampus[]; onClose: () => void; onApproved: (applicationId: string, account: { id: string; email: string; role: string }) => void }) {
  const [passwordMode, setPasswordMode] = useState<"GENERATED" | "MANUAL">("GENERATED");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const matchingPackages = useMemo(() => packages.filter((item) => item.teacherId === teacherId && item.isActive), [packages, teacherId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (application.status === "CONFIRMED") {
      setState("error");
      setMessage(locale === "zh" ? "账号已开通，不能重复创建。" : "This account has already been approved.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setState("submitting"); setMessage("");
    const payload = application.role === "STUDENT" ? {
      email: String(form.get("email")), passwordMode, password: passwordMode === "MANUAL" ? String(form.get("password")) : undefined,
      campusId: String(form.get("campusId")), teacherId, tuitionPackageId: String(form.get("tuitionPackageId"))
    } : {
      email: String(form.get("email")), passwordMode, password: passwordMode === "MANUAL" ? String(form.get("password")) : undefined,
      campusId: String(form.get("campusId")), teacherTitle: String(form.get("teacherTitle"))
    };
    try {
      const response = await fetch(`/api/admin/applications/${application.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(safeAdminError(locale, "账号创建失败，请检查信息后重试。", apiErrorCode(body), "Account approval failed."));
      setTemporaryPassword(body.data.temporaryPassword ?? "");
      setState("success");
      const emailSent = body.data.emailSent === true;
      const emailTrackingAvailable = body.data.emailTrackingAvailable === true;
      setMessage(emailSent
        ? emailTrackingAvailable
          ? locale === "zh" ? "\u8d26\u53f7\u5df2\u5f00\u901a\uff0c\u4e34\u65f6\u5bc6\u7801\u90ae\u4ef6\u5df2\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\uff0c\u6700\u7ec8\u6295\u9012\u72b6\u6001\u4ee5\u540e\u53f0\u8bb0\u5f55\u4e3a\u51c6\u3002" : "Account approved. The email provider accepted the temporary-password message; final delivery is tracked separately."
          : locale === "zh" ? "\u8d26\u53f7\u5df2\u5f00\u901a\uff0c\u90ae\u4ef6\u670d\u52a1\u5df2\u63a5\u53d7\u53d1\u9001\u8bf7\u6c42\uff0c\u4f46\u672c\u5730\u8ffd\u8e2a\u8bb0\u5f55\u4e0d\u53ef\u7528\u3002" : "Account approved. The email provider accepted the message, but local tracking is unavailable."
        : locale === "zh" ? "\u8d26\u53f7\u5df2\u5f00\u901a\uff0c\u4f46\u4e34\u65f6\u5bc6\u7801\u90ae\u4ef6\u672a\u80fd\u63d0\u4ea4\u53d1\u9001\u670d\u52a1\u3002" : "Account approved, but the temporary-password email was not accepted by the email provider.");
      onApproved(application.id, body.data.user);
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : safeAdminError(locale, "账号创建失败，请稍后重试。")); }
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setMessage(locale === "zh" ? "临时密码已复制。" : "Temporary password copied.");
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-piano/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={locale === "zh" ? "创建账户" : "Create account"}>
      <div className="glass-surface my-auto w-full max-w-2xl rounded-[28px] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-luxury text-gold">{formatApplicationRole(application.role, locale)}</p><h2 className="mt-2 text-2xl font-semibold">{locale === "zh" ? `为 ${application.name} 创建账户` : `Create an account for ${application.name}`}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/70" aria-label={locale === "zh" ? "关闭" : "Close"}><X size={18} /></button></div>
        {state === "success" ? <div className="mt-6 rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-5"><p className="flex items-center gap-2 font-medium text-emerald-800"><Check size={17} />{message}</p>{temporaryPassword ? <div className="mt-4 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-[16px] bg-white px-4 py-3 text-sm">{temporaryPassword}</code><Button type="button" variant="outline" onClick={copyPassword}><Clipboard size={16} />{locale === "zh" ? "复制临时密码" : "Copy password"}</Button></div> : null}<p className="mt-3 text-xs text-emerald-800/65">{locale === "zh" ? "管理员可在学员账号列表继续查看当前临时密码；用户首次改密后将自动清空。" : "Admins can still view the current temporary password until the user changes it."}</p></div> : (
          <form onSubmit={submit} className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm"><span>{locale === "zh" ? "登录邮箱" : "Login email"}</span><Input name="email" type="email" required defaultValue={application.email ?? ""} /></label>
            <div className="grid grid-cols-2 gap-2 rounded-full border border-white/60 bg-white/45 p-1.5"><Button type="button" variant={passwordMode === "GENERATED" ? "default" : "ghost"} onClick={() => setPasswordMode("GENERATED")}><KeyRound size={15} />{locale === "zh" ? "自动生成" : "Generate"}</Button><Button type="button" variant={passwordMode === "MANUAL" ? "default" : "ghost"} onClick={() => setPasswordMode("MANUAL")}>{locale === "zh" ? "手动设置" : "Manual"}</Button></div>
            {passwordMode === "MANUAL" ? <label className="grid gap-2 text-sm"><span>{locale === "zh" ? "临时密码（6 位数字以上）" : "Temporary password (6+ digits)"}</span><Input name="password" type="password" inputMode="numeric" pattern="\\d{6,}" minLength={6} required /></label> : null}
            <label className="grid gap-2 text-sm"><span>{locale === "zh" ? "校区" : "Campus"}</span><select name="campusId" required defaultValue={application.campusId ?? campuses[0]?.id} className="h-12 rounded-full border border-white/40 bg-white/65 px-4">{campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name}</option>)}</select></label>
            {application.role === "STUDENT" ? <><label className="grid gap-2 text-sm"><span>{locale === "zh" ? "授课老师" : "Teacher"}</span><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required className="h-12 rounded-full border border-white/40 bg-white/65 px-4">{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</select></label><label className="grid gap-2 text-sm"><span>{locale === "zh" ? "私有课包" : "Private package"}</span><select name="tuitionPackageId" required className="h-12 rounded-full border border-white/40 bg-white/65 px-4">{matchingPackages.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.lessonCount} {locale === "zh" ? "课时" : "lessons"}</option>)}</select></label></> : <label className="grid gap-2 text-sm"><span>{locale === "zh" ? "教师职称" : "Teacher title"}</span><Input name="teacherTitle" required minLength={2} defaultValue={locale === "zh" ? "钢琴导师" : "Piano Mentor"} /></label>}
            <Button type="submit" disabled={application.status === "CONFIRMED" || state === "submitting" || (application.role === "STUDENT" && !matchingPackages.length)} className="w-full sm:w-auto">{state === "submitting" ? <Loader2 size={16} className="animate-spin" /> : null}{application.status === "CONFIRMED" ? (locale === "zh" ? "账号已开通" : "Account approved") : (locale === "zh" ? "确认创建账户" : "Create account")}</Button>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
