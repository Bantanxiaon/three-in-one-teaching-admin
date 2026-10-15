"use client";

import { DayPicker } from "react-day-picker";
import { enUS, ja, zhCN } from "react-day-picker/locale";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";

export function ScheduleDatePicker({
  locale, date, onDateChange, time, onTimeChange
}: {
  locale: Locale;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  time: string;
  onTimeChange: (time: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="grid gap-3 rounded-[20px] border border-white/60 bg-white/55 p-3 sm:col-span-2 xl:col-span-3">
      <p className="text-sm font-medium">{locale === "zh" ? "选择上课日期" : locale === "ja" ? "授業日を選択" : "Choose lesson date"}<span className="ml-1 text-red-600" aria-hidden="true">*</span></p>
      <DayPicker
        mode="single"
        selected={date}
        onSelect={onDateChange}
        disabled={{ before: today }}
        locale={locale === "zh" ? zhCN : locale === "ja" ? ja : enUS}
        navLayout="after"
        className="mx-auto w-full max-w-sm"
        classNames={{
          root: "rdp-root text-sm",
          month_caption: "mb-2 flex min-h-10 items-center font-semibold",
          button_previous: "h-9 w-9 rounded-full hover:bg-white/70",
          button_next: "h-9 w-9 rounded-full hover:bg-white/70",
          weekday: "h-8 text-xs font-medium text-piano/45",
          day_button: "h-9 w-9 rounded-full text-sm transition hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          selected: "rounded-full bg-piano text-white",
          disabled: "opacity-25",
          today: "font-bold text-gold"
        }}
      />
      <label className="grid gap-2 text-sm font-medium">
        <span>{locale === "zh" ? "上课时间" : locale === "ja" ? "授業時間" : "Lesson time"}<span className="ml-1 text-red-600" aria-hidden="true">*</span></span>
        <Input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} required />
      </label>
    </div>
  );
}
