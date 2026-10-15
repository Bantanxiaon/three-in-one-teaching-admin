import { CampusCity } from "@prisma/client";
import { ApiError } from "@/lib/api-response";

export type StudentNumberStore = {
  campus: {
    findUnique(args: { where: { id: string }; select: { city: true } }): Promise<{ city: CampusCity } | null>;
  };
  studentNumberCounter: {
    update(args: {
      where: { scope: string };
      data: { lastValue: { increment: number } };
      select: { lastValue: true };
    }): Promise<{ lastValue: number }>;
  };
};

export function formatStudentNumber(city: CampusCity, sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 103) {
    throw new ApiError("INVALID_STUDENT_SEQUENCE", "Student sequence must be an integer of 103 or greater.", 500);
  }

  const campusCode = city === CampusCity.BEIJING ? "BJ" : city === CampusCity.GUANGZHOU ? "GZ" : null;
  if (!campusCode) {
    throw new ApiError("UNSUPPORTED_CAMPUS_CITY", "The campus city cannot be used for student numbering.", 422);
  }

  return `CY${campusCode}${String(sequence).padStart(4, "0")}`;
}

export async function allocateStudentNumber(tx: StudentNumberStore, campusId: string) {
  const campus = await tx.campus.findUnique({ where: { id: campusId }, select: { city: true } });
  if (!campus) {
    throw new ApiError("CAMPUS_REQUIRED", "Choose a valid campus before creating the student record.", 422);
  }

  const counter = await tx.studentNumberCounter.update({
    where: { scope: "STUDENT" },
    data: { lastValue: { increment: 1 } },
    select: { lastValue: true }
  });

  return formatStudentNumber(campus.city, counter.lastValue);
}
