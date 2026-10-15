export const studentDeletionReasonCodes = [
  "COURSE_COMPLETED",
  "LEARNING_ARRANGEMENT_CHANGED",
  "CLOSED_BY_REQUEST",
  "DUPLICATE_RECORD",
  "LONG_TERM_INACTIVE",
  "ACCOUNT_RECORD_ADJUSTMENT"
] as const;

export type StudentDeletionReasonCode = (typeof studentDeletionReasonCodes)[number];

export const studentDeletionReasonOptions: ReadonlyArray<{
  code: StudentDeletionReasonCode;
  label: Record<"zh" | "en" | "ja", string>;
  notice: Record<"zh" | "en" | "ja", string>;
}> = [
  {
    code: "COURSE_COMPLETED",
    label: { zh: "本阶段课程已结束", en: "Course stage completed", ja: "今回の受講期間が終了" },
    notice: {
      zh: "本阶段课程已顺利结束，相关会员账号现已完成关闭。如需再次开始课程，欢迎随时联系我们。",
      en: "This course stage has concluded and the related member account has been closed. Please contact us whenever you would like to resume lessons.",
      ja: "今回の受講期間終了に伴い、会員アカウントを閉鎖しました。レッスン再開をご希望の際は、いつでもご連絡ください。"
    }
  },
  {
    code: "LEARNING_ARRANGEMENT_CHANGED",
    label: { zh: "转学或学习安排调整", en: "Learning arrangement changed", ja: "転校または受講予定の変更" },
    notice: {
      zh: "因学习地点或课程安排发生调整，相关会员账号现已完成关闭。感谢您与晨音的相伴。",
      en: "Following a change to the learning location or lesson arrangement, the related member account has been closed. Thank you for your time with Chenyin.",
      ja: "学習場所または受講予定の変更に伴い、会員アカウントを閉鎖しました。Chenyinをご利用いただき、ありがとうございました。"
    }
  },
  {
    code: "CLOSED_BY_REQUEST",
    label: { zh: "学员或监护人申请关闭", en: "Closed at the member's request", ja: "生徒・保護者からのご依頼" },
    notice: {
      zh: "根据您或监护人的申请，相关会员账号现已完成关闭。如需重新开通，我们很乐意继续协助。",
      en: "At your or your guardian's request, the related member account has been closed. We will be glad to help if you would like to reactivate it.",
      ja: "ご本人または保護者様からのご依頼により、会員アカウントを閉鎖しました。再開をご希望の際は、喜んでお手伝いいたします。"
    }
  },
  {
    code: "DUPLICATE_RECORD",
    label: { zh: "重复账号或资料整理", en: "Duplicate account or record", ja: "重複アカウント・記録の整理" },
    notice: {
      zh: "经核实，该账号属于重复记录，现已完成资料整理与账号关闭，不影响其他有效账号的使用。",
      en: "This account was confirmed as a duplicate record and has been closed as part of a record cleanup. Other active accounts are unaffected.",
      ja: "重複記録であることを確認したため、情報整理のうえ当該アカウントを閉鎖しました。ほかの有効なアカウントには影響ありません。"
    }
  },
  {
    code: "LONG_TERM_INACTIVE",
    label: { zh: "长期未继续课程安排", en: "No lessons arranged for an extended period", ja: "長期間レッスン予定なし" },
    notice: {
      zh: "因较长时间未继续安排课程，相关会员账号现已完成关闭。如需恢复学习，请联系课程管理顾问。",
      en: "As no lessons have been arranged for an extended period, the related member account has been closed. Please contact the course advisor to resume learning.",
      ja: "長期間レッスンの予定がなかったため、会員アカウントを閉鎖しました。再開をご希望の場合は、担当者へご連絡ください。"
    }
  },
  {
    code: "ACCOUNT_RECORD_ADJUSTMENT",
    label: { zh: "其他账户资料调整", en: "Other account record adjustment", ja: "その他のアカウント情報調整" },
    notice: {
      zh: "因账户资料调整，相关会员账号现已完成关闭。如有疑问，请联系课程管理顾问核实。",
      en: "The related member account has been closed following an account record adjustment. Please contact the course advisor if you would like to verify the details.",
      ja: "アカウント情報の調整に伴い、会員アカウントを閉鎖しました。ご不明な点は担当者へお問い合わせください。"
    }
  }
];

export function getStudentDeletionReason(
  code: StudentDeletionReasonCode,
  locale: "zh" | "en" | "ja" = "zh"
) {
  const option = studentDeletionReasonOptions.find((item) => item.code === code);
  if (!option) throw new Error("Unsupported student deletion reason.");
  return option.notice[locale];
}
