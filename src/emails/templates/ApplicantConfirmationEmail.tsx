import { getRecipientEmailCopy } from "@/emails/copy";
import { formatCampus, formatPreferredDates } from "@/emails/format";
import { createDefinition } from "@/emails/templates/createDefinition";
import type { ApplicationSubmissionInput } from "@/lib/application-schemas";

export function buildApplicantConfirmationEmail(input: ApplicationSubmissionInput) {
  const isStudent = input.role === "STUDENT";
  const meta = getRecipientEmailCopy(isStudent ? "studentReceived" : "teacherReceived", input.locale);
  const details = isStudent ? [
    { labelZh: "预约编号", labelEn: "Reference", labelJa: "受付番号", value: input.idempotencyKey },
    { labelZh: "校区", labelEn: "Campus", labelJa: "校舎", value: formatCampus(input.campusId, input.locale) },
    { labelZh: "学习阶段", labelEn: "Learning stage", labelJa: "学習段階", value: input.learningStage },
    { labelZh: "预约时间", labelEn: "Preferred dates", labelJa: "ご希望日時", value: formatPreferredDates(input.preferredDates, input.locale) }
  ] : [
    { labelZh: "申请编号", labelEn: "Reference", labelJa: "受付番号", value: input.idempotencyKey },
    { labelZh: "城市", labelEn: "City", labelJa: "都市", value: input.city },
    { labelZh: "教学年限", labelEn: "Teaching years", labelJa: "指導年数", value: String(input.teachingYears) },
    { labelZh: "方便联系时间", labelEn: "Preferred contact", labelJa: "連絡希望時間", value: input.preferredContact }
  ];

  return createDefinition(meta, {
    locale: input.locale,
    eyebrowZh: isStudent ? "预约确认" : "申请确认",
    eyebrowEn: isStudent ? "Booking confirmation" : "Application confirmation",
    eyebrowJa: isStudent ? "ご予約の確認" : "応募の確認",
    titleZh: isStudent ? "预约已收到" : "教师申请已收到",
    titleEn: isStudent ? "We received your booking" : "We received your application",
    titleJa: isStudent ? "ご予約を受け付けました" : "講師応募を受け付けました",
    introZh: isStudent
      ? `${input.name}，感谢您认真填写信息。课程管理顾问会结合学习阶段、时间与目标，为您确认后续体验安排。`
      : `${input.name}，感谢您提交教师申请。晨音会认真阅读您的专业经历与教学方向，并在需要时与您进一步沟通。`,
    introEn: isStudent
      ? `${input.name}, thank you for sharing your information. A course advisor will review your goals, stage, and available times before confirming the next step.`
      : `${input.name}, thank you for submitting your teacher application. The Chenyin team will review your background and teaching direction carefully.`,
    introJa: isStudent
      ? `${input.name} 様、情報をご入力いただきありがとうございます。担当者が学習段階、ご希望日時、目標を確認し、次のご案内をいたします。`
      : `${input.name} 様、講師応募をお送りいただきありがとうございます。専門経験と指導方針を確認し、必要に応じてご連絡いたします。`,
    details,
    status: {
      labelZh: "下一步",
      labelEn: "Next step",
      labelJa: "今後の流れ",
      valueZh: isStudent
        ? "课程顾问将确认学习目标与可上课时间。账号创建完成后，我们会将账号信息发送至您的注册邮箱。"
        : "晨音团队将审核专业背景，并在需要时与您联系。若进入下一步沟通，我们会通过您预留的联系方式通知。",
      valueEn: isStudent
        ? "A course advisor will confirm your goals and available times. Once your account is ready, account details will be sent to your registered email."
        : "The Chenyin team will review your background and contact you when appropriate.",
      valueJa: isStudent
        ? "担当者より、学習目標とご希望日時についてご連絡いたします。アカウント作成後、登録メールへ情報をお送りします。"
        : "Chenyin チームが内容を確認し、次のご案内が必要な場合はご登録の連絡先へお知らせします。"
    }
  });
}
