import { LessonStatus, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";

const lessonFields = z.object({
  studentId: z.string().cuid(),
  teacherId: z.string().cuid(),
  campusId: z.string().trim().min(1).max(80).optional(),
  classroomId: z.string().cuid().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  topic: z.string().trim().min(2).max(160),
  googleEventId: z.string().trim().max(240).optional()
});

function validateLessonRange(startsAt: Date, endsAt: Date, context: z.RefinementCtx) {
  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMinutes <= 0) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Lesson end must be after start." });
  } else if (durationMinutes > 180) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "A lesson cannot exceed 180 minutes." });
  }
}

export const createLessonSchema = lessonFields.superRefine((input, context) => {
  validateLessonRange(input.startsAt, input.endsAt, context);
});

export const lessonPatchSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  classroomId: z.string().cuid().nullable().optional(),
  topic: z.string().trim().min(2).max(160).optional()
}).refine((input) => Object.keys(input).length > 0, "Provide at least one lesson field to update.");

type ConflictInput = {
  studentId: string;
  teacherId: string;
  classroomId?: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeLessonId?: string;
};

export function buildLessonConflictWhere(input: ConflictInput): Prisma.LessonWhereInput {
  return {
    id: input.excludeLessonId ? { not: input.excludeLessonId } : undefined,
    status: { notIn: [LessonStatus.CANCELLED, LessonStatus.RESCHEDULED] },
    startsAt: { lt: input.endsAt },
    endsAt: { gt: input.startsAt },
    OR: [
      { studentId: input.studentId },
      { teacherId: input.teacherId },
      ...(input.classroomId ? [{ classroomId: input.classroomId }] : [])
    ]
  };
}

export type ReconciliationDecision = "CONSUME" | "REVERSE" | "STATUS_ONLY" | "NOOP";

export function decideLessonReconciliation(
  lesson: { reconciledAt: Date | null; reversedAt: Date | null },
  requestedStatus: LessonStatus
): ReconciliationDecision {
  if (requestedStatus === LessonStatus.COMPLETED) {
    return lesson.reconciledAt ? "NOOP" : "CONSUME";
  }
  if (requestedStatus === LessonStatus.CANCELLED) {
    if (lesson.reconciledAt && !lesson.reversedAt) return "REVERSE";
    if (lesson.reconciledAt && lesson.reversedAt) return "NOOP";
  }
  return "STATUS_ONLY";
}

function conflictMessage(conflict: { studentId: string; teacherId: string; classroomId: string | null }, input: ConflictInput) {
  if (conflict.studentId === input.studentId) return "The student already has a lesson during this time.";
  if (conflict.teacherId === input.teacherId) return "The teacher already has a lesson during this time.";
  if (input.classroomId && conflict.classroomId === input.classroomId) return "The classroom is already occupied during this time.";
  return "The lesson conflicts with an existing schedule.";
}

export async function createLesson(
  input: z.infer<typeof createLessonSchema>,
  actorId: string,
  client: PrismaClient = prisma
) {
  return client.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUniqueOrThrow({
      where: { id: input.studentId },
      select: { id: true, studentNumber: true }
    });
    await tx.teacherProfile.findUniqueOrThrow({ where: { id: input.teacherId } });
    if (input.classroomId) {
      const classroom = await tx.classroom.findUniqueOrThrow({ where: { id: input.classroomId } });
      if (input.campusId && classroom.campusId !== input.campusId) {
        throw new ApiError("INVALID_CLASSROOM", "The selected classroom does not belong to this campus.", 422);
      }
    }

    const studentPackage = await tx.studentPackage.findFirst({
      where: {
        studentId: input.studentId,
        teacherId: input.teacherId,
        isActive: true,
        remainingLessons: { gt: 0 },
        expiresAt: { gt: new Date() }
      },
      orderBy: [{ expiresAt: "asc" }, { purchasedAt: "asc" }]
    });
    if (!studentPackage) throw new ApiError("NO_LESSON_BALANCE", "The student has no available lesson balance for this teacher.", 409);

    const reservedLessons = await tx.lesson.count({
      where: { studentPackageId: studentPackage.id, status: LessonStatus.SCHEDULED }
    });
    if (reservedLessons >= studentPackage.remainingLessons) {
      throw new ApiError("LESSON_BALANCE_RESERVED", "All remaining lessons in this package are already scheduled.", 409);
    }

    const conflictWhere = buildLessonConflictWhere(input);
    const conflict = await tx.lesson.findFirst({
      where: conflictWhere,
      select: { studentId: true, teacherId: true, classroomId: true }
    });
    if (conflict) throw new ApiError("SCHEDULE_CONFLICT", conflictMessage(conflict, input), 409);

    const lesson = await tx.lesson.create({
      data: {
        ...input,
        studentPackageId: studentPackage.id,
        unitPriceCents: studentPackage.unitPriceCents
      }
    });
    await recordStudentLifecycleEvent(tx, {
      studentId: student.id,
      studentNumber: student.studentNumber,
      actorId,
      eventType: studentLifecycleEventTypes.lessonScheduled,
      afterState: { lessonId: lesson.id, status: lesson.status }
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "lesson.create",
        entity: "Lesson",
        entityId: lesson.id,
        metadata: { studentId: input.studentId, teacherId: input.teacherId, studentPackageId: studentPackage.id }
      }
    });
    return { ...lesson, studentNumber: student.studentNumber };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateLesson(
  lessonId: string,
  input: z.infer<typeof lessonPatchSchema>,
  actorId: string,
  client: PrismaClient = prisma
) {
  return runSerializableTransaction(
    client,
    (tx) => updateLessonInTransaction(lessonId, input, actorId, tx)
  );
}

