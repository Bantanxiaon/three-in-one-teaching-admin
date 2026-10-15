import { fail, ok } from "@/lib/api-response";
import { getMiniContent } from "@/lib/mini-content";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "zh";
  if (locale !== "zh" && locale !== "en") {
    return fail("INVALID_LOCALE", "Locale must be zh or en.", 422);
  }

  const response = ok(getMiniContent(locale));
  response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return response;
}
