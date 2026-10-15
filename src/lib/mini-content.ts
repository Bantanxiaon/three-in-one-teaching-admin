import type { Locale } from "@/i18n/routing";
// 开源版只提供示例内容；正式站教师资料、照片与宣传内容不随代码发布。
export function getMiniContent(locale: Locale) {
  return { version: "1.0.0", locale, brand: { wordmark: "STUDIO ADMIN", chineseName: "教学管理示例", copyright: "Demo content" },
    home: {}, heroVideo: { url: "", poster: "/placeholder.svg" }, scenes: {}, stats: [],
    campuses: [], courses: [], teachers: [], successStories: [], journalPosts: [],
    contact: { wechat: "", phone: "", email: "support@example.com" } };
}
export type MiniContentPayload = ReturnType<typeof getMiniContent>;
