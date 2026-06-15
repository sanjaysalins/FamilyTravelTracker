// SMTP transport (e.g. Gmail) — proves deliver() routes through nodemailer when SMTP_HOST is set,
// logs a 'sent' attempt, and that a transport throw becomes a logged failure (never throws).

import { describe, expect, it, vi } from 'vitest';
import type { EmailContent } from '../src/lib/email-templates';
import type { Registration } from '../src/lib/types';

const sendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

const NOW = '2026-01-01T00:00:00.000Z';
const CONTENT: EmailContent = { subject: 'Hi', html: '<p>h</p>', text: 'h' };
const minimalDoc = () => ({ email: 'fam@example.com', emails: [], audit: [] } as unknown as Registration);

describe('sendEmail via SMTP (Gmail)', () => {
  it('sends through nodemailer when SMTP_HOST is set and logs status=sent', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_USER', 'u@gmail.com');
    vi.stubEnv('SMTP_PASS', 'app-pass');
    sendMail.mockResolvedValueOnce({ messageId: 'x', accepted: ['fam@example.com'] });

    // import AFTER stubbing env so config reads the SMTP values
    const { sendEmail } = await import('../src/lib/email');
    const { doc: out, sent } = await sendEmail(minimalDoc(), 'ack', CONTENT, NOW);

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(out.emails[0].status).toBe('sent');
    expect(out.audit[out.audit.length - 1].action).toBe('email_sent');
  });

  it('a transport throw is logged as failed, never thrown', async () => {
    const { sendEmail } = await import('../src/lib/email');
    sendMail.mockRejectedValueOnce(new Error('boom'));

    const { doc: out, sent } = await sendEmail(minimalDoc(), 'ack', CONTENT, NOW);

    expect(sent).toBe(false);
    expect(out.emails[0].status).toBe('failed');
    expect(out.emails[0].error_message).toMatch(/smtp: boom/);
  });
});
