import { prisma } from "@/lib/prisma";
import { getShanghaiDayRange } from "@/lib/teaching-time";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace-data";
import type { MiniSessionUser } from "@/lib/mini-session";

const studentLessonSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  topic: true,
  teacher: { select: { displayName: true } },
  classroom: { select: { name: true } },
  attendance: { select: { status: true } },
  feedback: { select: { focus: true, feedback: true, homework: true, updatedAt: true } },
} as const;

function lessonSummary(lesson: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  topic: string;
  teacher: { displayName: string };
  classroom: { name: string } | null;
  attendance: { status: string } | null;
  feedback: { focus: string | null; feedback: string | null; homework: string | null; updatedAt: Date } | null;
}) {
  return {
    id: lesson.id,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
    status: lesson.status,
    topic: lesson.topic,
    teacherName: lesson.teacher.displayName,
    classroomName: lesson.classroom?.name ?? null,
    attendanceStatus: lesson.attendance?.status ?? "PENDING",
    feedback: lesson.feedback ? {
      focus: lesson.feedback.focus,
      feedback: lesson.feedback.feedback,
      homework: lesson.feedback.homework,
      updatedAt: lesson.feedback.updatedAt.toISOString(),
    } : null,
  };
}

async function studentPortal(userId: string, now: Date) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      studentNumber: true,
      fullName: true,
      enrolledAt: true,
      totalHours: true,
      consumedHours: true,
      remainingHours: true,
      teacher: { select: { displayName: true } },
      campus: { select: { name: true } },
    },
  });

  if (!profile) {
    return { kind: "student" as const, profile: null, nextLesson: null, recentLessons: [], practiceLogs: [], packages: [] };
  }

  const [nextLesson, recentLessons, practiceLogs, packages] = await Promise.all([
    prisma.lesson.findFirst({
      where: { studentId: profile.id, startsAt: { gte: now }, status: { not: "CANCELLED" } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: studentLessonSelect,
    }),
    prisma.lesson.findMany({
      where: { studentId: profile.id, startsAt: { lt: now } },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: 8,
      select: studentLessonSelect,
    }),
    prisma.practiceLog.findMany({
      where: { studentId: profile.id },
      orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
      take: 12,
      select: { id: true, minutes: true, piece: true, notes: true, loggedAt: true },
    }),
    prisma.studentPackage.findMany({
      where: { studentId: profile.id, isActive: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        packageName: true,
        lessonDurationMinutes: true,
        totalLessons: true,
        consumedLessons: true,
        remainingLessons: true,
        expiresAt: true,
        teacher: { select: { displayName: true } },
      },
    }),
  ]);

  return {
    kind: "student" as const,
    profile: {
      id: profile.id,
      studentNumber: profile.studentNumber,
      fullName: profile.fullName,
      enrolledAt: profile.enrolledAt.toISOString(),
      totalHours: Number(profile.totalHours),
      consumedHours: Number(profile.consumedHours),
      remainingHours: Number(profile.remainingHours),
      teacherName: profile.teacher?.displayName ?? null,
      campusName: profile.campus?.name ?? null,
    },
    nextLesson: nextLesson ? lessonSummary(nextLesson) : null,
    recentLessons: recentLessons.map(lessonSummary),
    practiceLogs: practiceLogs.map((log) => ({ ...log, loggedAt: log.loggedAt.toISOString() })),
    packages: packages.map(({ teacher, ...item }) => ({
      ...item,
      expiresAt: item.expiresAt.toISOString(),
      teacherName: teacher.displayName,
    })),
  };
}

function teacherLesson(lesson: Awaited<ReturnType<typeof loadTeacherWorkspace>>["lessons"][number]) {
  return {
    id: lesson.id,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
    status: lesson.status,
    topic: lesson.topic,
    studentName: lesson.student.fullName,
    studentNumber: lesson.student.studentNumber,
    classroomName: lesson.classroom?.name ?? null,
    attendance: lesson.attendance,
    feedback: lesson.feedback,
  };
}

async function teacherPortal(userId: string, now: Date) {
  const workspace = await loadTeacherWorkspace(userId, prisma, now);
  return {
    kind: "teacher" as const,
    profile: workspace.profile,
    metrics: { ...workspace.metrics, reconciledHours: workspace.reconciledHours },
    todayLessons: workspace.todayLessons.map(teacherLesson),
    actionLessons: workspace.lessons.slice(0, 30).map(teacherLesson),
    feedbackDueLessons: workspace.feedbackDueLessons.map(teacherLesson),
    students: workspace.students.map((student) => ({ ...student, updatedAt: student.updatedAt.toISOString() })),
  };
}

async function adminPortal(now: Date) {
  const { start, end } = getShanghaiDayRange(now);
  const [students, teachers, pendingApplications, todayLessons, activePackages] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.accountApplication.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.lesson.count({ where: { startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } } }),
    prisma.studentPackage.count({ where: { isActive: true, expiresAt: { gte: now } } }),
  ]);
  return {
    kind: "admin" as const,
    generatedAt: now.toISOString(),
    metrics: { students, teachers, pendingApplications, todayLessons, activePackages },
  };
}

export async function getMiniPortal(user: Pick<MiniSessionUser, "id" | "workspace">, now = new Date()) {
  if (user.workspace === "student") return studentPortal(user.id, now);
  if (user.workspace === "teacher") return teacherPortal(user.id, now);
  return adminPortal(now);
}
