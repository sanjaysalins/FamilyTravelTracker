// Re-score the pretend guests. Usage: node score.cjs [withAliases]
const Q = require('../quiz-match.cjs'), fs = require('fs'), path = require('path');
const qs = [{id:'q1',type:'text'},{id:'q2',type:'text'},{id:'q3',type:'number',tolerance:0},{id:'q4',type:'choice'},{id:'q5',type:'text'}];
const al = process.argv[2] === 'withAliases';
const tr = {
  q1:{answer:'Butter chicken', aliases: al ? ['Murgh makhani','Butter chicken masala','chicken butter masala'] : []},
  q2:{answer:'Coorg', aliases: al ? ['Kodagu','Madikeri'] : []},
  q3:{answer:'40'}, q4:{answer:'Tea'},
  q5:{answer:'Mercedes-Benz', aliases: al ? ['Mercedes','Merc','Benz'] : []}};
let all = [];
for (let i = 1; i <= 5; i++) all = all.concat(JSON.parse(fs.readFileSync(path.join(__dirname, 'batch'+i+'.json'), 'utf8')));
const c = {}, bad = [];
for (const g of all) for (const q of qs) {
  const a = g.answers[q.id]; if (a == null) continue;
  const v = a === '' ? 'no' : Q.compare(q, a, tr[q.id]).verdict, m = g.meant[q.id] ? 'meant' : 'notmeant';
  c[m+'/'+v] = (c[m+'/'+v]||0)+1;
  if ((m==='meant'&&v!=='match')||(m==='notmeant'&&v!=='no')) bad.push(m+' | '+v+' | '+q.id+' | '+JSON.stringify(a));
}
console.log(c); console.log(bad.join('\n'));
