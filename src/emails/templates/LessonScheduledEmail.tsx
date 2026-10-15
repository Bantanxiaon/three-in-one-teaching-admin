import { getRecipientEmailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";

export type LessonScheduledEmailInput = {
  studentName: string;
  studentNumber: string;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  topic: string;
  classroomName?: string | null;
  locale?: "zh" | "en" | "ja";
};

export function buildLessonScheduledEmail(input: LessonScheduledEmailInput) {
  const formatter = new Intl.DateTimeFormat(input.locale === "ja" ? "ja-JP" : input.locale === "en" ? "en-US" : "zh-CN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  });
  const timeRange = `${formatter.format(input.startsAt)} - ${formatter.format(input.endsAt)}`;

  return createDefinition(getRecipientEmailCopy("lessonScheduled", input.locale), {
    locale: input.locale,
    eyebrowZh: "课程安排通知",
    eyebrowEn: "Lesson schedule",
    eyebrowJa: "レッスン日程のお知らせ",
    titleZh: "课程时间已安排",
    titleEn: "Your lesson is scheduled",
    titleJa: "レッスン日時が決まりました",
    introZh: `${input.studentName}，您的课程时间已确认。请提前预留出行时间，并携带近期练习曲目或老师布置的作业内容。`,
    introEn: `${input.studentName}, your lesson time is confirmed. Please allow enough travel time and bring your recent practice material or assigned work.`,
    introJa: `${input.studentName} 様、レッスン日時が確定しました。余裕を持ってお越しいただき、最近の練習曲や宿題をご準備ください。`,
    details: [
      { labelZh: "学员编号", labelEn: "Student number", labelJa: "会員番号", value: input.studentNumber },
      { labelZh: "上课时间", labelEn: "Lesson time", labelJa: "レッスン日時", value: timeRange, emphasize: true },
      { labelZh: "授课老师", labelEn: "Teacher", labelJa: "担当講師", value: input.teacherName },
      { labelZh: "课程重点", labelEn: "Lesson focus", labelJa: "レッスン重点", value: input.topic },
      {
        labelZh: "教室",
        labelEn: "Room",
        labelJa: "教室",
        value: input.classroomName || (input.locale === "ja" ? "担当者より別途ご案内します" : "课程顾问将另行确认 / To be confirmed")
      }
    ],
    status: {
      labelZh: "需要调整时间",
      labelEn: "Need to reschedule",
      labelJa: "日程変更をご希望の場合",
      valueZh: "如需调整时间，请尽量提前联系课程顾问，方便老师与教室安排。",
      valueEn: "If you need to change the time, contact the course advisor in advance so the teacher and room can be arranged.",
      valueJa: "変更をご希望の場合は、講師と教室の調整のため、できるだけ早めに担当者へご連絡ください。"
    }
  });
}
