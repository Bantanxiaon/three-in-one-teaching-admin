BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "StudentProfile" WHERE "studentNumber" IS NULL) THEN
        RAISE EXCEPTION 'Cannot require StudentProfile.studentNumber while null values remain.';
    END IF;
END $$;

DROP INDEX "StudentProfile_studentNumber_key";

ALTER TABLE "StudentProfile"
ALTER COLUMN "studentNumber" SET NOT NULL;

CREATE UNIQUE INDEX "StudentProfile_studentNumber_key" ON "StudentProfile"("studentNumber");

COMMIT;
