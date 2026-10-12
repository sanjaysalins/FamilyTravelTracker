// Birthday quiz: input cleaning, the ranked board (shared ranks, tiebreak, pending), the review
// list, and the host cookie (valid for the quiz, never opens /admin).

import { describe, expect, it } from 'vitest';
import {
  QUESTIONS, SCORED, buildBoard, cleanSubmission, cleanTruths, nameKey, reviewBlocks, validDecision, type QuizEntry,
} from '../src/lib/quiz';
import { makeQuizSession, quizSessionValid, verifyQuizPassword } from '../src/lib/quiz-auth';
import { makeSession, sessionValid } from '../src/lib/auth';

const NOW = new Date('2026-10-15T10:00:00.000Z');
const entry = (name: string, answers: Record<string, string>, device = name): QuizEntry =>
  ({ device, name, name_key: nameKey(name), answers, created_at: '', updated_at: '' });
const perfect = () => {
  const a: Record<string, string> = {};
  for (const q of QUESTIONS) a[q.id] = q.type === 'choice' ? q.options![0] : q.type === 'number' ? '12000' : 'pizza';
  return a;
};
const truthsAll = () => {
  const t: Record<string, { answer: string; aliases?: string[] }> = {};
  for (const [id, answer] of Object.entries(perfect())) t[id] = { answer };
  return t;
};

describe('cleanSubmission', () => {
  it('needs a readable name', () => {
    expect(cleanSubmission(() => '')).toEqual({ error: 'Please type your name.' });
    expect(cleanSubmission((k) => (k === 'name' ? '😀😀' : ''))).toHaveProperty('error');
  });
  it('drops choice answers that are not on the list, keeps the rest, counts blanks', () => {
    const form: Record<string, string> = { name: '  Aunt   Mary ', q1: 'Teacher', q4: 'Hot chocolate', q7: QUESTIONS[6].options![1] };
    const r = cleanSubmission((k) => form[k]);
    if ('error' in r) throw new Error('unexpected');
    expect(r.name).toBe('Aunt Mary');
    expect(r.answers.q1).toBe('Teacher');
    expect(r.answers.q4).toBeUndefined();
    expect(r.answers.q7).toBe(QUESTIONS[6].options![1]);
    expect(r.blanks).toBe(SCORED.length - 2);
  });
  it('caps length and strips control characters', () => {
    const r = cleanSubmission((k) => (k === 'name' ? 'N'.repeat(100) : k === 'q1' ? 'a\u0000b\n' + 'x'.repeat(500) : ''));
    if ('error' in r) throw new Error('unexpected');
    expect(r.name.length).toBe(40);
    expect(r.answers.q1.length).toBe(120);
    expect(r.answers.q1.includes('\u0000')).toBe(false);
  });
  it('keeps script tags as plain text (escaping is done when rendering)', () => {
    const r = cleanSubmission((k) => (k === 'name' ? '<script>alert(1)</script>' : ''));
    if ('error' in r) throw new Error('unexpected');
    expect(r.name).toBe('<script>alert(1)</script>');
  });
});

describe('cleanTruths', () => {
  it('reads aliases, skips blanks, reports missing', () => {
    const form: Record<string, string> = { q1: 'Interior designer', a_q1: 'Decorator, , Architect ', q4: 'Tea' };
    const { truths, missing } = cleanTruths((k) => form[k]);
    expect(truths.q1).toEqual({ answer: 'Interior designer', aliases: ['Decorator', 'Architect'] });
    expect(truths.q4).toEqual({ answer: 'Tea' });
    expect(missing).toHaveLength(SCORED.length - 2);
    expect(truths.q13).toBeUndefined();
  });
});

