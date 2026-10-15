import { EmailDeliveryStatus } from "@prisma/client";
import { Webhook } from "svix";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export type EmailCategory =
  | "BOOKING_INTERNAL"
  | "APPLICATION_INTERNAL"
  | "APPLICATION_CONFIRMATION"
  | "ACCOUNT_APPROVED"
  | "PASSWORD_RESET"
  | "ACCOUNT_DELETED"
  | "LESSON_SCHEDULED"
  | "LESSON_BALANCE";

export type EmailAcceptanceRecord = {
  providerMessageId: string;
  idempotencyKey: string;
  category: EmailCategory;
  recipient: string;
  subject: string;
  status: "ACCEPTED";
};

export type ResendDeliveryEvent = {
  eventId: string;
  type: string;
  occurredAt: Date;
  providerMessageId: string;
};

type DeliveryRecord = {
  id: string;
  status: string;
  lastEventAt: Date | null;
};

type DeliveryTransaction = {
  emailDeliveryEvent: {
    create(args: { data: { eventId: string; providerMessageId: string; type: string; occurredAt: Date } }): Promise<unknown>;
  };
  emailDelivery: {
    findUnique(args: { where: { providerMessageId: string }; select: { id: true; status: true; lastEventAt: true } }): Promise<DeliveryRecord | null>;
    update(args: { where: { id: string }; data: { status: EmailDeliveryStatus; lastEventAt: Date } }): Promise<unknown>;
  };
};

export type EmailDeliveryEventStore = {
  $transaction<T>(operation: (tx: DeliveryTransaction) => Promise<T>): Promise<T>;
};

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
}

function deliveryStatus(type: string) {
  const statuses: Record<string, EmailDeliveryStatus | undefined> = {
    "email.sent": EmailDeliveryStatus.SENT,
    "email.delivered": EmailDeliveryStatus.DELIVERED,
    "email.delivery_delayed": EmailDeliveryStatus.DELAYED,
    "email.bounced": EmailDeliveryStatus.BOUNCED,
    "email.failed": EmailDeliveryStatus.FAILED,
    "email.complained": EmailDeliveryStatus.COMPLAINED,
    "email.suppressed": EmailDeliveryStatus.SUPPRESSED
  };
  return statuses[type];
}

export async function recordEmailAcceptance(input: EmailAcceptanceRecord) {
  await prisma.emailDelivery.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: input,
    update: {
      providerMessageId: input.providerMessageId,
      category: input.category,
      recipient: input.recipient,
      subject: input.subject,
      status: EmailDeliveryStatus.ACCEPTED
    }
  });
}

export function verifyResendWebhook(input: {
  payload: string;
  headers: Record<"svix-id" | "svix-timestamp" | "svix-signature", string>;
  secret: string;
}): ResendDeliveryEvent {
  let verified: unknown;
  try {
    verified = new Webhook(input.secret).verify(input.payload, input.headers);
  } catch {
    throw new ApiError("INVALID_EMAIL_WEBHOOK_SIGNATURE", "Invalid email webhook signature.", 400);
  }

  const event = verified as { type?: unknown; created_at?: unknown; data?: { email_id?: unknown } };
  const eventId = input.headers["svix-id"];
  const occurredAt = typeof event.created_at === "string" ? new Date(event.created_at) : new Date(Number.NaN);
  const providerMessageId = event.data?.email_id;
  if (typeof event.type !== "string" || typeof providerMessageId !== "string" || Number.isNaN(occurredAt.getTime())) {
    throw new ApiError("INVALID_EMAIL_WEBHOOK_PAYLOAD", "Invalid email webhook payload.", 422);
  }

  return { eventId, type: event.type, occurredAt, providerMessageId };
}

export async function applyResendDeliveryEvent(event: ResendDeliveryEvent, store: EmailDeliveryEventStore) {
  try {
    return await store.$transaction(async (tx) => {
      const delivery = await tx.emailDelivery.findUnique({
        where: { providerMessageId: event.providerMessageId },
        select: { id: true, status: true, lastEventAt: true }
      });
      if (!delivery) return { status: "unmatched" as const };

      await tx.emailDeliveryEvent.create({
        data: {
          eventId: event.eventId,
          providerMessageId: event.providerMessageId,
          type: event.type,
          occurredAt: event.occurredAt
        }
      });
      if (delivery.lastEventAt && event.occurredAt < delivery.lastEventAt) return { status: "stale" as const };

      const status = deliveryStatus(event.type);
      if (!status) return { status: "recorded" as const };
      await tx.emailDelivery.update({
        where: { id: delivery.id },
        data: { status, lastEventAt: event.occurredAt }
      });
      return { status: "updated" as const };
    });
  } catch (error) {
    if (errorCode(error) === "P2002") return { status: "duplicate" as const };
    throw error;
  }
}
