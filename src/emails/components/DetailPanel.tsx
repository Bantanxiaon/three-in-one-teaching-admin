import { Column, Row, Section, Text } from "react-email";
import type { DetailItem, EmailLocale } from "@/emails/types";
import { colors, fontSans } from "@/emails/styles";

export function DetailPanel({ items, locale }: { items: DetailItem[]; locale?: EmailLocale }) {
  return <Section style={{ margin: "34px 0 26px", border: `1px solid ${colors.line}`, padding: "22px 24px" }}>
    {Array.from({ length: Math.ceil(items.length / 2) }, (_, rowIndex) => {
      const rowItems = items.slice(rowIndex * 2, rowIndex * 2 + 2);
      return <Row key={rowIndex} style={{ width: "100%" }}>{rowItems.map((item) => <Column key={`${item.labelEn}:${item.value}`} className="cy-detail-column" style={{ width: "50%", padding: "0 12px 18px 0", verticalAlign: "top" }}>
        <Text style={{ margin: "0 0 7px", color: colors.muted, fontFamily: fontSans, fontSize: "9px", lineHeight: "14px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{locale === "ja" ? item.labelJa : <>{item.labelZh}{" \u00b7 "}{item.labelEn}</>}</Text>
        <Text style={{ margin: 0, color: colors.ink, fontFamily: fontSans, fontSize: item.emphasize ? "21px" : "13px", fontWeight: item.emphasize ? 600 : 500, lineHeight: item.emphasize ? "29px" : "21px", letterSpacing: item.emphasize ? "0.14em" : 0, wordBreak: "break-word" }}>{item.value}</Text>
      </Column>)}</Row>;
    })}
  </Section>;
}
