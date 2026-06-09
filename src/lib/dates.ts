// Date display helpers (PRD §16). Storage is ISO-8601 text; guests SEE DD-MM-YYYY, and
// operational times are shown as IST. These are display-only; they never parse user input.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-16" -> "16-10-2026". Empty/invalid input returns "" (or the input unchanged). */
export function toDDMMYYYY(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** "2026-10-16" -> "16 Oct 2026" (friendlier for review/success screens). */
export function humanDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const mon = MONTHS[Number(m) - 1];
  if (!mon) return iso;
  return `${Number(d)} ${mon} ${y}`;
}
