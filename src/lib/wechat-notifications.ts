import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptWechatRecipient } from "@/lib/wechat-recipient-crypto";
import { wechatTemplateDefaults, type WechatTemplateDefault } from "@/lib/wechat-template-config";

export type WechatNotificationOutcome =
  | { status: "delivered"; providerMessageId?: string }
  | { status: "skipped"; reason: "not_configured" | "no_recipient" | "not_subscribed" };

export type WechatNotificationRecipient = {
  id: string;
  approvedUserId: string | null;
  grantOwner: "application" | "account";
  wechatRecipientCiphertext: string | null;
  wechatSubscriptionTemplateIds: string[];
};

export type WechatNotificationStore = {
  findByApplicationId(applicationId: string): Promise<WechatNotificationRecipient | null>;
  findByApprovedUserId(approvedUserId: string): Promise<WechatNotificationRecipient | null>;
  consumeGrant(recipientId: string, templateId: string, grantOwner: WechatNotificationRecipient["grantOwner"]): Promise<unknown>;
};

type WechatNotificationOptions = {
  fetcher?: typeof fetch;
  store?: WechatNotificationStore;
};

type Locale = "zh" | "en" | "ja";
type EventDefinition = {
  templateEnv: string;
  fieldsEnv: string;
  requiredFields: readonly string[];
  defaults: WechatTemplateDefault;
};

type EventConfiguration = {
  appId: string;
  appSecret: string;
  encryptionKey: string;
  templateId: string;
  fields: Record<string, string>;
};

const keywordPattern = /^(thing|character_string|date|time|name|phrase|number)\d+$/;
const recipientSelect = {
  id: true,
  approvedUserId: true,
  wechatRecipientCiphertext: true,
  wechatSubscriptionTemplateIds: true
} as const;

const defaultStore: WechatNotificationStore = {
  async findByApplicationId(applicationId) {
    const record = await prisma.accountApplication.findUnique({ where: { id: applicationId }, select: recipientSelect });
    return record ? { ...record, grantOwner: "application" as const } : null;
  },
  async findByApprovedUserId(approvedUserId) {
    const binding = await prisma.wechatNotificationBinding.findUnique({ where: { userId: approvedUserId } });
    if (binding) {
      return {
        id: binding.userId,
        approvedUserId: binding.userId,
        grantOwner: "account" as const,
        wechatRecipientCiphertext: binding.recipientCiphertext,
        wechatSubscriptionTemplateIds: binding.subscriptionTemplateIds
      };
    }
    const application = await prisma.accountApplication.findUnique({ where: { approvedUserId }, select: recipientSelect });
    return application ? { ...application, grantOwner: "application" as const } : null;
  },
  consumeGrant: (recipientId, templateId, grantOwner) => grantOwner === "account"
    ? prisma.$executeRaw(Prisma.sql`
        UPDATE "WechatNotificationBinding"
        SET "subscriptionTemplateIds" = array_remove("subscriptionTemplateIds", ${templateId}),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${recipientId}
          AND ${templateId} = ANY("subscriptionTemplateIds")
      `)
    : prisma.$executeRaw(Prisma.sql`
        UPDATE "Booking"
        SET "wechatSubscriptionTemplateIds" = array_remove("wechatSubscriptionTemplateIds", ${templateId}),
            "wechatSubscriptionUpdatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${recipientId}
          AND ${templateId} = ANY("wechatSubscriptionTemplateIds")
      `)
};

const bookingDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_BOOKING_RECEIVED",
  fieldsEnv: "WECHAT_TEMPLATE_BOOKING_RECEIVED_FIELDS",
  requiredFields: ["reference", "name", "status"],
  defaults: wechatTemplateDefaults.bookingReceived
};

const accountDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_ACCOUNT_READY",
  fieldsEnv: "WECHAT_TEMPLATE_ACCOUNT_READY_FIELDS",
  requiredFields: ["accountRef", "name", "status", "notice"],
  defaults: wechatTemplateDefaults.account
};

const lessonDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_LESSON_SCHEDULED",
  fieldsEnv: "WECHAT_TEMPLATE_LESSON_SCHEDULED_FIELDS",
  requiredFields: ["studentNumber", "studentName", "teacherName", "lessonTime", "remainingLessons"],
  defaults: wechatTemplateDefaults.lesson
};

const passwordResetDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_PASSWORD_RESET",
  fieldsEnv: "WECHAT_TEMPLATE_PASSWORD_RESET_FIELDS",
  requiredFields: ["accountRef", "name", "status", "notice"],
  defaults: wechatTemplateDefaults.account
};

const accountStatusDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_ACCOUNT_STATUS",
  fieldsEnv: "WECHAT_TEMPLATE_ACCOUNT_STATUS_FIELDS",
  requiredFields: ["accountRef", "name", "status", "notice"],
  defaults: wechatTemplateDefaults.account
};

const lessonBalanceDefinition: EventDefinition = {
  templateEnv: "WECHAT_TEMPLATE_LESSON_BALANCE",
  fieldsEnv: "WECHAT_TEMPLATE_LESSON_BALANCE_FIELDS",
  requiredFields: ["studentNumber", "studentName", "teacherName", "lessonTime", "remainingLessons"],
  defaults: wechatTemplateDefaults.lesson
};

const tokenSuccessSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive()
});

const sendResponseSchema = z.object({
  errcode: z.number().int(),
  errmsg: z.string().optional(),
  msgid: z.union([z.string(), z.number()]).optional()
});

type AccessTokenEntry = { value: string; usableUntil: number };

const accessTokenCache = new Map<string, AccessTokenEntry>();
const accessTokenRequests = new Map<string, Promise<AccessTokenEntry>>();

export class WechatNotificationError extends Error {
  constructor() {
    super("WeChat notification failed.");
    this.name = "WechatNotificationError";
  }
}

export function resetWechatAccessTokenCache() {
  accessTokenCache.clear();
  accessTokenRequests.clear();
}

function validEncryptionKey(value: string) {
  try {
    const key = Buffer.from(value, "base64");
    return key.length === 32 && key.toString("base64") === value;
  } catch {
    return false;
  }
}

function readConfiguration(definition: EventDefinition): EventConfiguration | undefined {
  const appId = process.env.WECHAT_MINI_APP_ID?.trim();
  const appSecret = process.env.WECHAT_MINI_APP_SECRET?.trim();
  const encryptionKey = process.env.WECHAT_NOTIFICATION_ENCRYPTION_KEY?.trim();
  const templateId = process.env[definition.templateEnv]?.trim() || definition.defaults.templateId;
  const rawFields = process.env[definition.fieldsEnv] || JSON.stringify(definition.defaults.fields);
  if (!appId || !appSecret || !encryptionKey || !validEncryptionKey(encryptionKey) || !templateId || !rawFields) {
    return undefined;
  }

  try {
    const parsed = z.record(z.string(), z.string()).parse(JSON.parse(rawFields));
    const keys = Object.keys(parsed);
    if (keys.length !== definition.requiredFields.length) return undefined;
    if (!definition.requiredFields.every((key) => keys.includes(key))) return undefined;
    if (!Object.values(parsed).every((keyword) => keywordPattern.test(keyword))) return undefined;
    if (new Set(Object.values(parsed)).size !== keys.length) return undefined;
    return { appId, appSecret, encryptionKey, templateId, fields: parsed };
  } catch {
    return undefined;
  }
}

function valueLimit(keyword: string) {
  if (keyword.startsWith("name")) return 10;
  if (keyword.startsWith("phrase")) return 5;
  if (keyword.startsWith("thing")) return 20;
  return 32;
}

function providerData(fields: Record<string, string>, values: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).map(([semanticKey, keyword]) => [
    keyword,
    { value: Array.from(values[semanticKey] ?? "").slice(0, valueLimit(keyword)).join("") }
  ]));
}

async function parseJson(response: Response) {
  if (!response.ok) throw new WechatNotificationError();
  try {
    return await response.json();
  } catch {
    throw new WechatNotificationError();
  }
}

