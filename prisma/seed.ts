import { PrismaClient, Role, CampusCity } from "@prisma/client";
import { hash } from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  if (process.env.CONFIRM_DEMO_SEED !== "create-demo-in-empty-database") throw new Error("Set CONFIRM_DEMO_SEED=create-demo-in-empty-database for your own empty database.");
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !email.includes("@") || !password || password.length < 12) throw new Error("Supply ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (12+ characters). No default credentials exist.");
  await prisma.$transaction(async tx => {
    if (await tx.user.count() || await tx.campus.count() || await tx.teacherProfile.count()) throw new Error("Refusing to seed a nonempty database.");
    await tx.user.create({ data: { name: "管理员", email, passwordHash: await hash(password,12), role: Role.ADMIN, isActive: true, mustChangePassword: false } });
    const campus=await tx.campus.create({ data: { name: "示例校区", city: CampusCity.BEIJING, address: "虚构的教学地点", mapUrl: "https://example.com", phone: "" } });
    await tx.classroom.create({ data: { name: "示例教室", piano: "示例钢琴", capacity: 2, campusId: campus.id } });
    for (const [index,slug] of ["teacher-one","teacher-two","teacher-three"].entries()) {
      await tx.teacherProfile.create({ data: { slug, displayName: "示例教师 "+(index+1), title: "示例教师", avatarUrl: "/placeholder.svg", heroImageUrl: "/placeholder.svg", bio: "虚构演示档案", philosophy: "示例教学说明", specialties: ["钢琴"], awards: [], campusId: campus.id, isCoreTeacher: true } });
    }
  });
  console.log("Created demo administrator, campus, classroom and three unlinked teacher profiles. No password is printed.");
}
main().catch(error=>{ console.error(error.message); process.exitCode=1; }).finally(()=>prisma.$disconnect());
