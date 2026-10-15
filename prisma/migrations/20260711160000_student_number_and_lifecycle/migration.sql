BEGIN;

-- Add the fields as nullable first so existing student records can be backfilled.
ALTER TABLE "StudentProfile"
ADD COLUMN "studentNumber" TEXT,
ADD COLUMN "enrolledAt" TIMESTAMP(3);

CREATE TABLE "StudentNumberCounter" (
    "scope" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentNumberCounter_pkey" PRIMARY KEY ("scope")
);

CREATE TABLE "StudentLifecycleEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "studentNumber" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "reasonCode" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLifecycleEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "StudentProfile" WHERE "campusId" IS NULL) THEN
        RAISE EXCEPTION 'Cannot assign student numbers while StudentProfile.campusId is null.';
    END IF;
END $$;

WITH numbered_students AS (
    SELECT
        student_numbers."id",
        campus."city"::TEXT AS "city",
        student_numbers."sequence"
    FROM (
        SELECT
            "id",
            "campusId",
            ROW_NUMBER() OVER (ORDER BY "createdAt", "id") + 102 AS "sequence"
        FROM "StudentProfile"
    ) AS student_numbers
    INNER JOIN "Campus" AS campus ON campus."id" = student_numbers."campusId"
)
UPDATE "StudentProfile" AS student
SET "enrolledAt" = "createdAt",
    "studentNumber" = CASE numbered_students."city"
        WHEN 'BEIJING' THEN 'CYBJ'
        WHEN 'GUANGZHOU' THEN 'CYGZ'
    END || LPAD(numbered_students."sequence"::TEXT, 4, '0')
FROM numbered_students
WHERE student."id" = numbered_students."id";

INSERT INTO "StudentLifecycleEvent" ("id", "studentId", "studentNumber", "actorId", "eventType", "afterState", "createdAt")
SELECT
    MD5(student."id" || CLOCK_TIMESTAMP()::TEXT || RANDOM()::TEXT),
    student."id",
    student."studentNumber",
    NULL,
    'ENROLLED',
    jsonb_build_object(
        'campusId', student."campusId",
        'enrolledAt', student."enrolledAt"
    ),
    student."enrolledAt"
FROM "StudentProfile" AS student;

ALTER TABLE "StudentProfile"
ALTER COLUMN "enrolledAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "enrolledAt" SET NOT NULL;

CREATE UNIQUE INDEX "StudentProfile_studentNumber_key" ON "StudentProfile"("studentNumber")
WHERE "studentNumber" IS NOT NULL;
CREATE INDEX "StudentLifecycleEvent_studentId_createdAt_idx" ON "StudentLifecycleEvent"("studentId", "createdAt");
CREATE INDEX "StudentLifecycleEvent_studentNumber_createdAt_idx" ON "StudentLifecycleEvent"("studentNumber", "createdAt");

ALTER TABLE "StudentLifecycleEvent"
ADD CONSTRAINT "StudentLifecycleEvent_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentLifecycleEvent"
ADD CONSTRAINT "StudentLifecycleEvent_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "StudentNumberCounter" ("scope", "lastValue", "updatedAt")
SELECT 'STUDENT', 102 + COUNT(*), CURRENT_TIMESTAMP
FROM "StudentProfile";

COMMIT;
