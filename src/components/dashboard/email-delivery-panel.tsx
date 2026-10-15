import { SHANGHAI_TIME_ZONE } from "@/lib/teaching-time";
import { CheckCircle2, CircleAlert, Clock3, MailCheck } from "lucide-react";
import type { AdminEmailDelivery } from "@/components/dashboard/admin-types";
import type { Locale } from "@/i18n/routing";
import { formatEmailDeliveryStatus } from "@/lib/admin-localization";

const categoryLabels: Record<string, { zh: string; en: string; ja: string }> = {
  BOOKING_INTERNAL: { zh: "预约内部通知", en: "Booking notification", ja: "予約内部通知" },
  APPLICATION_INTERNAL: { zh: "申请内部通知", en: "Application notification", ja: "申請内部通知" },
  APPLICATION_CONFIRMATION: { zh: "申请确认", en: "Application confirmation", ja: "申請確認" },
  ACCOUNT_APPROVED: { zh: "账号创建", en: "Account ready", ja: "アカウント作成" },
  PASSWORD_RESET: { zh: "密码重置", en: "Password reset", ja: "パスワード再設定" },
  ACCOUNT_DELETED: { zh: "账号删除", en: "Account closure", ja: "アカウント削除" },
  LESSON_SCHEDULED: { zh: "排课通知", en: "Lesson scheduled", ja: "レッスン通知" }
};

function categoryLabel(value: string, locale: Locale) {
  return categoryLabels[value]?.[locale] ?? (locale === "zh" ? "未知类型" : value);
}

function statusIcon(status: string) {
  if (status === "DELIVERED") return CheckCircle2;
  if (["BOUNCED", "FAILED", "COMPLAINED", "SUPPRESSED"].includes(status)) return CircleAlert;
  if (["ACCEPTED", "SENT", "DELAYED"].includes(status)) return Clock3;
  return MailCheck;
}

export function EmailDeliveryPanel({ locale, deliveries }: { locale: Locale; deliveries: AdminEmailDelivery[] }) {
  const dateLocale = locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US";
  return (
    <div className="overflow-x-auto rounded-[22px] border border-piano/[0.06] bg-white/52">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-xs text-piano/45"><tr>
          <th className="px-4 py-3">{locale === "zh" ? "时间" : "Time"}</th>
          <th className="px-4 py-3">{locale === "zh" ? "类型" : "Type"}</th>
          <th className="px-4 py-3">{locale === "zh" ? "收件人" : "Recipient"}</th>
          <th className="px-4 py-3">{locale === "zh" ? "主题" : "Subject"}</th>
          <th className="px-4 py-3">{locale === "zh" ? "真实状态" : "Delivery status"}</th>
        </tr></thead>
        <tbody>
          {deliveries.map((delivery) => {
            const Icon = statusIcon(delivery.status);
            return <tr key={delivery.id} className="border-t border-piano/[0.05]">
              <td className="px-4 py-3 text-xs text-piano/55">{new Date(delivery.createdAt).toLocaleString(dateLocale, { timeZone: SHANGHAI_TIME_ZONE })}</td>
              <td className="px-4 py-3">{categoryLabel(delivery.category, locale)}</td>
              <td className="px-4 py-3">{delivery.recipient}</td>
              <td className="max-w-72 truncate px-4 py-3" title={delivery.subject}>{delivery.subject}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-piano/[0.06] px-2.5 py-1 text-xs"><Icon size={13} />{formatEmailDeliveryStatus(delivery.status, locale)}</span></td>
            </tr>;
          })}
          {!deliveries.length ? <tr><td colSpan={5} className="px-4 py-14 text-center text-piano/40">{locale === "zh" ? "暂无邮件投递记录" : "No email delivery records"}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
