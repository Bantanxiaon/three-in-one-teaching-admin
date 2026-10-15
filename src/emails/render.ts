import { render, toPlainText } from "react-email";
import type { EmailDefinition, RenderedEmail } from "@/emails/types";

export async function renderEmailDefinition(definition: EmailDefinition): Promise<RenderedEmail> {
  const html = await render(definition.element, { pretty: false });
  return {
    subject: definition.subject,
    preview: definition.preview,
    html,
    text: toPlainText(html, { selectors: [{ selector: "h1", options: { uppercase: false } }] })
  };
}
