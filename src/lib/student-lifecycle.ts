import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import type { CampusTransferReason } from "@/lib/student-lifecycle-schemas";

export const studentLifecycleEventTypes = {
  enrolled: "ENROLLED",
  enrollmentDateChanged: "ENROLLMENT_DATE_CHANGED",
  campusTransferred: "CAMPUS_TRANSFERRED",
  teacherChanged: "TEACHER_CHANGED",
  profileUpdated: "PROFILE_UPDATED",
  packageAssigned: "PACKAGE_ASSIGNED",
  lessonScheduled: "LESSON_SCHEDULED",
  lessonUpdated: "LESSON_UPDATED",
  lessonCompleted: "LESSON_COMPLETED",
  lessonCancelled: "LESSON_CANCELLED",
  lessonReversed: "LESSON_REVERSED",
  attendanceRecorded: "ATTENDANCE_RECORDED",
  absenceDecided: "ABSENCE_DECIDED",
  accountCreated: "ACCOUNT_CREATED",
  passwordReset: "PASSWORD_RESET",
  accountDeleted: "ACCOUNT_DELETED"
} as const;

type LifecycleStore = Pick<Prisma.TransactionClient, "studentLifecycleEvent">;
type StudentLifecycleCommandStore = Pick<Prisma.TransactionClient, "studentProfile" | "campus" | "studentLifecycleEvent">;

async function readStudentRecordMutationResult(tx: StudentLifecycleCommandStore, studentId: string) {
  const student = await tx.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      campusId: true,
      enrolledAt: true,
      updatedAt: true,
      campus: { select: { name: true } }
    }
  });
  return {
    campusId: student.campusId,
    campusName: student.campus?.name ?? "-",
    enrolledAt: student.enrolledAt,
    updatedAt: student.updatedAt
  };
}

export async function recordStudentLifecycleEvent(
  tx: LifecycleStore,
  input: {
    studentId: string | null;
    studentNumber: string;
    actorId?: string | null;
    eventType: (typeof studentLifecycleEventTypes)[keyof typeof studentLifecycleEventTypes];
    reasonCode?: string | null;
    beforeState?: Prisma.InputJsonValue;
    afterState?: Prisma.InputJsonValue;
    note?: string | null;
  }
) {
  await tx.studentLifecycleEvent.create({ data: input });
}

export async function transferStudentCampus(
  input: {
    studentId: string;
    campusId: string;
    reasonCode: CampusTransferReason;
    note?: string;
    expectedUpdatedAt: Date;
  },
  actorId: string,
  tx: StudentLifecycleCommandStore
) {
  const student = await tx.studentProfile.findUniqueOrThrow({ where: { id: input.studentId } });
  if (student.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    throw new ApiError("STUDENT_CHANGED", "The student was updated by someone else. Refresh and try again.", 409);
  }
  if (student.campusId === input.campusId) {
    throw new ApiError("SAME_CAMPUS", "The student is already assigned to this campus.", 422);
  }
  if (!student.campusId) {
    throw new ApiError("STUDENT_CAMPUS_REQUIRED", "The student's current campus is required before transfer.", 422);
  }

  const [previousCampus, nextCampus] = await Promise.all([
    tx.campus.findUniqueOrThrow({ where: { id: student.campusId } }),
    tx.campus.findUniqueOrThrow({ where: { id: input.campusId } })
  ]);
  const changed = await tx.studentProfile.updateMany({
    where: { id: input.studentId, updatedAt: input.expectedUpdatedAt },
    data: { campusId: input.campusId }
  });
  if (changed.count !== 1) {
    throw new ApiError("STUDENT_CHANGED", "The student was updated by someone else. Refresh and try again.", 409);
  }

  await recordStudentLifecycleEvent(tx, {
    studentId: student.id,
    studentNumber: student.studentNumber,
    actorId,
    eventType: studentLifecycleEventTypes.campusTransferred,
    reasonCode: input.reasonCode,
    beforeState: { campusId: previousCampus.id, campusName: previousCampus.name },
    afterState: { campusId: nextCampus.id, campusName: nextCampus.name },
    note: input.note
  });

  return readStudentRecordMutationResult(tx, input.studentId);
}

export async function correctStudentEnrollmentDate(
  input: {
    studentId: string;
    enrolledAt: Date;
    expectedUpdatedAt: Date;
  },
  actorId: string,
  tx: StudentLifecycleCommandStore
) {
  const student = await tx.studentProfile.findUniqueOrThrow({ where: { id: input.studentId } });
  const changed = await tx.studentProfile.updateMany({
    where: { id: input.studentId, updatedAt: input.expectedUpdatedAt },
    data: { enrolledAt: input.enrolledAt }
  });
  if (changed.count !== 1) {
    throw new ApiError("STUDENT_CHANGED", "The student was updated by someone else. Refresh and try again.", 409);
  }

  await recordStudentLifecycleEvent(tx, {
    studentId: student.id,
    studentNumber: student.studentNumber,
    actorId,
    eventType: studentLifecycleEventTypes.enrollmentDateChanged,
    beforeState: { enrolledAt: student.enrolledAt.toISOString() },
    afterState: { enrolledAt: input.enrolledAt.toISOString() }
  });

  return readStudentRecordMutationResult(tx, input.studentId);
}
