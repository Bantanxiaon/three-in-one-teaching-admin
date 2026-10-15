import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/access/change-password-form";
import type { Locale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { getPortalPath } from "@/lib/dashboard";

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!session.user.mustChangePassword) redirect(getPortalPath(session.user.role, locale));

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <header>
          <p className="text-xs font-semibold uppercase tracking-luxury text-gold">Secure First Login</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">{locale === "zh" ? "临时密码，只使用这一次" : "Your temporary password ends here"}</h1>
          <p className="mt-5 max-w-xl leading-8 text-piano/58">{locale === "zh" ? "为了保护课程、反馈与个人资料，请先设置一组只有你知道的长期密码。保存后会自动进入对应工作台。" : "Protect your lessons, feedback, and personal records with a permanent password known only to you. You will enter the correct workspace after saving."}</p>
        </header>
        <ChangePasswordForm email={session.user.email ?? ""} locale={locale} role={session.user.role} />
      </div>
    </main>
  );
}
