import { describe, expect, it } from 'vitest';
import * as Q from '../src/lib/quiz-match';

const text = { id: 'q', text: 'q', type: 'text' as const };
const v = (guest: string, truth: string, aliases: string[] = []) =>
  Q.compare(text, guest, { answer: truth, aliases }).verdict;

describe('quiz matching', () => {
  it('ignores case, punctuation, accents, articles', () => {
    expect(v('  THE Pizza!! ', 'pizza')).toBe('match');
    expect(v('Café', 'cafe')).toBe('match');
  });
  it('forgives typos on longer words', () => {
    expect(v('Chocolat cake', 'chocolate cake')).toBe('match');
    expect(v('Jhon Smith', 'John Smith')).not.toBe('no');
  });
  it('handles word order and spacing', () => {
    expect(v('Salins Sybil', 'Sybil Salins')).toBe('match');
    expect(v('icecream', 'ice cream')).toBe('match');
  });
  it('sends partial answers to host review, not auto-match', () => {
    expect(v('pizza', 'cheese pizza')).toBe('maybe');
  });
  it('never auto-matches short look-alikes', () => {
    expect(v('cat', 'car')).not.toBe('match');
  });
  it('rejects different answers', () => {
    expect(v('Paris', 'Goa')).toBe('no');
  });
  it('uses host-supplied aliases', () => {
    expect(v('Bombay', 'Mumbai', ['Bombay'])).toBe('match');
  });
  it('choice is exact, number honours tolerance', () => {
    expect(Q.compare({ type: 'choice' }, 'b', { answer: 'b' }).verdict).toBe('match');
    expect(Q.compare({ type: 'choice' }, 'a', { answer: 'b' }).verdict).toBe('no');
    expect(Q.compare({ type: 'number', tolerance: 1 }, '29', { answer: '30' }).verdict).toBe('match');
    expect(Q.compare({ type: 'number' }, '29', { answer: '30' }).verdict).toBe('no');
  });
  it('groups duplicate answers and scores with host decisions', () => {
    const qs = [text];
    const guests = [
      { name: 'A', answers: { q: 'Pizza' } },
      { name: 'B', answers: { q: 'pizza!' } },
      { name: 'C', answers: { q: 'Burger' } },
    ];
    expect(Q.groupAnswers(text, guests)).toHaveLength(2);
    const truths = { q: { answer: 'cheese pizza' } };
    expect(Q.scoreGuest(qs, guests[0], truths).points).toBe(0);
    expect(Q.scoreGuest(qs, guests[0], truths, { q: { pizza: true } }).points).toBe(1);
  });
});

describe('number words', () => {
  const n = { type: 'number' };
  it('reads words and digits the same', () => {
    expect(Q.compare(n, 'forty', { answer: '40' }).verdict).toBe('match');
    expect(Q.compare(n, 'Fourty', { answer: '40' }).verdict).toBe('match');
    expect(Q.compare(n, 'thirty-five', { answer: '35' }).verdict).toBe('match');
    expect(Q.compare(n, 'thirty', { answer: '40' }).verdict).toBe('no');
  });
});

describe('stress findings', () => {
  it('reads full-width letters like normal ones', () => {
    expect(v('ＢＵＴＴＥＲ ＣＨＩＣＫＥＮ', 'butter chicken')).toBe('match');
  });
  it('choice ignores case and stray spaces', () => {
    expect(Q.compare({ type: 'choice' }, 'tea ', { answer: 'Tea' }).verdict).toBe('match');
  });
  it('"minus 40" is not 40', () => {
    expect(Q.compare({ type: 'number' }, 'minus 40', { answer: '40' }).verdict).toBe('no');
  });
  it('shotgun answers never score on their own', () => {
    expect(v('butter chicken pizza biryani pasta', 'butter chicken')).toBe('maybe');
  });
  it('odd input never throws', () => {
    for (const a of [null, undefined, '', '😀', '<script>', 'a'.repeat(50000)]) expect(() => v(a as string, 'x')).not.toThrow();
  });
});

