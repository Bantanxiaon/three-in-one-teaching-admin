import { LessonStatus, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { absenceDecisionSchema, teacherAttendanceSchema } from "@/lib/lesson-attendance-schemas";
import { updateLessonInTransaction } from "@/lib/lesson-service";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";

export type AttendanceActor = { userId: string };

type AttendanceInput = z.infer<typeof teacherAttendanceSchema> & { lessonId: string };
type AbsenceDecisionInput = z.infer<typeof absenceDecisionSchema> & { lessonId: string };
type AttendanceClient = Pick<PrismaClient, "$transaction">;

class LessonAttendanceCreateRaceError extends Error {
  constructor(readonly cause: unknown) {
    super("Lesson attendance was created concurrently.");
    this.name = "LessonAttendanceCreateRaceError";
  }
}

function isLessonAttendanceLessonIdUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") return false;
  if (!("meta" in error) || typeof error.meta !== "object" || error.meta === null || !("target" in error.meta)) return false;
  const target = error.meta.target;
  return Array.isArray(target)
    ? target.includes("lessonId")
    : typeof target === "string" && target.includes("lessonId");
}

async function createLessonAttendance(
  tx: Prisma.TransactionClient,
  data: Prisma.LessonAttendanceCreateArgs["data"]
) {
  try {
    return await tx.lessonAttendance.create({ data });
  } catch (error) {
    if (isLessonAttendanceLessonIdUniqueViolation(error)) {
      throw new LessonAttendanceCreateRaceError(error);
    }
    throw error;
  }
}

async function loadTeacherLesson(tx: Prisma.TransactionClient, lessonId: string, actor: AttendanceActor) {
  const teacher = await tx.teacherProfile.findUniqueOrThrow({ where: { userId: actor.userId }, select: { id: true } });
  const lesson = await tx.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { student: { select: { studentNumber: true } } }
  });
  if (lesson.teacherId !== teacher.id) {
    throw new ApiError("LESSON_NOT_OWNED", "Teachers can only record attendance for their own lessons.", 403);
  }
  return lesson;
}

export async function recordLessonAttendance(
  input: AttendanceInput,
  actor: AttendanceActor,
  client: AttendanceClient = prisma
) {
  const attendanceInput = teacherAttendanceSchema.parse(input);
  let lastRaceError: LessonAttendanceCreateRaceError | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await runSerializableTransaction(client, async (tx) => {
        const lesson = await loadTeacherLesson(tx, input.lessonId, actor);
        const existing = await tx.lessonAttendance.findUnique({ where: { lessonId: input.lessonId } });
        if (existing) {
          if (existing.status === attendanceInput.status) return { attendance: existing, lesson };
          throw new ApiError("ATTENDANCE_STATUS_CONFLICT", "Attendance has already been recorded for this lesson.", 409);
        }

        const attendance = await createLessonAttendance(tx, {
          lessonId: input.lessonId,
          status: attendanceInput.status,
          note: attendanceInput.note,
          recordedById: actor.userId
        });
        const reconciledLesson = attendanceInput.status === "ATTENDED"
          ? await updateLessonInTransaction(input.lessonId, { status: LessonStatus.COMPLETED }, actor.userId, tx)
          : lesson;

        await recordStudentLifecycleEvent(tx, {
          studentId: lesson.studentId,
          studentNumber: lesson.student.studentNumber,
          actorId: actor.userId,
          eventType: studentLifecycleEventTypes.attendanceRecorded,
          afterState: { lessonId: lesson.id, status: attendanceInput.status, reconciliationDecision: attendance.reconciliationDecision }
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: "lesson.attendance.record",
            entity: "LessonAttendance",
            entityId: attendance.id,
            metadata: { lessonId: lesson.id, status: attendanceInput.status }
          }
        });
        return { attendance, lesson: reconciledLesson };
      });
    } catch (error) {
      if (!(error instanceof LessonAttendanceCreateRaceError)) throw error;
      lastRaceError = error;
    }
  }

  if (lastRaceError) throw lastRaceError.cause;
  throw new Error("Lesson attendance create race retry limit was exhausted.");
}

export async function decideAbsentLesson(
  input: AbsenceDecisionInput,
  actor: AttendanceActor,
  client: AttendanceClient = prisma
) {
  const decisionInput = absenceDecisionSchema.parse(input);
  return runSerializableTransaction(client, async (tx) => {
    const lesson = await tx.lesson.findUniqueOrThrow({
      where: { id: input.lessonId },
      include: { student: { select: { studentNumber: true } } }
    });
    const attendance = await tx.lessonAttendance.findUnique({ where: { lessonId: input.lessonId } });
    if (!attendance) {
      throw new ApiError("ABSENCE_ATTENDANCE_REQUIRED", "An absence record is required before reconciliation.", 422);
    }
    if (attendance.status !== "STUDENT_ABSENT" && attendance.status !== "STUDENT_LEAVE") {
      throw new ApiError("ABSENCE_DECISION_NOT_ALLOWED", "Only student absences can be reconciled.", 422);
    }
    if (attendance.reconciliationDecision !== "PENDING") {
      if (attendance.reconciliationDecision === decisionInput.decision) {
        const reconciledLesson = decisionInput.decision === "CONSUME"
          ? await updateLessonInTransaction(input.lessonId, { status: LessonStatus.COMPLETED }, actor.userId, tx)
          : await updateLessonInTransaction(input.lessonId, { status: LessonStatus.CANCELLED }, actor.userId, tx);
        return { attendance, lesson: reconciledLesson };
      }
      throw new ApiError("ABSENCE_DECISION_CONFLICT", "The absence has already been reconciled with a different decision.", 409);
    }

    const decidedAt = new Date();
    const decidedAttendance = await tx.lessonAttendance.update({
      where: { lessonId: input.lessonId },
      data: {
        reconciliationDecision: decisionInput.decision,
        decidedById: actor.userId,
        decidedAt,
        ...(decisionInput.note === undefined ? {} : { decisionNote: decisionInput.note })
      }
    });
    const reconciledLesson = decisionInput.decision === "CONSUME"
      ? await updateLessonInTransaction(input.lessonId, { status: LessonStatus.COMPLETED }, actor.userId, tx)
      : await updateLessonInTransaction(input.lessonId, { status: LessonStatus.CANCELLED }, actor.userId, tx);

    await recordStudentLifecycleEvent(tx, {
      studentId: lesson.studentId,
      studentNumber: lesson.student.studentNumber,
      actorId: actor.userId,
      eventType: studentLifecycleEventTypes.absenceDecided,
      afterState: { lessonId: lesson.id, decision: decisionInput.decision },
      note: decisionInput.note
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "lesson.attendance.decide",
        entity: "LessonAttendance",
        entityId: decidedAttendance.id,
        metadata: {
          lessonId: lesson.id,
          decision: decisionInput.decision,
          decisionNote: decisionInput.note ?? null
        }
      }
    });
    return { attendance: decidedAttendance, lesson: reconciledLesson };
  });
}
