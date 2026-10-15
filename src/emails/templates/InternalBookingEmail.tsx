import { emailCopy } from "@/emails/copy";
import { createDefinition } from "@/emails/templates/createDefinition";
import type { BookingInput } from "@/lib/validators";

export function buildInternalBookingEmail(input: BookingInput, siteUrl: string) {
  return createDefinition(emailCopy.internalBooking, {
    eyebrowZh: "\u6668\u97f3\u5185\u90e8\u4e1a\u52a1\u901a\u77e5", eyebrowEn: "Chenyin internal notice",
    titleZh: "\u65b0\u7684\u9884\u7ea6\u8bb0\u5f55", titleEn: "New booking received",
    introZh: "\u4e00\u6761\u65b0\u7684\u8bfe\u7a0b\u9884\u7ea6\u7b49\u5f85\u5ba1\u6838\u3002", introEn: "A new lesson booking is ready for review.",
    details: [
      { labelZh: "\u59d3\u540d", labelEn: "Name", value: input.name },
      { labelZh: "\u5e74\u9f84", labelEn: "Age", value: String(input.age) },
      { labelZh: "\u7535\u8bdd", labelEn: "Phone", value: input.phone },
      { labelZh: "\u5fae\u4fe1", labelEn: "WeChat", value: input.wechat },
      { labelZh: "\u5b66\u4e60\u76ee\u6807", labelEn: "Learning goal", value: input.goal },
      { labelZh: "\u53ef\u4e0a\u8bfe\u65f6\u95f4", labelEn: "Preferred times", value: input.preferredTimes.join(" / ") }
    ],
    action: { href: `${siteUrl}/zh/admin`, zh: "\u8fdb\u5165\u7ba1\u7406\u540e\u53f0", en: "Open admin" },
    status: { labelZh: "\u5904\u7406\u72b6\u6001", labelEn: "Status", valueZh: "\u7b49\u5f85\u5ba1\u6838", valueEn: "Pending review" }
  });
}
