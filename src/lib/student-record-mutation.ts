import type { AdminStudent } from "@/components/dashboard/admin-types";

export type StudentRecordPatch = Pick<
  AdminStudent,
  "id" | "campusId" | "campusName" | "enrolledAt" | "updatedAt"
>;

export function parseStudentRecordPatch(value: unknown): StudentRecordPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The server did not return an authoritative student record.");
  }
  const record = value as Record<string, unknown>;
  const campusId = record.campusId;
  if (
    typeof record.id !== "string" ||
    (campusId !== null && typeof campusId !== "string") ||
    typeof record.campusName !== "string" ||
    typeof record.enrolledAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new Error("The server did not return an authoritative student record.");
  }
  return {
    id: record.id,
    campusId,
    campusName: record.campusName,
    enrolledAt: record.enrolledAt,
    updatedAt: record.updatedAt
  };
}

type StudentRecordMutationResult<T> =
  | { status: "in-flight" }
  | { status: "committed"; data: T }
  | { status: "failed"; error: unknown };

export async function runStudentRecordMutation<T extends StudentRecordPatch>({
  studentId,
  inFlight,
  execute,
  onCommitted,
  onPendingChange
}: {
  studentId: string;
  inFlight: Set<string>;
  execute: () => Promise<T>;
  onCommitted: (patch: T) => void;
  onPendingChange?: (pending: boolean) => void;
}): Promise<StudentRecordMutationResult<T>> {
  if (inFlight.has(studentId)) return { status: "in-flight" };

  inFlight.add(studentId);
  onPendingChange?.(true);
  try {
    const data = await execute();
    onCommitted(data);
    return { status: "committed", data };
  } catch (error) {
    return { status: "failed", error };
  } finally {
    inFlight.delete(studentId);
    onPendingChange?.(false);
  }
}

export function reconcileStudentList(students: AdminStudent[], patch: StudentRecordPatch) {
  return students.map((student) => student.id === patch.id ? { ...student, ...patch } : student);
}

export function reconcileSelectedStudent(student: AdminStudent | null, patch: StudentRecordPatch) {
  return student?.id === patch.id ? { ...student, ...patch } : student;
}
