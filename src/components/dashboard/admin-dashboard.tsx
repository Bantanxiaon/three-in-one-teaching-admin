"use client";

import { RetainedPanel } from "@/components/ui/retained-panel";

import { BarChart3, CalendarDays, CircleDollarSign, ClipboardCheck, FileText, GraduationCap, Inbox, LayoutDashboard, MailCheck, PenLine, UserRoundCog, UsersRound, WalletCards } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ApplicationsPanel } from "@/components/dashboard/applications-panel";
import { AttendanceReviewPanel } from "@/components/dashboard/attendance-review-panel";
import { CoreTeacherAccountPanel } from "@/components/dashboard/core-teacher-account-panel";
import { EmailDeliveryPanel } from "@/components/dashboard/email-delivery-panel";
import { LessonScheduler } from "@/components/dashboard/lesson-scheduler";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StudentManager } from "@/components/dashboard/student-manager";
import { TuitionManager } from "@/components/dashboard/tuition-manager";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Locale } from "@/i18n/routing";
import type { AdminMetrics, AdminTabData } from "@/lib/admin-workspace-data";
import { formatCurrency } from "@/lib/dashboard";
import type { SerializableWorkspaceItem } from "@/lib/workspace-nav";

const tabs = ["overview", "applications", "students", "schedule", "attendance", "tuition", "teacher-accounts", "email", "content", "finance"] as const;
type AdminTab = (typeof tabs)[number];