async function getAccessToken(configuration: EventConfiguration, fetcher: typeof fetch) {
  const identity = createHash("sha256")
    .update(configuration.appId)
    .update("\0")
    .update(configuration.appSecret)
    .digest("hex");
  const now = Date.now();
  const cached = accessTokenCache.get(identity);
  if (cached && cached.usableUntil > now) return cached.value;

  const existingRequest = accessTokenRequests.get(identity);
  if (existingRequest) return (await existingRequest).value;

  const request = (async () => {
    const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
    url.searchParams.set("grant_type", "client_credential");
    url.searchParams.set("appid", configuration.appId);
    url.searchParams.set("secret", configuration.appSecret);
    const payload = await parseJson(await fetcher(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    }));
    const parsed = tokenSuccessSchema.safeParse(payload);
    if (!parsed.success) throw new WechatNotificationError();
    const entry = {
      value: parsed.data.access_token,
      usableUntil: now + Math.max(0, parsed.data.expires_in * 1_000 - 60_000)
    };
    accessTokenCache.set(identity, entry);
    return entry;
  })();
  accessTokenRequests.set(identity, request);
  try {
    return (await request).value;
  } finally {
    if (accessTokenRequests.get(identity) === request) accessTokenRequests.delete(identity);
  }
}

async function deliver(input: {
  configuration: EventConfiguration;
  record: WechatNotificationRecipient;
  values: Record<string, string>;
  fetcher: typeof fetch;
  store: WechatNotificationStore;
}): Promise<WechatNotificationOutcome> {
  try {
    const decrypted = decryptWechatRecipient(
      input.record.wechatRecipientCiphertext!,
      input.configuration.encryptionKey
    );
    if (decrypted.status !== "decrypted") throw new WechatNotificationError();
    const accessToken = await getAccessToken(input.configuration, input.fetcher);
    const url = new URL("https://api.weixin.qq.com/cgi-bin/message/subscribe/send");
    url.searchParams.set("access_token", accessToken);
    const payload = await parseJson(await input.fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: decrypted.openId,
        template_id: input.configuration.templateId,
        data: providerData(input.configuration.fields, input.values)
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    }));
    const parsed = sendResponseSchema.safeParse(payload);
    if (!parsed.success) throw new WechatNotificationError();
    if (parsed.data.errcode === 43101) {
      await cleanupGrant(input.store, input.record, input.configuration.templateId);
      return { status: "skipped", reason: "not_subscribed" };
    }
    if (parsed.data.errcode !== 0) throw new WechatNotificationError();

    const providerMessageId = parsed.data.msgid === undefined ? undefined : String(parsed.data.msgid);
    await cleanupGrant(input.store, input.record, input.configuration.templateId);
    return providerMessageId === undefined
      ? { status: "delivered" }
      : { status: "delivered", providerMessageId };
  } catch (error) {
    if (error instanceof WechatNotificationError) throw error;
    throw new WechatNotificationError();
  }
}

async function cleanupGrant(store: WechatNotificationStore, recipient: WechatNotificationRecipient, templateId: string) {
  try {
    await store.consumeGrant(recipient.id, templateId, recipient.grantOwner);
  } catch {
    console.error("WeChat notification grant cleanup failed");
    try {
      await store.consumeGrant(recipient.id, templateId, recipient.grantOwner);
    } catch {
      // A later provider 43101 response can reconcile a still-stale local grant.
    }
  }
}

async function sendEvent(input: {
  definition: EventDefinition;
  findRecipient(store: WechatNotificationStore): Promise<WechatNotificationRecipient | null>;
  approvedUserId?: string;
  values: Record<string, string>;
}, options: WechatNotificationOptions = {}): Promise<WechatNotificationOutcome> {
  const configuration = readConfiguration(input.definition);
  if (!configuration) return { status: "skipped", reason: "not_configured" };
  const store = options.store ?? defaultStore;
  const record = await input.findRecipient(store);
  if (!record?.wechatRecipientCiphertext) return { status: "skipped", reason: "no_recipient" };
  if (input.approvedUserId && record.approvedUserId !== input.approvedUserId) {
    return { status: "skipped", reason: "no_recipient" };
  }
  if (!record.wechatSubscriptionTemplateIds.includes(configuration.templateId)) {
    return { status: "skipped", reason: "not_subscribed" };
  }
  return deliver({
    configuration,
    record,
    values: input.values,
    fetcher: options.fetcher ?? fetch,
    store
  });
}

function localized(locale: Locale | undefined, values: { zh: string; en: string; ja: string }) {
  if (locale === "en") return values.en;
  if (locale === "ja") return values.ja;
  return values.zh;
}

