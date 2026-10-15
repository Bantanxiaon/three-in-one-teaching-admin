"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";
import { getPortalPath } from "@/lib/dashboard";
import { loginSchema, type LoginInput } from "@/lib/validators";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors }
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError("");
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false
    });

    if (result?.error) {
      setError(locale === "zh" ? "邮箱或密码不正确。" : "Email or password is incorrect.");
      return;
    }

    const session = await getSession();
    if (!session?.user) {
      setError(locale === "zh" ? "登录状态未能建立，请重试。" : "The session could not be established. Please try again.");
      return;
    }

    router.replace(getPortalPath(session.user.role, locale, session.user.mustChangePassword));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-surface interactive-glow mx-auto max-w-md rounded-[28px] p-6 md:p-8">
      <div className="grid gap-5">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label={locale === "zh" ? "密码" : "Password"} error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </Field>
      </div>
      <Button type="submit" className="mt-7 w-full interactive-glow" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
        {locale === "zh" ? "登录" : "Log in"}
      </Button>
      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