describe('buildBoard', () => {
  it('ranks by points, then the closer tiebreak, and shares equal ranks', () => {
    const t = truthsAll();
    const a = entry('A', { ...perfect(), q13: '12100' });
    const b = entry('B', { ...perfect(), q13: '11000' });
    const c = entry('C', { ...perfect(), q13: '11000' });
    const d = entry('D', { q1: 'pizza' });
    const board = buildBoard([d, c, b, a], t, {});
    expect(board.rows.map((r) => r.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(board.rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(board.rows[1].tied && board.rows[2].tied).toBe(true);
    expect(board.rows[0].tied).toBe(false);
    expect(board.rows[0].points).toBe(SCORED.length);
  });
  it('a blank tiebreak ranks behind a guess', () => {
    const t = truthsAll();
    const x = entry('X', perfect());
    const noGuess = perfect();
    delete noGuess.q13;
    const rows = buildBoard([entry('Y', noGuess), x], t, {}).rows;
    expect(rows.map((r) => r.name)).toEqual(['X', 'Y']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });
  it('reports questions Sybil has not answered and answers waiting for a decision', () => {
    const t = truthsAll();
    delete t.q5;
    t.q1 = { answer: 'cheese pizza' };
    const es = [entry('A', { q1: 'pizza' }), entry('B', { q1: 'Pizza!' })];
    const board = buildBoard(es, t, {});
    expect(board.unanswered).toEqual(['q5']);
    expect(board.pending).toBe(1); // "pizza" and "Pizza!" are ONE answer
    const decided = buildBoard(es, t, { q1: { pizza: true } });
    expect(decided.pending).toBe(0);
    expect(decided.rows.every((r) => r.detail.q1 === 'match')).toBe(true);
  });
  it('the host can rescue a refused answer', () => {
    const t = truthsAll();
    t.q2 = { answer: 'Shahrukh Khan' };
    const e = entry('A', { q2: 'Chef' });
    expect(buildBoard([e], t, {}).rows[0].detail.q2).toBe('no');
    expect(buildBoard([e], t, { q2: { chef: true } }).rows[0].detail.q2).toBe('match');
  });
});

describe('review', () => {
  it('lists maybes first, then refused, with counts and decisions', () => {
    const t = truthsAll();
    t.q1 = { answer: 'cheese pizza' };
    const es = [entry('A', { q1: 'pizza' }), entry('B', { q1: 'Pizza' }), entry('C', { q1: 'burger' }), entry('D', { q1: 'cheese pizza' })];
    const blocks = reviewBlocks(es, t, { q1: { burger: false } });
    const b = blocks.find((x) => x.q.id === 'q1')!;
    expect(b.items.map((i) => [i.sample, i.count, i.verdict, i.decision])).toEqual([
      ['pizza', 2, 'maybe', undefined],
      ['burger', 1, 'no', false],
    ]);
  });
  it('only accepts decisions for real answers on typed questions', () => {
    const es = [entry('A', { q1: 'pizza', q4: 'Tea' })];
    expect(validDecision('q1', 'pizza', es)).toBe(true);
    expect(validDecision('q1', 'sushi', es)).toBe(false);
    expect(validDecision('q4', 'Tea', es)).toBe(false); // choice questions are exact
    expect(validDecision('nope', 'x', es)).toBe(false);
  });
});

describe('quiz host cookie', () => {
  it('accepts the quiz password and nothing else', () => {
    expect(verifyQuizPassword('bidar2026')).toBe(true);
    expect(verifyQuizPassword('Bidar2026')).toBe(false);
    expect(verifyQuizPassword('')).toBe(false);
  });
  it('is valid for the quiz but never satisfies the admin session', () => {
    const q = makeQuizSession(NOW);
    expect(quizSessionValid(q, NOW)).toBe(true);
    expect(sessionValid(q, NOW)).toBe(false);
  });
  it('an admin cookie is not a quiz cookie either', () => {
    expect(quizSessionValid(makeSession(NOW), NOW)).toBe(false);
  });
  it('expires and rejects tampering', () => {
    const q = makeQuizSession(NOW);
    expect(quizSessionValid(q, new Date(NOW.getTime() + 9 * 3600_000 * 8))).toBe(false);
    expect(quizSessionValid(q.slice(0, -2) + 'xx', NOW)).toBe(false);
    expect(quizSessionValid('', NOW)).toBe(false);
  });
});
