import { describe, expect, it, vi } from "vitest";
import { recordStudentLifecycleEvent, studentLifecycleEventTypes } from "@/lib/student-lifecycle";

describe("student lifecycle events", () => {
  it("writes the supplied lifecycle event without changing its payload", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const store = { studentLifecycleEvent: { create } } as unknown as Parameters<typeof recordStudentLifecycleEvent>[0];

    await recordStudentLifecycleEvent(store, {
      studentId: "student-1",
      studentNumber: "CYBJ0103",
      actorId: "admin-1",
      eventType: "ENROLLED",
      afterState: { campusId: "campus-bj", enrolledAt: "2026-07-11T00:00:00.000Z" }
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        studentId: "student-1",
        studentNumber: "CYBJ0103",
        actorId: "admin-1",
        eventType: "ENROLLED",
        afterState: { campusId: "campus-bj", enrolledAt: "2026-07-11T00:00:00.000Z" }
      }
    });
    expect(studentLifecycleEventTypes.enrolled).toBe("ENROLLED");
  });
});
