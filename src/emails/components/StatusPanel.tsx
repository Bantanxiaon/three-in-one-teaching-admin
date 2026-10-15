import { Section, Text } from "react-email";
import { colors, fontSans } from "@/emails/styles";
import type { EmailLocale } from "@/emails/types";

export function StatusPanel(props: { locale?: EmailLocale; labelZh: string; labelEn: string; labelJa?: string; valueZh: string; valueEn: string; valueJa?: string }) {
  return <Section style={{ marginTop: "26px", backgroundColor: "#F6F6F6", padding: "16px 18px", textAlign: "center" }}>
    <Text style={{ margin: 0, color: colors.ink, fontFamily: fontSans, fontSize: "11px", fontWeight: 600, lineHeight: "18px" }}>{props.locale === "ja" ? props.labelJa : <>{props.labelZh}{" \u00b7 "}{props.labelEn}</>}</Text>
    <Text style={{ margin: "5px 0 0", color: colors.muted, fontFamily: fontSans, fontSize: "11px", lineHeight: "18px" }}>{props.locale === "ja" ? props.valueJa : <>{props.valueZh}<br />{props.valueEn}</>}</Text>
  </Section>;
}
