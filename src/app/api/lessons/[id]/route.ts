import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { lessonPatchSchema, updateLesson } from "@/lib/lesson-service";
import { sendLessonBalanceNotification } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { sendLessonBalanceWechat } from "@/lib/wechat-notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("lesson:reconcile");
    const { id } = await params;
    const input = lessonPatchSchema.parse(await request.json());
    const previous = input.status === "COMPLETED"
      ? await prisma.lesson.findUnique({ where: { id }, select: { status: true } })
      : null;
    const lesson = await updateLesson(id, input, session.user.id);

    if (input.status === "COMPLETED" && previous?.status !== "COMPLETED") {
      try {
        const details = await prisma.lesson.findUnique({
          where: { id },
          select: {
            studentId: true,
            startsAt: true,
            teacher: { select: { displayName: true } },
            studentPackage: {
              select: { totalLessons: true, consumedLessons: true, remainingLessons: true }
            },
            student: {
              select: {
                fullName: true,
                studentNumber: true,
                user: { select: { id: true, email: true, preferredLocale: true } }
              }
            }
          }
        });
        if (details?.studentPackage && details.student.user) {
          const locale = details.student.user.preferredLocale === "en" || details.student.user.preferredLocale === "ja"
            ? details.student.user.preferredLocale
            : "zh";
          const nextLesson = await prisma.lesson.findFirst({
            where: { studentId: details.studentId, status: "SCHEDULED", startsAt: { gt: new Date() } },
            orderBy: { startsAt: "asc" },
            select: { startsAt: true }
          });
          try {
            await sendLessonBalanceNotification({
              to: details.student.user.email,
              studentName: details.student.fullName,
              studentNumber: details.student.studentNumber,
              teacherName: details.teacher.displayName,
              remainingLessons: details.studentPackage.remainingLessons,
              completedLessons: details.studentPackage.consumedLessons,
              totalLessons: details.studentPackage.totalLessons,
              nextLessonAt: nextLesson?.startsAt,
              locale
            });
          } catch {
            console.error("Lesson balance email notification failed");
          }
          try {
            await sendLessonBalanceWechat({
              approvedUserId: details.student.user.id,
              studentNumber: details.student.studentNumber,
              studentName: details.student.fullName,
              teacherName: details.teacher.displayName,
              remainingLessons: details.studentPackage.remainingLessons,
              nextLessonAt: nextLesson?.startsAt ?? details.startsAt,
              locale
            });
          } catch {
            console.error("Lesson balance WeChat notification failed");
          }
        }
      } catch {
        console.error("Lesson balance notification detail lookup failed");
      }
    }

    return ok(lesson);
  } catch (error) { return handleApiError(error); }
}
