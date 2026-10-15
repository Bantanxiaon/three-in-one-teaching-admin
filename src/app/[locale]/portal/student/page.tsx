import { CalendarDays, Gauge, NotebookPen } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import type { Locale } from "@/i18n/routing";
import { formatLessonStatus } from "@/lib/admin-localization";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatTeachingStatus } from "@/lib/teaching-localization";
import { formatTeachingDateTime } from "@/lib/teaching-time";

const lessonSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  topic: true,
  googleEventId: true,
  teacher: { select: { displayName: true } },
  classroom: { select: { name: true } },
  attendance: { select: { status: true, recordedAt: true } },
  feedback: { select: { focus: true, feedback: true, homework: true, updatedAt: true } }
} as const;

function optionalText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export default async function StudentPortalPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await requireRole(locale, ["STUDENT"]);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      enrolledAt: true,
      teacher: { select: { displayName: true } },
      campus: { select: { name: true } },
      lessons: {
        where: {
          OR: [
            { startsAt: { lte: now } },
            { attendance: { isNot: null } },
            { feedback: { isNot: null } }
          ]
        },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        take: 8,
        select: lessonSelect
      },
      practiceLogs: { where: { loggedAt: { gte: sevenDaysAgo } }, orderBy: { loggedAt: "desc" }, take: 12 }
    }
  });
  const [nextLesson, packageBalance] = profile ? await Promise.all([
    prisma.lesson.findFirst({
      where: { studentId: profile.id, status: { in: ["SCHEDULED", "RESCHEDULED"] }, startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 1,
      select: lessonSelect
    }),
    prisma.studentPackage.aggregate({
      where: { studentId: profile.id, isActive: true, expiresAt: { gt: now } },
      _sum: { remainingLessons: true }
    })
  ]) : [null, { _sum: { remainingLessons: null } }];

  const remainingLessons = packageBalance._sum.remainingLessons ?? 0;
  const practiceMinutes = (profile?.practiceLogs ?? []).reduce((sum, item) => sum + item.minutes, 0);
  const latestTeacherRecord = profile?.lessons.find((lesson) => {
    const feedback = lesson.feedback;
    return feedback && [feedback.focus, feedback.feedback, feedback.homework].some(optionalText);
  })?.feedback ?? null;
  const base = `/${locale}/portal/student`;
  const items = [
    { label: locale === "zh" ? "概览" : "Overview", href: base, icon: "dashboard" as const },
    { label: locale === "zh" ? "课程日历" : "Calendar", href: `${base}#calendar`, icon: "calendar" as const },
    { label: locale === "zh" ? "练琴日志" : "Practice", href: `${base}#practice`, icon: "practice" as const }
  ];
  const name = profile?.fullName ?? session.user.name ?? (locale === "zh" ? "学员" : "Student");

  return (
    <WorkspaceShell locale={locale} name={name} role={locale === "zh" ? "学生" : "Student"} items={items}>
      <header>
        <p className="text-sm text-piano/45">{locale === "zh" ? "学习工作台" : "Learning workspace"}</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{locale === "zh" ? `你好，${name}` : `Welcome, ${name}`}</h1>
        {profile ? <p className="mt-2 text-xs font-medium text-piano/45">{profile.studentNumber} · {locale === "zh" ? "入学" : "Enrolled"} {formatDate(profile.enrolledAt, locale)}</p> : null}
        {!profile ? <p className="mt-3 text-sm text-gold">{locale === "zh" ? "账号已启用，学员档案正等待课程顾问关联。" : "Your account is active and awaiting profile linking by the course advisor."}</p> : null}
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <MetricCard label={locale === "zh" ? "剩余课时" : "Remaining lessons"} value={String(remainingLessons)} icon={Gauge} />
        <MetricCard label={locale === "zh" ? "最近 7 天练习" : "Practice, last 7 days"} value={locale === "zh" ? `${practiceMinutes} 分钟` : `${practiceMinutes} min`} icon={NotebookPen} />
      </section>

      <section className={`mt-5 grid gap-5 ${latestTeacherRecord ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
        <div id="calendar" className="glass-surface rounded-[28px] p-5 sm:p-6">
          <p className="text-sm text-piano/45">{locale === "zh" ? "下一节课" : "Next lesson"}</p>
          {nextLesson ? <>
            <h2 className="mt-3 text-2xl font-semibold">{nextLesson.topic}</h2>
            <div className="mt-6 flex items-center gap-3 rounded-[22px] bg-piano p-4 text-white">
              <CalendarDays size={20} />
              <div><p className="text-sm font-medium">{formatDateTime(nextLesson.startsAt, locale)}</p><p className="mt-1 text-xs text-white/55">{nextLesson.teacher.displayName}{nextLesson.classroom ? ` · ${nextLesson.classroom.name}` : ""}{nextLesson.googleEventId ? (locale === "zh" ? " · 已同步 Google Calendar" : " · Google Calendar synced") : ""}</p></div>
            </div>
          </> : <EmptyText locale={locale} zh="暂无已安排的下一节课" en="No upcoming lesson is scheduled" />}
          <div className="mt-6 grid gap-1">
            {(profile?.lessons ?? []).map((lesson) => <div key={lesson.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-piano/[0.06] py-3 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{lesson.topic}</span><span className="mt-1 block text-xs text-piano/42">{formatDateTime(lesson.startsAt, locale)} · {formatLessonStatus(lesson.status, locale)}</span></span>{lesson.attendance ? <span className="shrink-0 text-xs font-medium text-gold">{formatTeachingStatus(lesson.attendance.status, locale)}</span> : null}</div>)}
            {profile && !profile.lessons.length ? <EmptyText locale={locale} zh="暂无上课记录" en="No lesson history yet" /> : null}
          </div>
        </div>

        {latestTeacherRecord ? <div className="glass-surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">{locale === "zh" ? "最近课堂记录" : "Latest lesson record"}</h2>
          {optionalText(latestTeacherRecord.focus) ? <section className="mt-5 border-t border-piano/[0.07] pt-4"><h3 className="text-xs font-semibold text-gold">{locale === "zh" ? "课堂重点" : "Lesson focus"}</h3><p className="mt-2 text-sm leading-6 text-piano/70">{optionalText(latestTeacherRecord.focus)}</p></section> : null}
          {optionalText(latestTeacherRecord.feedback) ? <section className="mt-5 border-t border-piano/[0.07] pt-4"><h3 className="text-xs font-semibold text-gold">{locale === "zh" ? "教师反馈" : "Teacher feedback"}</h3><p className="mt-2 text-sm leading-6 text-piano/70">{optionalText(latestTeacherRecord.feedback)}</p></section> : null}
          {optionalText(latestTeacherRecord.homework) ? <section className="mt-5 border-t border-piano/[0.07] pt-4"><h3 className="text-xs font-semibold text-gold">{locale === "zh" ? "课后作业" : "Homework"}</h3><p className="mt-2 text-sm leading-6 text-piano/70">{optionalText(latestTeacherRecord.homework)}</p></section> : null}
          <p className="mt-5 text-xs text-piano/42">{locale === "zh" ? "更新于" : "Updated"} {formatDateTime(latestTeacherRecord.updatedAt, locale)}</p>
        </div> : null}
      </section>

      <section id="practice" className="glass-surface mt-5 rounded-[28px] p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{locale === "zh" ? "练琴日志" : "Practice log"}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(profile?.practiceLogs ?? []).map((log) => <div key={log.id} className="rounded-[22px] bg-white/65 p-4"><p className="text-xs text-piano/40">{formatDate(log.loggedAt, locale)}</p><p className="mt-2 text-2xl font-semibold">{log.minutes} {locale === "zh" ? "分钟" : "min"}</p><p className="mt-2 text-sm text-piano/50">{log.piece}</p>{log.notes ? <p className="mt-2 text-xs leading-5 text-piano/42">{log.notes}</p> : null}</div>)}
        </div>
        {profile && !profile.practiceLogs.length ? <EmptyText locale={locale} zh="最近 7 天暂无练琴记录" en="No practice logs in the last 7 days" /> : null}
      </section>
    </WorkspaceShell>
  );
}

function formatDate(value: Date, locale: Locale) {
  return value.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value: Date, locale: Locale) {
  return formatTeachingDateTime(value, locale);
}

function EmptyText({ locale, zh, en }: { locale: Locale; zh: string; en: string }) {
  return <p className="py-10 text-center text-sm text-piano/40">{locale === "zh" ? zh : en}</p>;
}
