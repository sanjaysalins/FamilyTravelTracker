// Lenient phone normalisation (PRD §16). Accept messy input, store BOTH the raw entry and
// an E.164 form when we can parse one. NEVER reject: junk just yields e164 = null.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export interface NormalizedPhone {
  raw: string;
  e164: string | null;
}

/** Normalise to E.164 if possible; default region India. Always returns, never throws. */
export function normalizePhone(input: string, region: CountryCode = 'IN'): NormalizedPhone {
  const raw = (input ?? '').trim();
  if (!raw) return { raw, e164: null };
  try {
    // isPossible (not isValid): keep E.164 for well-formed numbers even if the exact range
    // isn't an assigned/known one — being lenient per PRD §16. Junk still yields null.
    const p = parsePhoneNumberFromString(raw, region);
    return { raw, e164: p && p.isPossible() ? p.number : null };
  } catch {
    return { raw, e164: null };
  }
}
