"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarDays, ChevronLeft, LayoutDashboard, LogOut, Music2, NotebookPen, Settings, UsersRound } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import type { SerializableWorkspaceItem, WorkspaceIconName } from "@/lib/workspace-nav";

const workspaceIcons = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  students: UsersRound,
  practice: NotebookPen,
  settings: Settings
} satisfies Record<WorkspaceIconName, React.ComponentType<{ size?: number }>>;

export function WorkspaceShell({ locale, name, role, items, activeHref, onNavigate, children }: { locale: Locale; name: string; role: string; items: SerializableWorkspaceItem[]; activeHref?: string; onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentHref = activeHref ?? `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return (
    <main className="min-h-screen bg-[#f5f5f2] p-3 md:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1600px] gap-3 md:min-h-[calc(100vh-40px)] lg:grid-cols-[240px_1fr]">
        <aside className="glass-surface flex rounded-[28px] p-4 lg:flex-col">
          <div className="flex min-w-0 items-center gap-3 px-2 py-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-piano text-white"><Music2 size={18} /></span>
            <div className="hidden min-w-0 lg:block"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs uppercase tracking-[0.16em] text-piano/42">{role}</p></div>
          </div>
          <nav className="ml-auto flex gap-1 overflow-x-auto lg:ml-0 lg:mt-8 lg:grid">
            {items.map(({ label, href, icon }) => {
              const Icon = workspaceIcons[icon];
              const active = currentHref === href || (href === pathname && !searchParams.toString());
              return <Link key={href} href={href} title={label} onClick={onNavigate ? (event) => onNavigate(event, href) : undefined} className={cn("flex h-11 shrink-0 items-center gap-3 rounded-full px-3 text-sm transition lg:px-4", active ? "bg-piano text-white shadow-[0_10px_28px_rgba(5,5,5,0.16)]" : "text-piano/58 hover:bg-white/65 hover:text-piano")}><Icon size={17} /><span className="hidden lg:inline">{label}</span></Link>;
            })}
          </nav>
          <div className="hidden lg:mt-auto lg:grid lg:gap-1">
            <Link href={`/${locale}`} className="flex h-11 items-center gap-3 rounded-full px-4 text-sm text-piano/55 hover:bg-white/65"><ChevronLeft size={17} />{locale === "zh" ? "返回官网" : "Back to site"}</Link>
            <button onClick={() => signOut({ callbackUrl: `/${locale}/login` })} className="flex h-11 items-center gap-3 rounded-full px-4 text-left text-sm text-piano/55 hover:bg-white/65"><LogOut size={17} />{locale === "zh" ? "退出登录" : "Sign out"}</button>
          </div>
        </aside>
        <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/65 p-4 shadow-[0_18px_55px_rgba(5,5,5,0.05)] backdrop-blur-[20px] md:p-8">{children}</section>
      </div>
    </main>
  );
}
