import { createHash } from "node:crypto";
import type { ApplicationSubmissionInput } from "@/lib/application-schemas";
import type { BookingInput } from "@/lib/validators";
import { renderEmailDefinition } from "@/emails/render";
import { buildAccountApprovedEmail } from "@/emails/templates/AccountApprovedEmail";
import { buildAccountDeletedEmail } from "@/emails/templates/AccountDeletedEmail";
import { buildApplicantConfirmationEmail } from "@/emails/templates/ApplicantConfirmationEmail";
import { buildInternalApplicationEmail } from "@/emails/templates/InternalApplicationEmail";
import { buildInternalBookingEmail } from "@/emails/templates/InternalBookingEmail";
import { buildLessonBalanceEmail } from "@/emails/templates/LessonBalanceEmail";
import { buildLessonScheduledEmail } from "@/emails/templates/LessonScheduledEmail";
import { buildPasswordResetEmail } from "@/emails/templates/PasswordResetEmail";
import type { EmailDefinition } from "@/emails/types";
import {
  recordEmailAcceptance,
  type EmailAcceptanceRecord,
  type EmailCategory
} from "@/lib/email-delivery";

export type MailResult =
  | { status: "accepted"; providerMessageId: string; trackingAvailable: boolean }
  | { status: "skipped"; reason: "not_configured" | "no_recipient" };

type MailOptions = {
  fetcher?: typeof fetch;
  recordAcceptance?: (input: EmailAcceptanceRecord) => Promise<void>;
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

function createIdempotencyKey(input: { to: string; subject: string; html: string; text: string }) {
  return createHash("sha256")
    .update(`${input.to}\n${input.subject}\n${input.html}\n${input.text}`, "utf8")
    .digest("hex");
}

async function sendResendEmail(
  input: { to?: string | null; definition: EmailDefinition; category: EmailCategory },
  options: MailOptions = {}
): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.MAIL_FROM) return { status: "skipped", reason: "not_configured" };
  if (!input.to) return { status: "skipped", reason: "no_recipient" };

  const rendered = await renderEmailDefinition(input.definition);
  const idempotencyKey = createIdempotencyKey({ to: input.to, ...rendered });
  const response = await (options.fetcher ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: input.to,
      reply_to: process.env.MAIL_REPLY_TO || undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: []
    })
  });

  if (!response.ok) {
    let providerCode = "unknown";
    try {
      const body = await response.json() as { name?: unknown };
      if (typeof body.name === "string" && body.name.length <= 80) providerCode = body.name;
    } catch {
      // Keep the delivery error useful even when the provider response is not JSON.
    }
    throw new Error(`Email notification failed (${response.status}, ${providerCode}).`);
  }

  const providerResponse = await response.json() as { id?: unknown };
  if (typeof providerResponse.id !== "string" || !providerResponse.id) {
    throw new Error("Email provider response did not include a message id.");
  }

  const acceptance = {
    providerMessageId: providerResponse.id,
    idempotencyKey,
    category: input.category,
    recipient: input.to,
    subject: rendered.subject,
    status: "ACCEPTED" as const
  };
  const recordAcceptance = options.recordAcceptance ?? (options.fetcher ? undefined : recordEmailAcceptance);
  let trackingAvailable = false;
  if (recordAcceptance) {
    try {
      await recordAcceptance(acceptance);
      trackingAvailable = true;
    } catch (error) {
      console.error("Email acceptance recording failed", error);
    }
  }
  return { status: "accepted", providerMessageId: providerResponse.id, trackingAvailable };
}

export async function sendBookingNotification(booking: BookingInput, options: MailOptions = {}) {
  return sendResendEmail({
    to: process.env.BOOKING_NOTIFY_EMAIL,
    definition: buildInternalBookingEmail(booking, siteUrl),
    category: "BOOKING_INTERNAL"
  }, options);
}

export async function sendApplicationNotification(application: ApplicationSubmissionInput, options: MailOptions = {}) {
  return sendResendEmail({
    to: process.env.BOOKING_NOTIFY_EMAIL,
    definition: buildInternalApplicationEmail(application, siteUrl),
    category: "APPLICATION_INTERNAL"
  }, options);
}

export async function sendApplicantConfirmation(application: ApplicationSubmissionInput, options: MailOptions = {}) {
  return sendResendEmail({
    to: application.email,
    definition: buildApplicantConfirmationEmail(application),
    category: "APPLICATION_CONFIRMATION"
  }, options);
}

export async function sendAccountApprovedNotification(input: {
  to?: string | null;
  name: string;
  email: string;
  studentNumber?: string;
  temporaryPassword: string;
  locale?: "zh" | "en" | "ja";
}, options: MailOptions = {}) {
  return sendResendEmail({
    to: input.to,
    definition: buildAccountApprovedEmail(input, siteUrl),
    category: "ACCOUNT_APPROVED"
  }, options);
}

export async function sendPasswordResetNotification(input: {
  to?: string | null;
  name: string;
  temporaryPassword: string;
  locale?: "zh" | "en" | "ja";
}, options: MailOptions = {}) {
  return sendResendEmail({
    to: input.to,
    definition: buildPasswordResetEmail(input, siteUrl),
    category: "PASSWORD_RESET"
  }, options);
}

export async function sendAccountDeletedNotification(input: {
  to?: string | null;
  name: string;
  reason: string;
  locale?: "zh" | "en" | "ja";
}, options: MailOptions = {}) {
  return sendResendEmail({
    to: input.to,
    definition: buildAccountDeletedEmail(input),
    category: "ACCOUNT_DELETED"
  }, options);
}

export async function sendLessonScheduledNotification(input: {
  to?: string | null;
  studentName: string;
  studentNumber: string;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  topic: string;
  classroomName?: string | null;
  locale?: "zh" | "en" | "ja";
}, options: MailOptions = {}) {
  return sendResendEmail({
    to: input.to,
    definition: buildLessonScheduledEmail(input),
    category: "LESSON_SCHEDULED"
  }, options);
}

export async function sendLessonBalanceNotification(input: {
  to?: string | null;
  studentName: string;
  studentNumber: string;
  teacherName?: string | null;
  remainingLessons: number;
  completedLessons: number;
  totalLessons: number;
  nextLessonAt?: Date | null;
  locale?: "zh" | "en" | "ja";
}, options: MailOptions = {}) {
  return sendResendEmail({
    to: input.to,
    definition: buildLessonBalanceEmail(input),
    category: "LESSON_BALANCE"
  }, options);
}
