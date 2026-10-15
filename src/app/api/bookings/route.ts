import { sendBookingNotification } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validators";
import { handleApiError, ok } from "@/lib/api-response";
import { requireApiPermission } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const input = bookingSchema.parse(await request.json());
    const booking = await prisma.accountApplication.create({
      data: {
        role: "STUDENT",
        idempotencyKey: request.headers.get("Idempotency-Key") ?? crypto.randomUUID(),
        name: input.name,
        age: input.age,
        phone: input.phone,
        wechat: input.wechat,
        goal: input.goal,
        preferredDates: input.preferredTimes,
        locale: input.locale
      }
    });

    try {
      await sendBookingNotification(input);
    } catch {
      console.error("Booking email notification failed");
    }

    return ok({ id: booking.id, status: booking.status }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    await requireApiPermission("admin:read");
    const bookings = await prisma.accountApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return ok(bookings);
  } catch (error) {
    return handleApiError(error);
  }
}
