import { getRecipientEmailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";

export type LessonBalanceEmailInput = {
  studentName: string;
  studentNumber: string;
  teacherName?: string | null;
  remainingLessons: number;
  completedLessons: number;
  totalLessons: number;
  nextLessonAt?: Date | null;
  locale?: "zh" | "en" | "ja";
};

function formatDate(date: Date | null | undefined, locale: LessonBalanceEmailInput["locale"]) {
  if (!date) {
    if (locale === "ja") return "担当者より別途ご案内します";
    if (locale === "en") return "To be confirmed";
    return "课程顾问将另行确认";
  }

  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "zh-CN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(date);
}

export function buildLessonBalanceEmail(input: LessonBalanceEmailInput) {
  const remainingText = `${input.remainingLessons} / ${input.totalLessons}`;

  return createDefinition(getRecipientEmailCopy("lessonBalance", input.locale), {
    locale: input.locale,
    eyebrowZh: "课时余额提醒",
    eyebrowEn: "Lesson balance reminder",
    eyebrowJa: "残りレッスン数のお知らせ",
    titleZh: "请查看您的剩余课时",
    titleEn: "Your lesson balance",
    titleJa: "残りレッスン数のご案内",
    introZh: `${input.studentName}，这是您的阶段性课时提醒。我们会持续记录每一次上课与老师反馈，方便您清楚了解学习进度。`,
    introEn: `${input.studentName}, this is a lesson balance reminder. We continue to record lessons and teacher feedback so your progress stays clear.`,
    introJa: `${input.studentName} 様、現在のレッスン残数をお知らせします。毎回のレッスンと講師フィードバックを記録し、学習状況を分かりやすく管理します。`,
    details: [
      { labelZh: "学员编号", labelEn: "Student number", labelJa: "会員番号", value: input.studentNumber },
      { labelZh: "剩余课时", labelEn: "Remaining lessons", labelJa: "残りレッスン数", value: remainingText, emphasize: true },
      { labelZh: "已上课时", labelEn: "Completed lessons", labelJa: "受講済み回数", value: String(input.completedLessons) },
      { labelZh: "授课老师", labelEn: "Teacher", labelJa: "担当講師", value: input.teacherName || (input.locale === "en" ? "To be confirmed" : input.locale === "ja" ? "調整中" : "待确认") },
      { labelZh: "下一节课", labelEn: "Next lesson", labelJa: "次回レッスン", value: formatDate(input.nextLessonAt, input.locale) }
    ],
    status: {
      labelZh: "续课与安排",
      labelEn: "Planning ahead",
      labelJa: "今後のご案内",
      valueZh: input.remainingLessons <= 3
        ? "您的剩余课时已不多。课程顾问会协助您确认后续学习节奏，避免课程中断。"
        : "当前课时状态正常。请按老师反馈保持练习节奏，如需调整上课时间可提前联系课程顾问。",
      valueEn: input.remainingLessons <= 3
        ? "Your balance is running low. A course advisor can help plan the next stage so lessons continue smoothly."
        : "Your lesson balance is in a healthy range. Keep following your teacher's feedback and contact us if scheduling needs change.",
      valueJa: input.remainingLessons <= 3
        ? "残り回数が少なくなっています。学習が途切れないよう、担当者が次の段階をご案内します。"
        : "現在の残数は十分です。講師のフィードバックに沿って練習を続け、日程変更が必要な場合はご連絡ください。"
    }
  });
}
