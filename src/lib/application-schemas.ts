import { z } from "zod";
import { locales } from "@/i18n/routing";

const periodSchema = z.enum(["MORNING", "AFTERNOON", "EVENING"]);
const preferredDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const endOfDate = new Date(`${value}T23:59:59`);
    return !Number.isNaN(endOfDate.getTime()) && endOfDate >= new Date();
  }, "Please choose a future date."),
  period: periodSchema
});

const submissionCommonSchema = z.object({
  idempotencyKey: z.string().uuid(),
  consent: z.literal(true),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(32),
  wechat: z.string().trim().max(80).default(""),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  locale: z.enum(locales)
});

const studentFields = {
  role: z.literal("STUDENT"),
  email: z.string().trim().email().max(160),
  age: z.number().int().min(3).max(90),
  guardianName: z.string().trim().max(80).optional(),
  campusId: z.enum(["beijing", "guangzhou"]),
  learningStage: z.string().trim().min(2).max(80),
  goal: z.string().trim().min(2).max(1200),
  preferredDates: z.array(preferredDateSchema).min(1).max(3).refine(
    (items) => new Set(items.map((item) => item.date)).size === items.length,
    "Please choose different dates."
  )
} as const;

const teacherFields = {
  role: z.literal("TEACHER"),
  email: z.string().trim().email().max(160),
  city: z.string().trim().min(2).max(80),
  teachingYears: z.number().int().min(0).max(60),
  education: z.string().trim().min(12).max(1500),
  specialties: z.string().trim().min(8).max(1000),
  philosophy: z.string().trim().min(8).max(1200),
  preferredContact: z.string().trim().min(2).max(160)
} as const;

function requireGuardianForMinor(input: { age: number; guardianName?: string }, context: z.RefinementCtx) {
  if (input.age < 18 && !input.guardianName?.trim()) {
    context.addIssue({ code: "custom", path: ["guardianName"], message: "Guardian name is required." });
  }
}

const verificationFields = {
  turnstileToken: z.string().trim().min(1),
  humanChallengeAnswer: z.number().int().min(0).max(100).optional()
};

export const studentSubmissionSchema = submissionCommonSchema
  .extend(studentFields)
  .superRefine(requireGuardianForMinor);

export const teacherSubmissionSchema = submissionCommonSchema.extend(teacherFields);

export const applicationSubmissionSchema = z.discriminatedUnion("role", [
  studentSubmissionSchema,
  teacherSubmissionSchema
]);

export const studentApplicationSchema = submissionCommonSchema
  .extend({ ...studentFields, ...verificationFields })
  .superRefine(requireGuardianForMinor);

export const teacherApplicationSchema = submissionCommonSchema.extend({
  ...teacherFields,
  ...verificationFields
});

export const applicationSchema = z.discriminatedUnion("role", [
  studentApplicationSchema,
  teacherApplicationSchema
]);

export type ApplicationSubmissionInput = z.infer<typeof applicationSubmissionSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;

export function toApplicationSubmission(input: ApplicationInput): ApplicationSubmissionInput {
  return applicationSubmissionSchema.parse(input);
}
