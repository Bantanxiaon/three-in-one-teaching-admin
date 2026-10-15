import { describe, expect, it } from "vitest";
import { bookingSchema, changePasswordSchema, contactSchema, registerSchema, studentSchema } from "@/lib/validators";

const validBooking = {
  name: "Lin Yue",
  age: 12,
  phone: "10000000001",
  wechat: "chenyin_parent",
  goal: "Prepare for a conservatory pathway with stronger technique.",
  preferredTimes: ["Saturday 10:00", "Sunday 16:00"],
  locale: "en"
};

describe("booking validation", () => {
  it("accepts a complete trial lesson request", () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it("accepts a two-character learning goal and rejects one character", () => {
    expect(bookingSchema.safeParse({ ...validBooking, goal: "学琴" }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, goal: "学" }).success).toBe(false);
  });

  it("rejects missing contact details", () => {
    const result = bookingSchema.safeParse({ ...validBooking, phone: "" });

    expect(result.success).toBe(false);
  });

  it("rejects impossible student ages", () => {
    const result = bookingSchema.safeParse({ ...validBooking, age: 102 });

    expect(result.success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts a complete studio enquiry", () => {
    expect(
      contactSchema.safeParse({
        name: "Lin Tao",
        email: "lin@example.com",
        phone: "10000000001",
        message: "I would like to visit the Beijing studio next week.",
        locale: "en"
      }).success
    ).toBe(true);
  });
});

describe("registerSchema", () => {
  it("requires a name and a six-character password", () => {
    expect(registerSchema.safeParse({ name: "Li", email: "li@example.com", password: "123456" }).success).toBe(true);
    expect(registerSchema.safeParse({ email: "li@example.com", password: "short" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("allows users to set any numeric password with at least six digits", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "123456", newPassword: "234567", confirmPassword: "234567" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "123456", newPassword: "23456a", confirmPassword: "23456a" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "123456", newPassword: "23456", confirmPassword: "23456" }).success).toBe(false);
  });
});

describe("studentSchema", () => {
  it("accepts stable campus slugs used by seeded campuses", () => {
    expect(studentSchema.safeParse({ name: "Lin Yue", age: 12, phone: "10000000001", campusId: "beijing" }).success).toBe(true);
  });
});
