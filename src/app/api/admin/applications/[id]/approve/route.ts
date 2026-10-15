import { z } from "zod";
import { approveApplication } from "@/lib/application-service";
import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";

const approvalSchema = z.object({
  email: z.string().trim().email(),
  passwordMode: z.enum(["GENERATED", "MANUAL"]),
  password: z.string().regex(/^\d{6,}$/, "Temporary passwords must be at least 6 digits.").max(128).optional(),
  campusId: z.string().trim().min(1).optional(),
  teacherId: z.string().cuid().optional(),
  tuitionPackageId: z.string().cuid().or(z.string().startsWith("tuition-")).optional(),
  teacherTitle: z.string().trim().min(2).max(120).optional()
}).superRefine((input, context) => {
  if (input.passwordMode === "MANUAL" && !input.password) context.addIssue({ code: "custom", path: ["password"], message: "Enter a temporary password." });
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiPermission("admin:write");
    const { id } = await params;
    const input = approvalSchema.parse(await request.json());
    return ok(await approveApplication({ applicationId: id, actorId: session.user.id, ...input }));
  } catch (error) {
    return handleApiError(error);
  }
}
