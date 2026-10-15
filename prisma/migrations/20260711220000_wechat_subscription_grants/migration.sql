ALTER TABLE "Booking"
  ADD COLUMN "wechatRecipientCiphertext" TEXT,
  ADD COLUMN "wechatSubscriptionTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "wechatSubscriptionUpdatedAt" TIMESTAMP(3);
