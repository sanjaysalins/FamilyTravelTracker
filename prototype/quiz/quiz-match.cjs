// Birthday quiz answer matching. Plain CJS so the prototype page (classic <script>) and vitest share one file.
(function (root) {
  const FILLER = new Set(['the', 'a', 'an', 'my', 'her', 'his', 'its', 'of']);
  const AUTO = 0.85; // at or above: counts as a match on its own
  const MAYBE = 0.65; // at or above (but below AUTO): host decides once per distinct answer

  function normalize(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/&/g, ' and ')
      .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ') // keep letters of any script (Kannada, Hindi, Urdu...)
      .split(/\s+/).filter((t) => t && !FILLER.has(t))
      .join(' ');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let prev2 = prev;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1); // swapped neighbours: "hosue"
      }
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  const ratio = (a, b) => (a || b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1);

  // Text similarity 0..1 between two already-normalized strings.
  function textSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ta = a.split(' ').sort(), tb = b.split(' ').sort();
    let best = ratio(ta.join(' '), tb.join(' ')); // typos + word order ("salins sybil" = "sybil salins")
    const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (small.length < big.length && small.every((t) => big.includes(t))) best = Math.max(best, 0.8); // "pizza" vs "cheese pizza" -> maybe
    if (a.replace(/ /g, '') === b.replace(/ /g, '')) best = Math.max(best, 0.95); // "ice cream" = "icecream"
    // very short words: one typo is a big swing, so never auto-match
    if (a.length <= 4 && b.length <= 4 && best < 1) best = Math.min(best, 0.7);
    return best;
  }

  const ONES = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
  const TENS = {twenty:2,thirty:3,forty:4,fourty:4,fifty:5,sixty:6,seventy:7,eighty:8,ninety:9};

  function parseNumber(s) {
    const str = String(s == null ? '' : s).replace(/,/g, '');
    const low = str.toLowerCase();
    const mult = /(\d|\s)k\b|thousand/.test(low) ? 1000 : /\b(lakh|lakhs|lac)\b/.test(low) ? 100000 : 1;
    const m = str.match(/-?\d+(\.\d+)?/);
    if (m) return parseFloat(m[0]) * mult * (/\b(minus|negative)\b/.test(low) ? -1 : 1);
    let total = null; // number words: "forty", "thirty-five", "twelve thousand"
    for (const w of low.split(/[^a-z]+/)) {
      if (w in ONES) total = (total || 0) + ONES[w];
      else if (w in TENS) total = (total || 0) + TENS[w] * 10;
    }
    return total == null ? null : total * mult;
  }

  // question: {type:'choice'|'number'|'text', tolerance?}. truth: {answer, aliases?:[]} (Sybil's answer).
  // Returns {score:0..1, verdict:'match'|'maybe'|'no'}.
  function compare(question, guest, truth) {
    const out = (score) => ({ score, verdict: score >= AUTO ? 'match' : score >= MAYBE ? 'maybe' : 'no' });
    if (question.type === 'choice') return out(String(guest).trim().toLowerCase() === String(truth.answer).trim().toLowerCase() ? 1 : 0);
    if (question.type === 'number') {
      const g = parseNumber(guest), t = parseNumber(truth.answer);
      if (g == null || t == null) return out(0);
      return out(Math.abs(g - t) <= (question.tolerance || 0) ? 1 : 0);
    }
    // shotgun: a list of 3+ things ("house, car, gold") is not an answer
    if ((String(guest).match(/[,\/|;]|\bor\b/gi) || []).length >= 2) return out(0);
    const g = normalize(guest);
    const best = [truth.answer].concat(truth.aliases || [])
      .map((t) => textSimilarity(g, normalize(t))).reduce((m, x) => Math.max(m, x), 0);
    return out(best);
  }

  const keyOf = (q, raw) => (q.type === 'text' ? normalize(raw) : String(raw));

  // Distinct guest answers for a question (so the host judges "Pizza"/"pizza!!" once, not 20 times).
  function groupAnswers(question, guests) {
    const groups = new Map();
    for (const g of guests) {
      const raw = g.answers[question.id];
      if (raw == null || raw === '') continue;
      const key = keyOf(question, raw);
      if (!groups.has(key)) groups.set(key, { key, sample: raw, guests: [] });
      groups.get(key).guests.push(g.name);
    }
    return Array.from(groups.values());
  }

  // decisions: {[questionId]: {[groupKey]: true|false}} - the host's call on 'maybe' answers.
  function scoreGuest(questions, guest, truths, decisions) {
    decisions = decisions || {};
    let points = 0;
    const detail = {};
    let tieDiff = Infinity;
    for (const q of questions) {
      const truth = truths[q.id];
      if (q.tiebreak) {
        const gn = parseNumber(guest.answers[q.id]), tn = truth ? parseNumber(truth.answer) : null;
        if (gn != null && tn != null) tieDiff = Math.abs(gn - tn);
        continue;
      }
      const raw = guest.answers[q.id];
      if (!truth || raw == null || raw === '') { detail[q.id] = 'no'; continue; }
      let verdict = compare(q, raw, truth).verdict;
      if (verdict === 'maybe') {
        const d = (decisions[q.id] || {})[keyOf(q, raw)];
        verdict = d === true ? 'match' : d === false ? 'no' : 'maybe'; // undecided maybes score 0 until reviewed
      }
      detail[q.id] = verdict;
      if (verdict === 'match') points++;
    }
    return { name: guest.name, points, detail, tieDiff };
  }

  const api = { normalize, textSimilarity, compare, groupAnswers, scoreGuest, AUTO, MAYBE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
