import nodemailer from "nodemailer";
import {
  fillIntakeMessage,
  INTAKE_TEMPLATES,
  intakeVarsForLead,
  type IntakeTemplateId,
} from "./intakeTemplates.ts";
import type { LeadPublic } from "./types.ts";

export type EmailStatus = "sent" | "failed" | "skipped";

export type EmailResult = {
  status: EmailStatus;
  detail: string;
};

export type SalesMailbox = {
  userId: string;
  from: string;
  appPassword: string | undefined;
  phone: string;
  displayName: string;
};

export type SendMailFn = (opts: {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  authUser: string;
  authPass: string;
}) => Promise<void>;

function cleanSecret(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, "").trim();
  return trimmed || undefined;
}

export function mailboxForUser(user: { id: string; displayName: string }): SalesMailbox | null {
  if (user.id === "user_jared") {
    return {
      userId: user.id,
      from: process.env.GMAIL_JARED_USER?.trim() || "jared@apexdraftingservices.com",
      appPassword: cleanSecret(process.env.GMAIL_JARED_APP_PASSWORD),
      phone: process.env.SALES_PHONE_JARED ?? "435-990-3556",
      displayName: user.displayName,
    };
  }
  if (user.id === "user_reuben") {
    return {
      userId: user.id,
      from: process.env.GMAIL_REUBEN_USER?.trim() || "reuben@apexdraftingservices.com",
      appPassword: cleanSecret(process.env.GMAIL_REUBEN_APP_PASSWORD),
      phone: process.env.SALES_PHONE_REUBEN ?? "213-414-7319",
      displayName: user.displayName,
    };
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function intakeEmailHtml(text: string): string {
  return `<pre style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;white-space:pre-wrap;color:#1B242C">${escapeHtml(text)}</pre>`;
}

export async function defaultSendMail(opts: Parameters<SendMailFn>[0]): Promise<void> {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: opts.authUser, pass: opts.authPass },
  });
  try {
    await transport.sendMail({
      from: `"${opts.fromName}" <${opts.from}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } finally {
    transport.close();
  }
}

export async function sendIntakeEmail(opts: {
  lead: LeadPublic;
  user: { id: string; displayName: string };
  templateId: IntakeTemplateId;
  send?: SendMailFn;
}): Promise<EmailResult> {
  const template = INTAKE_TEMPLATES[opts.templateId];
  const to = opts.lead.email?.trim() || "";
  if (!to) {
    return { status: "skipped", detail: "Lead has no customer email" };
  }

  const mailbox = mailboxForUser(opts.user);
  if (!mailbox) {
    return { status: "skipped", detail: `No Gmail mailbox mapped for ${opts.user.id}` };
  }

  if (!mailbox.appPassword) {
    const envName = opts.user.id === "user_reuben" ? "GMAIL_REUBEN_APP_PASSWORD" : "GMAIL_JARED_APP_PASSWORD";
    return {
      status: "skipped",
      detail: `Gmail app password is not configured (${envName}); intake email not sent`,
    };
  }

  const filled = fillIntakeMessage(template, intakeVarsForLead(opts.lead, mailbox));
  try {
    const send = opts.send ?? defaultSendMail;
    await send({
      from: mailbox.from,
      fromName: `${mailbox.displayName} — Apex Drafting`,
      to,
      subject: filled.subject,
      text: filled.body,
      html: intakeEmailHtml(filled.body),
      authUser: mailbox.from,
      authPass: mailbox.appPassword,
    });
    return { status: "sent", detail: `Sent ${template.label} intake email to ${to} from ${mailbox.from}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", detail: `Failed to send ${template.label} intake email to ${to}: ${message}` };
  }
}
