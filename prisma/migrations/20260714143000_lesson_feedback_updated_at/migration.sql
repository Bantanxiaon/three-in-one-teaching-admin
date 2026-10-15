BEGIN;

ALTER TABLE "LessonFeedback"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LessonFeedback"
SET "updatedAt" = "createdAt";

COMMIT;
