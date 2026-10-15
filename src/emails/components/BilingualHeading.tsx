import { Heading, Hr, Text } from "react-email";
import { colors, fontEditorial, fontSans } from "@/emails/styles";
import type { EmailLocale } from "@/emails/types";

export function BilingualHeading(props: { locale?: EmailLocale; eyebrowZh?: string; eyebrowEn?: string; eyebrowJa?: string; zh: string; en: string; ja?: string; introZh?: string; introEn?: string; introJa?: string }) {
  if (props.locale === "ja") {
    return <>
      {props.eyebrowJa ? <Text style={{ margin: 0, textAlign: "center", color: colors.muted, fontFamily: fontSans, fontSize: "10px", lineHeight: "16px", letterSpacing: "0.12em", textTransform: "uppercase" }}>{props.eyebrowJa}</Text> : null}
      <Heading className="cy-title" style={{ margin: "16px 0 0", textAlign: "center", color: colors.ink, fontFamily: fontEditorial, fontSize: "36px", fontWeight: 500, lineHeight: "45px" }}>{props.ja}</Heading>
      <Hr style={{ width: "42px", margin: "28px auto", borderColor: colors.ink, borderTopWidth: "1px" }} />
      {props.introJa ? <Text style={{ margin: 0, textAlign: "center", color: colors.body, fontFamily: fontEditorial, fontSize: "14px", lineHeight: "27px" }}>{props.introJa}</Text> : null}
    </>;
  }

  return <>
    {(props.eyebrowZh || props.eyebrowEn) ? <Text style={{ margin: 0, textAlign: "center", color: colors.muted, fontFamily: fontSans, fontSize: "10px", lineHeight: "16px", letterSpacing: "0.12em", textTransform: "uppercase" }}>{[props.eyebrowZh, props.eyebrowEn].filter(Boolean).join(" \u00b7 ")}</Text> : null}
    <Heading className="cy-title" style={{ margin: "16px 0 0", textAlign: "center", color: colors.ink, fontFamily: fontEditorial, fontSize: "36px", fontWeight: 500, lineHeight: "45px" }}>{props.zh}</Heading>
    <Heading className="cy-title-en" style={{ margin: "2px 0 0", textAlign: "center", color: colors.muted, fontFamily: fontEditorial, fontSize: "25px", fontWeight: 400, lineHeight: "34px" }}>{props.en}</Heading>
    <Hr style={{ width: "42px", margin: "28px auto", borderColor: colors.ink, borderTopWidth: "1px" }} />
    {props.introZh ? <Text style={{ margin: 0, textAlign: "center", color: colors.body, fontFamily: fontEditorial, fontSize: "14px", lineHeight: "27px" }}>{props.introZh}</Text> : null}
    {props.introEn ? <Text style={{ margin: "2px 0 0", textAlign: "center", color: colors.body, fontFamily: fontEditorial, fontSize: "13px", lineHeight: "24px" }}>{props.introEn}</Text> : null}
  </>;
}
