// "Who knows Sybil best?" birthday quiz: the questions, input cleaning and the leaderboard.
// Pure functions (no I/O) so they are unit-tested; the store + routes live elsewhere.

import {
  type AnswerGroup, type Decisions, type Scored, type Truth, type QuizQuestion,
  answerKey, compare, groupAnswers, normalize, parseNumber, scoreGuest,
} from './quiz-match';

/** Choice options are what guests tap; Sybil answers from the same list. The tiebreaker goes last. */
export const QUESTIONS: QuizQuestion[] = [
  { id: 'q1', text: 'If she were NOT an eye doctor, what profession would she have chosen?', type: 'text' },
  { id: 'q2', text: 'What food does she always say yes to?', type: 'text' },
  { id: 'q3', text: 'Who was her film-star crush growing up?', type: 'text' },
  { id: 'q4', text: 'Which drink does she have every day?', type: 'choice', options: ['Tea', 'Coffee', 'Both', 'Neither'] },
  { id: 'q5', text: 'If we emptied her handbag, what item would we find the MOST of?', type: 'text' },
  { id: 'q6', text: 'If she won ₹1 crore tomorrow, what would be her FIRST big purchase?', type: 'text' },
  { id: 'q7', text: 'A patient says "Doctor, just give me drops, I don\'t want surgery." What does she do?', type: 'choice', options: ['Calmly explains why surgery is needed', 'Gives the drops, with a warning', 'Gives a serious look without words', 'Tells a story about another patient'] },
  { id: 'q8', text: 'She wants to leave a late-night function early. What excuse does she usually give?', type: 'choice', options: ['Early clinic tomorrow', 'Headache', 'Tired / long day', 'Just says goodbye and goes'] },
  { id: 'q9', text: 'A rare, completely free Sunday in Bidar. How does she spend it?', type: 'choice', options: ['Sleeping in and resting', 'Cooking a big meal for everyone', 'Shopping or outing', 'Catching up with friends and phone calls'] },
  { id: 'q10', text: 'How does she mostly use WhatsApp?', type: 'choice', options: ['Family group chats', 'Sharing messages and pictures', 'Voice notes', 'Photos and videos'] },
  { id: 'q11', text: 'What was she MOST like as a young girl?', type: 'choice', options: ['Top of the class', 'Full of tricks', 'Quiet dreamer', 'Natural leader'] },
  { id: 'q12', text: 'How does she feel about turning 60?', type: 'choice', options: ['Proud and happy', 'Young at heart', 'Would rather not talk about it', 'Looking forward to relaxing more'] },
  { id: 'q14', text: 'Which dish is Sybil famous for? Everyone asks for it at every gathering.', type: 'text' },
  { id: 'q15', text: 'What does Sybil say most often?', type: 'choice', options: ['"Have you eaten?"', '"Wear your glasses properly!"', '"I told you so."', '"Just five minutes more."'] },
  { id: 'q16', text: 'If Sybil got one superpower tomorrow, she would pick:', type: 'choice', options: ['X-ray vision', 'Being in Bidar and Bangalore at the same time', 'Never needing sleep', 'Being at every family event at once'] },
  { id: 'q17', text: 'It is 5:30 in the morning. What is Sybil doing?', type: 'choice', options: ['Fast asleep, phone on silent', 'Already dressed, already on the phone to the hospital', 'Walking fast in the garden', 'Watering the plants and giving them instructions'] },
  { id: 'q13', text: 'Last question (the tiebreaker): about how many eye surgeries has she done in her whole career? Type a number.', type: 'number', tiebreak: true },
];
export const SCORED = QUESTIONS.filter((q) => !q.tiebreak);

export const NAME_MAX = 40;
export const ANSWER_MAX = 120;

/** What one phone sends. One entry per device; the device id is the storage key. */
export interface QuizEntry {
  device: string;
  name: string;
  name_key: string;
  answers: Record<string, string>;
  created_at: string;
  updated_at: string;
}
export interface QuizState { open: boolean; updated_at?: string }
export type Truths = Record<string, Truth>;

const clip = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normalise a name so "mary" and "Mary " clash. Empty if the name has no readable letters. */
export const nameKey = (name: string) => normalize(name);

export type Cleaned = { name: string; answers: Record<string, string>; blanks: number } | { error: string };

/**
 * Turn raw form values into a safe entry body. Choice answers must be one of the listed options
 * (anything else is dropped), the tiebreaker is kept as typed, text is trimmed and length-capped.
 */
export function cleanSubmission(get: (k: string) => unknown): Cleaned {
  const name = clip(get('name'), NAME_MAX);
  if (!nameKey(name)) return { error: 'Please type your name.' };
  const answers: Record<string, string> = {};
  let blanks = 0;
  for (const q of QUESTIONS) {
    let a = clip(get(q.id), ANSWER_MAX);
    if (q.type === 'choice' && !(q.options ?? []).includes(a)) a = '';
    if (a === '') { if (!q.tiebreak) blanks++; continue; }
    answers[q.id] = a;
  }
  return { name, answers, blanks };
}

