import { getRecipientEmailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";

export type AccountApprovedEmailInput = {
  name: string;
  email: string;
  studentNumber?: string;
  temporaryPassword: string;
  locale?: "zh" | "en" | "ja";
};

export function buildAccountApprovedEmail(input: AccountApprovedEmailInput, siteUrl: string) {
  return createDefinition(getRecipientEmailCopy("accountApproved", input.locale), {
    locale: input.locale,
    eyebrowZh: "晨音会员通知",
    eyebrowEn: "A private note from Chenyin",
    eyebrowJa: "Chenyin 会員アカウントのお知らせ",
    titleZh: `欢迎，${input.name}`,
    titleEn: "Welcome to Chenyin",
    titleJa: "アカウントの準備が整いました",
    introZh: "从此刻起，您的课程、练习与成长记录将被晨音认真保存。请使用下方信息登录会员中心；首次登录后，建议尽快修改为您熟悉的数字密码。",
    introEn: "Your lessons, practice, and progress will be thoughtfully recorded from this moment forward. Use the details below to sign in, then set a numeric password you can remember.",
    introJa: `${input.name} 様、Chenyin 会員アカウントの準備が整いました。今後のレッスン、練習記録、成長の歩みを大切にお預かりします。`,
    details: [
      ...(input.studentNumber
        ? [{ labelZh: "学员编号", labelEn: "Student number", labelJa: "会員番号", value: input.studentNumber }]
        : []),
      { labelZh: "登录邮箱", labelEn: "Login email", labelJa: "ログイン用メールアドレス", value: input.email },
      { labelZh: "六位临时密码", labelEn: "Temporary password", labelJa: "6 桁の仮パスワード", value: input.temporaryPassword, emphasize: true }
    ],
    action: { href: `${siteUrl}/${input.locale ?? "zh"}/login`, zh: "进入会员登录", en: "Sign in", ja: "会員ログインへ" },
    status: {
      labelZh: "账号安全",
      labelEn: "Account security",
      labelJa: "アカウントの安全について",
      valueZh: "首次登录后，请设置新的 6 位以上数字密码。若您没有申请账号，请直接联系课程顾问核实。",
      valueEn: "After signing in, set a new numeric password with at least six digits. If you did not request an account, contact the course advisor.",
      valueJa: "初回ログイン後、6 桁以上の新しい数字パスワードを設定してください。心当たりがない場合は担当者へご連絡ください。"
    }
  });
}
