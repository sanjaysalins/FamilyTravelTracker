// Phase 4 — email templates (pure) + the send layer's logging/never-throw contract.

import { describe, expect, it } from 'vitest';
import {
  ackEmail, confirmationEmail, clarificationEmail, updatedEmail, esc,
  type EventInfo,
} from '../src/lib/email-templates';
import { sendEmail } from '../src/lib/email';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration } from '../src/lib/types';

const NOW = '2026-06-12T10:00:00.000Z';
const EVENT: EventInfo = {
  birthdayName: 'Sybil', birthdayAge: 60, town: 'Bidar',
  organiserName: 'Joan', organiserWhatsapp: '+919812345678',
};
const LINK = 'https://bidarplan.netlify.app/edit/BDAY-2026-0001?token=rawtok123';

// Any guest-facing string must never leak money/operator details (PRD §11 CONSTRAINT).
const FORBIDDEN = /cost|price|quote|budget|₹|\bINR\b|operator|vendor/i;

function build(extra: Record<string, string> = {}, ref = 'BDAY-2026-0001'): Registration {
  const fields: Record<string, string> = {
    first: 'Rashid', surname: 'Khan', email: 'rashid@example.com', phone: '98765 43210',
    phone_region: 'IN', wa_same: 'on', home_country: 'India', party_size: '4', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_time: '10:15', arr_mode: 'flight', arr_ref: '6E7123', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_time: '07:00', dep_mode: 'flight', dep_ref: '6E7124', dep_transport: 'yes',
    ...extra,
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error('build failed: ' + JSON.stringify(res.errors));
  return res.doc;
}

/** A confirmed doc whose legs the admin has planned (driver + pickup cached on the leg). */
function confirmedDoc(): Registration {
  const doc = build();
  doc.status = 'confirmed';
  for (const leg of doc.legs) {
    leg.status = 'confirmed';
    leg.driver_name = 'Ravi Kumar';
    leg.driver_phone_e164 = '+919000000000';
    leg.pickup_point = 'Hotel lobby';
    leg.pickup_time_confirmed = '09:30';
  }
  return doc;
}

describe('esc — HTML escaping', () => {
  it('escapes the five significant characters', () => {
    expect(esc(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });
});

describe('ack email', () => {
  const doc = build();
  const m = ackEmail(doc, LINK, EVENT);

  it('carries the reference and the edit link', () => {
    expect(m.text).toContain('BDAY-2026-0001');
    expect(m.text).toContain(LINK);
    expect(m.html).toContain(esc(LINK));
    expect(m.subject).toContain('BDAY-2026-0001');
  });
  it('greets by first name and never mentions money', () => {
    expect(m.text).toContain('Hello Rashid');
    expect(m.text).not.toMatch(FORBIDDEN);
    expect(m.html).not.toMatch(FORBIDDEN);
  });
});

describe('confirmation email', () => {
  const doc = confirmedDoc();
  const m = confirmationEmail(doc, LINK, EVENT);

  it('states the headcount and lists confirmed legs with driver + pickup', () => {
    expect(m.text).toContain('4 people');
    expect(m.text).toContain('Hyderabad → Bidar');
    expect(m.text).toContain('Ravi Kumar');
    expect(m.text).toContain('+919000000000');
    expect(m.text).toContain('Hotel lobby');
    expect(m.text).toContain('09:30 IST');
  });
  it('only includes confirmed transport-needed legs', () => {
    const partial = confirmedDoc();
    partial.legs.find((l) => l.direction === 'departure')!.status = 'planned';
    const out = confirmationEmail(partial, LINK, EVENT);
    expect(out.text).toContain('Hyderabad → Bidar');     // arrival still confirmed
    expect(out.text).not.toContain('Bidar → Hyderabad');  // departure not yet confirmed
  });
  it('never mentions cost or operator', () => {
    expect(m.text).not.toMatch(FORBIDDEN);
    expect(m.html).not.toMatch(FORBIDDEN);
  });
  it('escapes user text in the HTML body', () => {
    const evil = confirmedDoc();
    evil.special_requirements = '<script>alert(1)</script>';
    const out = confirmationEmail(evil, LINK, EVENT);
    expect(out.html).not.toContain('<script>alert(1)</script>');
    expect(out.html).toContain('&lt;script&gt;');
  });
});

describe('clarification email', () => {
  const m = clarificationEmail(build(), ['Arrival time', 'Flight number'], 'Which terminal?', LINK, EVENT);
  it('lists the reasons and the free text', () => {
    expect(m.text).toContain('Arrival time');
    expect(m.text).toContain('Flight number');
    expect(m.text).toContain('Which terminal?');
    expect(m.text).toContain(LINK);
  });
});

describe('updated email', () => {
  const doc = confirmedDoc();
  const m = updatedEmail(doc, doc.legs, LINK, EVENT);
  it('says it replaces the previous confirmation', () => {
    expect(m.text).toContain('replaces the previous confirmation');
    expect(m.html).toContain('replaces the previous confirmation');
    expect(m.text).not.toMatch(FORBIDDEN);
  });
});

describe('sendEmail — logging + never-throw', () => {
  it('with no RESEND_API_KEY: logs a failed attempt, appends audit, never throws, returns sent=false', async () => {
    const doc = build();
    const before = { emails: doc.emails.length, audit: doc.audit.length };
    const { doc: out, sent } = await sendEmail(doc, 'ack', ackEmail(doc, LINK, EVENT), NOW);

    expect(sent).toBe(false);
    expect(out.emails).toHaveLength(before.emails + 1);
    expect(out.audit).toHaveLength(before.audit + 1);

    const log = out.emails[out.emails.length - 1];
    expect(log.status).toBe('failed');
    expect(log.type).toBe('ack');
    expect(log.to_email).toBe('rashid@example.com');     // logs the INTENDED family address
    expect(log.error_message).toMatch(/RESEND_API_KEY/);
    expect(out.audit[out.audit.length - 1].action).toBe('email_failed');
  });

  it('does not mutate the input document (returns a copy)', async () => {
    const doc = build();
    const auditBefore = doc.audit.length;
    await sendEmail(doc, 'ack', ackEmail(doc, LINK, EVENT), NOW);
    expect(doc.emails).toEqual([]);                // no email row leaked onto the original
    expect(doc.audit).toHaveLength(auditBefore);   // no audit row leaked onto the original
  });
});
