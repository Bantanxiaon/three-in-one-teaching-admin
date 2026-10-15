"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";
import { getPortalPath } from "@/lib/dashboard";
import type { Role } from "@/lib/rbac";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validators";

export function ChangePasswordForm({ email, locale, role }: { email: string; locale: Locale; role: Role }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema)
  });

  async function onSubmit(values: ChangePasswordInput) {
    setError("");
    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      setError(result.error?.code === "INVALID_CURRENT_PASSWORD"
        ? (locale === "zh" ? "当前临时密码不正确。" : "The current temporary password is incorrect.")
        : (locale === "zh" ? "密码未能更新，请确认使用 6 位以上数字。" : "The password could not be updated. Use at least 6 digits."));
      return;
    }

    await signOut({ redirect: false });
    const login = await signIn("credentials", { email, password: values.newPassword, redirect: false });
    if (login?.error) {
      router.replace(`/${locale}/login`);
      return;
    }

    router.replace(getPortalPath(role, locale));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-surface interactive-glow rounded-[28px] p-5 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-piano text-white"><KeyRound size={18} /></span>
        <div><h2 className="font-semibold">{locale === "zh" ? "设置你的长期密码" : "Set your permanent password"}</h2><p className="mt-1 text-xs text-piano/45">{email}</p></div>
      </div>
      <div className="mt-7 grid gap-5">
        <Field label={locale === "zh" ? "当前临时密码" : "Current temporary password"} error={errors.currentPassword?.message}><Input type="password" inputMode="numeric" autoComplete="current-password" {...register("currentPassword")} /></Field>
        <Field label={locale === "zh" ? "新密码" : "New password"} error={errors.newPassword?.message}><Input type="password" inputMode="numeric" autoComplete="new-password" {...register("newPassword")} /></Field>
        <Field label={locale === "zh" ? "再次输入新密码" : "Confirm new password"} error={errors.confirmPassword?.message}><Input type="password" inputMode="numeric" autoComplete="new-password" {...register("confirmPassword")} /></Field>
      </div>
      <div className="mt-6 grid gap-2 text-xs text-piano/48 sm:grid-cols-2">
        {[locale === "zh" ? "至少 6 位数字" : "At least 6 digits", locale === "zh" ? "只能使用数字" : "Digits only"].map((item) => <span className="flex items-center gap-2" key={item}><CheckCircle2 size={14} className="text-gold" />{item}</span>)}
      </div>
      <Button type="submit" className="interactive-glow mt-7 w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}{locale === "zh" ? "保存并进入工作台" : "Save and enter workspace"}</Button>
      {error ? <p className="mt-4 text-center text-sm text-red-600" role="alert">{error}</p> : null}
    </form>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return <label className="grid gap-2"><Label>{label}</Label>{children}{error ? <span className="text-xs text-red-600">{error}</span> : null}</label>;
}
