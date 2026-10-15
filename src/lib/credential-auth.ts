import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, getLoginFailures, recordLoginFailure } from "@/lib/rate-limit";
import type { Role } from "@/lib/rbac";

const LOGIN_BLOCK_THRESHOLD = 8;
const DUMMY_PASSWORD_HASH = "$2b$12$91QzHYRjCcv1Q7wiEFxvtuVG.yH9CH8YWvyCT.GQ6AUJdGP/uePym";
const credentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(128)
});

type CredentialUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  mustChangePassword: boolean;
  isActive: boolean;
  passwordHash: string | null;
};

export type CredentialAuthDependencies = {
  findUser(email: string): Promise<CredentialUser | null>;
  comparePassword(password: string, passwordHash: string): Promise<boolean>;
  getFailures(identifier: string): Promise<number>;
  recordFailure(identifier: string): Promise<number>;
  clearFailures(identifier: string): Promise<void>;
};

const defaultDependencies: CredentialAuthDependencies = {
  findUser: (email) => prisma.user.findUnique({ where: { email } }),
  comparePassword: compare,
  getFailures: (identifier) => getLoginFailures(identifier),
  recordFailure: (identifier) => recordLoginFailure(identifier),
  clearFailures: (identifier) => clearLoginFailures(identifier)
};

export function isLoginBlocked(failures: number) {
  return failures >= LOGIN_BLOCK_THRESHOLD;
}

function requestOrigin(request: Request | undefined) {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request?.headers.get("x-real-ip")?.trim();
  return (forwarded || direct || "unknown").slice(0, 64);
}

export async function authorizeCredentials(
  credentials: unknown,
  request?: Request,
  dependencies: CredentialAuthDependencies = defaultDependencies
) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const identifiers = [
    `account:${parsed.data.email}`,
    `origin:${requestOrigin(request)}`
  ];
  const failures = await Promise.all(identifiers.map((identifier) => dependencies.getFailures(identifier)));
  if (failures.some(isLoginBlocked)) return null;

  const user = await dependencies.findUser(parsed.data.email);
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const validPassword = await dependencies.comparePassword(parsed.data.password, passwordHash);
  if (!user || !user.passwordHash || !validPassword || !user.isActive) {
    await Promise.all(identifiers.map((identifier) => dependencies.recordFailure(identifier)));
    return null;
  }

  await Promise.all(identifiers.map((identifier) => dependencies.clearFailures(identifier)));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role as Role,
    mustChangePassword: user.mustChangePassword
  };
}
