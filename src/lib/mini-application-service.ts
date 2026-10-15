import { z } from "zod";
import { studentSubmissionSchema, type ApplicationSubmissionInput } from "@/lib/application-schemas";
import {
  createApplicationIdempotently,
  type WechatSubscriptionMetadataFactory
} from "@/lib/application-service";
import { sendApplicantConfirmation, sendApplicationNotification } from "@/lib/mail";
import { verifyMiniProgramLogin } from "@/lib/mini-program-auth";
import { enforceMiniSubmissionLimit } from "@/lib/mini-program-rate-limit";
import { encryptWechatRecipient } from "@/lib/wechat-recipient-crypto";
import { sendBookingReceivedWechat } from "@/lib/wechat-notifications";
import { wechatTemplateDefaults } from "@/lib/wechat-template-config";

export const miniStudentApplicationSchema = z.intersection(
  studentSubmissionSchema,
  z.object({
    locale: z.enum(["zh", "en"]),
    loginCode: z.string().trim().min(1).max(256),
    subscriptionTemplateIds: z.array(z.string().min(1).max(256).refine(
      (templateId) => templateId.trim().length > 0,
      "Subscription template IDs must be non-empty."
    )).max(3).refine(
      (ids) => new Set(ids).size === ids.length,
      "Subscription template IDs must be unique."
    ).optional()
  })
);

export type MiniStudentApplicationInput = z.infer<typeof miniStudentApplicationSchema>;

export function toMiniSubmission(input: MiniStudentApplicationInput): ApplicationSubmissionInput {
  return studentSubmissionSchema.parse(input);
}

export type MiniDependencies = {
  verifyLogin(code: string): Promise<{ identityHash: string; openId: string }>;
  enforceLimit(identityHash: string, idempotencyKey: string): Promise<void>;
  create(input: ApplicationSubmissionInput, getWechatSubscription?: WechatSubscriptionMetadataFactory): ReturnType<typeof createApplicationIdempotently>;
  notifyAdmin(input: ApplicationSubmissionInput): ReturnType<typeof sendApplicationNotification>;
  notifyApplicant(input: ApplicationSubmissionInput): ReturnType<typeof sendApplicantConfirmation>;
  notifyWechat?(input: Parameters<typeof sendBookingReceivedWechat>[0]): ReturnType<typeof sendBookingReceivedWechat>;
};

const defaultMiniDependencies: MiniDependencies = {
  verifyLogin: verifyMiniProgramLogin,
  enforceLimit: enforceMiniSubmissionLimit,
  create: (input, getWechatSubscription) => createApplicationIdempotently(input, undefined, getWechatSubscription),
  notifyAdmin: sendApplicationNotification,
  notifyApplicant: sendApplicantConfirmation,
  notifyWechat: sendBookingReceivedWechat
};

function allowedSubscriptionTemplateIds() {
  return new Set([
    process.env.WECHAT_TEMPLATE_BOOKING_RECEIVED || wechatTemplateDefaults.bookingReceived.templateId,
    process.env.WECHAT_TEMPLATE_ACCOUNT_READY || wechatTemplateDefaults.account.templateId,
    process.env.WECHAT_TEMPLATE_LESSON_SCHEDULED || wechatTemplateDefaults.lesson.templateId
  ].filter((templateId): templateId is string => Boolean(templateId)));
}

function toWechatSubscriptionMetadataFactory(
  input: MiniStudentApplicationInput,
  openId: string
): WechatSubscriptionMetadataFactory | undefined {
  const allowedIds = (input.subscriptionTemplateIds ?? []).filter((templateId) => allowedSubscriptionTemplateIds().has(templateId));
  if (!allowedIds.length) return undefined;

  return () => {
    const encrypted = encryptWechatRecipient(openId);
    if (encrypted.status === "skipped") return undefined;

    return {
      wechatRecipientCiphertext: encrypted.ciphertext,
      wechatSubscriptionTemplateIds: allowedIds,
      wechatSubscriptionUpdatedAt: new Date()
    };
  };
}

export async function submitMiniApplication(
  input: MiniStudentApplicationInput,
  dependencies: MiniDependencies = defaultMiniDependencies
) {
  const identity = await dependencies.verifyLogin(input.loginCode);
  await dependencies.enforceLimit(identity.identityHash, input.idempotencyKey);
  const submission = toMiniSubmission(input);
  const result = await dependencies.create(submission, toWechatSubscriptionMetadataFactory(input, identity.openId));

  if (result.created) {
    try {
      await dependencies.notifyAdmin(submission);
    } catch {
      console.error("Mini Program application email notification failed");
    }
    try {
      await dependencies.notifyApplicant(submission);
    } catch {
      console.error("Mini Program applicant confirmation email failed");
    }
    try {
      await dependencies.notifyWechat?.({
        applicationId: result.application.id,
        reference: submission.idempotencyKey,
        name: submission.name,
        locale: submission.locale === "ja" ? "en" : submission.locale
      });
    } catch {
      console.error("Mini Program booking WeChat notification failed");
    }
  }

  return { id: result.application.id, status: result.application.status, created: result.created } as const;
}
