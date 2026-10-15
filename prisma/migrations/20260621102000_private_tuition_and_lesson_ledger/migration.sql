-- CreateEnum
CREATE TYPE "LessonLedgerKind" AS ENUM ('CONSUME', 'REVERSE', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "studentPackageId" TEXT,
ADD COLUMN     "unitPriceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TuitionPackage" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lessonDurationMinutes" INTEGER NOT NULL DEFAULT 45,
    "lessonCount" INTEGER NOT NULL,
    "originalUnitPriceCents" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountLabel" TEXT NOT NULL,
    "validityMonths" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuitionPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPackage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "tuitionPackageId" TEXT,
    "packageName" TEXT NOT NULL,
    "lessonDurationMinutes" INTEGER NOT NULL,
    "totalLessons" INTEGER NOT NULL,
    "consumedLessons" INTEGER NOT NULL DEFAULT 0,
    "remainingLessons" INTEGER NOT NULL,
    "originalUnitPriceCents" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonLedger" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "studentPackageId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "LessonLedgerKind" NOT NULL,
    "lessonDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TuitionPackage_teacherId_isActive_sortOrder_idx" ON "TuitionPackage"("teacherId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "StudentPackage_studentId_isActive_expiresAt_idx" ON "StudentPackage"("studentId", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "StudentPackage_teacherId_idx" ON "StudentPackage"("teacherId");

-- CreateIndex
CREATE INDEX "LessonLedger_studentPackageId_createdAt_idx" ON "LessonLedger"("studentPackageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonLedger_lessonId_kind_key" ON "LessonLedger"("lessonId", "kind");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_startsAt_endsAt_idx" ON "Lesson"("teacherId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Lesson_studentId_startsAt_endsAt_idx" ON "Lesson"("studentId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Lesson_classroomId_startsAt_endsAt_idx" ON "Lesson"("classroomId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "TuitionPackage" ADD CONSTRAINT "TuitionPackage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_tuitionPackageId_fkey" FOREIGN KEY ("tuitionPackageId") REFERENCES "TuitionPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentPackageId_fkey" FOREIGN KEY ("studentPackageId") REFERENCES "StudentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonLedger" ADD CONSTRAINT "LessonLedger_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonLedger" ADD CONSTRAINT "LessonLedger_studentPackageId_fkey" FOREIGN KEY ("studentPackageId") REFERENCES "StudentPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonLedger" ADD CONSTRAINT "LessonLedger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
