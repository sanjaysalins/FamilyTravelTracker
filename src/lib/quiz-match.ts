// Birthday quiz ("Who knows Sybil best?") answer matching. Pure functions, no I/O.
//
// Every guest answer gets a verdict against Sybil's answer:
//   match  - scores a point on its own
//   maybe  - close but not sure; the host decides ONCE per distinct answer
//   no     - no point
// The host may also overrule a 'no' ("rescue") from the review list, so a right answer in an
// unexpected form never has to stay lost.

export type QType = 'text' | 'choice' | 'number';
export interface QuizQuestion {
  id: string;
  text: string;
  type: QType;
  options?: string[];
  tolerance?: number;
  /** closest guess wins ties; carries no point */
  tiebreak?: boolean;
}
export interface Truth { answer: string; aliases?: string[] }
export type Verdict = 'match' | 'maybe' | 'no';
export interface Compared { score: number; verdict: Verdict }
export interface Answerer { name: string; answers: Record<string, string> }
/** {[questionId]: {[groupKey]: true|false}} - the host's calls */
export type Decisions = Record<string, Record<string, boolean>>;

export const AUTO = 0.85; // at or above: counts as a match on its own
export const MAYBE = 0.65; // at or above (below AUTO): goes to the host

const FILLER = new Set(['the', 'a', 'an', 'my', 'her', 'his', 'its', 'of']);

export function normalize(s: unknown): string {
  return String(s == null ? '' : s)
    .normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ') // keep letters of any script (Kannada, Hindi, Urdu...)
    .split(/\s+/).filter((t) => t && !FILLER.has(t))
    .join(' ');
}

/** Edit distance where swapping two neighbouring letters ("hosue") costs 1. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let prev2 = prev;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const ratio = (a: string, b: string) => (a || b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 1);

/** Text similarity 0..1 between two already-normalised strings. */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = a.split(' ').sort(), tb = b.split(' ').sort();
  let best = ratio(ta.join(' '), tb.join(' ')); // typos + word order ("salins sybil" = "sybil salins")
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (small.length < big.length && small.every((t) => big.includes(t))) best = Math.max(best, 0.8); // "pizza" vs "cheese pizza" -> maybe
  if (a.replace(/ /g, '') === b.replace(/ /g, '')) best = Math.max(best, 0.95); // "ice cream" = "icecream"
  if (a.length <= 4 && b.length <= 4 && best < 1) best = Math.min(best, 0.7); // very short words: never auto-match
  // one word differs by a letter or two and starts differently ("exterior" vs "interior"): host decides
  if (best >= AUTO && best < 1 && ta.length === tb.length) {
    const diff = ta.map((t, i) => [t, tb[i]]).filter(([x, y]) => x !== y);
    if (diff.length === 1 && diff[0][0][0] !== diff[0][1][0] && distance(diff[0][0], diff[0][1]) <= 2) best = Math.min(best, AUTO - 0.01);
  }
  return best;
}

/** Spell it the way it sounds, so Poori = Puri, Kapur = Kapoor, Sanitiser = Sanitizer, Biriyani = Biryani. */
function fold(s: string): string {
  return s.replace(/y/g, 'i').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/z/g, 's')
    .replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/([a-z])\1+/g, '$1');
}
const singular = (t: string) => (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t) ? t.slice(0, -1) : t);
const canonOf = (s: string) => fold(s.split(' ').map(singular).join(' '));
/** Words people add around a real answer ("I think pani puri", "Rishi Kapoor ji"). Dropped only if something is left. */
const NOISE = new Set(['i', 'is', 'it', 'she', 'would', 'will', 'buy', 'think', 'maybe', 'probably', 'guess', 'ji', 'sir', 'late', 'new', 'big', 'dream', 'own'].map(canonOf));
/** Other names for the same thing; the first of each group is the one we compare on. */
const SYNONYMS = [
  ['pani puri', 'panipuri', 'golgappa', 'gol gappa', 'golgappe', 'gol gappe', 'puchka', 'phuchka'],
  ['house', 'home', 'ghar', 'makaan', 'makan', 'mane'],
];
const CANON = new Map<string, string>();
for (const g of SYNONYMS) for (const w of g) CANON.set(canonOf(normalize(w)), canonOf(normalize(g[0])));
const PHRASES = [...CANON.keys()].sort((a, b) => b.length - a.length);

/** normalise + sound-alike spelling + plurals + synonyms + filler words, for comparing two answers only. */
function canon(raw: unknown): string {
  let s = canonOf(normalize(raw));
  for (const p of PHRASES) s = s.replace(new RegExp(`(^| )${p}(?= |$)`, 'g'), `$1${CANON.get(p)}`);
  const kept = s.split(' ').filter((t) => t && !NOISE.has(t));
  return kept.length ? kept.join(' ') : s;
}

const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 2, thirty: 3, forty: 4, fourty: 4, fifty: 5, sixty: 6, seventy: 7, eighty: 8, ninety: 9 };

