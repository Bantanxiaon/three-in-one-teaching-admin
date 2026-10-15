export const applicationDeletionReasonOptions = [
  {
    code: "WITHDRAWN_BY_APPLICANT",
    label: { zh: "申请人主动撤回", en: "Withdrawn by applicant", ja: "申込者による取下げ" },
    notice: {
      zh: "根据申请人意愿，本次申请记录已完成关闭与整理。",
      en: "At the applicant's request, this application record has been closed and archived.",
      ja: "申込者様のご希望により、今回のお申込み記録を終了し整理しました。",
    },
  },
  {
    code: "DUPLICATE_APPLICATION",
    label: { zh: "重复申请记录", en: "Duplicate application", ja: "重複した申込み" },
    notice: {
      zh: "经核实，本记录与已有申请重复，现已完成资料整理，不影响其他有效申请。",
      en: "This record was confirmed as a duplicate and has been consolidated. Other active applications are unaffected.",
      ja: "既存のお申込みと重複していることを確認し、記録を整理しました。ほかの有効なお申込みには影響ありません。",
    },
  },
  {
    code: "CONTACT_NOT_CONTINUED",
    label: { zh: "暂未继续沟通", en: "Conversation not continued", ja: "ご相談を終了" },
    notice: {
      zh: "因本次咨询暂未继续推进，相关申请记录现已完成整理。如需重新了解课程，欢迎再次联系我们。",
      en: "As this enquiry is not continuing at present, the application record has been closed. You are welcome to contact us again in the future.",
      ja: "今回のご相談は継続しないこととなったため、申込み記録を整理しました。再度ご検討の際は、いつでもご連絡ください。",
    },
  },
  {
    code: "INFORMATION_INCOMPLETE",
    label: { zh: "资料不完整或无法核实", en: "Information incomplete", ja: "情報の確認が困難" },
    notice: {
      zh: "因申请资料暂无法完整核实，本次记录已完成整理。如需继续申请，请使用准确的联系方式重新提交。",
      en: "As the application details could not be fully verified, this record has been closed. Please submit again with accurate contact details if you wish to continue.",
      ja: "お申込み内容を十分に確認できなかったため、記録を整理しました。継続をご希望の場合は、正確な連絡先で改めてお申込みください。",
    },
  },
  {
    code: "RECORD_CONSOLIDATION",
    label: { zh: "其他资料整理", en: "Other record consolidation", ja: "その他の記録整理" },
    notice: {
      zh: "因申请资料整理需要，本次记录已完成关闭。如有疑问，请联系课程管理顾问核实。",
      en: "This application record has been closed as part of a record consolidation. Please contact the course advisor if you would like to verify the details.",
      ja: "申込み情報の整理に伴い、今回の記録を終了しました。ご不明な点はコースアドバイザーへお問い合わせください。",
    },
  },
] as const;

export type ApplicationDeletionReasonCode = (typeof applicationDeletionReasonOptions)[number]["code"];
