import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { verifyMiniProgramLogin } from "@/lib/mini-program-auth";
import { prisma } from "@/lib/prisma";
import { decryptWechatRecipient, encryptWechatRecipient } from "@/lib/wechat-recipient-crypto";
import { wechatTemplateDefaults } from "@/lib/wechat-template-config";

export const miniNotificationSubscriptionSchema = z.object({
  loginCode: z.string().trim().min(1).max(256),
  subscriptionTemplateIds: z.array(z.string().trim().min(1).max(256)).min(1).max(3)
    .refine((ids) => new Set(ids).size === ids.length, "Subscription template IDs must be unique.")
}).strict();

type SubscriptionStore = {
  findByUserId(userId: string): Promise<{
    userId: string;
    identityHash: string | null;
    recipientCiphertext: string;
    subscriptionTemplateIds: string[];
  } | null>;
  findByIdentityHash(identityHash: string): Promise<{ userId: string } | null>;
  upsert(userId: string, identityHash: string, ciphertext: string, templateIds: string[]): Promise<void>;
};

type Dependencies = {
  verifyLogin(code: string): Promise<{ identityHash: string; openId: string }>;
  encrypt(openId: string): ReturnType<typeof encryptWechatRecipient>;
  decrypt(ciphertext: string): ReturnType<typeof decryptWechatRecipient>;
  store: SubscriptionStore;
};

const defaultDependencies: Dependencies = {
  verifyLogin: verifyMiniProgramLogin,
  encrypt: encryptWechatRecipient,
  decrypt: decryptWechatRecipient,
  store: {
    findByUserId: (userId) => prisma.wechatNotificationBinding.findUnique({ where: { userId } }),
    findByIdentityHash: (identityHash) => prisma.wechatNotificationBinding.findUnique({
      where: { identityHash },
      select: { userId: true }
    }),
    async upsert(userId, identityHash, ciphertext, templateIds) {
      await prisma.wechatNotificationBinding.upsert({
        where: { userId },
        create: {
          userId,
          identityHash,
          recipientCiphertext: ciphertext,
          subscriptionTemplateIds: templateIds
        },
        update: {
          identityHash,
          recipientCiphertext: ciphertext,
          subscriptionTemplateIds: templateIds
        }
      });
    }
  }
};

export function secondaryNotificationTemplateIds() {
  return new Set([
    process.env.WECHAT_TEMPLATE_PASSWORD_RESET || wechatTemplateDefaults.account.templateId,
    process.env.WECHAT_TEMPLATE_ACCOUNT_STATUS || wechatTemplateDefaults.account.templateId,
    process.env.WECHAT_TEMPLATE_LESSON_BALANCE || wechatTemplateDefaults.lesson.templateId
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value)));
}

export async function saveMiniNotificationSubscriptions(
  userId: string,
  input: z.infer<typeof miniNotificationSubscriptionSchema>,
  dependencies: Dependencies = defaultDependencies
) {
  const allowed = secondaryNotificationTemplateIds();
  const accepted = input.subscriptionTemplateIds.filter((templateId) => allowed.has(templateId));
  if (!accepted.length) {
    throw new ApiError("NOTIFICATION_TEMPLATE_NOT_CONFIGURED", "当前提醒类型暂未开放。", 422);
  }

  const [identity, binding] = await Promise.all([
    dependencies.verifyLogin(input.loginCode),
    dependencies.store.findByUserId(userId)
  ]);
  const otherAccount = await dependencies.store.findByIdentityHash(identity.identityHash);
  if (otherAccount && otherAccount.userId !== userId) {
    throw new ApiError("WECHAT_ACCOUNT_MISMATCH", "当前微信已绑定其他会员账号，请联系课程管理顾问核实。", 409);
  }

  if (binding) {
    if (binding.userId !== userId) {
      throw new ApiError("WECHAT_ACCOUNT_MISMATCH", "当前账号消息绑定不一致，请联系课程管理顾问核实。", 409);
    }
    const current = dependencies.decrypt(binding.recipientCiphertext);
    if (current.status !== "decrypted" || current.openId !== identity.openId) {
      throw new ApiError("WECHAT_ACCOUNT_MISMATCH", "当前微信与账号原有绑定不一致，请联系课程管理顾问核实。", 409);
    }
  }

  const encrypted = dependencies.encrypt(identity.openId);
  if (encrypted.status !== "encrypted") {
    throw new ApiError("WECHAT_NOTIFICATION_UNAVAILABLE", "消息提醒暂时无法启用，请稍后重试。", 503);
  }

  const templateIds = Array.from(new Set([
    ...(binding?.subscriptionTemplateIds ?? []).filter((templateId) => allowed.has(templateId)),
    ...accepted
  ]));
  await dependencies.store.upsert(userId, identity.identityHash, encrypted.ciphertext, templateIds);
  return { enabled: accepted.length } as const;
}
