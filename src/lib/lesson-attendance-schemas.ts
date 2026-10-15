import { z } from "zod";

export const teacherAttendanceSchema = z.object({
  status: z.enum(["ATTENDED", "STUDENT_ABSENT", "STUDENT_LEAVE", "TEACHER_ADJUSTED"]),
  note: z.string().trim().max(800).optional()
});

export const absenceDecisionSchema = z.object({
  decision: z.enum(["CONSUME", "WAIVE"]),
  note: z.string().trim().max(800).optional()
});
