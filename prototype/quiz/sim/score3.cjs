// Big stress scoring: s3batch*.json (80 honest-ish guests) and cheat*.json (cheaters) vs the final questions.
// Run: node score3.cjs [list]
const Q = require('../quiz-match.cjs'), fs = require('fs'), path = require('path');
const ctx = {}; new Function('localStorage', 'ctx', fs.readFileSync(path.join(__dirname, '../questions.js'), 'utf8').replace(/^var Q =/m, 'ctx.Q =').split('var KEY')[0])({}, ctx);
const qs = ctx.Q, byId = Object.fromEntries(qs.map(q => [q.id, q]));
const opt = (id, i) => byId[id].options[i];
const tr = {
  q1:{answer:'Interior designer',aliases:['Interior decorator','Interior designing']},
  q2:{answer:'Pani puri',aliases:['Golgappa','Puchka','Gol gappa','Pani poori']},
  q3:{answer:'Rishi Kapoor',aliases:['Chintu Kapoor','Rishi Kapur']},
  q4:{answer:'Tea'}, q5:{answer:'Hand sanitizer',aliases:['Sanitizer','Hand sanitiser','Sanitiser']},
  q6:{answer:'A house',aliases:['House','Home','Villa','Bungalow']},
  q7:{answer:opt('q7',0)}, q8:{answer:opt('q8',0)}, q9:{answer:opt('q9',0)}, q10:{answer:opt('q10',0)},
  q11:{answer:opt('q11',0)}, q12:{answer:opt('q12',1)},
  q14:{answer:'Mutton biryani',aliases:['Biryani','Mutton biriyani','Biriyani']},
  q15:{answer:opt('q15',0)}, q16:{answer:opt('q16',0)}, q17:{answer:opt('q17',1)}, q13:{answer:'12000'}};
const scored = qs.filter(q => !q.tiebreak);
const read = re => fs.readdirSync(__dirname).filter(f => re.test(f)).sort().flatMap(f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^﻿/, '')).map(g => Object.assign(g, { file: f })));

// ---------- honest-ish guests
const guests = read(/^s3batch\d+\.json$/);
const c = {}, per = {}, bad = [];
for (const g of guests) for (const q of scored) {
  const a = g.answers[q.id]; if (a == null) continue;
  const v = a === '' ? 'no' : Q.compare(q, a, tr[q.id]).verdict, m = (q.type === 'choice' ? a === tr[q.id].answer : g.meant[q.id]) ? 'meant' : 'notmeant'; // choice: truth is known, ignore agent label
  const k = m + '/' + v; c[k] = (c[k] || 0) + 1; ((per[q.id] = per[q.id] || {})[k] = ((per[q.id] || {})[k] || 0) + 1);
  if ((m === 'meant' && v !== 'match') || (m === 'notmeant' && v !== 'no')) bad.push([g.file, m, v, q.id, JSON.stringify(a)].join(' | '));
}
// host workload: distinct maybe groups
let taps = 0; const tapsBy = {};
for (const q of scored) { const n = Q.groupAnswers(q, guests).filter(x => Q.compare(q, x.sample, tr[q.id]).verdict === 'maybe').length; tapsBy[q.id] = n; taps += n; }
const meantTotal = (c['meant/match'] || 0) + (c['meant/maybe'] || 0) + (c['meant/no'] || 0);
const notTotal = (c['notmeant/no'] || 0) + (c['notmeant/maybe'] || 0) + (c['notmeant/match'] || 0);
console.log('HONEST GUESTS:', guests.length, 'guests,', meantTotal + notTotal, 'answers');
console.log(' right answers (' + meantTotal + '): match', c['meant/match'] || 0, '| maybe', c['meant/maybe'] || 0, '| refused', c['meant/no'] || 0);
console.log(' wrong answers (' + notTotal + '): refused', c['notmeant/no'] || 0, '| maybe', c['notmeant/maybe'] || 0, '| FALSE POINT', c['notmeant/match'] || 0);
console.log(' host taps needed:', taps, 'distinct "maybe" answers', JSON.stringify(tapsBy));
if (process.argv[2] === 'list') console.log(bad.join('\n'));

// ---------- cheaters
const letter = { a: 0, b: 1, c: 2, d: 3 };
const cheats = read(/^cheat\d+\.json$/);
if (cheats.length) {
  console.log('\nCHEATERS:', cheats.length, 'attempts');
  const best = {}; // best per-question across all attempts of one cheater file = repeat-submission exploit
  const perAttempt = [];
  for (const g of cheats) {
    let pts = 0, maybes = 0;
    for (const q of scored) {
      let a = g.answers[q.id]; if (a == null || a === '') continue;
      if (q.type === 'choice') a = String(a).length === 1 ? (q.options[letter[String(a).toLowerCase()]] || '') : a;
      const v = a === '' ? 'no' : Q.compare(q, a, tr[q.id]).verdict;
      if (v === 'match') { pts++; (best[g.file] = best[g.file] || {})[q.id] = 1; }
      if (v === 'maybe') maybes++;
    }
    perAttempt.push({ file: g.file, name: g.name, pts, maybes });
  }
  const text = scored.filter(q => q.type === 'text').length, choice = scored.filter(q => q.type === 'choice').length;
  console.log(' questions:', scored.length, '(' + text + ' text,', choice, 'choice). Pure luck on choice alone ~', (choice / 4).toFixed(1), 'pts');
  for (const f of [...new Set(cheats.map(g => g.file))]) {
    const rows = perAttempt.filter(r => r.file === f);
    console.log(' ' + f + ': best single attempt', Math.max(...rows.map(r => r.pts)), '| avg', (rows.reduce((s, r) => s + r.pts, 0) / rows.length).toFixed(1),
      '| pts if repeats allowed (union of attempts):', Object.keys(best[f] || {}).length, '| maybes sent to host:', rows.reduce((s, r) => s + r.maybes, 0));
  }
}
