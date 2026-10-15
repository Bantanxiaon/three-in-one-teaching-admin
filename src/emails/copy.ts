export const emailCopy = {
  internalBooking: {
    subject: "晨音内部：新的预约记录 | New booking received",
    preview: "新的预约记录等待处理 | A new booking is ready for review"
  },
  internalStudent: {
    subject: "晨音内部：新的学员预约 | New student booking",
    preview: "新的学员预约等待处理 | A student booking is ready for review"
  },
  internalTeacher: {
    subject: "晨音内部：新的教师申请 | New teacher application",
    preview: "新的教师申请等待处理 | A teacher application is ready for review"
  },
  studentReceived: {
    subject: "晨音：预约已收到 | We received your booking",
    preview: "课程顾问将确认您的预约信息 | We will review your booking details"
  },
  teacherReceived: {
    subject: "晨音：教师申请已收到 | We received your application",
    preview: "晨音团队已收到您的教师申请 | Your application has reached the Chenyin team"
  },
  accountApproved: {
    subject: "晨音：账号已开通 | Your account is ready",
    preview: "您的晨音会员账号现已开通 | Your Chenyin account is now ready"
  },
  passwordReset: {
    subject: "晨音：临时密码已重置 | Your temporary password was reset",
    preview: "请使用新的临时密码登录 | Use your new temporary password to sign in"
  },
  accountDeleted: {
    subject: "晨音：账号登录权限已关闭 | Account access update",
    preview: "关于您的晨音会员账号登录权限说明 | A note about your Chenyin account access"
  },
  lessonScheduled: {
    subject: "晨音：课程时间已安排 | Your lesson is scheduled",
    preview: "请查看课程日期、教师与教室 | Review your lesson time, teacher, and room"
  },
  lessonBalance: {
    subject: "晨音：课时余额提醒 | Lesson balance reminder",
    preview: "请查看您的剩余课时与下一步安排 | Review your remaining lessons and next steps"
  }
} as const;

const japaneseRecipientEmailCopy = {
  studentReceived: {
    subject: "Chenyin：ご予約を受け付けました",
    preview: "内容を確認のうえ、担当者よりご連絡いたします。"
  },
  teacherReceived: {
    subject: "Chenyin：講師応募を受け付けました",
    preview: "応募内容を確認のうえ、Chenyin チームよりご連絡いたします。"
  },
  accountApproved: {
    subject: "Chenyin：アカウントの準備が整いました",
    preview: "Chenyin 会員アカウントをご利用いただけます。"
  },
  passwordReset: {
    subject: "Chenyin：仮パスワードを再設定しました",
    preview: "新しい仮パスワードでログインしてください。"
  },
  accountDeleted: {
    subject: "Chenyin：アカウント利用に関するお知らせ",
    preview: "Chenyin 会員アカウントのログイン権限についてのお知らせです。"
  },
  lessonScheduled: {
    subject: "Chenyin：レッスン日時が決まりました",
    preview: "レッスン日時、担当講師、教室をご確認ください。"
  },
  lessonBalance: {
    subject: "Chenyin：残りレッスン数のお知らせ",
    preview: "残りレッスン数と今後のご案内をご確認ください。"
  }
} as const;

type RecipientEmailCopyKey = keyof typeof japaneseRecipientEmailCopy;

export function getRecipientEmailCopy(key: RecipientEmailCopyKey, locale: "zh" | "en" | "ja" | undefined) {
  return locale === "ja" ? japaneseRecipientEmailCopy[key] : emailCopy[key];
}
