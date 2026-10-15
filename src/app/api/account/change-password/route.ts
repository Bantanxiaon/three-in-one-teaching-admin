import { compare, hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail("UNAUTHORIZED", "Please sign in first.", 401);

    const input = changePasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true }
    });

    if (!user?.passwordHash || !await compare(input.currentPassword, user.passwordHash)) {
      return fail("INVALID_CURRENT_PASSWORD", "The current password is incorrect.", 422);
    }

    if (await compare(input.newPassword, user.passwordHash)) {
      return fail("PASSWORD_REUSED", "Choose a password you have not just used.", 422);
    }

    const passwordHash = await hash(input.newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, currentTemporaryPassword: null }
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id }
      });
    });

    return ok({ mustChangePassword: false });
  } catch (error) {
    return handleApiError(error);
  }
}
