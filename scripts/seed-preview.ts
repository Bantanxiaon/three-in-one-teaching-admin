import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

// 只在临时 CI 测试库创建页面演示数据，绝不调用邮件或其他外部服务。
const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (process.env.CI !== "true" ||
    process.env.CONFIRM_DEMO_SEED !== "create-demo-in-empty-database" ||
    !["127.0.0.1", "localhost", "postgres"].includes(database.hostname) ||
    !database.pathname.endsWith("_test")) {
  throw new Error("Preview data is restricted to the disposable local CI test database.");
}
const prisma = new PrismaClient();
async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password || password.length < 12) throw new Error("CI password is missing.");
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_SEED_EMAIL } });
  const profile = await prisma.teacherProfile.findUniqueOrThrow({ where: { slug: "teacher-one" } });
  const classroom = await prisma.classroom.findFirstOrThrow();
  const passwordHash = await hash(password, 12);
  const teacher = await prisma.user.create({ data: { name: "演示教师", email: "teacher@example.com", role: Role.TEACHER, passwordHash, isActive: true, isProtected: true } });
  await prisma.teacherProfile.update({ where: { id: profile.id }, data: { userId: teacher.id, displayName: "演示教师" } });
  const learner = await prisma.user.create({ data: { name: "演示学员", email: "student@example.com", role: Role.STUDENT, passwordHash, isActive: true } });
  const student = await prisma.studentProfile.create({ data: { userId: learner.id, teacherId: profile.id, campusId: classroom.campusId,
    studentNumber: "DEMO20260001", fullName: "演示学员", age: 18, phone: "10000000000",
    goal: "建立稳定的练习习惯，学习完整作品。", totalHours: 12, consumedHours: 1, remainingHours: 11 } });
  const tuition = await prisma.tuitionPackage.create({ data: { teacherId: profile.id, name: "演示基础课包", lessonCount: 12,
    originalUnitPriceCents: 20000, unitPriceCents: 18000, discountLabel: "演示价格", validityMonths: 6 } });
  const now = new Date();
  const studentPackage = await prisma.studentPackage.create({ data: { studentId: student.id, teacherId: profile.id, tuitionPackageId: tuition.id,
    packageName: tuition.name, lessonDurationMinutes: 45, totalLessons: 12, consumedLessons: 1, remainingLessons: 11,
    originalUnitPriceCents: 20000, unitPriceCents: 18000, expiresAt: new Date(now.getTime() + 180 * 86400000) } });
  const completed = await prisma.lesson.create({ data: { studentId: student.id, teacherId: profile.id, campusId: classroom.campusId,
    classroomId: classroom.id, studentPackageId: studentPackage.id, topic: "节奏训练与乐句表达（演示）",
    startsAt: new Date(now.getTime() - 3 * 3600000), endsAt: new Date(now.getTime() - 3 * 3600000 + 2700000),
    status: "COMPLETED", unitPriceCents: 18000, reconciledAt: now } });
  await prisma.lessonAttendance.create({ data: { lessonId: completed.id, status: "ATTENDED", reconciliationDecision: "CONSUME",
    note: "演示出勤记录", recordedById: teacher.id, decidedById: admin.id, decidedAt: now } });
  await prisma.lessonFeedback.create({ data: { lessonId: completed.id, studentId: student.id, teacherId: profile.id,
    focus: "放松触键，保持稳定节奏。", feedback: "节奏控制有进步，继续注意旋律连贯性。", homework: "慢速练习音阶，每天 20 分钟。" } });
  await prisma.lessonLedger.create({ data: { lessonId: completed.id, studentPackageId: studentPackage.id, actorId: admin.id,
    kind: "CONSUME", lessonDelta: -1, reason: "演示课程核销" } });
  for (const [index, offset] of [1, 25].entries()) {
    const startsAt = new Date(now.getTime() + offset * 3600000);
    await prisma.lesson.create({ data: { studentId: student.id, teacherId: profile.id, campusId: classroom.campusId, classroomId: classroom.id,
      studentPackageId: studentPackage.id, topic: index ? "作品连贯性训练（演示）" : "音阶与手指控制（演示）",
      startsAt, endsAt: new Date(startsAt.getTime() + 2700000), status: "SCHEDULED", unitPriceCents: 18000 } });
  }
  await prisma.practiceLog.createMany({ data: [
    { studentId: student.id, minutes: 30, piece: "音阶与琶音", notes: "演示练习记录" },
    { studentId: student.id, minutes: 25, piece: "旋律连贯训练", notes: "保持放松" }
  ] });
  await prisma.accountApplication.createMany({ data: [
    { role: "STUDENT", name: "演示申请学员", age: 12, guardianName: "演示监护人", phone: "10000000001", email: "applicant@example.com", locale: "zh", learningStage: "初学", goal: "学习基础乐理与钢琴演奏。", status: "PENDING" },
    { role: "TEACHER", name: "演示申请教师", phone: "10000000002", email: "candidate@example.com", locale: "zh", education: "演示教育经历", teachingYears: 3, specialties: "基础钢琴教学", status: "REVIEWING" }
  ] });
  await prisma.studentLifecycleEvent.create({ data: { studentId: student.id, studentNumber: student.studentNumber, actorId: admin.id,
    eventType: "ENROLLED", note: "演示入学档案；不代表真实学员。" } });
  console.log("Created synthetic records for real browser screenshots. No production data or external notifications were used.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
