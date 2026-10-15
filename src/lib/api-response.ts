import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function handleApiError(error: unknown, options?: { logUnknownError?: (error: unknown) => void }) {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request.", 422);
  }

  if (error instanceof Error && error.message.startsWith("Missing permission")) {
    return fail("FORBIDDEN", error.message, 403);
  }

  if (errorCode(error) === "P2002") {
    return fail("CONFLICT", "A record with these unique details already exists.", 409);
  }

  if (errorCode(error) === "P2025") {
    return fail("NOT_FOUND", "The requested record was not found.", 404);
  }

  if (options?.logUnknownError) {
    options.logUnknownError(error);
  } else {
    console.error(error);
  }
  return fail("INTERNAL_SERVER_ERROR", "The request could not be completed.", 500);
}
