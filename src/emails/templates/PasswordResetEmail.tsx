import { getRecipientEmailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";

export type PasswordResetEmailInput = { name: string; temporaryPassword: string; locale?: "zh" | "en" | "ja" };

export function buildPasswordResetEmail(input: PasswordResetEmailInput, siteUrl: string) {
  return createDefinition(getRecipientEmailCopy("passwordReset", input.locale), {
    locale: input.locale,
    eyebrowZh: "账号安全通知",
    eyebrowEn: "Account security notice",
    eyebrowJa: "アカウント安全のお知らせ",
    titleZh: "临时密码已重置",
    titleEn: "Your temporary password was reset",
    titleJa: "仮パスワードを再設定しました",
    introZh: `${input.name}，我们已为您的账号生成新的临时密码。请使用下方密码登录，并在登录后设置新的数字密码。`,
    introEn: `${input.name}, a new temporary password has been created for your account. Please sign in and set a new numeric password afterwards.`,
    introJa: `${input.name} 様、新しい仮パスワードを発行しました。ログイン後、新しい数字パスワードを設定してください。`,
    details: [
      { labelZh: "新的临时密码", labelEn: "New temporary password", labelJa: "新しい仮パスワード", value: input.temporaryPassword, emphasize: true }
    ],
    action: { href: `${siteUrl}/${input.locale ?? "zh"}/login`, zh: "进入会员登录", en: "Sign in", ja: "会員ログインへ" },
    status: {
      labelZh: "若非本人请求",
      labelEn: "If you did not request this",
      labelJa: "心当たりがない場合",
      valueZh: "请尽快联系课程顾问，我们会协助您核实账号并保护信息安全。",
      valueEn: "Please contact the course advisor so we can verify and secure your account.",
      valueJa: "担当者へご連絡ください。アカウント状況を確認し、安全を確保いたします。"
    }
  });
}
