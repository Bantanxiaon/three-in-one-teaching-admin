import { handleApiError, ok } from "@/lib/api-response";
import { contactSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const input = contactSchema.parse(await request.json());
    const message = await prisma.contactMessage.create({ data: input });
    return ok({ id: message.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
