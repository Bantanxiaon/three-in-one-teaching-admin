import { describe, expect, it } from "vitest";
import { canAccess, hasAnyRole, permissionsByRole, type Role } from "@/lib/rbac";

describe("rbac", () => {
  it("allows admins to read admin dashboards", () => {
    expect(canAccess("ADMIN", "admin:read")).toBe(true);
  });

  it("blocks students from teacher-only actions", () => {
    expect(canAccess("STUDENT", "lesson:write-feedback")).toBe(false);
  });

  it("keeps both database-compatible administrator roles exactly equal", () => {
    expect(permissionsByRole.ADMIN).toEqual(permissionsByRole.SUPER_ADMIN);
    expect(new Set(permissionsByRole.ADMIN)).toEqual(new Set(permissionsByRole.SUPER_ADMIN));
    expect(canAccess("ADMIN", "role:assign")).toBe(canAccess("SUPER_ADMIN", "role:assign"));
    expect(canAccess("ADMIN", "protected-account:manage")).toBe(true);
    expect(canAccess("SUPER_ADMIN", "protected-account:manage")).toBe(true);
    expect(canAccess("MANAGER", "protected-account:manage")).toBe(false);
  });

  it("checks role groups without elevating guests", () => {
    const allowed: Role[] = ["TEACHER", "MANAGER"];

    expect(hasAnyRole("TEACHER", allowed)).toBe(true);
    expect(hasAnyRole("GUEST", allowed)).toBe(false);
  });
});
