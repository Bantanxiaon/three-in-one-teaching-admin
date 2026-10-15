import { z } from "zod";

export const campusTransferReasons = [
  "ADDRESS_CHANGED",
  "SCHEDULE_CHANGED",
  "TEACHER_ARRANGEMENT",
  "COURSE_STAGE_CHANGED",
  "CLASSROOM_RESOURCE",
  "RECORD_CORRECTION",
  "OTHER"
] as const;

export const campusTransferSchema = z.object({
  campusId: z.string().trim().min(1).max(80),
  reasonCode: z.enum(campusTransferReasons),
  note: z.string().trim().max(500).optional(),
  expectedUpdatedAt: z.coerce.date()
}).strict();

export const enrollmentCorrectionSchema = z.object({
  enrolledAt: z.coerce.date().refine((value) => value <= new Date(), "Enrollment date cannot be in the future."),
  expectedUpdatedAt: z.coerce.date()
}).strict();

export type CampusTransferReason = (typeof campusTransferReasons)[number];
