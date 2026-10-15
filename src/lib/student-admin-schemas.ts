import { z } from "zod";
import { studentDeletionReasonCodes } from "@/lib/student-deletion-reasons";

const profileFields = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.number().int().min(3).max(90),
  guardianName: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(6).max(32),
  wechat: z.string().trim().max(80).optional(),
  goal: z.string().trim().max(1500).optional(),
  teacherId: z.string().cuid().optional()
});

const campusId = z.string().trim().min(1).max(80);
const nonNullEnrollmentDate = z.preprocess(
  (value) => value === null ? undefined : value,
  z.coerce.date().refine((value) => value <= new Date(), "Enrollment date cannot be in the future.")
);

const accountFields = {
  email: z.string().trim().email().max(160).optional(),
  passwordMode: z.enum(["GENERATED", "MANUAL"]).default("GENERATED"),
  password: z.string().regex(/^\d{6,}$/, "Temporary passwords must be at least 6 digits.").max(128).optional(),
  tuitionPackageId: z.string().cuid().or(z.string().startsWith("tuition-")).optional()
} as const;

export const studentAdminCreateSchema = profileFields.extend({
  campusId,
  enrolledAt: nonNullEnrollmentDate.optional()
}).extend(accountFields).superRefine((input, context) => {
  if (!input.email && (input.password || input.tuitionPackageId)) {
    context.addIssue({ code: "custom", path: ["email"], message: "Create a login email before assigning credentials or a tuition package." });
  }
  if (input.passwordMode === "MANUAL" && !input.password) {
    context.addIssue({ code: "custom", path: ["password"], message: "Enter a temporary password." });
  }
  if (input.password && input.passwordMode !== "MANUAL") {
    context.addIssue({ code: "custom", path: ["passwordMode"], message: "Choose manual password mode before entering a password." });
  }
  if (input.tuitionPackageId && !input.teacherId) {
    context.addIssue({ code: "custom", path: ["teacherId"], message: "Choose a teacher before assigning a tuition package." });
  }
  if (input.tuitionPackageId && !input.campusId) {
    context.addIssue({ code: "custom", path: ["campusId"], message: "Choose a campus before assigning a tuition package." });
  }
});

export const studentAdminUpdateSchema = profileFields.partial().extend({
  campusId: campusId.optional(),
  email: accountFields.email,
  passwordMode: z.enum(["GENERATED", "MANUAL"]).optional(),
  password: accountFields.password,
  tuitionPackageId: accountFields.tuitionPackageId
}).strict().superRefine((input, context) => {
  if (Object.keys(input).length === 0) {
    context.addIssue({ code: "custom", message: "Provide at least one student field to update." });
  }
  if (input.passwordMode === "MANUAL" && !input.password) {
    context.addIssue({ code: "custom", path: ["password"], message: "Enter a temporary password." });
  }
  if (input.password && input.passwordMode !== "MANUAL") {
    context.addIssue({ code: "custom", path: ["passwordMode"], message: "Choose manual password mode before entering a password." });
  }
});

export const studentDeleteSchema = z.object({
  confirmation: z.string(),
  reasonCode: z.enum(studentDeletionReasonCodes)
}).strict();

export type StudentAdminCreateInput = z.infer<typeof studentAdminCreateSchema>;
