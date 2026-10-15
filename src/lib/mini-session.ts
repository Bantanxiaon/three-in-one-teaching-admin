import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { authorizeCredentials } from "@/lib/credential-auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";

const MINI_SESSION_PREFIX = "mini_";
export const MINI_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const miniLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
});

type MiniWorkspace = "student" | "teacher" | "admin";

export type MiniSessionUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  preferredLocale: "zh" | "en" | "ja";
  workspace: MiniWorkspace;
  student: { id: string; studentNumber: string; fullName: string } | null;
  teacher: { id: string; slug: string; displayName: string } | null;
};

type SessionRecord = {
  sessionToken: string;
  expires: Date;
  user: Omit<MiniSessionUser, "workspace" | "preferredLocale"> & {
    isActive: boolean;
    preferredLocale: string;
  };
};

type AuthorizedUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

export type MiniSessionDependencies = {
  now(): Date;
  createToken(): string;
  authorize(credentials: unknown, request: Request): Promise<AuthorizedUser | null>;
  createSession(input: { sessionToken: string; userId: string; expires: Date }): Promise<void>;
  findSession(sessionToken: string): Promise<SessionRecord | null>;
  deleteSession(sessionToken: string): Promise<void>;
  pruneExpiredSessions(userId: string, now: Date): Promise<void>;
};

const miniUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  mustChangePassword: true,
  isActive: true,
  preferredLocale: true,
  studentProfile: { select: { id: true, studentNumber: true, fullName: true } },
  teacherProfile: { select: { id: true, slug: true, displayName: true } },
} as const;

const defaultDependencies: MiniSessionDependencies = {
  now: () => new Date(),
  createToken: () => `${MINI_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`,
  authorize: (credentials, request) => authorizeCredentials(credentials, request),
  async createSession(input) {
    await prisma.session.create({ data: input });
  },
  async findSession(sessionToken) {
    const record = await prisma.session.findUnique({
      where: { sessionToken },
      select: { sessionToken: true, expires: true, user: { select: miniUserSelect } },
    });
    if (!record) return null;

    return {
      sessionToken: record.sessionToken,
      expires: record.expires,
      user: {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        role: record.user.role,
        mustChangePassword: record.user.mustChangePassword,
        isActive: record.user.isActive,
        preferredLocale: record.user.preferredLocale,
        student: record.user.studentProfile,
        teacher: record.user.teacherProfile,
      },
    };
  },
  async deleteSession(sessionToken) {
    await prisma.session.deleteMany({ where: { sessionToken } });
  },
  async pruneExpiredSessions(userId, now) {
    await prisma.session.deleteMany({ where: { userId, expires: { lte: now } } });
  },
};

function workspaceForRole(role: Role): MiniWorkspace {
  if (role === "STUDENT") return "student";
  if (role === "TEACHER") return "teacher";
  return "admin";
}

function preferredLocale(value: string): MiniSessionUser["preferredLocale"] {
  return value === "en" || value === "ja" ? value : "zh";
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(mini_[A-Za-z0-9_-]{32,})$/.exec(authorization);
  if (!match) {
    throw new ApiError("MINI_SESSION_REQUIRED", "请先登录后再继续。", 401);
  }
  return match[1];
}

function publicUser(record: SessionRecord): MiniSessionUser {
  return {
    id: record.user.id,
    name: record.user.name,
    email: record.user.email,
    role: record.user.role,
    mustChangePassword: record.user.mustChangePassword,
    preferredLocale: preferredLocale(record.user.preferredLocale),
    workspace: workspaceForRole(record.user.role),
    student: record.user.student,
    teacher: record.user.teacher,
  };
}

export async function createMiniSession(
  input: unknown,
  request: Request,
  dependencies: MiniSessionDependencies = defaultDependencies,
) {
  const credentials = miniLoginSchema.parse(input);
  const user = await dependencies.authorize(credentials, request);
  if (!user) {
    throw new ApiError("INVALID_CREDENTIALS", "邮箱或密码不正确，请检查后重试。", 401);
  }

  const now = dependencies.now();
  const expires = new Date(now.getTime() + MINI_SESSION_DURATION_MS);
  const sessionToken = dependencies.createToken();
  await dependencies.pruneExpiredSessions(user.id, now);
  await dependencies.createSession({ sessionToken, userId: user.id, expires });

  return {
    token: sessionToken,
    expiresAt: expires.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      workspace: workspaceForRole(user.role),
    },
  };
}

export async function requireMiniSession(
  request: Request,
  dependencies: MiniSessionDependencies = defaultDependencies,
): Promise<{ token: string; expiresAt: string; user: MiniSessionUser }> {
  const token = bearerToken(request);
  const record = await dependencies.findSession(token);
  const now = dependencies.now();

  if (!record || !record.user.isActive || record.expires.getTime() <= now.getTime()) {
    if (record) await dependencies.deleteSession(token);
    throw new ApiError("MINI_SESSION_EXPIRED", "登录状态已失效，请重新登录。", 401);
  }

  return {
    token,
    expiresAt: record.expires.toISOString(),
    user: publicUser(record),
  };
}

export async function deleteMiniSession(
  request: Request,
  dependencies: MiniSessionDependencies = defaultDependencies,
) {
  const token = bearerToken(request);
  await dependencies.deleteSession(token);
  return { signedOut: true as const };
}
