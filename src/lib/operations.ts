export type ScheduleRange = {
  startsAt: Date;
  endsAt: Date;
};

export function calculatePackageTotal(unitPriceCents: number, lessonCount: number) {
  if (
    !Number.isInteger(unitPriceCents) ||
    unitPriceCents < 0 ||
    !Number.isInteger(lessonCount) ||
    lessonCount < 1
  ) {
    throw new Error("Invalid package values");
  }

  return unitPriceCents * lessonCount;
}

export function calculatePackageHours(lessonCount: number, lessonDurationMinutes: number) {
  if (
    !Number.isInteger(lessonCount) ||
    lessonCount < 1 ||
    !Number.isInteger(lessonDurationMinutes) ||
    lessonDurationMinutes < 1 ||
    lessonDurationMinutes > 180
  ) {
    throw new Error("Invalid package duration");
  }

  return lessonCount * lessonDurationMinutes / 60;
}

export function addMonthsClamped(date: Date, months: number) {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("Invalid validity period");
  }

  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const finalDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, finalDay));
  return result;
}

export function hasScheduleConflict(ranges: ScheduleRange[], startsAt: Date, endsAt: Date) {
  return ranges.some((range) => range.startsAt < endsAt && range.endsAt > startsAt);
}

export function nextLessonBalance(balance: { consumed: number; remaining: number }) {
  if (!Number.isInteger(balance.consumed) || !Number.isInteger(balance.remaining)) {
    throw new Error("Invalid lesson balance");
  }
  if (balance.remaining < 1) {
    throw new Error("No remaining lessons");
  }

  return {
    consumed: balance.consumed + 1,
    remaining: balance.remaining - 1
  };
}
