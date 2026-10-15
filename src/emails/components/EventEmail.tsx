import type { DetailItem, EmailLocale } from "@/emails/types";
import { EmailShell } from "@/emails/components/EmailShell";
import { BilingualHeading } from "@/emails/components/BilingualHeading";
import { DetailPanel } from "@/emails/components/DetailPanel";
import { PrimaryAction } from "@/emails/components/PrimaryAction";
import { StatusPanel } from "@/emails/components/StatusPanel";

export type EventEmailProps = {
  preview: string;
  locale?: EmailLocale;
  eyebrowZh: string;
  eyebrowEn: string;
  eyebrowJa?: string;
  titleZh: string;
  titleEn: string;
  titleJa?: string;
  introZh: string;
  introEn: string;
  introJa?: string;
  details: DetailItem[];
  action?: { href: string; zh: string; en: string; ja?: string };
  status?: { labelZh: string; labelEn: string; labelJa?: string; valueZh: string; valueEn: string; valueJa?: string };
};

export function EventEmail(props: EventEmailProps) {
  return <EmailShell preview={props.preview} locale={props.locale}>
    <BilingualHeading locale={props.locale} eyebrowZh={props.eyebrowZh} eyebrowEn={props.eyebrowEn} eyebrowJa={props.eyebrowJa} zh={props.titleZh} en={props.titleEn} ja={props.titleJa} introZh={props.introZh} introEn={props.introEn} introJa={props.introJa} />
    <DetailPanel items={props.details} locale={props.locale} />
    {props.action ? <PrimaryAction {...props.action} locale={props.locale} /> : null}
    {props.status ? <StatusPanel {...props.status} locale={props.locale} /> : null}
  </EmailShell>;
}
