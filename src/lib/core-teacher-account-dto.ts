import type { ProtectedTeacherAccountCommand } from "@/components/dashboard/admin-types";

export const CORE_TEACHER_SLUGS = ["teacher-one", "teacher-two", "teacher-three"] as const;

type CoreTeacherAccountResult = {
  teacher: { id: string; slug: string; displayName: string };
  user: { email: string; isActive: boolean; isProtected: boolean };
  temporaryPassword?: string;
  emailAccepted?: boolean;
  emailTrackingAvailable?: boolean;
};

export function maskEmailAddress(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

export function toCoreTeacherAccountDto(result: CoreTeacherAccountResult): ProtectedTeacherAccountCommand {
  const dto: ProtectedTeacherAccountCommand = {
    teacher: {
      id: result.teacher.id,
      slug: result.teacher.slug,
      displayName: result.teacher.displayName
    },
    maskedEmail: maskEmailAddress(result.user.email),
    isActive: result.user.isActive,
    isProtected: result.user.isProtected
  };
  if (result.temporaryPassword !== undefined) dto.temporaryPassword = result.temporaryPassword;
  if (result.emailAccepted !== undefined) dto.emailAccepted = result.emailAccepted;
  if (result.emailTrackingAvailable !== undefined) dto.emailTrackingAvailable = result.emailTrackingAvailable;
  return dto;
}
