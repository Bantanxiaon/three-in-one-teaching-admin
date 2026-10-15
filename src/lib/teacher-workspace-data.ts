import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getShanghaiDayRange, getShanghaiMonthRange } from "@/lib/teaching-time";

type TeacherWorkspaceClient = Pick<PrismaClient, "$queryRaw" | "teacherProfile" | "lesson" | "studentProfile">;

const UPCOMING_LESSON_LIMIT = 30;
const TODAY_LESSON_LIMIT = 50;
const ATTENDANCE_PAGE_SIZE = 20;
const FEEDBACK_QUEUE_LIMIT = 20;
const MAX_ATTENDANCE_PAGE = 10_000;

const teacherLessonSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  topic: true,
  student: { select: { fullName: true, studentNumber: true } },
  classroom: { select: { name: true } },
  attendance: { select: { status: true, note: true } },
  feedback: { select: { focus: true, feedback: true, homework: true } }
} as const;

export type TeacherWorkspaceTab = "overview" | "lessons" | "students";

export { formatTeachingDateTime, getShanghaiDayRange } from "@/lib/teaching-time";

export function normalizeTeacherWorkspaceTab(value: string | string[] | undefined): TeacherWorkspaceTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "lessons" || tab === "students" ? tab : "overview";
}

export function normalizeAttendancePage(value: string | string[] | number | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = typeof candidate === "number" ? candidate : Number(candidate);
  if (!Number.isSafeInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_ATTENDANCE_PAGE);
}

async function queryTeacherReconciledHours(client: TeacherWorkspaceClient, teacherId: string, now: Date) {
  const { start, end } = getShanghaiMonthRange(now);
  const [result] = await client.$queryRaw<Array<{ reconciledHours: number | null }>>(Prisma.sql`
    SELECT COALESCE(
      SUM(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 3600.0),
      0
    )::double precision AS "reconciledHours"
    FROM "Lesson"
    WHERE "teacherId" = ${teacherId}
      AND "status" = 'COMPLETED'::"LessonStatus"
      AND "reversedAt" IS NULL
      AND "reconciledAt" >= ${start}
      AND "reconciledAt" < ${end}
  `);
  return Number(result?.reconciledHours ?? 0);
}

export async function loadTeacherWorkspace(
  userId: string,
  client: TeacherWorkspaceClient = prisma,
  now = new Date(),
  options: { attendancePage?: number } = {}
) {
  const profile = await client.teacherProfile.findUnique({
    where: { userId },
    select: { id: true, displayName: true }
  });
  const requestedAttendancePage = normalizeAttendancePage(options.attendancePage);

  if (!profile) {
    return {
      profile: null,
      lessons: [],
      todayLessons: [],
      feedbackDueLessons: [],
      students: [],
      reconciledHours: 0,
      metrics: { todayLessons: 0, attendanceDue: 0, feedbackDue: 0 },
      attendancePage: 1,
      attendancePageSize: ATTENDANCE_PAGE_SIZE,
      attendanceTotal: 0,
      attendanceTotalPages: 1
    };
  }

  const { start: todayStart, end: todayEnd } = getShanghaiDayRange(now);
  const attendanceWhere = {
    teacherId: profile.id,
    status: { not: "CANCELLED" as const },
    startsAt: { lt: now },
    attendance: { is: null }
  };
  const todayWhere = {
    teacherId: profile.id,
    status: { not: "CANCELLED" as const },
    startsAt: { gte: todayStart, lt: todayEnd }
  };
  const feedbackDueWhere = {
    teacherId: profile.id,
    status: "COMPLETED" as const,
    startsAt: { lt: now },
    attendance: { is: { status: "ATTENDED" as const } },
    feedback: { is: null }
  };
  const attendanceWork = client.lesson.count({ where: attendanceWhere }).then(async (attendanceTotal) => {
    const attendanceTotalPages = Math.max(1, Math.ceil(attendanceTotal / ATTENDANCE_PAGE_SIZE));
    const attendancePage = Math.min(requestedAttendancePage, attendanceTotalPages);
    const lessons = await client.lesson.findMany({
      where: attendanceWhere,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      skip: (attendancePage - 1) * ATTENDANCE_PAGE_SIZE,
      take: ATTENDANCE_PAGE_SIZE,
      select: teacherLessonSelect
    });
    return { lessons, attendancePage, attendanceTotal, attendanceTotalPages };
  });

  const [
    students,
    reconciledHours,
    pendingAttendance,
    feedbackDueLessons,
    todayLessons,
    upcomingLessons,
    todayLessonsCount,
    feedbackDue
  ] = await Promise.all([
    client.studentProfile.findMany({
      where: { teacherId: profile.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        goal: true,
        updatedAt: true
      }
    }),
    queryTeacherReconciledHours(client, profile.id, now),
    attendanceWork,
    client.lesson.findMany({
      where: feedbackDueWhere,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: FEEDBACK_QUEUE_LIMIT,
      select: teacherLessonSelect
    }),
    client.lesson.findMany({
      where: todayWhere,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: TODAY_LESSON_LIMIT,
      select: teacherLessonSelect
    }),
    client.lesson.findMany({
      where: {
        teacherId: profile.id,
        startsAt: { gte: todayEnd },
        status: { not: "CANCELLED" }
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: UPCOMING_LESSON_LIMIT,
      select: teacherLessonSelect
    }),
    client.lesson.count({ where: todayWhere }),
    client.lesson.count({ where: feedbackDueWhere })
  ]);

  const { lessons: pendingAttendanceLessons, attendancePage, attendanceTotal, attendanceTotalPages } = pendingAttendance;
  const lessons = Array.from(new Map(
    [...pendingAttendanceLessons, ...todayLessons, ...upcomingLessons].map((lesson) => [lesson.id, lesson])
  ).values());
  return {
    profile,
    lessons,
    todayLessons,
    feedbackDueLessons,
    students,
    reconciledHours,
    metrics: {
      todayLessons: todayLessonsCount,
      attendanceDue: attendanceTotal,
      feedbackDue
    },
    attendancePage,
    attendancePageSize: ATTENDANCE_PAGE_SIZE,
    attendanceTotal,
    attendanceTotalPages
  };
}
