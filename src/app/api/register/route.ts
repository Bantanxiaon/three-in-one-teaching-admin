import { fail } from "@/lib/api-response";

export async function POST() {
  return fail(
    "REGISTRATION_MANAGED",
    "Accounts are created by a Chenyin course advisor.",
    403
  );
}