/** "12,000", "10k", "twelve thousand", "1 lakh", "minus 5" -> number; null if there is none. */
export function parseNumber(s: unknown): number | null {
  const str = String(s == null ? '' : s).replace(/,/g, '').replace(/(\d) (\d{3})(?!\d)/g, '$1$2'); // "12 000" -> 12000
  const low = str.toLowerCase();
  const mult = /(\d|\s)k\b|thousand/.test(low) ? 1000 : /\b(lakh|lakhs|lac)\b/.test(low) ? 100000 : 1;
  const dotted = mult === 1 ? str.replace(/^(\D*\d{1,3})\.(\d{3})(?!\d)/, '$1$2') : str; // "12.000" -> 12000
  const m = dotted.match(/-?\d+(\.\d+)?/);
  if (m) return parseFloat(m[0]) * mult * (/\b(minus|negative)\b/.test(low) ? -1 : 1);
  let total = 0, cur = 0, seen = false;
  for (const w of low.split(/[^a-z]+/)) {
    if (w in ONES) { cur += ONES[w]; seen = true; }
    else if (w in TENS) { cur += TENS[w] * 10; seen = true; }
    else if (w === 'hundred' && seen) cur = (cur || 1) * 100;
    else if (w === 'thousand' && seen) { total += (cur || 1) * 1000; cur = 0; }
    else if (/^(lakh|lakhs|lac)$/.test(w) && seen) { total += (cur || 1) * 100000; cur = 0; }
  }
  return seen ? total + cur : null;
}

const out = (score: number): Compared => ({ score, verdict: score >= AUTO ? 'match' : score >= MAYBE ? 'maybe' : 'no' });

/** One guest answer vs Sybil's answer. */
export function compare(q: Pick<QuizQuestion, 'type' | 'tolerance'>, guest: unknown, truth: Truth): Compared {
  if (q.type === 'choice') return out(String(guest).trim().toLowerCase() === String(truth.answer).trim().toLowerCase() ? 1 : 0);
  if (q.type === 'number') {
    const g = parseNumber(guest), t = parseNumber(truth.answer);
    if (g == null || t == null) return out(0);
    return out(Math.abs(g - t) <= (q.tolerance || 0) ? 1 : 0);
  }
  // shotgun: a list of 3+ things ("house, car, gold") is not an answer
  if ((String(guest).match(/[,/|;]|\bor\b/gi) || []).length >= 2) return out(0);
  const g = canon(guest);
  const best = [truth.answer, ...(truth.aliases || [])]
    .map((t) => textSimilarity(g, canon(t))).reduce((m, x) => Math.max(m, x), 0);
  return out(best);
}

/** The key the host's decision is stored under: same key = same decision for every guest who wrote it. */
export const answerKey = (q: Pick<QuizQuestion, 'type'>, raw: unknown) => (q.type === 'text' ? normalize(raw) : String(raw));

export interface AnswerGroup { key: string; sample: string; guests: string[] }

/** Distinct answers to a question, so "Pizza" / "pizza!!" is judged once, not 20 times. */
export function groupAnswers(q: QuizQuestion, people: Answerer[]): AnswerGroup[] {
  const groups = new Map<string, AnswerGroup>();
  for (const p of people) {
    const raw = p.answers[q.id];
    if (raw == null || raw === '') continue;
    const key = answerKey(q, raw);
    if (!key) continue; // nothing readable (e.g. only emoji)
    if (!groups.has(key)) groups.set(key, { key, sample: raw, guests: [] });
    groups.get(key)!.guests.push(p.name);
  }
  return [...groups.values()];
}

export interface Scored {
  name: string;
  points: number;
  detail: Record<string, Verdict>;
  /** how far the tiebreak guess was from the truth; Infinity if no usable guess */
  tieDiff: number;
  tieGuess: string;
}

/**
 * Score one guest. An undecided 'maybe' counts 0 until reviewed. A host decision overrules the
 * automatic verdict either way, except that it never takes away an automatic 'match'.
 */
export function scoreGuest(questions: QuizQuestion[], guest: Answerer, truths: Record<string, Truth>, decisions: Decisions = {}): Scored {
  let points = 0;
  let tieDiff = Infinity;
  let tieGuess = '';
  const detail: Record<string, Verdict> = {};
  for (const q of questions) {
    const truth = truths[q.id];
    const raw = guest.answers[q.id];
    if (q.tiebreak) {
      tieGuess = raw ?? '';
      const gn = parseNumber(raw), tn = truth ? parseNumber(truth.answer) : null;
      if (gn != null && tn != null) tieDiff = Math.abs(gn - tn);
      continue;
    }
    if (!truth || raw == null || raw === '') { detail[q.id] = 'no'; continue; }
    let verdict = compare(q, raw, truth).verdict;
    if (verdict !== 'match') {
      const d = (decisions[q.id] || {})[answerKey(q, raw)];
      if (d === true) verdict = 'match';
      else if (d === false) verdict = 'no';
    }
    detail[q.id] = verdict;
    if (verdict === 'match') points++;
  }
  return { name: guest.name, points, detail, tieDiff, tieGuess };
}
