import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { journalSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const locale = new URL(request.url).searchParams.get("locale") ?? "zh";
    return ok(await prisma.journalPost.findMany({ where: { locale, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("journal:write");
    const input = journalSchema.parse(await request.json());
    return ok(await prisma.journalPost.create({ data: { ...input, authorId: session.user.id } }), { status: 201 });
  } catch (error) { return handleApiError(error); }
}
