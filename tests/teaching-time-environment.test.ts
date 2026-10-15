import { describe, expect, it } from "vitest";
import { formatTeachingDate, formatTeachingTime } from "@/lib/teaching-time";

describe("teaching display across server and browser timezones", () => {
  it.each(["UTC", "America/Los_Angeles", "Asia/Shanghai"])("keeps the same teaching day/time with host TZ=%s", (zone) => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = zone;
      const instant = new Date("2026-10-15T22:30:00.000Z");
      expect(formatTeachingDate(instant, "zh")).toBe("2026/10/16");
      expect(formatTeachingTime(instant, "zh")).toBe("06:30");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
