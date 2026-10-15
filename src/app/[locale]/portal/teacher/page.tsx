import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardPen } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TeacherPortalSwitcher, TeacherTabPanel } from "@/components/teacher/teacher-portal-switcher";
import type { TeacherLessonRecord } from "@/components/teacher/classroom-record-dialog";
import { TeacherLessonList } from "@/components/teacher/teacher-lesson-list";
import { TeacherStudentList } from "@/components/teacher/teacher-student-list";
import type { Locale } from "@/i18n/routing";
import { requireRole } from "@/lib/guards";
import { loadTeacherWorkspace, normalizeAttendancePage, normalizeTeacherWorkspaceTab } from "@/lib/teacher-workspace-data";

type TeacherPageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string | string[]; attendancePage?: string | string[] }>;
};

function copy(locale: Locale, zh: string, en: string, ja = en) {
  return locale === "zh" ? zh : locale === "ja" ? ja : en;
}

export default async function TeacherPortalPage({ params, searchParams }: TeacherPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const session = await requireRole(locale, ["TEACHER"]);
  const attendancePage = normalizeAttendancePage(query.attendancePage);
  const workspace = await loadTeacherWorkspace(session.user.id, undefined, new Date(), { attendancePage });
  const tab = normalizeTeacherWorkspaceTab(query.tab);
  const toLessonRecord = (lesson: (typeof workspace.lessons)[number]): TeacherLessonRecord => ({
    id: lesson.id,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
    status: lesson.status,
    topic: lesson.topic,
    studentName: lesson.student.fullName,
    studentNumber: lesson.student.studentNumber,
    classroomName: lesson.classroom?.name ?? null,
    attendance: lesson.attendance,
    feedback: lesson.feedback
  });
  const lessons = workspace.lessons.map(toLessonRecord);
  const todayLessons = workspace.todayLessons.map(toLessonRecord);
  const feedbackDueLessons = workspace.feedbackDueLessons.map(toLessonRecord);
  const students = workspace.students.map((student) => ({ ...student, updatedAt: student.updatedAt.toISOString() }));
  const base = `/${locale}/portal/teacher`;
  const items = [
    { label: copy(locale, "概览", "Overview", "概要"), href: `${base}?tab=overview`, icon: "dashboard" as const },
    { label: copy(locale, "课程", "Lessons", "レッスン"), href: `${base}?tab=lessons`, icon: "calendar" as const },
    { label: copy(locale, "学员", "Students", "生徒"), href: `${base}?tab=students`, icon: "students" as const }
  ];
  const name = workspace.profile?.displayName ?? session.user.name ?? copy(locale, "教师", "Teacher", "講師");

  return (
    <TeacherPortalSwitcher locale={locale} name={name} items={items} base={base} initialTab={tab}>
      <header>
        <p className="text-sm text-piano/45">{copy(locale, "教师上课工作台", "Classroom workspace", "レッスンワークスペース")}</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{copy(locale, "今天的教学安排", "Today's teaching", "本日のレッスン")}</h1>
        {!workspace.profile ? <p className="mt-3 text-sm text-gold">{copy(locale, "教师账号已启用，师资档案正在等待关联。", "Your account is awaiting teacher-profile linking.", "講師プロフィールの関連付けを待っています。")}</p> : null}
      </header>

      <section aria-label={copy(locale, "教学概览", "Teaching overview", "レッスン概要")} className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={copy(locale, "今日课程", "Lessons today", "本日のレッスン")} value={String(workspace.metrics.todayLessons)} icon={CalendarDays} />
        <MetricCard label={copy(locale, "待登记出勤", "Attendance due", "出欠未登録")} value={String(workspace.metrics.attendanceDue)} icon={ClipboardCheck} />
        <MetricCard label={copy(locale, "待写评价", "Feedback due", "評価未記入")} value={String(workspace.metrics.feedbackDue)} icon={ClipboardPen} />
        <MetricCard label={copy(locale, "本月已核销", "Reconciled this month", "今月消化済み")} value={formatHours(workspace.reconciledHours, locale)} icon={CheckCircle2} />
      </section>

      <TeacherTabPanel tab="overview">
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <section aria-labelledby="today-lessons-title" className="min-w-0">
            <h2 id="today-lessons-title" className="mb-4 text-xl font-semibold">{copy(locale, "今日课程", "Today's lessons", "本日のレッスン")}</h2>
            <TeacherLessonList locale={locale} lessons={todayLessons} emptyMessage={copy(locale, "今日暂无课程", "No lessons today", "本日のレッスンはありません")} />
          </section>
          <section aria-labelledby="recent-students-title" className="min-w-0">
            <h2 id="recent-students-title" className="mb-4 text-xl font-semibold">{copy(locale, "最近学员", "Recent students", "最近の生徒")}</h2>
            <TeacherStudentList locale={locale} students={students.slice(0, 8)} />
          </section>
        </div>
      </TeacherTabPanel>

      <TeacherTabPanel tab="lessons">
        <div className="mt-8 grid gap-8">
          <section aria-labelledby="feedback-due-title" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="feedback-due-title" className="text-xl font-semibold">{copy(locale, "\u5f85\u5199\u8bc4\u4ef7", "Feedback due")}</h2>
              <p className="text-xs text-piano/42">{copy(locale, `\u663e\u793a ${feedbackDueLessons.length} / ${workspace.metrics.feedbackDue} \u8282`, `${feedbackDueLessons.length} of ${workspace.metrics.feedbackDue}`)}</p>
            </div>
            <TeacherLessonList locale={locale} lessons={feedbackDueLessons} emptyMessage={copy(locale, "\u6682\u65e0\u5f85\u5199\u8bc4\u4ef7", "No feedback due")} />
          </section>
          <section aria-labelledby="all-lessons-title" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="all-lessons-title" className="text-xl font-semibold">{copy(locale, "课程记录", "Lesson records", "レッスン記録")}</h2>
            <p className="text-xs text-piano/42">{copy(locale, `最近 ${lessons.length} 节`, `${lessons.length} recent lessons`, `最近の${lessons.length}件`)}</p>
          </div>
          <TeacherLessonList locale={locale} lessons={lessons} emptyMessage={copy(locale, "暂无课程记录", "No lesson records", "レッスン記録はありません")} />
          {workspace.attendanceTotalPages > 1 ? (
            <nav aria-label={copy(locale, "待登记出勤分页", "Attendance pages", "出欠ページ")} className="mt-5 flex items-center justify-between gap-3 text-sm">
              {workspace.attendancePage > 1 ? (
                <Link className="inline-flex items-center gap-1 text-piano/65 hover:text-piano" href={`${base}?tab=lessons&attendancePage=${workspace.attendancePage - 1}`}>
                  <ChevronLeft size={16} aria-hidden="true" />{copy(locale, "上一页", "Previous", "前へ")}
                </Link>
              ) : <span />}
              <span className="text-xs text-piano/42">{workspace.attendancePage} / {workspace.attendanceTotalPages}</span>
              {workspace.attendancePage < workspace.attendanceTotalPages ? (
                <Link className="inline-flex items-center gap-1 text-piano/65 hover:text-piano" href={`${base}?tab=lessons&attendancePage=${workspace.attendancePage + 1}`}>
                  {copy(locale, "下一页", "Next", "次へ")}<ChevronRight size={16} aria-hidden="true" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
          </section>
        </div>
      </TeacherTabPanel>

      <TeacherTabPanel tab="students">
        <section aria-labelledby="all-students-title" className="mt-8 min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="all-students-title" className="text-xl font-semibold">{copy(locale, "我的学员", "My students", "担当生徒")}</h2>
            <p className="text-xs text-piano/42">{copy(locale, `共 ${students.length} 位`, `${students.length} students`, `${students.length}名`)}</p>
          </div>
          <TeacherStudentList locale={locale} students={students} />
        </section>
      </TeacherTabPanel>
    </TeacherPortalSwitcher>
  );
}

function formatHours(value: number, locale: Locale) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return copy(locale, `${formatted} 小时`, `${formatted} h`, `${formatted}時間`);
}
