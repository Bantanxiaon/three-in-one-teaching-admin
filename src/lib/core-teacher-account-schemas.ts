import { z } from "zod";
import { locales } from "@/i18n/routing";

export const createCoreTeacherAccountSchema = z.object({
  email: z.string().trim().email().max(160),
  preferredLocale: z.enum(locales).default("zh")
});

export const coreTeacherAccountActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUSPEND") }),
  z.object({ action: z.literal("RESUME") }),
  z.object({ action: z.literal("RESET_PASSWORD") })
]);
