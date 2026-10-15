import { describe, expect, it, vi } from "vitest";
import { decideAbsentLesson, recordLessonAttendance } from "@/lib/lesson-attendance";

const teacherActor = { userId: "teacher-user-1" };
const adminActor = { userId: "admin-user-1" };

function scheduledLesson() {
  return {
    id: "lesson-1",
    studentId: "student-1",
    teacherId: "teacher-1",
    studentPackageId: "package-1",
    startsAt: new Date("2099-06-28T10:00:00.000Z"),
    endsAt: new Date("2099-06-28T10:45:00.000Z"),
    status: "SCHEDULED",
    reconciledAt: null,
    reversedAt: null,
    student: { studentNumber: "CYBJ0103" }
  };
}

function attendanceStore(options?: { attendance?: Record<string, unknown> | null; teacherId?: string }) {
  const lesson = { ...scheduledLesson(), teacherId: options?.teacherId ?? "teacher-1" };
  return {
    teacherProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "teacher-1" }) },
    lesson: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(lesson),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...lesson, ...data })),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    lessonAttendance: {
      findUnique: vi.fn().mockResolvedValue(options?.attendance ?? null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "attendance-1", ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "attendance-1", ...options?.attendance, ...data }))
    },
    studentPackage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    studentProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    lessonLedger: { create: vi.fn().mockResolvedValue({ id: "ledger-1" }) },
    studentLifecycleEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
  };
}

function clientFor(tx: ReturnType<typeof attendanceStore>) {
  return { $transaction: vi.fn((operation) => operation(tx)) };
}

