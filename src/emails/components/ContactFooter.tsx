import { Hr, Section, Text } from "react-email";
import { colors, fontSans } from "@/emails/styles";
import type { EmailLocale } from "@/emails/types";

const footerCopy = "\u8ba9\u6bcf\u4e00\u6b21\u89e6\u952e\u90fd\u62e5\u6709\u7075\u9b42 \u00b7 Where every touch finds its voice";
const contactCopy = "\u5fae\u4fe1 WeChat\uff1aexample-studio \u00b7 \u7535\u8bdd Phone\uff1a10000000000";
const emailCopy = "\u90ae\u7bb1 Email\uff1asupport@example.com";

export function ContactFooter({ locale }: { locale?: EmailLocale }) {
  const isJapanese = locale === "ja";
  return <Section style={{ marginTop: "44px", textAlign: "center" }}>
    <Hr style={{ margin: "0 0 20px", borderColor: colors.softLine }} />
    <Text style={{ margin: 0, color: colors.muted, fontFamily: fontSans, fontSize: "10px", lineHeight: "18px" }}>{isJapanese ? "すべての一音に、心を。" : footerCopy}<br />{isJapanese ? "WeChat：example-studio ・ 電話：10000000000" : contactCopy}<br />{isJapanese ? "メール：support@example.com" : emailCopy}<br />{isJapanese ? "© 2026 Chenyin Piano Art Center. 無断転載を禁じます。" : "\u00a9 2026 Chenyin Piano Art Center. All rights reserved."}</Text>
  </Section>;
}
