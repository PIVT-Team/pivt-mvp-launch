/**
 * The outbound message for a requirement request, composed in one place.
 *
 * `send-requirement-request` used to do `String(body || "").replace(PLACEHOLDER,
 * link)`. If the caller sent no body — or a body the reviewer had edited the
 * placeholder out of — the counterparty received an email with no upload link,
 * which is an email that cannot be acted on. The link is the point of the
 * message; it must be present whatever the reviewer did to the text.
 */
export const LINK_PLACEHOLDER = "[SECURE UPLOAD LINK]";

export interface ComposedMessage {
  subject: string;
  body: string;
  /** True when the link had to be appended because the text did not carry it. */
  linkAppended: boolean;
}

export function composeRequirementMessage(input: {
  subject?: string | null;
  body?: string | null;
  link: string;
  requirementTitle: string;
  recipientName?: string | null;
  dealName?: string | null;
}): ComposedMessage {
  const subject = (input.subject || "").trim() || `Document request — ${input.requirementTitle}`;

  let body = (input.body || "").trim();
  if (!body) {
    const who = input.recipientName ? `Dear ${input.recipientName},` : "Hello,";
    const deal = input.dealName ? ` in connection with ${input.dealName}` : "";
    body =
      `${who}\n\n` +
      `We need the following from you${deal}: ${input.requirementTitle}.\n\n` +
      `Please upload it using this secure link:\n${LINK_PLACEHOLDER}\n\n` +
      `The link is unique to you and expires in 30 days.\n\nThank you.`;
  }

  let linkAppended = false;
  if (body.includes(LINK_PLACEHOLDER)) {
    body = body.split(LINK_PLACEHOLDER).join(input.link);
  } else if (!body.includes(input.link)) {
    body += `\n\nUpload securely here:\n${input.link}`;
    linkAppended = true;
  }

  return { subject, body, linkAppended };
}
