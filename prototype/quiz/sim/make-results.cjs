// Builds results.html from the pretend guests (static page, no browser needed to generate).
const Q = require('../quiz-match.cjs'), fs = require('fs'), path = require('path');
const qs = [{id:'q1',t:'Food',type:'text'},{id:'q2',t:'Place',type:'text'},{id:'q3',t:'Age',type:'number',tolerance:0},{id:'q4',t:'Tea/Coffee',type:'choice'},{id:'q5',t:'Car',type:'text'}];
const tr = {q1:{answer:'Butter chicken',aliases:['Murgh makhani','Butter chicken masala','chicken butter masala']},q2:{answer:'Coorg',aliases:['Kodagu','Madikeri']},q3:{answer:'40'},q4:{answer:'Tea'},q5:{answer:'Mercedes-Benz',aliases:['Mercedes','Merc','Benz']}};
let all = [];
for (let i = 1; i <= 5; i++) all = all.concat(JSON.parse(fs.readFileSync(path.join(__dirname,'batch'+i+'.json'),'utf8')));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rows = all.map(g => {
  const cells = qs.map(q => { const a = g.answers[q.id] || ''; const v = a === '' ? 'no' : Q.compare(q,a,tr[q.id]).verdict; return {a,v,meant:g.meant[q.id]}; });
  return {name:g.name, cells, pts:cells.filter(c=>c.v==='match').length, maybes:cells.filter(c=>c.v==='maybe').length};
}).sort((a,b)=>b.pts-a.pts||a.maybes-b.maybes);
const mark = v => v==='match'?'✓':v==='maybe'?'?':'✗';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quiz test results</title><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../quiz.css">
<style>td.a{font-size:.85rem;vertical-align:top} .big{font-size:2rem;font-weight:800;margin:0} .grid{display:flex;gap:10px;flex-wrap:wrap} .grid .card{flex:1;min-width:140px;text-align:center}</style></head>
<body><div class="wrap wrap-wide">
<div class="hero"><div class="kicker">Test run · 40 pretend guests</div><h1>Quiz results</h1>
<p>Sybil's secret answers: <b>Butter chicken · Coorg · 40 · Tea · Mercedes-Benz</b></p></div>
<div class="grid">
<div class="card"><p class="big" style="color:var(--ok)">85 / 86</p>wrong answers correctly refused</div>
<div class="card"><p class="big" style="color:var(--ok)">94 / 114</p>right answers got the point on their own</div>
<div class="card"><p class="big" style="color:var(--warn)">17</p>"maybe" answers for Sybil to tap</div>
<div class="card"><p class="big" style="color:var(--danger)">3</p>right answers missed (Kurg, Cuorg, cuarenta)</div></div>
<p class="muted">✓ point · ? waiting for Sybil's tap (counts 0 for now) · ✗ no point. Words in grey are what the guest typed.</p>
<div class="card"><table>${rows.map((r,i)=>`<tr><td class="rank">${i+1}</td><td><b>${esc(r.name)}</b><br><span class="muted">${r.pts} points${r.maybes?` · ${r.maybes} to check`:''}</span></td>
${r.cells.map((c,j)=>`<td class="a"><span class="pill ${c.v}">${mark(c.v)}</span><br><span class="muted">${esc(c.a)||'—'}</span></td>`).join('')}</tr>`).join('')}</table></div>
</div></body></html>`;
fs.writeFileSync(path.join(__dirname,'results.html'), html);
console.log(rows.slice(0,5).map(r=>r.name+' '+r.pts).join(', '));
