import type {
  AdminApplication,
  AdminCampus,
  AdminClassroom,
  AdminEmailDelivery,
  AdminLesson,
  AdminPendingAbsence,
  ProtectedTeacherAccountView,
  AdminStudent,
  AdminTeacher,
  AdminTuitionPackage
} from "@/components/dashboard/admin-types";
import { loadAdminAttendanceData } from "@/lib/admin-attendance-data";
import { prisma } from "@/lib/prisma";
import { canAccess, type Role } from "@/lib/rbac";
import { CORE_TEACHER_SLUGS, maskEmailAddress } from "@/lib/core-teacher-account-dto";
import { revealStudentTemporaryPasswords } from "@/lib/temporary-password-vault";

export const adminTabs = ["overview", "applications", "students", "schedule", "attendance", "tuition", "teacher-accounts", "email", "content", "finance"] as const;
export type AdminTab = (typeof adminTabs)[number];

export type AdminTabData = {
  applications: AdminApplication[];
  students: AdminStudent[];
  teachers: AdminTeacher[];
  packages: AdminTuitionPackage[];
  campuses: AdminCampus[];
  classrooms: AdminClassroom[];
  lessons: AdminLesson[];
  pendingAbsences: AdminPendingAbsence[];
  emailDeliveries: AdminEmailDelivery[];
  protectedTeachers: ProtectedTeacherAccountView[];
};

export function emptyAdminTabData(): AdminTabData {
  return { applications: [], students: [], teachers: [], packages: [], campuses: [], classrooms: [], lessons: [], pendingAbsences: [], emailDeliveries: [], protectedTeachers: [] };
}

async function loadTeachers(): Promise<AdminTeacher[]> {
  const teachers = await prisma.teacherProfile.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      title: true,
      campusId: true,
      _count: { select: { students: true, lessons: true } }
    }
  });
  return teachers.map((item) => ({
    id: item.id,
    name: item.displayName,
    title: item.title,
    campusId: item.campusId,
    students: item._count.students,
    lessons: item._count.lessons
  }));
}

async function loadProtectedTeachers(): Promise<ProtectedTeacherAccountView[]> {
  const teachers = await prisma.teacherProfile.findMany({
    where: { isCoreTeacher: true, slug: { in: [...CORE_TEACHER_SLUGS] } },
    select: {
      id: true,
      slug: true,
      displayName: true,
      title: true,
      _count: { select: { students: true } },
      user: { select: { email: true, isActive: true, isProtected: true } }
    }
  });
  return CORE_TEACHER_SLUGS.flatMap((slug) => {
    const teacher = teachers.find((item) => item.slug === slug);
    if (!teacher) return [];
    return [{
      id: teacher.id,
      slug: teacher.slug,
      displayName: teacher.displayName,
      title: teacher.title,
      students: teacher._count.students,
      account: teacher.user ? {
        maskedEmail: maskEmailAddress(teacher.user.email),
        isActive: teacher.user.isActive,
        isProtected: teacher.user.isProtected
      } : null
    }];
  });
}

async function loadPackages(): Promise<AdminTuitionPackage[]> {
  const packages = await prisma.tuitionPackage.findMany({
    orderBy: [{ teacherId: "asc" }, { sortOrder: "asc" }],
    include: { teacher: { select: { displayName: true } } }
  });
  return packages.map((item) => ({
    id: item.id,
    teacherId: item.teacherId,
    teacherName: item.teacher.displayName,
    name: item.name,
    lessonDurationMinutes: item.lessonDurationMinutes,
    lessonCount: item.lessonCount,
    originalUnitPriceCents: item.originalUnitPriceCents,
    unitPriceCents: item.unitPriceCents,
    discountLabel: item.discountLabel,
    validityMonths: item.validityMonths,
    isActive: item.isActive,
    sortOrder: item.sortOrder
  }));
}

async function loadCampuses(): Promise<AdminCampus[]> {
  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });
  return campuses.map((item) => ({ id: item.id, name: item.name, city: item.city }));
}

async function loadManagedStudents(role: Role): Promise<AdminStudent[]> {
  const students = await prisma.studentProfile.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, mustChangePassword: true, currentTemporaryPassword: true } },
      teacher: { select: { displayName: true } },
      campus: { select: { name: true } },
      studentPackages: {
        orderBy: { purchasedAt: "desc" },
        select: { id: true, packageName: true, totalLessons: true, consumedLessons: true, remainingLessons: true, expiresAt: true, isActive: true }
      }
    }
  });
  return revealStudentTemporaryPasswords(students, role).map((item) => ({
    id: item.id,
    studentNumber: item.studentNumber,
    name: item.fullName,
    age: item.age,
    phone: item.phone,
    wechat: item.wechat,
    guardianName: item.guardianName,
    goal: item.goal,
    teacherId: item.teacherId,
    teacherName: item.teacher?.displayName ?? "-",
    campusId: item.campusId,
    campusName: item.campus?.name ?? "-",
    enrolledAt: item.enrolledAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    user: item.user,
    totalHours: Number(item.totalHours),
    consumedHours: Number(item.consumedHours),
    remainingHours: Number(item.remainingHours),
    packages: item.studentPackages.map((pkg) => ({ ...pkg, expiresAt: pkg.expiresAt.toISOString() }))
  }));
}

