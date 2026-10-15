import type { AdminPendingAbsence } from "@/components/dashboard/admin-types";
import { prisma } from "@/lib/prisma";

type AttendanceDataClient = Pick<typeof prisma, "lessonAttendance">;

export async function loadAdminAttendanceData(activeTab: string, client: AttendanceDataClient = prisma): Promise<AdminPendingAbsence[]> {
  if (activeTab !== "attendance") return [];

  const attendances = await client.lessonAttendance.findMany({
    where: {
      status: { in: ["STUDENT_ABSENT", "STUDENT_LEAVE"] },
      reconciliationDecision: "PENDING"
    },
    orderBy: { recordedAt: "asc" },
    take: 100,
    select: {
      status: true,
      recordedAt: true,
      lesson: {
        select: {
          id: true,
          startsAt: true,
          student: { select: { fullName: true, studentNumber: true } },
          teacher: { select: { displayName: true } }
        }
      }
    }
  });

  return attendances.map((item) => ({
    lessonId: item.lesson.id,
    studentName: item.lesson.student.fullName,
    studentNumber: item.lesson.student.studentNumber,
    teacherName: item.lesson.teacher.displayName,
    startsAt: item.lesson.startsAt.toISOString(),
    attendanceStatus: item.status,
    recordedAt: item.recordedAt.toISOString()
  }));
}
