import { getRecipientEmailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";

export type AccountDeletedEmailInput = { name: string; reason: string; locale?: "zh" | "en" | "ja" };

export function buildAccountDeletedEmail(input: AccountDeletedEmailInput) {
  return createDefinition(getRecipientEmailCopy("accountDeleted", input.locale), {
    locale: input.locale,
    eyebrowZh: "会员账号通知",
    eyebrowEn: "Membership account notice",
    eyebrowJa: "会員アカウントのお知らせ",
    titleZh: "账号登录权限已关闭",
    titleEn: "Account access has been updated",
    titleJa: "アカウント利用に関するお知らせ",
    introZh: `${input.name}，您好。根据当前课程服务安排，您的晨音会员账号登录权限已关闭。感谢您此前对晨音的信任与支持。`,
    introEn: `${input.name}, access to your Chenyin member account has been closed according to the current service arrangement. Thank you for your trust and support.`,
    introJa: `${input.name} 様、現在のサービス状況に基づき、Chenyin 会員アカウントのログイン権限を終了いたしました。これまでのご信頼に感謝申し上げます。`,
    details: [{ labelZh: "说明", labelEn: "Note", labelJa: "ご案内", value: input.reason }],
    status: {
      labelZh: "如需核实",
      labelEn: "Need clarification",
      labelJa: "確認をご希望の場合",
      valueZh: "如您认为信息有误，或后续希望重新沟通课程安排，请通过邮件底部联系方式联系课程顾问。",
      valueEn: "If you believe this is incorrect or would like to discuss lessons again, contact the course advisor using the details below.",
      valueJa: "内容の確認や今後のご相談をご希望の場合は、メール下部の連絡先より担当者へご連絡ください。"
    }
  });
}
