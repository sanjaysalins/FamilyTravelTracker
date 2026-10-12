// Scores the pretend guests (q2batch*.json) against the final 13 questions. Run: node score2.cjs [list]
const Q = require('../quiz-match.cjs'), fs = require('fs'), path = require('path');
const ctx = {}; new Function('localStorage','document','ctx', fs.readFileSync(path.join(__dirname,'../questions.js'),'utf8').replace(/^var Q =/m,'ctx.Q =').split('var KEY')[0])({getItem(){return null}}, {}, ctx);
const qs = ctx.Q;
// Sybil's invented test answers + the "also OK" list she would reasonably write for the text questions
const tr = {
  q1:{answer:'Interior designer',aliases:['Designer','Architect','Interior decorator']},
  q2:{answer:'Pani puri',aliases:['Golgappa','Puchka','Gol gappa']},
  q3:{answer:'Rishi Kapoor',aliases:['Rishi','Chintu']},
  q4:{answer:'Tea'}, q5:{answer:'Hand sanitizer',aliases:['Sanitizer','Hand sanitiser','Sanitiser']},
  q6:{answer:'A house',aliases:['House','Home','Flat','Villa','Apartment']},
  q7:{answer:'Calmly explains why surgery is needed'}, q8:{answer:'Early clinic tomorrow'}, q9:{answer:'Sleeping in and resting'},
  q10:{answer:'Family group chats'}, q11:{answer:'Studious topper'}, q12:{answer:'Still 25 inside!'}, q13:{answer:'12000'}};
let all = [];
for (const f of fs.readdirSync(__dirname).filter(f => /^q2batch\d+\.json$/.test(f))) all = all.concat(JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8')));
const c = {}, bad = [], per = {};
for (const g of all) for (const q of qs) {
  if (q.tiebreak) continue;
  const a = g.answers[q.id]; if (a == null) continue;
  const v = a === '' ? 'no' : Q.compare(q, a, tr[q.id]).verdict, m = g.meant[q.id] ? 'meant' : 'notmeant';
  c[m+'/'+v] = (c[m+'/'+v]||0)+1; (per[q.id] = per[q.id]||{})[m+'/'+v] = ((per[q.id]||{})[m+'/'+v]||0)+1;
  if ((m==='meant'&&v!=='match')||(m==='notmeant'&&v!=='no')) bad.push(m+' | '+v+' | '+q.id+' | '+JSON.stringify(a));
}
console.log('guests', all.length); console.log(c);
if (process.argv[2]==='list') console.log(bad.join('\n'));
const rows = all.map(g => Q.scoreGuest(qs, g, tr, {})).sort((a,b)=>b.points-a.points||a.tieDiff-b.tieDiff);
console.log('top 3:', rows.slice(0,3).map(r=>r.name+' '+r.points+' (tie '+r.tieDiff+')').join(', '));
module.exports = {all, tr, qs};
