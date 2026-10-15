import { z } from "zod";
import { locales } from "@/i18n/routing";

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(80),
  age: z.number().int().min(3).max(90),
  phone: z.string().trim().min(6).max(32),
  wechat: z.string().trim().min(2).max(80),
  goal: z.string().trim().min(2).max(800),
  preferredTimes: z.array(z.string().trim().min(2).max(80)).min(1).max(5),
  locale: z.enum(locales)
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(32),
  message: z.string().trim().min(12).max(1500),
  locale: z.enum(locales)
});

export type ContactInput = z.infer<typeof contactSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128)
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string()
    .min(6, "请输入至少 6 位数字。")
    .max(128)
    .regex(/^\d+$/, "密码只能使用数字。"),
  confirmPassword: z.string().min(1)
}).superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
  if (value.currentPassword === value.newPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a different password." });
  }
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const studentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.number().int().min(3).max(90),
  phone: z.string().trim().min(6).max(32),
  wechat: z.string().trim().optional(),
  teacherId: z.string().cuid().optional(),
  campusId: z.string().trim().min(1).max(80).optional()
});

export const lessonFeedbackSchema = z.object({
  lessonId: z.string().cuid(),
  focus: z.string().trim().max(240).optional().default(""),
  feedback: z.string().trim().max(1500).optional().default(""),
  homework: z.string().trim().max(1500).optional().default(""),
  videoUrl: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().optional()
  )
});

export const journalSchema = z.object({
  title: z.string().trim().min(4).max(140),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().min(12).max(240),
  content: z.string().trim().min(80),
  locale: z.enum(locales),
  category: z.string().trim().min(2).max(80),
  tags: z.array(z.string().trim().min(1).max(32)).max(8),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(160).optional()
});
