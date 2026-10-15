import { Button, Section } from "react-email";
import { colors, fontSans } from "@/emails/styles";
import type { EmailLocale } from "@/emails/types";

export function PrimaryAction(props: { href: string; zh: string; en: string; ja?: string; locale?: EmailLocale }) {
  return <Section style={{ textAlign: "center" }}><Button className="cy-action" href={props.href} style={{ display: "inline-block", minHeight: "44px", boxSizing: "border-box", borderRadius: "999px", backgroundColor: colors.ink, color: colors.paper, fontFamily: fontSans, fontSize: "12px", fontWeight: 650, lineHeight: "20px", padding: "12px 24px", textDecoration: "none" }}>{props.locale === "ja" ? props.ja : <>{props.zh}{" \u00b7 "}{props.en}</>}</Button></Section>;
}
