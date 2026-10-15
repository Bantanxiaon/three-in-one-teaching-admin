export type AdminTeacher = {
  id: string;
  name: string;
  title: string;
  campusId: string | null;
  students: number;
  lessons: number;
};
export type ProtectedTeacherAccountView = {
  id: string;
  slug: string;
  displayName: string;
  title: string;
  students: number;
  account: { maskedEmail: string; isActive: boolean; isProtected: boolean } | null;
};
export type ProtectedTeacherAccountCommand = {
  teacher: { id: string; slug: string; displayName: string };
  maskedEmail: string;
  isActive: boolean;
  isProtected: boolean;
  temporaryPassword?: string;
  emailAccepted?: boolean;
  emailTrackingAvailable?: boolean;
};
export type AdminCampus = { id: string; name: string; city: string };
export type AdminClassroom = { id: string; name: string; piano: string; campusId: string; campusName: string };
export type AdminTuitionPackage = { id: string; teacherId: string; teacherName: string; name: string; lessonDurationMinutes: number; lessonCount: number; originalUnitPriceCents: number; unitPriceCents: number; discountLabel: string; validityMonths: number; isActive: boolean; sortOrder: number };
export type AdminStudentPackage = { id: string; packageName: string; totalLessons: number; consumedLessons: number; remainingLessons: number; expiresAt: string; isActive: boolean };
export type AdminStudent = { id: string; studentNumber: string; name: string; age: number; phone: string; wechat: string | null; guardianName: string | null; goal: string | null; teacherId: string | null; teacherName: string; campusId: string | null; campusName: string; enrolledAt: string; updatedAt: string; user: { id: string; email: string; mustChangePassword: boolean; currentTemporaryPassword: string | null } | null; totalHours: number; consumedHours: number; remainingHours: number; packages: AdminStudentPackage[] };
export type StudentLifecycleEventView = { id: string; eventType: string; reasonCode: string | null; beforeState: Record<string, unknown> | null; afterState: Record<string, unknown> | null; note: string | null; createdAt: string; actor: { name: string | null; role: string } | null };
export type AdminApplication = { id: string; role: "STUDENT" | "TEACHER"; status: string; name: string; phone: string; wechat: string | null; email: string | null; campusId: string | null; age: number | null; goal: string | null; education: string | null; specialties: string | null; createdAt: string; reviewerNotes: string | null; approvedUser: { id: string; email: string; role: string } | null };
export type AdminLesson = { id: string; studentId: string; studentName: string; teacherId: string; teacherName: string; classroomId: string | null; classroomName: string; startsAt: string; endsAt: string; status: string; topic: string };
export type AdminEmailDelivery = { id: string; category: string; recipient: string; subject: string; status: string; createdAt: string; lastEventAt: string | null };
export type AdminPendingAbsence = { lessonId: string; studentName: string; studentNumber: string; teacherName: string; startsAt: string; attendanceStatus: string; recordedAt: string };
