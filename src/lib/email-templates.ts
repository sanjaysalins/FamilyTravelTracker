// The four guest-facing emails (PRD §11), assembled from a Registration document. PURE and
// I/O-free so they're fully unit-testable; the send layer (email.ts) handles delivery + logging.
//
// [CONSTRAINT] No money, ever. Nothing here may include cost, quote, operator/vendor name, or
// budget. Family-facing transport detail is limited to: date, from→to, pickup point + time (IST),
// driver name + phone, vehicle type/description. (PRD §11 rules.)

import type { Registration, TransportLeg } from './types';
import { humanDate } from './dates';

export type EmailType = 'ack' | 'confirmation' | 'clarification' | 'updated';

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/** The event/organiser bits the templates need (a subset of config.event). */
export interface EventInfo {
  birthdayName: string;
  birthdayAge: number;
  town: string;
  organiserName: string;
  organiserWhatsapp: string;
}

/** Escape the five HTML-significant characters. Templates build raw strings, so unlike Astro
 *  pages nothing auto-escapes — every interpolated guest value must pass through here. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const greetingName = (doc: Registration): string =>
  doc.main_contact_first.trim() || 'there';

/** One human contact line for the footer — organiser name + WhatsApp, both optional. */
function organiserLine(event: EventInfo): { text: string; html: string } | null {
  const bits: string[] = [];
  if (event.organiserName) bits.push(event.organiserName);
  if (event.organiserWhatsapp) bits.push(`WhatsApp ${event.organiserWhatsapp}`);
  if (!bits.length) return null;
  const joined = bits.join(' · ');
  return { text: `Any questions, just reply or contact ${joined}.`, html: esc(`Any questions, just reply or contact ${joined}.`) };
}

