-- CreateEnum
CREATE TYPE "ApplicantRole" AS ENUM ('STUDENT', 'TEACHER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedUserId" TEXT,
ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "learningStage" TEXT,
ADD COLUMN     "philosophy" TEXT,
ADD COLUMN     "preferredContact" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "role" "ApplicantRole" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "specialties" TEXT,
ADD COLUMN     "teachingYears" INTEGER,
ALTER COLUMN "age" DROP NOT NULL,
ALTER COLUMN "wechat" DROP NOT NULL,
ALTER COLUMN "goal" DROP NOT NULL,
ALTER COLUMN "preferredTimes" DROP NOT NULL;

-- Preserve every existing booking while backfilling the new required idempotency key.
UPDATE "Booking"
SET "idempotencyKey" = 'legacy-' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_approvedUserId_key" ON "Booking"("approvedUserId");

-- CreateIndex
CREATE INDEX "Booking_role_status_createdAt_idx" ON "Booking"("role", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_approvedUserId_fkey" FOREIGN KEY ("approvedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
