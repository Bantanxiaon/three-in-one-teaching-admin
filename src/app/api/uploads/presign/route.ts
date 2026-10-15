import { randomUUID } from "crypto";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { handleApiError, ok } from "@/lib/api-response";
import { createPresignedUpload } from "@/lib/storage";

const schema = z.object({ filename: z.string().trim().min(1).max(180), contentType: z.string().regex(/^(image|video)\//) });

export async function POST(request: Request) {
  try {
    await requireApiPermission("lesson:write-feedback");
    const input = schema.parse(await request.json());
    const extension = input.filename.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    return ok(await createPresignedUpload(`studio/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`, input.contentType));
  } catch (error) { return handleApiError(error); }
}