/** Shared sign-off used by all four emails. */
function footer(event: EventInfo): { text: string; html: string } {
  const org = organiserLine(event);
  const textLines = ['', `Warm wishes,`, `${event.birthdayName}'s ${event.birthdayAge}th celebration team`];
  const htmlLines = [`<p>Warm wishes,<br>${esc(`${event.birthdayName}'s ${event.birthdayAge}th celebration team`)}</p>`];
  if (org) {
    textLines.unshift(org.text, '');
    htmlLines.unshift(`<p>${org.html}</p>`);
  }
  return { text: textLines.join('\n'), html: htmlLines.join('\n') };
}

/** Wrap body paragraphs (already-escaped HTML strings) in a minimal, email-client-safe shell. */
function htmlDoc(bodyHtml: string): string {
  return [
    '<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;line-height:1.5;">',
    '<div style="max-width:560px;margin:0 auto;padding:8px 4px;">',
    bodyHtml,
    '</div></body></html>',
  ].join('\n');
}

/** Family-facing one-liner for a single confirmed leg. NO cost, NO operator. */
function legLineText(leg: TransportLeg): string {
  const when = leg.travel_date ? humanDate(leg.travel_date) : 'date to be confirmed';
  const route = `${leg.from_location} → ${leg.to_location}`;
  const parts = [`• ${when}: ${route}`];
  if (leg.pickup_point) parts.push(`  Pickup: ${leg.pickup_point}${leg.pickup_time_confirmed ? ` at ${leg.pickup_time_confirmed} IST` : ''}`);
  else if (leg.pickup_time_confirmed) parts.push(`  Pickup time: ${leg.pickup_time_confirmed} IST`);
  if (leg.driver_name) parts.push(`  Driver: ${leg.driver_name}${leg.driver_phone_e164 ? ` (${leg.driver_phone_e164})` : ''}`);
  return parts.join('\n');
}

function legLineHtml(leg: TransportLeg): string {
  const when = leg.travel_date ? humanDate(leg.travel_date) : 'date to be confirmed';
  const route = `${leg.from_location} → ${leg.to_location}`;
  const rows = [`<strong>${esc(when)}</strong>: ${esc(route)}`];
  if (leg.pickup_point) rows.push(`Pickup: ${esc(leg.pickup_point)}${leg.pickup_time_confirmed ? ` at ${esc(leg.pickup_time_confirmed)} IST` : ''}`);
  else if (leg.pickup_time_confirmed) rows.push(`Pickup time: ${esc(leg.pickup_time_confirmed)} IST`);
  if (leg.driver_name) rows.push(`Driver: ${esc(leg.driver_name)}${leg.driver_phone_e164 ? ` (${esc(leg.driver_phone_e164)})` : ''}`);
  return `<li style="margin:0 0 12px;">${rows.join('<br>')}</li>`;
}

function editLinkText(editLink: string): string {
  return `Change your details any time with your private link:\n${editLink}`;
}
function editLinkHtml(editLink: string): string {
  // editLink is our own generated URL (origin + ref + raw token) — safe to use as href, still escaped.
  return `<p>Change your details any time with your private link:<br><a href="${esc(editLink)}">${esc(editLink)}</a></p>`;
}

/* ---------------- 1. Acknowledgement + edit link (on submit) ---------------- */

export function ackEmail(doc: Registration, editLink: string, event: EventInfo): EmailContent {
  const subject = `Travel details received — ${event.birthdayName}'s ${event.birthdayAge}th (${doc.reference_number})`;
  const f = footer(event);

  const text = [
    `Hello ${greetingName(doc)},`,
    '',
    `Thank you — your travel details for ${event.birthdayName}'s ${event.birthdayAge}th in ${event.town} are saved.`,
    `Your reference is ${doc.reference_number}.`,
    '',
    `The organiser will review everything and confirm your arrangements by email. There's nothing more you need to do for now.`,
    '',
    editLinkText(editLink),
    f.text,
  ].join('\n');

  const html = htmlDoc([
    `<p>Hello ${esc(greetingName(doc))},</p>`,
    `<p>Thank you — your travel details for ${esc(`${event.birthdayName}'s ${event.birthdayAge}th in ${event.town}`)} are saved.<br>Your reference is <strong>${esc(doc.reference_number)}</strong>.</p>`,
    `<p>The organiser will review everything and confirm your arrangements by email. There's nothing more you need to do for now.</p>`,
    editLinkHtml(editLink),
    f.html,
  ].join('\n'));

  return { subject, text, html };
}

/* ---------------- 2. Confirmation (admin "Confirm & Send") ---------------- */

export function confirmationEmail(doc: Registration, editLink: string, event: EventInfo): EmailContent {
  const subject = `Your travel is confirmed — ${event.birthdayName}'s ${event.birthdayAge}th`;
  const f = footer(event);
  const confirmedLegs = doc.legs.filter((l) => l.status === 'confirmed' && l.transport_needed);

  const text = [
    `Hello ${greetingName(doc)},`,
    '',
    `Good news — your registration for ${doc.party_size} ${doc.party_size === 1 ? 'person' : 'people'} is confirmed.`,
    '',
    ...(confirmedLegs.length
      ? ['Your transport:', ...confirmedLegs.map(legLineText)]
      : ['Your registration is confirmed.']),
    ...(doc.special_requirements ? ['', `A note on your requirements: ${doc.special_requirements}`] : []),
    '',
    editLinkText(editLink),
    f.text,
  ].join('\n');

  const html = htmlDoc([
    `<p>Hello ${esc(greetingName(doc))},</p>`,
    `<p>Good news — your registration for <strong>${doc.party_size}</strong> ${doc.party_size === 1 ? 'person' : 'people'} is confirmed.</p>`,
    ...(confirmedLegs.length
      ? [`<p>Your transport:</p>`, `<ul style="padding-left:18px;">${confirmedLegs.map(legLineHtml).join('')}</ul>`]
      : [`<p>Your registration is confirmed.</p>`]),
    ...(doc.special_requirements ? [`<p>A note on your requirements: ${esc(doc.special_requirements)}</p>`] : []),
    editLinkHtml(editLink),
    f.html,
  ].join('\n'));

  return { subject, text, html };
}

/* ---------------- 3. Clarification (admin "Request clarification") ---------------- */

export function clarificationEmail(
  doc: Registration,
  reasons: string[],
  freeText: string | null,
  editLink: string,
  event: EventInfo,
): EmailContent {
  const subject = `A quick question about your travel — ${event.birthdayName}'s ${event.birthdayAge}th`;
  const f = footer(event);
  const points = reasons.filter((r) => r.trim());

  const text = [
    `Hello ${greetingName(doc)},`,
    '',
    `Thank you for registering. To finish arranging your transport, could you help us with the following:`,
    '',
    ...(points.length ? points.map((p) => `• ${p}`) : ['• A little more detail on your travel.']),
    ...(freeText && freeText.trim() ? ['', freeText.trim()] : []),
    '',
    `Just open your private link and update your details — that's all we need:`,
    editLink,
    f.text,
  ].join('\n');

  const html = htmlDoc([
    `<p>Hello ${esc(greetingName(doc))},</p>`,
    `<p>Thank you for registering. To finish arranging your transport, could you help us with the following:</p>`,
    `<ul style="padding-left:18px;">${(points.length ? points : ['A little more detail on your travel.']).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`,
    ...(freeText && freeText.trim() ? [`<p>${esc(freeText.trim())}</p>`] : []),
    `<p>Just open your private link and update your details — that's all we need:<br><a href="${esc(editLink)}">${esc(editLink)}</a></p>`,
    f.html,
  ].join('\n'));

  return { subject, text, html };
}

/* ---------------- 4. Updated arrangements (admin edits a leg after confirmation) ---------------- */

export function updatedEmail(
  doc: Registration,
  changedLegs: TransportLeg[],
  editLink: string,
  event: EventInfo,
): EmailContent {
  const subject = `Updated travel arrangements — ${event.birthdayName}'s ${event.birthdayAge}th`;
  const f = footer(event);

  const text = [
    `Hello ${greetingName(doc)},`,
    '',
    `Your transport arrangements have been updated. This replaces the previous confirmation.`,
    '',
    `Your transport:`,
    ...changedLegs.map(legLineText),
    '',
    editLinkText(editLink),
    f.text,
  ].join('\n');

  const html = htmlDoc([
    `<p>Hello ${esc(greetingName(doc))},</p>`,
    `<p>Your transport arrangements have been updated. <strong>This replaces the previous confirmation.</strong></p>`,
    `<p>Your transport:</p>`,
    `<ul style="padding-left:18px;">${changedLegs.map(legLineHtml).join('')}</ul>`,
    editLinkHtml(editLink),
    f.html,
  ].join('\n'));

  return { subject, text, html };
}
