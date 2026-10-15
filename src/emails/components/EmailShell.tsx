import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Section } from "react-email";
import { BrandHeader } from "@/emails/components/BrandHeader";
import { ContactFooter } from "@/emails/components/ContactFooter";
import { bodyStyle, containerStyle, responsiveCss } from "@/emails/styles";
import type { EmailLocale } from "@/emails/types";

export function EmailShell({ preview, children, locale = "zh" }: { preview: string; children: ReactNode; locale?: EmailLocale }) {
  return <Html lang={locale === "ja" ? "ja" : "zh-CN"} dir="ltr">
    <Head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>{responsiveCss}</style>
    </Head>
    <Preview>{preview}</Preview>
    <Body style={bodyStyle}>
      <Container className="cy-container" style={containerStyle}>
        <Section className="cy-content" style={{ padding: "48px 54px 34px" }}>
          <BrandHeader />
          {children}
          <ContactFooter locale={locale} />
        </Section>
      </Container>
    </Body>
  </Html>;
}
