import { EventEmail } from "@/emails/components/EventEmail";
import type { EventEmailProps } from "@/emails/components/EventEmail";
import type { EmailDefinition } from "@/emails/types";
import { createElement } from "react";

export function createDefinition(meta: { subject: string; preview: string }, props: Omit<EventEmailProps, "preview">): EmailDefinition {
  return { ...meta, element: createElement(EventEmail, { preview: meta.preview, ...props }) };
}