describe('big numbers for the tiebreaker', () => {
  const n = { type: 'number' };
  it('reads 10k, twelve thousand, 1 lakh', () => {
    expect(Q.compare(n, '10k', { answer: '10000' }).verdict).toBe('match');
    expect(Q.compare(n, 'twelve thousand', { answer: '12000' }).verdict).toBe('match');
    expect(Q.compare(n, '12,000', { answer: '12000' }).verdict).toBe('match');
    expect(Q.compare(n, '1 lakh', { answer: '100000' }).verdict).toBe('match');
    expect(Q.compare(n, '10', { answer: '10000' }).verdict).toBe('no');
  });
});

describe('big stress findings', () => {
  it('swapped letters are a typo, not a miss', () => {
    expect(v('hosue', 'house')).toBe('maybe');
    expect(v('Interior desginer', 'Interior designer')).not.toBe('no');
  });
  it('lists of 3+ things never reach the host or score', () => {
    expect(v('house, car, gold, land', 'a house')).toBe('no');
    expect(v('house or car or gold', 'a house')).toBe('no');
    expect(v('house or car', 'a house')).toBe('maybe');
    expect(v('chaat / pani puri', 'pani puri')).toBe('maybe');
  });
});

describe('other scripts', () => {
  it('Kannada / Hindi answers are kept, not erased', () => {
    expect(v('ಬಿರಿಯಾನಿ', 'ಬಿರಿಯಾನಿ')).toBe('match');
    expect(v('बिरयानी', 'बिरयानी')).toBe('match');
    expect(v('ಬಿರಿಯಾನಿ', 'pizza')).toBe('no');
    expect(v('😀', 'pizza')).toBe('no');
  });
});

describe('quiz matching: how people really type', () => {
  it('treats sound-alike spellings as the same', () => {
    expect(v('Pani poori', 'Pani puri')).toBe('match');
    expect(v('Rishi Kapur', 'Rishi Kapoor')).toBe('match');
    expect(v('Sanitiser', 'Hand sanitizer')).not.toBe('no');
    expect(v('Hand sanitiser bottles', 'Hand sanitizer')).not.toBe('no');
    expect(v('Mutton Biriyani', 'Mutton biryani')).toBe('match');
  });
  it('ignores filler words around a right answer', () => {
    expect(v('I think pani puri', 'Pani puri')).toBe('match');
    expect(v('Rishi Kapoor ji', 'Rishi Kapoor')).toBe('match');
    expect(v('She would buy a house', 'A house')).toBe('match');
  });
  it('knows common Hindi/Kannada names for the same thing', () => {
    expect(v('Golgappa', 'Pani puri')).toBe('match');
    expect(v('Puchka', 'Pani puri')).toBe('match');
    expect(v('Ghar', 'A house')).toBe('match');
    expect(v('Home', 'A house')).toBe('match');
  });
  it('does not auto-match look-alike wrong answers', () => {
    expect(v('Exterior designer', 'Interior designer')).toBe('maybe');
    expect(v('Fashion designer', 'Interior designer')).toBe('no');
    expect(v('Chicken biryani', 'Mutton biryani')).not.toBe('match');
    expect(v('Bhel puri', 'Pani puri')).not.toBe('match');
  });
  it('reads written-out and spaced numbers', () => {
    expect(Q.parseNumber('12 000')).toBe(12000);
    expect(Q.parseNumber('12.000')).toBe(12000);
    expect(Q.parseNumber('twelve hundred')).toBe(1200);
    expect(Q.parseNumber('twelve thousand five hundred')).toBe(12500);
    expect(Q.parseNumber('twelve thousand')).toBe(12000);
    expect(Q.parseNumber('12k')).toBe(12000);
    expect(Q.parseNumber('1.5')).toBe(1.5);
  });
});
