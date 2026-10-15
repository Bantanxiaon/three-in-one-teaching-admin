import type { ReactElement } from "react";

export type EmailLocale = "zh" | "en" | "ja";

export type EmailDefinition = {
  subject: string;
  preview: string;
  element: ReactElement;
};

export type RenderedEmail = {
  subject: string;
  preview: string;
  html: string;
  text: string;
};

export type DetailItem = {
  labelZh: string;
  labelEn: string;
  labelJa?: string;
  value: string;
  emphasize?: boolean;
};