function shanghaiLessonTime(startsAt: Date, endsAt: Date) {
  const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const start = parts(startsAt);
  const end = parts(endsAt);
  return `${start.year}-${start.month}-${start.day} ${start.hour}:${start.minute}-${end.hour}:${end.minute}`;
}

function shanghaiDateTime(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function sendBookingReceivedWechat(input: {
  applicationId: string;
  reference: string;
  name: string;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: bookingDefinition,
    findRecipient: (store) => store.findByApplicationId(input.applicationId),
    values: {
      reference: input.reference,
      name: input.name,
      status: input.locale === "en" ? "Booking received" : "预约已收到"
    }
  }, options);
}

export function sendAccountReadyWechat(input: {
  approvedUserId: string;
  studentNumber: string;
  name: string;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: accountDefinition,
    findRecipient: (store) => store.findByApprovedUserId(input.approvedUserId),
    approvedUserId: input.approvedUserId,
    values: {
      accountRef: input.studentNumber,
      name: input.name,
      status: "账号已创建",
      notice: localized(input.locale, {
        zh: "账号信息已发送至注册邮箱",
        en: "Account details sent by email",
        ja: "登録メールへ送信しました"
      })
    }
  }, options);
}

export function sendLessonScheduledWechat(input: {
  approvedUserId: string;
  studentNumber: string;
  studentName: string;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  remainingLessons: number;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: lessonDefinition,
    findRecipient: (store) => store.findByApprovedUserId(input.approvedUserId),
    approvedUserId: input.approvedUserId,
    values: {
      studentNumber: input.studentNumber,
      studentName: input.studentName,
      teacherName: input.teacherName,
      lessonTime: shanghaiLessonTime(input.startsAt, input.endsAt),
      remainingLessons: String(Math.max(0, Math.trunc(input.remainingLessons)))
    }
  }, options);
}

export function sendPasswordResetWechat(input: {
  approvedUserId: string;
  accountRef?: string;
  name: string;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: passwordResetDefinition,
    findRecipient: (store) => store.findByApprovedUserId(input.approvedUserId),
    approvedUserId: input.approvedUserId,
    values: {
      accountRef: input.accountRef?.trim() || "ACCOUNT",
      name: input.name,
      status: "密码已重置",
      notice: localized(input.locale, { zh: "请查看注册邮箱", en: "Check your registered email", ja: "登録メールをご確認ください" })
    }
  }, options);
}

export function sendAccountStatusWechat(input: {
  approvedUserId: string;
  accountRef?: string;
  name: string;
  reason: string;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: accountStatusDefinition,
    findRecipient: (store) => store.findByApprovedUserId(input.approvedUserId),
    approvedUserId: input.approvedUserId,
    values: {
      accountRef: input.accountRef?.trim() || "ACCOUNT",
      name: input.name,
      status: "账号已更新",
      notice: input.reason
    }
  }, options);
}

export function sendAccountStatusWechatToRecipient(input: {
  approvedUserId: string;
  recipient: WechatNotificationRecipient;
  accountRef?: string;
  name: string;
  reason: string;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: accountStatusDefinition,
    findRecipient: async () => input.recipient,
    approvedUserId: input.approvedUserId,
    values: {
      accountRef: input.accountRef?.trim() || "ACCOUNT",
      name: input.name,
      status: "账号已更新",
      notice: input.reason
    }
  }, options);
}

export function sendLessonBalanceWechat(input: {
  approvedUserId: string;
  studentNumber: string;
  studentName: string;
  teacherName: string;
  remainingLessons: number;
  nextLessonAt?: Date;
  locale?: Locale;
}, options: WechatNotificationOptions = {}) {
  return sendEvent({
    definition: lessonBalanceDefinition,
    findRecipient: (store) => store.findByApprovedUserId(input.approvedUserId),
    approvedUserId: input.approvedUserId,
    values: {
      studentNumber: input.studentNumber,
      studentName: input.studentName,
      teacherName: input.teacherName,
      lessonTime: shanghaiDateTime(input.nextLessonAt ?? new Date()),
      remainingLessons: String(Math.max(0, Math.trunc(input.remainingLessons)))
    }
  }, options);
}
