CREATE TYPE "AttendanceStatus" AS ENUM (
  'PENDING',
  'ATTENDED',
  'STUDENT_ABSENT',
  'STUDENT_LEAVE',
  'TEACHER_ADJUSTED'
);

CREATE TYPE "AttendanceDecision" AS ENUM (
  'PENDING',
  'CONSUME',
  'WAIVE'
);

ALTER TABLE "User"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'zh';

ALTER TABLE "TeacherProfile"
  ADD COLUMN "isCoreTeacher" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LessonFeedback"
  ALTER COLUMN "focus" DROP NOT NULL,
  ALTER COLUMN "feedback" DROP NOT NULL,
  ALTER COLUMN "homework" DROP NOT NULL;

UPDATE "TeacherProfile"
SET "isCoreTeacher" = TRUE
WHERE "slug" IN ('teacher-one', 'teacher-two', 'teacher-three');

UPDATE "User"
SET "isProtected" = TRUE
WHERE "id" IN (
  SELECT "userId"
  FROM "TeacherProfile"
  WHERE "isCoreTeacher" = TRUE AND "userId" IS NOT NULL
);

CREATE TABLE "LessonAttendance" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
  "reconciliationDecision" "AttendanceDecision" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "recordedById" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonAttendance_lessonId_key" ON "LessonAttendance"("lessonId");
CREATE INDEX "LessonAttendance_status_reconciliationDecision_recordedAt_idx" ON "LessonAttendance"("status", "reconciliationDecision", "recordedAt");

ALTER TABLE "LessonAttendance"
  ADD CONSTRAINT "LessonAttendance_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonAttendance"
  ADD CONSTRAINT "LessonAttendance_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LessonAttendance"
  ADD CONSTRAINT "LessonAttendance_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_protected_user_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD."isProtected" = TRUE THEN
    RAISE EXCEPTION 'Protected account cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_core_user_delete
BEFORE DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION prevent_protected_user_delete();
