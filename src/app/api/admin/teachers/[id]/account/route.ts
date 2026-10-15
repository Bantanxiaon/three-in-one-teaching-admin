import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import {
  createCoreTeacherAccount,
  resetCoreTeacherPassword,
  setTeacherAccountActive
} from "@/lib/core-teacher-account";
import {
  coreTeacherAccountActionSchema,
  createCoreTeacherAccountSchema
} from "@/lib/core-teacher-account-schemas";
import { toCoreTeacherAccountDto } from "@/lib/core-teacher-account-dto";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const session = await requireApiPermission("protected-account:manage");
    const { id } = await params;
    const input = createCoreTeacherAccountSchema.parse(await request.json());
    const result = await createCoreTeacherAccount({
      teacherId: id,
      email: input.email,
      preferredLocale: input.preferredLocale,
      actorId: session.user.id
    });
    return ok(toCoreTeacherAccountDto(result), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await requireApiPermission("protected-account:manage");
    const { id } = await params;
    const input = coreTeacherAccountActionSchema.parse(await request.json());
    const command = { teacherId: id, actorId: session.user.id };
    const result = input.action === "RESET_PASSWORD"
      ? await resetCoreTeacherPassword(command)
      : await setTeacherAccountActive({ ...command, isActive: input.action === "RESUME" });
    return ok(toCoreTeacherAccountDto(result));
  } catch (error) {
    return handleApiError(error);
  }
}
