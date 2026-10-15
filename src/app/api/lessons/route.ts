import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api-response";
import { createLesson, createLessonSchema } from "@/lib/lesson-service";
import { assertPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sendLessonScheduledNotification } from "@/lib/mail";
import { sendLessonScheduledWechat } from "@/lib/wechat-notifications";

const lessonSafeSelect = {
  id: true,
  studentId: true,
  teacherId: true,
  campusId: true,
  classroomId: true,
  studentPackageId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  topic: true,
  googleEventId: true,
  reconciledAt: true,
  reversedAt: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, fullName: true } },
  teacher: { select: { id: true, displayName: true, slug: true } },
  classroom: { select: { id: true, name: true } },
  feedback: true
} satisfies Prisma.LessonSelect;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) throw new Error("Missing permission: lesson:read-own");
    const isAdmin = ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(session.user.role);
    const where = isAdmin ? {} : session.user.role === "TEACHER" ? { teacher: { userId: session.user.id } } : { student: { userId: session.user.id } };
    return ok(await prisma.lesson.findMany({ where, orderBy: { startsAt: "asc" }, take: 100, select: lessonSafeSelect }));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    assertPermission(session?.user?.role, "admin:write");
    const input = createLessonSchema.parse(await request.json());
    const lesson = await createLesson(input, session!.user.id);
    try {
      const details = await prisma.lesson.findUnique({
        where: { id: lesson.id },
        select: {
          startsAt: true,
          endsAt: true,
          topic: true,
          student: { select: { fullName: true, user: { select: { id: true, email: true } } } },
          teacher: { select: { displayName: true } },
          classroom: { select: { name: true } },
          studentPackage: { select: { remainingLessons: true } }
        }
      });
      if (details) {
        try {
          await sendLessonScheduledNotification({
            to: details.student.user?.email,
            studentName: details.student.fullName,
            studentNumber: lesson.studentNumber,
            teacherName: details.teacher.displayName,
            startsAt: details.startsAt,
            endsAt: details.endsAt,
            topic: details.topic,
            classroomName: details.classroom?.name,
            locale: "zh"
          });
        } catch {
          console.error("Lesson scheduled email notification failed");
        }
        if (details.student.user) {
          try {
            await sendLessonScheduledWechat({
              approvedUserId: details.student.user.id,
              studentNumber: lesson.studentNumber,
              studentName: details.student.fullName,
              teacherName: details.teacher.displayName,
              startsAt: details.startsAt,
              endsAt: details.endsAt,
              remainingLessons: details.studentPackage?.remainingLessons ?? 0,
              locale: "zh"
            });
          } catch {
            console.error("Lesson scheduled WeChat notification failed");
          }
        }
      }
    } catch {
      console.error("Lesson notification detail lookup failed");
    }
    return ok(lesson, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
