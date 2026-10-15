import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({ requireApiPermission: dependencies.requireApiPermission }));
vi.mock("@/lib/prisma", () => ({
  prisma: { studentProfile: { findMany: dependencies.findMany } }
}));

import { GET } from "@/app/api/admin/students/route";
import { encryptTemporaryPassword } from "@/lib/temporary-password-vault";

function storedStudent(currentTemporaryPassword: string) {
  return {
    id: "student-1",
    user: {
      id: "user-1",
      email: "lin@example.com",
      mustChangePassword: true,
      currentTemporaryPassword
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("temporary password admin response shaping", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)("decrypts list values for %s", async (role) => {
    const encrypted = encryptTemporaryPassword("123456");
    dependencies.requireApiPermission.mockResolvedValue({ user: { id: "admin-1", role } });
    dependencies.findMany.mockResolvedValue([storedStudent(encrypted)]);

    const response = await GET();
    const body = await response.json();

    expect(body.data[0].user.currentTemporaryPassword).toBe("123456");
    expect(JSON.stringify(body)).not.toContain(encrypted);
  });

  it("redacts list values for MANAGER without attempting to decrypt", async () => {
    dependencies.requireApiPermission.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER" } });
    dependencies.findMany.mockResolvedValue([storedStudent("tpv1.not-a-valid-envelope")]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].user.currentTemporaryPassword).toBeNull();
    expect(JSON.stringify(body)).not.toContain("tpv1.not-a-valid-envelope");
  });

  it("uses the same role-aware shaper for the server-rendered admin page", () => {
    const source = readFileSync("src/app/[locale]/admin/page.tsx", "utf8");

    expect(source).toContain("loadAdminTabData(activeTab, session.user.role)");
    expect(readFileSync("src/lib/admin-workspace-data.ts", "utf8")).toContain("revealStudentTemporaryPasswords(students, role)");
    expect(source).not.toContain("initialStudents={students.map");
  });
});