export function AdminDashboard({
  locale,
  name,
  role,
  items,
  initialTab,
  initialTabData,
  initialMetrics,
  canManageProtectedAccounts
}: {
  locale: Locale;
  name: string;
  role: string;
  items: SerializableWorkspaceItem[];
  initialTab: AdminTab;
  initialTabData: AdminTabData;
  initialMetrics: AdminMetrics;
  canManageProtectedAccounts: boolean;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [dataByTab, setDataByTab] = useState<Partial<Record<AdminTab, AdminTabData>>>({ [initialTab]: initialTabData });
  const [metrics, setMetrics] = useState(initialMetrics);
  const [pendingTabs, setPendingTabs] = useState<Partial<Record<AdminTab, boolean>>>({});
  const [errorsByTab, setErrorsByTab] = useState<Partial<Record<AdminTab, string>>>({});
  const requests = useRef(new Map<AdminTab, AbortController>());
  const updatedAt = useRef<Partial<Record<AdminTab, number>>>({ [initialTab]: Date.now() });
  const base = "/" + locale + "/admin";
  const activeHref = activeTab === "overview" ? base : base + "?tab=" + activeTab;
  const loading = pendingTabs[activeTab] && !dataByTab[activeTab];
  const loadError = errorsByTab[activeTab] ?? "";

  useEffect(() => {
    const current = requests.current;
    return () => { for (const controller of current.values()) controller.abort(); };
  }, []);

  function loadTab(tab: AdminTab) {
    if (requests.current.has(tab)) return;
    const controller = new AbortController();
    requests.current.set(tab, controller);
    setPendingTabs((current) => ({ ...current, [tab]: true }));
    setErrorsByTab((current) => ({ ...current, [tab]: "" }));
    void fetch("/api/admin/workspace?tab=" + encodeURIComponent(tab), {
      signal: controller.signal, cache: "no-store"
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error("Unable to load workspace");
      return body.data as AdminTabData;
    }).then((data) => {
      if (controller.signal.aborted) return;
      updatedAt.current[tab] = Date.now();
      setDataByTab((current) => ({ ...current, [tab]: data }));
    }).catch(() => {
      if (controller.signal.aborted) return;
      setErrorsByTab((current) => ({ ...current, [tab]: locale === "zh" ? "栏目更新失败，请重试。" : locale === "ja" ? "読み込みに失敗しました。" : "Workspace update failed. Please retry." }));
    }).finally(() => {
      requests.current.delete(tab);
      if (!controller.signal.aborted) setPendingTabs((current) => ({ ...current, [tab]: false }));
    });
  }

  function refreshMetrics() {
    void fetch("/api/admin/metrics", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok && body.ok) setMetrics(body.data as AdminMetrics);
      })
      .catch(() => undefined);
  }

  function selectTab(value: string) {
    if (!tabs.includes(value as AdminTab)) return;
    const tab = value as AdminTab;
    if (tab === "teacher-accounts" && !canManageProtectedAccounts) return;
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.history.replaceState(window.history.state, "", tab === "overview" ? base : `${base}?tab=${tab}`);
    if (tab === "overview" || tab === "content" || tab === "finance") {
      if (tab === "overview") refreshMetrics();
      return;
    }
    if (!dataByTab[tab] || Date.now() - (updatedAt.current[tab] ?? 0) > 30_000) loadTab(tab);
  }

  function handleSidebarNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(href, window.location.origin);
    if (destination.pathname !== base) return;
    const tab = destination.searchParams.get("tab") ?? "overview";
    if (!tabs.includes(tab as AdminTab)) return;
    event.preventDefault();
    selectTab(tab);
  }

  async function publishPost(formData: FormData) {
    const title = String(formData.get("title"));
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: String(formData.get("slug")),
        excerpt: String(formData.get("excerpt")),
        content: String(formData.get("content")),
        locale,
        category: String(formData.get("category")),
        tags: String(formData.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
        seoTitle: title,
        seoDescription: String(formData.get("excerpt"))
      })
    });
    if (response.ok) (document.getElementById("journal-form") as HTMLFormElement | null)?.reset();
  }

  const t = locale === "zh"
    ? { overview: "数据概览", applications: "账号申请", students: "学员账号", schedule: "排课系统", attendance: "出勤核销", tuition: "私有课价", teachers: "教师账号", email: "邮件状态", content: "内容", finance: "财务" }
    : { overview: "Overview", applications: "Applications", students: "Student accounts", schedule: "Schedule", attendance: "Attendance review", tuition: "Private tuition", teachers: "Teachers", email: "Email status", content: "Content", finance: "Finance" };

  const tabsView = <Tabs value={activeTab} onValueChange={selectTab} className="min-w-0"><div className="overflow-x-auto pb-2"><TabsList className="min-w-max"><TabsTrigger value="overview"><BarChart3 size={15} className="mr-2" />{t.overview}</TabsTrigger><TabsTrigger value="applications"><Inbox size={15} className="mr-2" />{t.applications}</TabsTrigger><TabsTrigger value="students"><GraduationCap size={15} className="mr-2" />{t.students}</TabsTrigger><TabsTrigger value="schedule"><CalendarDays size={15} className="mr-2" />{t.schedule}</TabsTrigger><TabsTrigger value="attendance"><ClipboardCheck size={15} className="mr-2" />{t.attendance}</TabsTrigger><TabsTrigger value="tuition"><WalletCards size={15} className="mr-2" />{t.tuition}</TabsTrigger>{canManageProtectedAccounts ? <TabsTrigger value="teacher-accounts"><UserRoundCog size={15} className="mr-2" />{t.teachers}</TabsTrigger> : null}<TabsTrigger value="email"><MailCheck size={15} className="mr-2" />{t.email}</TabsTrigger><TabsTrigger value="content"><FileText size={15} className="mr-2" />{t.content}</TabsTrigger><TabsTrigger value="finance"><CircleDollarSign size={15} className="mr-2" />{t.finance}</TabsTrigger></TabsList></div>
    {loading ? <div role="status" className="mt-6 rounded-[24px] bg-white/60 p-7 text-sm text-piano/60">{locale === "zh" ? "正在加载当前栏目…" : "Loading this workspace…"}</div> : null}
    {loadError ? <div role="alert" className="mt-4 text-sm text-red-700"><p>{loadError}</p><Button type="button" size="sm" className="mt-2" onClick={() => loadTab(activeTab)}>{locale === "zh" ? "重试" : "Retry"}</Button></div> : null}
    <TabsContent forceMount className="data-[state=inactive]:hidden" value="overview"><RetainedPanel active={activeTab === "overview"}><div className="glass-surface rounded-[24px] p-7 text-center"><p className="text-sm font-medium">{locale === "zh" ? "所有运营数据均来自 PostgreSQL 真实记录" : "All operational data is loaded from real PostgreSQL records"}</p><p className="mt-2 text-xs text-piano/45">{locale === "zh" ? "申请、账号、课包与课程状态会在对应工作区更新。" : "Applications, accounts, packages, and lessons are managed in their focused workspaces."}</p></div></RetainedPanel></TabsContent>
    {dataByTab.applications ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="applications"><RetainedPanel active={activeTab === "applications"}><ApplicationsPanel locale={locale} initialApplications={dataByTab.applications!.applications} teachers={dataByTab.applications!.teachers} packages={dataByTab.applications!.packages} campuses={dataByTab.applications!.campuses} /></RetainedPanel></TabsContent> : null}
    {dataByTab.students ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="students"><RetainedPanel active={activeTab === "students"}><StudentManager locale={locale} initialStudents={dataByTab.students!.students} teachers={dataByTab.students!.teachers} packages={dataByTab.students!.packages} campuses={dataByTab.students!.campuses} /></RetainedPanel></TabsContent> : null}
    {dataByTab.schedule ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="schedule"><RetainedPanel active={activeTab === "schedule"}><LessonScheduler locale={locale} initialLessons={dataByTab.schedule!.lessons} students={dataByTab.schedule!.students} teachers={dataByTab.schedule!.teachers} classrooms={dataByTab.schedule!.classrooms} /></RetainedPanel></TabsContent> : null}
    {dataByTab.attendance ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="attendance"><RetainedPanel active={activeTab === "attendance"}><AttendanceReviewPanel locale={locale} initialAbsences={dataByTab.attendance!.pendingAbsences} /></RetainedPanel></TabsContent> : null}
    {dataByTab.tuition ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="tuition"><RetainedPanel active={activeTab === "tuition"}><TuitionManager locale={locale} initialPackages={dataByTab.tuition!.packages} teachers={dataByTab.tuition!.teachers} /></RetainedPanel></TabsContent> : null}
    {canManageProtectedAccounts && dataByTab["teacher-accounts"] ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="teacher-accounts"><RetainedPanel active={activeTab === "teacher-accounts"}><CoreTeacherAccountPanel locale={locale} initialTeachers={dataByTab["teacher-accounts"]!.protectedTeachers} /></RetainedPanel></TabsContent> : null}
    {dataByTab.email ? <TabsContent forceMount className="data-[state=inactive]:hidden" value="email"><RetainedPanel active={activeTab === "email"}><EmailDeliveryPanel locale={locale} deliveries={dataByTab.email!.emailDeliveries} /></RetainedPanel></TabsContent> : null}
    <TabsContent forceMount className="data-[state=inactive]:hidden" value="content"><RetainedPanel active={activeTab === "content"}><form id="journal-form" action={publishPost} className="glass-surface grid gap-4 rounded-[24px] p-5 sm:p-6"><div className="grid gap-4 md:grid-cols-2"><Input name="title" required minLength={4} placeholder={locale === "zh" ? "文章标题" : "Article title"} /><Input name="slug" required pattern="[a-z0-9-]+" placeholder={locale === "zh" ? "文章路径（小写英文与连字符）" : "Article slug"} /><Input name="category" required placeholder={locale === "zh" ? "分类" : "Category"} /><Input name="tags" placeholder={locale === "zh" ? "标签，以逗号分隔" : "Tags, comma separated"} /></div><Input name="excerpt" required minLength={12} maxLength={160} placeholder={locale === "zh" ? "摘要" : "Excerpt"} /><textarea name="content" required minLength={80} className="min-h-56 rounded-[20px] border border-white/40 bg-white/55 p-5 text-sm leading-7 outline-none backdrop-blur-[20px] focus:ring-2 focus:ring-gold/30" placeholder={locale === "zh" ? "正文内容" : "Article content"} /><Button type="submit" className="justify-self-start"><PenLine size={16} />{locale === "zh" ? "发布文章" : "Publish article"}</Button></form></RetainedPanel></TabsContent>
    <TabsContent forceMount className="data-[state=inactive]:hidden" value="finance"><RetainedPanel active={activeTab === "finance"}><div className="glass-surface rounded-[24px] p-8 text-center"><p className="text-sm font-medium">{locale === "zh" ? "财务趋势将在真实收款记录产生后显示" : "Finance trends will appear after real payments are recorded"}</p></div></RetainedPanel></TabsContent>
  </Tabs>;
  return (
    <WorkspaceShell locale={locale} name={name} role={role} items={items} activeHref={activeHref} onNavigate={handleSidebarNavigation}>
      <header>
        <p className="text-sm text-piano/45">{locale === "zh" ? "运营工作台" : "Operations workspace"}</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{locale === "zh" ? "晨音运营中心" : "Chenyin command center"}</h1>
      </header>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={locale === "zh" ? "在读学员" : "Active students"} value={String(metrics.studentCount)} icon={UsersRound} />
        <MetricCard label={locale === "zh" ? "教师" : "Teachers"} value={String(metrics.teacherCount)} icon={LayoutDashboard} />
        <MetricCard label={locale === "zh" ? "已核销课时" : "Reconciled lessons"} value={String(metrics.lessonCount)} icon={BarChart3} />
        <MetricCard label={locale === "zh" ? "已收款" : "Collected revenue"} value={formatCurrency(metrics.revenueCents, locale)} icon={CircleDollarSign} />
      </section>
      <section className="mt-6">{tabsView}</section>
    </WorkspaceShell>
  );
}