export async function updateLessonInTransaction(
  lessonId: string,
  input: z.infer<typeof lessonPatchSchema>,
  actorId: string,
  tx: Prisma.TransactionClient
) {
    const lesson = await tx.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        attendance: {
          select: { status: true, reconciliationDecision: true }
        },
        student: { select: { studentNumber: true } }
      }
    });
    if (input.status === LessonStatus.COMPLETED && lesson.attendance?.reconciliationDecision === "WAIVE") {
      throw new ApiError("ATTENDANCE_WAIVED", "A waived absence cannot consume a lesson.", 409);
    }
    if (
      input.status === LessonStatus.COMPLETED
      && (lesson.attendance?.status === "STUDENT_ABSENT" || lesson.attendance?.status === "STUDENT_LEAVE")
      && lesson.attendance.reconciliationDecision === "PENDING"
    ) {
      throw new ApiError(
        "ABSENCE_DECISION_REQUIRED",
        "The absence requires an administrator decision before the lesson can be consumed.",
        409
      );
    }
    if (lesson.reversedAt && input.status === LessonStatus.COMPLETED) {
      throw new ApiError("LESSON_REOPEN_UNSUPPORTED", "A reversed lesson cannot be completed again without full ledger reconciliation.", 422);
    }
    const startsAt = input.startsAt ?? lesson.startsAt;
    const endsAt = input.endsAt ?? lesson.endsAt;
    const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
    if (durationMinutes <= 0 || durationMinutes > 180) {
      throw new ApiError("INVALID_LESSON_RANGE", "Lesson times must define an interval between 1 and 180 minutes.", 422);
    }

    const classroomId = input.classroomId === undefined ? lesson.classroomId : input.classroomId;
    const changedFields: Array<"startsAt" | "endsAt" | "classroomId" | "topic" | "status"> = [];
    if (input.startsAt && input.startsAt.getTime() !== lesson.startsAt.getTime()) changedFields.push("startsAt");
    if (input.endsAt && input.endsAt.getTime() !== lesson.endsAt.getTime()) changedFields.push("endsAt");
    if (input.classroomId !== undefined && input.classroomId !== lesson.classroomId) changedFields.push("classroomId");
    if (input.topic !== undefined && input.topic !== lesson.topic) changedFields.push("topic");
    if (input.status !== undefined && input.status !== lesson.status) changedFields.push("status");
    if (changedFields.length === 0) return lesson;

    if (changedFields.some((field) => field === "startsAt" || field === "endsAt" || field === "classroomId")) {
      const conflictInput = {
        studentId: lesson.studentId,
        teacherId: lesson.teacherId,
        classroomId,
        startsAt,
        endsAt,
        excludeLessonId: lesson.id
      };
      const conflict = await tx.lesson.findFirst({
        where: buildLessonConflictWhere(conflictInput),
        select: { studentId: true, teacherId: true, classroomId: true }
      });
      if (conflict) throw new ApiError("SCHEDULE_CONFLICT", conflictMessage(conflict, conflictInput), 409);
    }

    const requestedStatus = input.status ?? lesson.status;
    const decision = decideLessonReconciliation(lesson, requestedStatus);
    const baseUpdate = {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      classroomId: input.classroomId,
      topic: input.topic,
      status: input.status
    };

    if (decision === "CONSUME") {
      if (!lesson.studentPackageId) throw new ApiError("LESSON_PACKAGE_REQUIRED", "This lesson is not linked to a student package.", 422);
      const changed = await tx.studentPackage.updateMany({
        where: { id: lesson.studentPackageId, isActive: true, remainingLessons: { gt: 0 } },
        data: { consumedLessons: { increment: 1 }, remainingLessons: { decrement: 1 } }
      });
      if (changed.count !== 1) throw new ApiError("NO_LESSON_BALANCE", "The student has no remaining lessons.", 409);

      const hours = durationMinutes / 60;
      const profileChanged = await tx.studentProfile.updateMany({
        where: { id: lesson.studentId, remainingHours: { gte: hours } },
        data: { consumedHours: { increment: hours }, remainingHours: { decrement: hours } }
      });
      if (profileChanged.count !== 1) {
        throw new ApiError("INCONSISTENT_HOUR_BALANCE", "The student's hour balance is inconsistent with the package.", 409);
      }

      await tx.lessonLedger.create({
        data: { lessonId, studentPackageId: lesson.studentPackageId, actorId, kind: "CONSUME", lessonDelta: -1, reason: "Lesson completed" }
      });
      const updated = await tx.lesson.update({
        where: { id: lessonId },
        data: { ...baseUpdate, status: LessonStatus.COMPLETED, reconciledAt: new Date() }
      });
      await recordStudentLifecycleEvent(tx, {
        studentId: lesson.studentId,
        studentNumber: lesson.student.studentNumber,
        actorId,
        eventType: studentLifecycleEventTypes.lessonCompleted,
        beforeState: { lessonId, status: lesson.status },
        afterState: { lessonId, status: updated.status }
      });
      await tx.auditLog.create({ data: { actorId, action: "lesson.complete", entity: "Lesson", entityId: lessonId } });
      return updated;
    }

    if (decision === "REVERSE") {
      if (!lesson.studentPackageId) throw new ApiError("LESSON_PACKAGE_REQUIRED", "This lesson is not linked to a student package.", 422);
      const changed = await tx.studentPackage.updateMany({
        where: { id: lesson.studentPackageId, consumedLessons: { gt: 0 } },
        data: { consumedLessons: { decrement: 1 }, remainingLessons: { increment: 1 } }
      });
      if (changed.count !== 1) throw new ApiError("LESSON_REVERSE_CONFLICT", "The consumed lesson could not be reversed.", 409);

      const hours = durationMinutes / 60;
      const profileChanged = await tx.studentProfile.updateMany({
        where: { id: lesson.studentId, consumedHours: { gte: hours } },
        data: { consumedHours: { decrement: hours }, remainingHours: { increment: hours } }
      });
      if (profileChanged.count !== 1) {
        throw new ApiError("INCONSISTENT_HOUR_BALANCE", "The student's consumed-hour balance could not be reversed.", 409);
      }

      await tx.lessonLedger.create({
        data: { lessonId, studentPackageId: lesson.studentPackageId, actorId, kind: "REVERSE", lessonDelta: 1, reason: "Completed lesson cancelled" }
      });
      const updated = await tx.lesson.update({
        where: { id: lessonId },
        data: { ...baseUpdate, status: LessonStatus.CANCELLED, reversedAt: new Date() }
      });
      await recordStudentLifecycleEvent(tx, {
        studentId: lesson.studentId,
        studentNumber: lesson.student.studentNumber,
        actorId,
        eventType: studentLifecycleEventTypes.lessonReversed,
        beforeState: { lessonId, status: lesson.status },
        afterState: { lessonId, status: updated.status }
      });
      await tx.auditLog.create({ data: { actorId, action: "lesson.reverse", entity: "Lesson", entityId: lessonId } });
      return updated;
    }

    const updated = await tx.lesson.update({ where: { id: lessonId }, data: baseUpdate });
    if (input.status === LessonStatus.CANCELLED && lesson.status !== LessonStatus.CANCELLED) {
      await recordStudentLifecycleEvent(tx, {
        studentId: lesson.studentId,
        studentNumber: lesson.student.studentNumber,
        actorId,
        eventType: studentLifecycleEventTypes.lessonCancelled,
        beforeState: { lessonId, status: lesson.status },
        afterState: { lessonId, status: updated.status }
      });
    } else {
      await recordStudentLifecycleEvent(tx, {
        studentId: lesson.studentId,
        studentNumber: lesson.student.studentNumber,
        actorId,
        eventType: studentLifecycleEventTypes.lessonUpdated,
        beforeState: {
          lessonId,
          status: lesson.status,
          startsAt: lesson.startsAt.toISOString(),
          endsAt: lesson.endsAt.toISOString(),
          classroomId: lesson.classroomId
        },
        afterState: {
          lessonId,
          status: updated.status,
          startsAt: updated.startsAt.toISOString(),
          endsAt: updated.endsAt.toISOString(),
          classroomId: updated.classroomId,
          changedFields
        }
      });
    }
    await tx.auditLog.create({
      data: { actorId, action: "lesson.update", entity: "Lesson", entityId: lessonId, metadata: { fields: changedFields } }
    });
    return updated;
}
