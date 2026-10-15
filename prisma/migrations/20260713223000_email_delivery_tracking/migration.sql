CREATE TYPE "EmailDeliveryStatus" AS ENUM (
  'ACCEPTED',
  'SENT',
  'DELAYED',
  'DELIVERED',
  'BOUNCED',
  'FAILED',
  'COMPLAINED',
  'SUPPRESSED'
);

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'ACCEPTED',
  "lastEventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDeliveryEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_providerMessageId_key" ON "EmailDelivery"("providerMessageId");
CREATE UNIQUE INDEX "EmailDelivery_idempotencyKey_key" ON "EmailDelivery"("idempotencyKey");
CREATE INDEX "EmailDelivery_recipient_createdAt_idx" ON "EmailDelivery"("recipient", "createdAt");
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
CREATE UNIQUE INDEX "EmailDeliveryEvent_eventId_key" ON "EmailDeliveryEvent"("eventId");
CREATE INDEX "EmailDeliveryEvent_providerMessageId_occurredAt_idx" ON "EmailDeliveryEvent"("providerMessageId", "occurredAt");

ALTER TABLE "EmailDeliveryEvent"
ADD CONSTRAINT "EmailDeliveryEvent_providerMessageId_fkey"
FOREIGN KEY ("providerMessageId") REFERENCES "EmailDelivery"("providerMessageId")
ON DELETE CASCADE ON UPDATE CASCADE;
