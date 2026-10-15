CREATE TABLE "WechatNotificationBinding" (
  "userId" TEXT NOT NULL,
  "identityHash" TEXT,
  "recipientCiphertext" TEXT NOT NULL,
  "subscriptionTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WechatNotificationBinding_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "WechatNotificationBinding_identityHash_key"
  ON "WechatNotificationBinding"("identityHash");

ALTER TABLE "WechatNotificationBinding"
  ADD CONSTRAINT "WechatNotificationBinding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WechatNotificationBinding" (
  "userId", "recipientCiphertext", "subscriptionTemplateIds", "updatedAt"
)
SELECT
  "approvedUserId", "wechatRecipientCiphertext", "wechatSubscriptionTemplateIds", COALESCE("wechatSubscriptionUpdatedAt", CURRENT_TIMESTAMP)
FROM "Booking"
WHERE "approvedUserId" IS NOT NULL
  AND "wechatRecipientCiphertext" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;