/** Sybil's saved form -> truths. Blank answers are skipped; choice answers must be listed. */
export function cleanTruths(get: (k: string) => unknown): { truths: Truths; missing: string[] } {
  const truths: Truths = {};
  const missing: string[] = [];
  for (const q of QUESTIONS) {
    let a = clip(get(q.id), ANSWER_MAX);
    if (q.type === 'choice' && !(q.options ?? []).includes(a)) a = '';
    if (!a) { if (!q.tiebreak) missing.push(q.id); continue; }
    const t: Truth = { answer: a };
    if (q.type === 'text') {
      const aliases = clip(get('a_' + q.id), 400).split(',').map((x) => clip(x, ANSWER_MAX)).filter(Boolean);
      if (aliases.length) t.aliases = aliases.slice(0, 20);
    }
    truths[q.id] = t;
  }
  return { truths, missing };
}

export interface BoardRow extends Scored {
  rank: number;
  tied: boolean;
  device: string;
}
export interface Board {
  rows: BoardRow[];
  /** scored questions Sybil has not answered yet (everyone gets no point there) */
  unanswered: string[];
  /** distinct answers still waiting for Sybil's Same/Different */
  pending: number;
}

/** A group is "open" when it is a maybe and nobody has decided it yet. */
export function openGroups(q: QuizQuestion, entries: QuizEntry[], truth: Truth | undefined, decisions: Decisions): AnswerGroup[] {
  if (!truth || q.tiebreak) return [];
  return groupAnswers(q, entries).filter((g) => compare(q, g.sample, truth).verdict === 'maybe' && decisions[q.id]?.[g.key] === undefined);
}

/** Ranked leaderboard. Ties share a rank; points first, then the closer tiebreak guess. */
export function buildBoard(entries: QuizEntry[], truths: Truths, decisions: Decisions): Board {
  const scored = entries.map((e) => ({ ...scoreGuest(QUESTIONS, e, truths, decisions), device: e.device }));
  scored.sort((a, b) => b.points - a.points || a.tieDiff - b.tieDiff || a.name.localeCompare(b.name));
  const same = (a: Scored, b: Scored) => a.points === b.points && a.tieDiff === b.tieDiff;
  const rows: BoardRow[] = scored.map((r, i) => {
    const ahead = scored.filter((o) => o.points > r.points || (o.points === r.points && o.tieDiff < r.tieDiff)).length;
    return { ...r, rank: ahead + 1, tied: scored.some((o, j) => j !== i && same(o, r)) };
  });
  const unanswered = SCORED.filter((q) => !truths[q.id]).map((q) => q.id);
  const pending = SCORED.reduce((n, q) => n + openGroups(q, entries, truths[q.id], decisions).length, 0);
  return { rows, unanswered, pending };
}

export interface ReviewItem { key: string; sample: string; count: number; verdict: 'maybe' | 'no'; decision: boolean | undefined }
export interface ReviewBlock { q: QuizQuestion; truth: Truth; items: ReviewItem[] }

/**
 * Per text question: every distinct answer that did not score on its own, with the host's call.
 * Maybes first (unreviewed ones on top), then the refused ones so a right answer in an unexpected
 * form can be rescued. Choice and number questions are exact, so they have nothing to review.
 */
export function reviewBlocks(entries: QuizEntry[], truths: Truths, decisions: Decisions): ReviewBlock[] {
  const blocks: ReviewBlock[] = [];
  for (const q of SCORED.filter((x) => x.type === 'text')) {
    const truth = truths[q.id];
    if (!truth) continue;
    const items: ReviewItem[] = [];
    for (const g of groupAnswers(q, entries)) {
      const verdict = compare(q, g.sample, truth).verdict;
      if (verdict === 'match') continue;
      items.push({ key: g.key, sample: g.sample, count: g.guests.length, verdict, decision: decisions[q.id]?.[g.key] });
    }
    items.sort((a, b) =>
      (a.verdict === 'maybe' ? 0 : 1) - (b.verdict === 'maybe' ? 0 : 1) ||
      (a.decision === undefined ? 0 : 1) - (b.decision === undefined ? 0 : 1) ||
      b.count - a.count || a.sample.localeCompare(b.sample));
    if (items.length) blocks.push({ q, truth, items });
  }
  return blocks;
}

/** Valid decision target? (stops junk keys being stored) */
export function validDecision(qid: string, key: string, entries: QuizEntry[]): boolean {
  const q = SCORED.find((x) => x.id === qid && x.type === 'text');
  if (!q || !key) return false;
  return entries.some((e) => answerKey(q, e.answers[q.id]) === key);
}

export { parseNumber };
