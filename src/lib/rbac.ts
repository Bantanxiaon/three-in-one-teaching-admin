export const roles = ["GUEST", "STUDENT", "TEACHER", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "public:read",
  "booking:create",
  "student:read-own",
  "student:write-practice",
  "lesson:read-own",
  "lesson:write-feedback",
  "lesson:reconcile",
  "teacher:read",
  "teacher:manage",
  "admin:read",
  "admin:write",
  "finance:read",
  "finance:write",
  "journal:write",
  "role:assign",
  "audit:read",
  "protected-account:manage"
] as const;

export type Permission = (typeof permissions)[number];

const administratorPermissions: Permission[] = [
  "public:read",
  "teacher:read",
  "teacher:manage",
  "lesson:read-own",
  "lesson:write-feedback",
  "lesson:reconcile",
  "admin:read",
  "admin:write",
  "finance:read",
  "finance:write",
  "journal:write",
  "audit:read",
  "protected-account:manage"
];

export const permissionsByRole: Record<Role, Permission[]> = {
  GUEST: ["public:read", "booking:create"],
  STUDENT: ["public:read", "student:read-own", "student:write-practice", "lesson:read-own"],
  TEACHER: ["public:read", "teacher:read", "lesson:read-own", "lesson:write-feedback"],
  MANAGER: [
    "public:read",
    "teacher:read",
    "teacher:manage",
    "lesson:read-own",
    "lesson:write-feedback",
    "lesson:reconcile",
    "admin:read",
    "admin:write",
    "finance:read",
    "journal:write"
  ],
  ADMIN: administratorPermissions,
  SUPER_ADMIN: administratorPermissions
};

export function canAccess(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) {
    return false;
  }

  return permissionsByRole[role]?.includes(permission) ?? false;
}

export function hasAnyRole(role: Role | undefined | null, allowedRoles: Role[]): boolean {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}

export function assertPermission(role: Role | undefined | null, permission: Permission): void {
  if (!canAccess(role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