describe("lesson attendance", () => {
  it("allows a teacher to record only their own lesson", async () => {
    const tx = attendanceStore({ teacherId: "teacher-2" });

    await expect(recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED" }, teacherActor, clientFor(tx) as never))
      .rejects.toMatchObject({ code: "LESSON_NOT_OWNED", status: 403 });
    expect(tx.lessonAttendance.create).not.toHaveBeenCalled();
  });

  it("marks ATTENDED and consumes exactly one lesson atomically", async () => {
    const tx = attendanceStore();
    const client = clientFor(tx);

    const result = await recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED", note: "  Sound balance  " }, teacherActor, client as never);

    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(tx.lessonAttendance.create).toHaveBeenCalledWith({ data: expect.objectContaining({ lessonId: "lesson-1", status: "ATTENDED", note: "Sound balance" }) });
    expect(tx.studentPackage.updateMany).toHaveBeenCalledOnce();
    expect(tx.studentProfile.updateMany).toHaveBeenCalledOnce();
    expect(tx.lessonLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({ lessonId: "lesson-1", kind: "CONSUME", actorId: "teacher-user-1" }) });
    expect(tx.lesson.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(tx.studentLifecycleEvent.create).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(result.lesson.status).toBe("COMPLETED");
  });

  it("treats a duplicate ATTENDED request as idempotent", async () => {
    const existing = { id: "attendance-1", lessonId: "lesson-1", status: "ATTENDED", reconciliationDecision: "PENDING" };
    const tx = attendanceStore({ attendance: existing });

    const result = await recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED" }, teacherActor, clientFor(tx) as never);

    expect(result.attendance).toBe(existing);
    expect(tx.lessonAttendance.create).not.toHaveBeenCalled();
    expect(tx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(tx.lessonLedger.create).not.toHaveBeenCalled();
  });

  it("retries a concurrent first ATTENDED unique conflict and returns the stored attendance", async () => {
    const existing = { id: "attendance-1", lessonId: "lesson-1", status: "ATTENDED", reconciliationDecision: "PENDING" };
    const winningTx = attendanceStore();
    winningTx.lessonAttendance.create.mockResolvedValue(existing);
    const conflictingTx = attendanceStore();
    conflictingTx.lessonAttendance.create.mockRejectedValue({ code: "P2002", meta: { target: ["lessonId"] } });
    const replayTx = attendanceStore({ attendance: existing });
    const transactions = [winningTx, conflictingTx, replayTx];
    const client = { $transaction: vi.fn((operation) => operation(transactions.shift()!)) };

    const [winner, replay] = await Promise.all([
      recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED" }, teacherActor, client as never),
      recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED" }, teacherActor, client as never)
    ]);

    expect(winner.attendance).toBe(existing);
    expect(replay.attendance).toBe(existing);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(winningTx.studentPackage.updateMany).toHaveBeenCalledOnce();
    expect(conflictingTx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(replayTx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(winningTx.lessonLedger.create).toHaveBeenCalledOnce();
    expect(conflictingTx.lessonLedger.create).not.toHaveBeenCalled();
    expect(replayTx.lessonLedger.create).not.toHaveBeenCalled();
  });

  it("keeps a conflicting attendance status as a conflict after a concurrent create race", async () => {
    const existing = { id: "attendance-1", lessonId: "lesson-1", status: "STUDENT_ABSENT", reconciliationDecision: "PENDING" };
    const conflictingTx = attendanceStore();
    conflictingTx.lessonAttendance.create.mockRejectedValue({ code: "P2002", meta: { target: ["lessonId"] } });
    const replayTx = attendanceStore({ attendance: existing });
    const transactions = [conflictingTx, replayTx];
    const client = { $transaction: vi.fn((operation) => operation(transactions.shift()!)) };

    await expect(recordLessonAttendance({ lessonId: "lesson-1", status: "ATTENDED" }, teacherActor, client as never))
      .rejects.toMatchObject({ code: "ATTENDANCE_STATUS_CONFLICT", status: 409 });
    expect(conflictingTx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(replayTx.studentPackage.updateMany).not.toHaveBeenCalled();
  });

  it("records absence without consuming a lesson", async () => {
    const tx = attendanceStore();

    const result = await recordLessonAttendance({ lessonId: "lesson-1", status: "STUDENT_ABSENT" }, teacherActor, clientFor(tx) as never);

    expect(result.attendance.status).toBe("STUDENT_ABSENT");
    expect(tx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(tx.studentProfile.updateMany).not.toHaveBeenCalled();
    expect(tx.lessonLedger.create).not.toHaveBeenCalled();
    expect(tx.lesson.update).not.toHaveBeenCalled();
  });

  it("lets an administrator consume an absent lesson with reconciliation side effects", async () => {
    const absent = { id: "attendance-1", lessonId: "lesson-1", status: "STUDENT_LEAVE", reconciliationDecision: "PENDING" };
    const tx = attendanceStore({ attendance: absent });
    const client = clientFor(tx);

    await decideAbsentLesson({ lessonId: "lesson-1", decision: "CONSUME", note: "  Confirmed by guardian  " }, adminActor, client as never);

    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(tx.lessonAttendance.update).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1" },
      data: expect.objectContaining({
        reconciliationDecision: "CONSUME",
        decidedById: "admin-user-1",
        decidedAt: expect.any(Date),
        decisionNote: "Confirmed by guardian"
      })
    });
    expect(tx.lessonAttendance.update.mock.calls[0][0].data).not.toHaveProperty("note");
    expect(tx.studentPackage.updateMany).toHaveBeenCalledOnce();
    expect(tx.studentProfile.updateMany).toHaveBeenCalledOnce();
    expect(tx.lessonLedger.create).toHaveBeenCalledOnce();
    expect(tx.lesson.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(tx.studentLifecycleEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("lets an administrator waive an absent lesson without consuming it", async () => {
    const absent = { id: "attendance-1", lessonId: "lesson-1", status: "STUDENT_ABSENT", reconciliationDecision: "PENDING" };
    const tx = attendanceStore({ attendance: absent });

    await decideAbsentLesson({ lessonId: "lesson-1", decision: "WAIVE", note: "  Approved leave  " }, adminActor, clientFor(tx) as never);

    expect(tx.lessonAttendance.update).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1" },
      data: expect.objectContaining({
        reconciliationDecision: "WAIVE",
        decidedById: "admin-user-1",
        decidedAt: expect.any(Date),
        decisionNote: "Approved leave"
      })
    });
    expect(tx.lessonAttendance.update.mock.calls[0][0].data).not.toHaveProperty("note");
    expect(tx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(tx.studentProfile.updateMany).not.toHaveBeenCalled();
    expect(tx.lessonLedger.create).not.toHaveBeenCalled();
    expect(tx.lesson.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" })
    }));
    expect(tx.studentLifecycleEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "ABSENCE_DECIDED", actorId: "admin-user-1", afterState: { lessonId: "lesson-1", decision: "WAIVE" } }) });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "lesson.attendance.decide",
        actorId: "admin-user-1",
        metadata: expect.objectContaining({ decisionNote: "Approved leave" })
      })
    });

    const decided = { ...absent, reconciliationDecision: "WAIVE" };
    const replayTx = attendanceStore({ attendance: decided });
    const replay = await decideAbsentLesson({ lessonId: "lesson-1", decision: "WAIVE" }, adminActor, clientFor(replayTx) as never);
    expect(replay.attendance).toBe(decided);
    expect(replayTx.lessonAttendance.update).not.toHaveBeenCalled();
    expect(replayTx.lesson.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" })
    }));

    await expect(decideAbsentLesson({ lessonId: "lesson-1", decision: "CONSUME" }, adminActor, clientFor(replayTx) as never))
      .rejects.toMatchObject({ code: "ABSENCE_DECISION_CONFLICT", status: 409 });
  });

  it("does not consume for teacher adjustment", async () => {
    const tx = attendanceStore();

    await recordLessonAttendance({ lessonId: "lesson-1", status: "TEACHER_ADJUSTED" }, teacherActor, clientFor(tx) as never);

    expect(tx.studentPackage.updateMany).not.toHaveBeenCalled();
    expect(tx.studentProfile.updateMany).not.toHaveBeenCalled();
    expect(tx.lessonLedger.create).not.toHaveBeenCalled();
    expect(tx.lesson.update).not.toHaveBeenCalled();
  });
});