async function loadScheduleStudents(): Promise<AdminStudent[]> {
  const students = await prisma.studentProfile.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { teacher: { select: { displayName: true } }, campus: { select: { name: true } } }
  });
  return students.map((item) => ({
    id: item.id,
    studentNumber: item.studentNumber,
    name: item.fullName,
    age: item.age,
    phone: item.phone,
    wechat: item.wechat,
    guardianName: item.guardianName,
    goal: item.goal,
    teacherId: item.teacherId,
    teacherName: item.teacher?.displayName ?? "-",
    campusId: item.campusId,
    campusName: item.campus?.name ?? "-",
    enrolledAt: item.enrolledAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    user: null,
    totalHours: Number(item.totalHours),
    consumedHours: Number(item.consumedHours),
    remainingHours: Number(item.remainingHours),
    packages: []
  }));
}

export async function loadAdminTabData(activeTab: AdminTab, role: Role): Promise<AdminTabData> {
  const data = emptyAdminTabData();
  switch (activeTab) {
    case "applications": {
      const [applications, teachers, packages, campuses] = await Promise.all([
        prisma.accountApplication.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { approvedUser: { select: { id: true, email: true, role: true } } } }),
        loadTeachers(),
        loadPackages(),
        loadCampuses()
      ]);
      data.applications = applications.map((item) => ({ id: item.id, role: item.role, status: item.status, name: item.name, phone: item.phone, wechat: item.wechat, email: item.email, campusId: item.campusId, age: item.age, goal: item.goal, education: item.education, specialties: item.specialties, createdAt: item.createdAt.toISOString(), reviewerNotes: item.reviewerNotes, approvedUser: item.approvedUser }));
      data.teachers = teachers;
      data.packages = packages;
      data.campuses = campuses;
      return data;
    }
    case "students":
      [data.students, data.teachers, data.packages, data.campuses] = await Promise.all([loadManagedStudents(role), loadTeachers(), loadPackages(), loadCampuses()]);
      return data;
    case "schedule": {
      const [students, teachers, classrooms, lessons] = await Promise.all([
        loadScheduleStudents(),
        loadTeachers(),
        prisma.classroom.findMany({ orderBy: { name: "asc" }, include: { campus: { select: { name: true } } } }),
        prisma.lesson.findMany({ take: 100, orderBy: { startsAt: "asc" }, include: { student: { select: { fullName: true } }, teacher: { select: { displayName: true } }, classroom: { select: { name: true } } } })
      ]);
      data.students = students;
      data.teachers = teachers;
      data.classrooms = classrooms.map((item) => ({ id: item.id, name: item.name, piano: item.piano, campusId: item.campusId, campusName: item.campus.name }));
      data.lessons = lessons.map((item) => ({ id: item.id, studentId: item.studentId, studentName: item.student.fullName, teacherId: item.teacherId, teacherName: item.teacher.displayName, classroomId: item.classroomId, classroomName: item.classroom?.name ?? "-", startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(), status: item.status, topic: item.topic }));
      return data;
    }
    case "attendance": {
      data.pendingAbsences = await loadAdminAttendanceData(activeTab);
      return data;
    }
    case "tuition":
      [data.teachers, data.packages] = await Promise.all([loadTeachers(), loadPackages()]);
      return data;
    case "teacher-accounts":
      if (canAccess(role, "protected-account:manage")) data.protectedTeachers = await loadProtectedTeachers();
      return data;
    case "email": {
      const deliveries = await prisma.emailDelivery.findMany({ take: 100, orderBy: { createdAt: "desc" } });
      data.emailDeliveries = deliveries.map((item) => ({ id: item.id, category: item.category, recipient: item.recipient, subject: item.subject, status: item.status, createdAt: item.createdAt.toISOString(), lastEventAt: item.lastEventAt?.toISOString() ?? null }));
      return data;
    }
    default:
      return data;
  }
}


export type AdminMetrics = {
  studentCount: number;
  teacherCount: number;
  lessonCount: number;
  revenueCents: number;
};

export async function loadAdminMetrics(): Promise<AdminMetrics> {
  const [studentCount, teacherCount, lessonCount, revenue] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.lesson.count({ where: { status: "COMPLETED" } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } })
  ]);
  return { studentCount, teacherCount, lessonCount, revenueCents: revenue._sum.amountCents ?? 0 };
}
