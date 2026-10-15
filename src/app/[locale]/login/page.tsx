import Link from "next/link";
import { LoginForm } from "@/components/booking/auth-forms";
import type { Locale } from "@/i18n/routing";
export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
    <header className="mb-8 text-center"><p className="text-sm uppercase tracking-widest text-piano/50">Studio Admin</p>
      <h1 className="mt-3 text-3xl font-semibold">{locale === "zh" ? "登录教学管理系统" : "Sign in to Studio Admin"}</h1>
      <p className="mt-3 text-sm text-piano/60">{locale === "zh" ? "请使用你在独立测试数据库中创建的账号。" : "Use an account from your own database."}</p></header>
    <LoginForm locale={locale} />
    <nav aria-label="Language" className="mt-6 flex justify-center gap-5 text-sm"><Link href="/zh/login">中文</Link><Link href="/en/login">English</Link><Link href="/ja/login">日本語</Link></nav>
  </main>;
}
