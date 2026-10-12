// End-to-end test of the birthday quiz against a RUNNING server (real HTTP, real cookies, real store).
//   npx astro dev --port 4399      (in another terminal)
//   npx vite-node scripts/quiz-e2e.mjs [baseUrl]
// Each guest is its own "phone" (own cookie jar). Results are compared with an offline scoring of the
// same answers, so the server pages, the store and the matcher all have to agree.
// It wipes the quiz entries at the start and the end (type-DELETE route); Sybil's answers are overwritten.

import { readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { scoreGuest, groupAnswers, compare } from '../src/lib/quiz-match';
import { QUESTIONS } from '../src/lib/quiz';

const BASE = process.argv[2] || 'http://localhost:4399';
const SIM = new URL('../prototype/quiz/sim/', import.meta.url);
const PASSWORD = 'bidar2026';

// ---- the questions: the same list the server uses (run this script with vite-node so the TS imports resolve)
const QS = QUESTIONS;
const SCORED = QS.filter((q) => !q.tiebreak);
const opt = (id, i) => QS.find((q) => q.id === id).options[i];
const TRUTH = {
  q1: { answer: 'Interior designer', aliases: ['Interior decorator', 'Interior designing'] },
  q2: { answer: 'Pani puri', aliases: ['Golgappa', 'Puchka', 'Gol gappa', 'Pani poori'] },
  q3: { answer: 'Rishi Kapoor', aliases: ['Chintu Kapoor', 'Rishi Kapur'] },
  q4: { answer: 'Tea' }, q5: { answer: 'Hand sanitizer', aliases: ['Sanitizer', 'Hand sanitiser', 'Sanitiser'] },
  q6: { answer: 'A house', aliases: ['House', 'Home', 'Villa', 'Bungalow'] },
  q7: { answer: opt('q7', 0) }, q8: { answer: opt('q8', 0) }, q9: { answer: opt('q9', 0) }, q10: { answer: opt('q10', 0) },
  q11: { answer: opt('q11', 0) }, q12: { answer: opt('q12', 1) },
  q14: { answer: 'Mutton biryani', aliases: ['Biryani', 'Mutton biriyani', 'Biriyani'] },
  q15: { answer: opt('q15', 0) }, q16: { answer: opt('q16', 0) }, q17: { answer: opt('q17', 1) }, q13: { answer: '12000' },
};

// ---- tiny HTTP client with a cookie jar (one per phone)
class Phone {
  constructor() { this.jar = new Map(); }
  async req(path, init = {}) {
    const res = await fetch(BASE + path, { ...init, redirect: 'manual', headers: { ...(init.headers || {}), cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const sc of res.headers.getSetCookie()) {
      const [kv, ...attrs] = sc.split(';');
      const i = kv.indexOf('=');
      const name = kv.slice(0, i).trim(), val = kv.slice(i + 1).trim();
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(attrs.join(';')) || val === '') this.jar.delete(name); else this.jar.set(name, val);
    }
    return res;
  }
  get(path) { return this.req(path); }
  async text(path) { const r = await this.get(path); return { status: r.status, loc: r.headers.get('location'), body: await r.text() }; }
  post(path, fields) {
    return this.req(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
  }
  async csrfFrom(path) { const { body } = await this.text(path); const m = body.match(/name="csrf_token" value="([^"]+)"/); return m ? m[1] : null; }
}

// ---- tiny test harness
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('  ✓', name); } else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  ✗', name, detail ? '→ ' + detail : ''); }
}
const section = (t) => console.log('\n' + t);
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const rowsOf = (html) => [...html.matchAll(/<tr[^>]*>\s*<td class="rank[^"]*"[^>]*>([^<]*)<\/td>\s*<td[^>]*><b[^>]*>([\s\S]*?)<\/b><\/td>[\s\S]*?<td class="pts[^"]*"[^>]*>(\d+)\/(\d+)<\/td>/g)]
  .map((m) => ({ rank: m[1].trim(), name: unesc(m[2]), points: Number(m[3]), of: Number(m[4]) }));

// ---- load the simulated people
const readJson = (f) => JSON.parse(readFileSync(new URL(f, SIM), 'utf8').replace(/^﻿/, ''));
const files = readdirSync(SIM);
const honest = files.filter((f) => /^s3batch\d+\.json$/.test(f)).sort().flatMap((f) => readJson(f).map((g) => ({ ...g, src: f })));
const cheats = files.filter((f) => /^cheat\d+\.json$/.test(f)).sort().flatMap((f) => readJson(f).map((g) => ({ ...g, src: f, cheat: true })));
const LET = { a: 0, b: 1, c: 2, d: 3 };
for (const c of cheats) for (const q of QS) if (q.type === 'choice' && c.answers[q.id] != null && String(c.answers[q.id]).length === 1) c.answers[q.id] = q.options[LET[String(c.answers[q.id]).toLowerCase()]] ?? '';
const seen = new Set();
const people = [...honest, ...cheats].map((g, i) => { // names must be unique per phone: that is a server rule we test separately
  let n = String(g.name).trim() || 'Guest', k = n.toLowerCase();
  if (seen.has(k)) { n = `${n} ${String.fromCharCode(65 + (i % 26))}${i}`; k = n.toLowerCase(); }
  seen.add(k);
  return { ...g, name: n };
});
// what the server will store: choice answers must be on the list, text capped at 120 chars, control chars stripped
const stored = (g) => {
  const answers = {};
  for (const q of QS) {
    let a = String(g.answers[q.id] ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (q.type === 'choice' && !q.options.includes(a)) a = '';
    if (a) answers[q.id] = a;
  }
  return { name: g.name, answers };
};
const expectedBoard = (list, decisions = {}) => list.map((g) => scoreGuest(QS, g, TRUTH, decisions));
const pendingGroups = (list, decisions = {}) => SCORED.filter((q) => q.type === 'text')
  .reduce((n, q) => n + groupAnswers(q, list).filter((x) => compare(q, x.sample, TRUTH[q.id]).verdict === 'maybe' && decisions[q.id]?.[x.key] === undefined).length, 0);

const host = new Phone();
let htok = null;
const hostPost = async (path, fields) => { htok = (await host.csrfFrom('/quiz/results')) || htok; return host.post(path, { csrf_token: htok, ...fields }); };
async function guestSubmit(name, answers, phone = new Phone()) {
  const csrf = await phone.csrfFrom('/quiz?edit=1');
  const res = await phone.post('/api/quiz/submit', { csrf_token: csrf, name, ...answers });
  return { phone, res, loc: res.headers.get('location') };
}

console.log(`Quiz e2e against ${BASE}  (${honest.length} honest guests, ${cheats.length} cheat attempts)`);

// A previous run ends by locking the login for a minute (section 11). Wait that out first.
for (let i = 0; i < 30; i++) {
  const p = new Phone();
  const c = await p.csrfFrom('/quiz/login');
  await p.post('/api/quiz/login', { csrf_token: c, password: PASSWORD, next: 'results' });
  if (p.jar.has('ftc_quiz')) break;
  if (i === 0) console.log('login is locked from an earlier run, waiting for it to clear...');
  await new Promise((r) => setTimeout(r, 4000));
}

// =============== 1. the public page ===============
section('1. Public quiz page');
{
  const p = new Phone();
  const { status, body } = await p.text('/quiz');
  check('/quiz is open to everyone (200)', status === 200);
  check('lists all 17 questions', (body.match(/class="card q"/g) || []).length === QS.length, `${(body.match(/class="card q"/g) || []).length}`);
  check('no link or button for the host pages or "start over"', !/quiz\/sybil|quiz\/results|Start over|api\/quiz\/(truths|decide|clear|status)/i.test(body));
  check('device + csrf cookies issued', p.jar.has('ftc_quiz_dev') && p.jar.has('ftc_csrf'));
  check('page is not cacheable', (await p.get('/quiz')).headers.get('cache-control')?.includes('no-store'));
}

// =============== 2. protection ===============
section('2. The two host pages are protected');
{
  const p = new Phone();
  for (const path of ['/quiz/sybil', '/quiz/results']) {
    const r = await p.text(path);
    check(`${path} without login redirects to /quiz/login`, r.status === 302 && /\/quiz\/login/.test(r.loc || ''), `${r.status} ${r.loc}`);
  }
  const csrf = await p.csrfFrom('/quiz/login?next=sybil');
  for (const path of ['/api/quiz/truths', '/api/quiz/decide', '/api/quiz/status', '/api/quiz/clear']) {
    const r = await p.post(path, { csrf_token: csrf, confirm: 'DELETE', open: '0', q: 'q1', key: 'x', v: '1' });
    check(`POST ${path} without login is refused`, r.status === 303 && /\/quiz\/login/.test(r.headers.get('location') || ''), `${r.status}`);
  }
  const bad = await p.post('/api/quiz/login', { csrf_token: 'forged', password: PASSWORD, next: 'sybil' });
  check('login with a forged CSRF token is refused (403)', bad.status === 403, `${bad.status}`);
  const wrong = await p.post('/api/quiz/login', { csrf_token: csrf, password: 'Bidar2026', next: 'sybil' });
  check('wrong password -> back to login, no session', wrong.status === 303 && /login/.test(wrong.headers.get('location')) && !p.jar.has('ftc_quiz'));
  const errPage = await p.text('/quiz/login?next=sybil');
  check('wrong password shows an error message', /not right/.test(errPage.body));
  const csrf2 = await p.csrfFrom('/quiz/login?next=sybil');
  const ok = await p.post('/api/quiz/login', { csrf_token: csrf2, password: PASSWORD, next: 'sybil' });
  check('correct password -> Sybil page', ok.status === 303 && ok.headers.get('location') === '/quiz/sybil' && p.jar.has('ftc_quiz'), `${ok.status} ${ok.headers.get('location')}`);
  check('the quiz cookie opens /quiz/sybil and /quiz/results', (await p.text('/quiz/sybil')).status === 200 && (await p.text('/quiz/results')).status === 200);
  const adm = await p.text('/admin');
  check('the quiz cookie does NOT open /admin', adm.status === 302 && /admin\/login/.test(adm.loc || ''), `${adm.status} ${adm.loc}`);
  const forged = new Phone(); forged.jar.set('ftc_quiz', p.jar.get('ftc_quiz').slice(0, -3) + 'abc');
  check('a tampered quiz cookie is rejected', (await forged.text('/quiz/results')).status === 302);
  const noCsrf = await p.post('/api/quiz/truths', { q1: 'Hacked' });
  check('host POST without a CSRF token is refused (403)', noCsrf.status === 403, `${noCsrf.status}`);
  const open = new Phone(); const oc = await open.csrfFrom('/quiz/login');
  const redirectAttack = await open.post('/api/quiz/login', { csrf_token: oc, password: PASSWORD, next: 'https://evil.example' });
  check('login "next" cannot send you to another site', redirectAttack.headers.get('location') === '/quiz/results', redirectAttack.headers.get('location'));
}

// =============== 3. Sybil's answers ===============
section("3. Sybil's page: save her answers");
await host.post('/api/quiz/login', { csrf_token: await host.csrfFrom('/quiz/login?next=results'), password: PASSWORD, next: 'results' });
{
  await hostPost('/api/quiz/clear', { confirm: 'DELETE' });
  const fields = {};
  for (const [id, t] of Object.entries(TRUTH)) { fields[id] = t.answer; if (t.aliases) fields['a_' + id] = t.aliases.join(', '); }
  const r = await hostPost('/api/quiz/truths', fields);
  check('saving Sybil\'s answers redirects with saved=1', r.status === 303 && /saved=1&missing=0/.test(r.headers.get('location')), r.headers.get('location'));
  const page = await host.text('/quiz/sybil?saved=1');
  check('page reloads with every answer remembered (incl. answers with quote marks)', page.status === 200 && page.body.includes('Interior designer') && (page.body.match(/checked/g) || []).length >= 9, `${page.status}`);
  const partial = { ...fields }; delete partial.q5;
  const r2 = await hostPost('/api/quiz/truths', partial);
  check('leaving a question blank is reported', /missing=1/.test(r2.headers.get('location')));
  const pg2 = await host.text('/quiz/sybil');
  check('...and the page warns about it', /still blank/.test(pg2.body));
  await hostPost('/api/quiz/truths', fields);
}

// =============== 4. 100 phones at once ===============
section(`4. ${people.length} phones submit at the same moment`);
const phones = new Map();
{
  const t0 = performance.now();
  const results = await Promise.all(people.map(async (g) => { const s = stored(g); const r = await guestSubmit(s.name, s.answers); phones.set(g.name, r.phone); return r.loc; }));
  const ms = Math.round(performance.now() - t0);
  const okN = results.filter((l) => l === '/quiz?done=1').length;
  check(`all ${people.length} accepted (no lost or overwritten entries)`, okN === people.length, `${okN} accepted; others: ${[...new Set(results.filter((l) => l !== '/quiz?done=1'))].join(',')}`);
  console.log(`    (took ${ms} ms for ${people.length} parallel submissions)`);
  const t1 = performance.now();
  const page = await host.text('/quiz/results');
  const render = Math.round(performance.now() - t1);
  const rows = rowsOf(page.body);
  check(`results page lists all ${people.length} guests`, rows.length === people.length, `${rows.length}`);
  console.log(`    (results page rendered in ${render} ms)`);
  const exp = expectedBoard(people.map(stored));
  const byName = new Map(exp.map((e) => [e.name, e.points]));
  const wrong = rows.filter((r) => byName.get(r.name) !== r.points);
  check('every guest\'s points equal the offline scoring', wrong.length === 0, wrong.slice(0, 3).map((w) => `${w.name}: page ${w.points} vs ${byName.get(w.name)}`).join('; '));
  const shown = rows.map((r) => r.points);
  check('board is sorted best-first', shown.every((p, i) => i === 0 || shown[i - 1] >= p));
  const pend = Number((page.body.match(/<b[^>]*>(\d+) answers? not checked yet/) || [])[1] ?? 0);
  check('"not checked yet" banner equals the number of distinct maybe answers', pend === pendingGroups(people.map(stored)), `page ${pend} vs ${pendingGroups(people.map(stored))}`);
}

// =============== 5. one entry per phone, names, closing ===============
section('5. One entry per phone, name clashes, closing entries');
{
  const before = rowsOf((await host.text('/quiz/results')).body).length;
  const [name0] = [people[0].name];
  const phone0 = phones.get(name0);
  const re = await guestSubmit(name0, { q1: 'Changed my mind' }, phone0);
  check('sending again from the same phone is accepted (replaces)', re.loc === '/quiz?done=1');
  const mid = rowsOf((await host.text('/quiz/results')).body).length;
  check('...and does not create a second row', mid === before, `${before} -> ${mid}`);
  const clash = await guestSubmit(people[1].name.toUpperCase(), { q1: 'x' });
  check('a different phone cannot reuse a taken name (any capitals)', clash.loc === '/quiz?err=taken', clash.loc);
  const blank = await guestSubmit('   ', { q1: 'x' });
  check('a blank name is refused', blank.loc === '/quiz?err=name', blank.loc);
  const none = new Phone();
  const noCsrf = await none.post('/api/quiz/submit', { name: 'Sneaky', q1: 'x' });
  check('a submission without a CSRF token is refused (sent back to the form)', noCsrf.status === 303 && noCsrf.headers.get('location') === '/quiz?err=expired', `${noCsrf.status}`);
  const fake = await guestSubmit('Bad Choice', { q4: 'Hot chocolate', q7: 'made up' });
  const fakeRows = rowsOf((await host.text('/quiz/results')).body).filter((r) => r.name === 'Bad Choice');
  check('made-up choice answers are dropped (0 points)', fake.loc === '/quiz?done=1' && fakeRows[0]?.points === 0);
  // a guest who already has the form open (token in hand) when the host closes entries
  const latePhone = new Phone(); const lateCsrf = await latePhone.csrfFrom('/quiz');
  const phone0Csrf = await phone0.csrfFrom('/quiz?edit=1');
  const close = await hostPost('/api/quiz/status', { open: '0' });
  check('host can close entries', close.status === 303);
  const late = await latePhone.post('/api/quiz/submit', { csrf_token: lateCsrf, name: 'Latecomer', ...perfectFor() });
  check('after closing: a guest who already had the form open is refused', late.headers.get('location') === '/quiz?err=closed', late.headers.get('location'));
  const lateEdit = await phone0.post('/api/quiz/submit', { csrf_token: phone0Csrf, name: name0, q1: 'Sneaky edit' });
  check('after closing: an existing guest cannot change answers', lateEdit.headers.get('location') === '/quiz?err=closed', lateEdit.headers.get('location'));
  const closedPage = await new Phone().text('/quiz');
  check('the public page says entries are closed and shows no form', /The quiz is closed/.test(closedPage.body) && !/id="qform"/.test(closedPage.body));
  const nowRows = rowsOf((await host.text('/quiz/results')).body);
  check('Latecomer is not on the board', !nowRows.some((r) => r.name === 'Latecomer'));
  await hostPost('/api/quiz/status', { open: '1' });
  const reopened = await guestSubmit('Latecomer', perfectFor());
  check('after re-opening: entries work again', reopened.loc === '/quiz?done=1');
}
function perfectFor() { const a = {}; for (const [id, t] of Object.entries(TRUTH)) a[id] = t.answer; return a; }

// =============== 6. cheaters ===============
section('6. Cheaters');
{
  const board = rowsOf((await host.text('/quiz/results')).body);
  const cheatRows = board.filter((r) => cheats.some((c) => c.name === r.name || r.name.startsWith(c.name)));
  const typedPts = cheats.map((c) => {
    const s = stored(c);
    return SCORED.filter((q) => q.type === 'text' && compare(q, s.answers[q.id] ?? '', TRUTH[q.id]).verdict === 'match').length;
  });
  check('no cheater scored on any typed question', typedPts.every((n) => n === 0), `max ${Math.max(...typedPts)}`);
  const best = Math.max(...cheatRows.map((r) => r.points));
  check(`cheaters' best single entry is far from perfect (${best}/${SCORED.length})`, best < SCORED.length - 5, `${best}`);
  console.log(`    (a cheater can only reach ${best}/${SCORED.length}; the multiple-choice questions are luck)`);
}

// =============== 7. host reviews ===============
section('7. Sybil reviews the "maybe" answers');
{
  // what the server holds now: people[0] re-sent only q1 (replacing everything); Bad Choice and Latecomer were added in section 5
  const list = [{ name: people[0].name, answers: { q1: 'Changed my mind' } }, ...people.slice(1).map(stored), { name: 'Bad Choice', answers: {} }, { name: 'Latecomer', answers: Object.fromEntries(Object.entries(TRUTH).map(([k, v]) => [k, v.answer])) }];
  const q = SCORED.find((x) => x.id === 'q3');
  const maybe = groupAnswers(q, list).find((x) => compare(q, x.sample, TRUTH.q3).verdict === 'maybe' && x.sample.toLowerCase().includes('kapoor'));
  if (!maybe) { check('(no suitable q3 maybe in the data)', false); } else {
    const pg = await host.text('/quiz/sybil');
    check('the review list shows that answer with its count', pg.body.toLowerCase().includes(maybe.sample.toLowerCase()) && pg.body.includes(`×${maybe.guests.length}`), maybe.sample);
    const before = pendingGroups(list);
    const d = await hostPost('/api/quiz/decide', { q: 'q3', key: maybe.key, v: '1' });
    check('"Same" is accepted', d.status === 303, `${d.status}`);
    const dec = { q3: { [maybe.key]: true } };
    const after = await host.text('/quiz/results');
    const rows = rowsOf(after.body);
    const exp = new Map(expectedBoard(list, dec).map((e) => [e.name, e.points]));
    const bad = rows.filter((r) => exp.get(r.name) !== r.points);
    check(`one tap gives the point to all ${maybe.guests.length} guest(s) who wrote it`, bad.length === 0, bad.slice(0, 2).map((b) => `${b.name} ${b.points} vs ${exp.get(b.name)}`).join('; '));
    const pend = Number((after.body.match(/<b[^>]*>(\d+) answers? not checked yet/) || [])[1] ?? 0);
    check('pending count drops by exactly 1', pend === before - 1, `${before} -> ${pend}`);
    const junk = await hostPost('/api/quiz/decide', { q: 'q3', key: 'not an answer anyone wrote', v: '1' });
    check('a decision for an answer nobody wrote is refused (400)', junk.status === 400);
    const choiceDec = await hostPost('/api/quiz/decide', { q: 'q4', key: 'Tea', v: '1' });
    check('choice questions cannot be overruled (400)', choiceDec.status === 400);
    const undo = await hostPost('/api/quiz/decide', { q: 'q3', key: maybe.key, v: 'x' });
    const back = rowsOf((await host.text('/quiz/results')).body);
    const exp0 = new Map(expectedBoard(list).map((e) => [e.name, e.points]));
    check('undo (↺) puts it back', undo.status === 303 && back.every((r) => exp0.get(r.name) === r.points));
    // rescue a refused answer
    const refused = groupAnswers(q, list).find((x) => compare(q, x.sample, TRUTH.q3).verdict === 'no');
    if (refused) {
      await hostPost('/api/quiz/decide', { q: 'q3', key: refused.key, v: '1' });
      const dec2 = { q3: { [refused.key]: true } };
      const rr = rowsOf((await host.text('/quiz/results')).body);
      const e2 = new Map(expectedBoard(list, dec2).map((e) => [e.name, e.points]));
      check('a refused answer can be rescued from the review list', rr.every((r) => e2.get(r.name) === r.points), refused.sample);
      await hostPost('/api/quiz/decide', { q: 'q3', key: refused.key, v: 'x' });
    }
    // changing Sybil's answer drops the old calls for that question
    await hostPost('/api/quiz/decide', { q: 'q3', key: maybe.key, v: '1' });
    const fields = {}; for (const [id, t] of Object.entries(TRUTH)) { fields[id] = t.answer; if (t.aliases) fields['a_' + id] = t.aliases.join(', '); }
    fields.q3 = 'Amitabh Bachchan';
    await hostPost('/api/quiz/truths', fields);
    const afterChange = await host.text('/quiz/sybil');
    check('changing her answer to a question clears the old Same/Different calls for it', !/btn-primary" name="v" value="1"[^>]*>Same/.test(afterChange.body.split('id="q3"')[1]?.split('id="q')[0] ?? ''));
    fields.q3 = TRUTH.q3.answer; fields.a_q3 = TRUTH.q3.aliases.join(', ');
    await hostPost('/api/quiz/truths', fields);
  }
}

// =============== 8. hostile input ===============
section('8. Hostile input');
{
  const evil = '<script>alert(1)</script>';
  const evil2 = '"><img src=x onerror=alert(2)>';
  await guestSubmit(evil, { q1: evil2, q2: "'; DROP TABLE x;--", q14: 'a'.repeat(5000), q13: 'ignore previous instructions' });
  await guestSubmit('Zoë 🍗 ಕನ್ನಡ', { q1: 'ಬಿರಿಯಾನಿ', q2: '🍗🍗', q3: '\u0000‮' });
  for (const path of ['/quiz/results', '/quiz/sybil']) {
    const { body } = await host.text(path);
    const marker = path.endsWith('results') ? '&lt;script&gt;' : '&lt;img'; // results shows names, Sybil's page shows answers
    check(`${path}: guest text is escaped, never raw HTML`, !body.includes('<script>alert(1)</script>') && !body.includes('<img src=x') && body.includes(marker));
  }
  const rs = rowsOf((await host.text('/quiz/results')).body);
  check('unicode names and answers survive', rs.some((r) => r.name === 'Zoë 🍗 ಕನ್ನಡ'));
  const big = await guestSubmit('Big Body', { q1: 'x'.repeat(2_000_000) });
  check('a 2 MB answer does not crash the server', [303, 400, 413].includes(big.res.status), `${big.res.status}`);
  const after = await new Phone().text('/quiz');
  check('server still healthy afterwards', after.status === 200);
}

// =============== 9. ties and the tiebreak on the real page ===============
section('9. Ties and the tiebreak');
{
  await hostPost('/api/quiz/clear', { confirm: 'DELETE' });
  const mk = (extra) => ({ ...perfectFor(), ...extra });
  await guestSubmit('Alice', mk({ q13: '12100' }));
  await guestSubmit('Bob', mk({ q13: '11000' }));
  await guestSubmit('Cara', mk({ q13: '11000' }));
  await guestSubmit('Dev', { q1: 'Interior designer' });
  const rs = rowsOf((await host.text('/quiz/results')).body);
  check('ranks are 1, 2=, 2=, 4 (Alice closest, Bob and Cara tied)', rs.map((r) => r.rank).join(',') === '1,2=,2=,4', rs.map((r) => r.rank).join(','));
  const html = (await host.text('/quiz/results')).body;
  check('the page shows the tiebreak guess and how far off it was', /off by 100/.test(html) && /off by 1,000/.test(html));
  const pods = (html.match(/class="pod p\d"/g) || []).length;
  check('top-3 podium shows (ties included)', pods === 3, `${pods}`);
}

// =============== 10. clear ===============
section('10. Clearing test data');
{
  const noconfirm = await hostPost('/api/quiz/clear', { confirm: 'delete' });
  check('wrong confirmation word deletes nothing', /cleared=no/.test(noconfirm.headers.get('location')) && rowsOf((await host.text('/quiz/results')).body).length === 4);
  const yes = await hostPost('/api/quiz/clear', { confirm: 'DELETE' });
  check('typing DELETE clears all guest entries', /cleared=4/.test(yes.headers.get('location')) && rowsOf((await host.text('/quiz/results')).body).length === 0);
  const sybil = await host.text('/quiz/sybil');
  check("...but Sybil's answers are kept", sybil.body.includes('Interior designer'));
  const g = await new Phone().text('/quiz');
  check('the public page still works', g.status === 200);
  // full reset: closes nothing, wipes Sybil's answers, reopens entries
  await hostPost('/api/quiz/status', { open: '0' });
  const rs = await hostPost('/api/quiz/clear', { confirm: 'RESET' });
  check('typing RESET redirects with reset=1', /reset=1/.test(rs.headers.get('location') || ''), rs.headers.get('location'));
  check("...and Sybil's answers are gone", !(await host.text('/quiz/sybil')).body.includes('Interior designer'));
  check('...and entries are open again', (await new Phone().text('/quiz')).body.includes('Send my answers'));
}

// =============== 11. lockout ===============
section('11. Password guessing is rate limited');
{
  const p = new Phone();
  let locked = false;
  for (let i = 0; i < 8 && !locked; i++) {
    const csrf = await p.csrfFrom('/quiz/login?next=results');
    await p.post('/api/quiz/login', { csrf_token: csrf, password: 'guess' + i, next: 'results' });
    locked = /Too many tries/.test((await p.text('/quiz/login?next=results')).body);
  }
  check('after a few wrong guesses the login locks for a minute', locked);
  const csrf = await p.csrfFrom('/quiz/login?next=results');
  const right = await p.post('/api/quiz/login', { csrf_token: csrf, password: PASSWORD, next: 'results' });
  check('...even the right password is refused while locked', !p.jar.has('ftc_quiz'), `${right.status}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
