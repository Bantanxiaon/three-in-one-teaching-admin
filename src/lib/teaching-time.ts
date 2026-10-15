import type { Locale } from "@/i18n/routing";

export const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getShanghaiDayRange(now: Date) {
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_UTC_OFFSET_MS);
  const year = shanghaiNow.getUTCFullYear();
  const month = shanghaiNow.getUTCMonth();
  const day = shanghaiNow.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - SHANGHAI_UTC_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function getShanghaiMonthRange(now: Date) {
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_UTC_OFFSET_MS);
  const year = shanghaiNow.getUTCFullYear();
  const month = shanghaiNow.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - SHANGHAI_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - SHANGHAI_UTC_OFFSET_MS)
  };
}

export function formatTeachingDateTime(value: Date, locale: Locale) {
  return value.toLocaleString(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: SHANGHAI_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
