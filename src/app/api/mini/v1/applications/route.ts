import { handleApiError, ok } from "@/lib/api-response";
import { miniStudentApplicationSchema, submitMiniApplication } from "@/lib/mini-application-service";

export async function POST(request: Request) {
  try {
    const input = miniStudentApplicationSchema.parse(await request.json());
    const result = await submitMiniApplication(input);
    return ok({ id: result.id, status: result.status, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error, {
      logUnknownError: () => console.error("Mini Program application request failed")
    });
  }
}
