// Next family reference number, e.g. "BDAY-2026-0042".
// Pure (caller passes the existing refs) so it's I/O-free and easy to test. Takes the
// highest existing suffix + 1, which is also safe over seeded data (seed uses the same prefix).

/** Reference prefix for a given event year, e.g. "BDAY-2026-". */
export function refPrefix(year: string): string {
  return `BDAY-${year}-`;
}

/** Next free reference for `year`, given all currently-used references. */
export function nextReference(existing: string[], year: string): string {
  const prefix = refPrefix(year);
  let max = 0;
  for (const ref of existing) {
    if (!ref.startsWith(prefix)) continue;
    const n = Number(ref.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
