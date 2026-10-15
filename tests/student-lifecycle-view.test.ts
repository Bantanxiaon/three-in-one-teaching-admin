import { describe, expect, it } from "vitest";
import {
  formatLocalDateInputValue,
  formatLifecycleDateTime,
  getLifecycleActorLabel,
  getLifecycleReasonLabel,
  lifecycleReasonLabels
} from "@/lib/student-lifecycle-view";

describe("student lifecycle timeline presentation", () => {
  it("localizes structured transfer reasons", () => {
    expect(lifecycleReasonLabels.ADDRESS_CHANGED).toEqual({ zh: "地址变更", en: "Address changed" });
    expect(getLifecycleReasonLabel("SCHEDULE_CHANGED", "zh")).toBe("时间安排变更");
    expect(getLifecycleReasonLabel("SCHEDULE_CHANGED", "en")).toBe("Schedule changed");
    expect(getLifecycleReasonLabel("FUTURE_REASON", "zh")).toBe("其他调整");
    expect(getLifecycleReasonLabel("FUTURE_REASON", "en")).toBe("Other adjustment");
    expect(getLifecycleReasonLabel("FUTURE_REASON", "ja")).toBe("その他の調整");
    expect(getLifecycleReasonLabel(null, "zh")).toBeNull();
  });

  it("renders the actor name with a localized system fallback", () => {
    expect(getLifecycleActorLabel("Admin Chen", "en")).toBe("Admin Chen");
    expect(getLifecycleActorLabel(null, "en")).toBe("System");
    expect(getLifecycleActorLabel(null, "zh")).toBe("系统");
    expect(getLifecycleActorLabel("?", "zh", "ADMIN")).toBe("管理员");
    expect(getLifecycleActorLabel(null, "en", "SUPER_ADMIN")).toBe("Admin");
    expect(getLifecycleActorLabel("Teacher Li", "zh", "TEACHER")).toBe("Teacher Li");
    expect(getLifecycleActorLabel("?", "zh", "TEACHER")).toBe("教师");
  });

  it("formats both the localized date and time", () => {
    const value = "2026-07-11T08:45:00.000Z";

    expect(formatLifecycleDateTime(value, "en")).toBe(new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value)));
    expect(formatLifecycleDateTime(value, "zh")).toBe(new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value)));
  });

  it("formats a date-input maximum from the local calendar day instead of UTC", () => {
    const beforeShanghaiEightAm = new Date("2026-07-11T16:30:00.000Z");

    expect(formatLocalDateInputValue(beforeShanghaiEightAm, "Asia/Shanghai")).toBe("2026-07-12");
    expect(formatLocalDateInputValue(beforeShanghaiEightAm, "UTC")).toBe("2026-07-11");
  });
});
