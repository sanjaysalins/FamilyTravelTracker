// Email send layer (plan Phase 4). Delivers via Resend's HTTP API (no SDK dependency — a single
// fetch), supports test-mode, and records every attempt — sent OR failed — onto the document's
// emails[] + audit. It NEVER throws: a delivery failure must never break a guest submit (PRD §11).
//
// The channel itself was proven in Phase 0.5; this is the templating + logging + safety wrapper.

import type { AuditEntry, EmailLogEntry, Registration } from './types';
import type { EmailContent, EmailType, EventInfo } from './email-templates';
import { config } from './config';

export interface SendResult {
  doc: Registration;        // a copy with the email-log + audit entry appended
  sent: boolean;            // true only on a real provider success
}

/** The template-facing slice of config.event (keeps the pure templates free of config imports). */
export function eventInfo(): EventInfo {
  const e = config.event;
  return {
    birthdayName: e.birthdayName,
    birthdayAge: e.birthdayAge,
    town: e.town,
    organiserName: e.organiserName,
    organiserWhatsapp: e.organiserWhatsapp,
  };
}

/** SMTP send via nodemailer (e.g. Gmail). Returns null on success, or a short error string. */
async function deliverSmtp(to: string, content: EmailContent): Promise<string | null> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
    await transport.sendMail({
      from: config.emailFrom,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    return null;
  } catch (err) {
    return `smtp: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Low-level send. Returns null on success, or a short error string on failure.
 *  Returns a "skipped" reason (still a failure) when not configured to actually send.
 *  SMTP (SMTP_HOST) takes priority over Resend (RESEND_API_KEY). */
async function deliver(to: string, content: EmailContent): Promise<string | null> {
  if (config.smtpHost) return deliverSmtp(to, content);
  if (!config.resendApiKey) return 'skipped: no email transport (set SMTP_HOST or RESEND_API_KEY)';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return `resend ${res.status}: ${body.slice(0, 200)}`;
    }
    return null;
  } catch (err) {
    return `network: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Send `content` of `type` for `doc`, logging the outcome onto a returned copy of the document.
 * Test-mode: if TEST_EMAIL_RECIPIENT is set, mail is redirected there (the log still records the
 * intended family address so the organiser sees who it was for). Never throws.
 */
export async function sendEmail(
  doc: Registration,
  type: EmailType,
  content: EmailContent,
  now: string,
): Promise<SendResult> {
  const intended = doc.email;
  const recipient = config.testEmailRecipient || intended;

  let error: string | null;
  try {
    error = await deliver(recipient, content);
  } catch (err) {
    // deliver() already catches, but belt-and-braces: a send must never reach the caller as a throw.
    error = `unexpected: ${err instanceof Error ? err.message : String(err)}`;
  }
  const sent = error === null;

  const emailLog: EmailLogEntry = {
    at: now,
    type,
    to_email: intended,                 // log metadata only — never the body (PRD §17)
    subject: content.subject,
    status: sent ? 'sent' : 'failed',
    error_message: error,
  };
  const audit: AuditEntry = {
    at: now,
    actor: 'system',
    action: sent ? 'email_sent' : 'email_failed',
    details: `${type}${sent ? '' : ` — ${error}`}`,
  };

  return {
    doc: { ...doc, emails: [...doc.emails, emailLog], audit: [...doc.audit, audit] },
    sent,
  };
}
