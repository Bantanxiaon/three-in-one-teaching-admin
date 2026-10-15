import { z } from "zod";

const tuitionPackageFields = z.object({
  teacherId: z.string().cuid(),
  name: z.string().trim().min(2).max(80),
  lessonDurationMinutes: z.number().int().min(15).max(180),
  lessonCount: z.number().int().min(1).max(200),
  originalUnitPriceCents: z.number().int().positive().max(10_000_000),
  unitPriceCents: z.number().int().positive().max(10_000_000),
  discountLabel: z.string().trim().min(1).max(32),
  validityMonths: z.number().int().min(1).max(60),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0)
});

export const tuitionPackageSchema = tuitionPackageFields.superRefine((input, context) => {
  if (input.unitPriceCents > input.originalUnitPriceCents) {
    context.addIssue({
      code: "custom",
      path: ["unitPriceCents"],
      message: "The package unit price cannot exceed the original unit price."
    });
  }
});

export const tuitionPackageUpdateSchema = tuitionPackageFields.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one package field to update."
);

export type TuitionPackageInput = z.infer<typeof tuitionPackageSchema>;
