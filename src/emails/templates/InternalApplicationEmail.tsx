import { emailCopy } from "@/emails/copy";
import { formatCampus, formatPreferredDates } from "@/emails/format";
import { createDefinition } from "@/emails/templates/createDefinition";
import type { ApplicationSubmissionInput } from "@/lib/application-schemas";

export function buildInternalApplicationEmail(input: ApplicationSubmissionInput, siteUrl: string) {
  const isStudent = input.role === "STUDENT";
  const details = isStudent ? [
    { labelZh: "\u59d3\u540d", labelEn: "Name", value: input.name },
    { labelZh: "\u5e74\u9f84", labelEn: "Age", value: String(input.age) },
    { labelZh: "\u76d1\u62a4\u4eba", labelEn: "Guardian", value: input.guardianName?.trim() || "未填写" },
    { labelZh: "\u7535\u8bdd", labelEn: "Phone", value: input.phone },
    { labelZh: "\u5fae\u4fe1", labelEn: "WeChat", value: input.wechat.trim() || "未填写" },
    { labelZh: "\u90ae\u7bb1", labelEn: "Email", value: input.email || "未填写" },
    { labelZh: "\u6821\u533a", labelEn: "Campus", value: formatCampus(input.campusId) },
    { labelZh: "\u5b66\u4e60\u9636\u6bb5", labelEn: "Learning stage", value: input.learningStage },
    { labelZh: "\u9884\u7ea6\u65f6\u95f4", labelEn: "Preferred dates", value: formatPreferredDates(input.preferredDates) },
    { labelZh: "\u5b66\u4e60\u76ee\u6807", labelEn: "Learning goal", value: input.goal }
  ] : [
    { labelZh: "\u59d3\u540d", labelEn: "Name", value: input.name },
    { labelZh: "\u7535\u8bdd", labelEn: "Phone", value: input.phone },
    { labelZh: "\u5fae\u4fe1", labelEn: "WeChat", value: input.wechat.trim() || "未填写" },
    { labelZh: "\u90ae\u7bb1", labelEn: "Email", value: input.email },
    { labelZh: "\u57ce\u5e02", labelEn: "City", value: input.city },
    { labelZh: "\u6559\u5b66\u5e74\u9650", labelEn: "Teaching years", value: String(input.teachingYears) },
    { labelZh: "\u8054\u7cfb\u65f6\u95f4", labelEn: "Preferred contact", value: input.preferredContact },
    { labelZh: "\u6559\u80b2\u80cc\u666f", labelEn: "Education", value: input.education },
    { labelZh: "\u64c5\u957f\u65b9\u5411", labelEn: "Specialties", value: input.specialties },
    { labelZh: "\u6559\u5b66\u7406\u5ff5", labelEn: "Teaching philosophy", value: input.philosophy }
  ];
  const meta = isStudent ? emailCopy.internalStudent : emailCopy.internalTeacher;

  return createDefinition(meta, {
    eyebrowZh: "\u6668\u97f3\u5185\u90e8\u4e1a\u52a1\u901a\u77e5", eyebrowEn: "Chenyin internal notice",
    titleZh: isStudent ? "\u65b0\u7684\u5b66\u5458\u9884\u7ea6" : "\u65b0\u7684\u6559\u5e08\u7533\u8bf7", titleEn: isStudent ? "New student booking" : "New teacher application",
    introZh: "\u4ee5\u4e0b\u4fe1\u606f\u7b49\u5f85\u7ba1\u7406\u56e2\u961f\u5ba1\u6838\u3002", introEn: "The following submission is ready for administrative review.",
    details,
    action: { href: `${siteUrl}/zh/admin`, zh: "\u8fdb\u5165\u7ba1\u7406\u540e\u53f0", en: "Open admin" },
    status: { labelZh: "\u5904\u7406\u72b6\u6001", labelEn: "Status", valueZh: "\u7b49\u5f85\u5ba1\u6838", valueEn: "Pending review" }
  });
}
