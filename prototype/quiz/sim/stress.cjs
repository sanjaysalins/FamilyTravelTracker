const Q = require('../quiz-match.cjs');
const T = {type:'text'}, truth = {answer:'Butter chicken', aliases:['Murgh makhani']};
const v = (a, t = truth, q = T) => Q.compare(q, a, t).verdict;

// 1. SCALE: 5,000 guests x 5 questions, all with long-ish answers
let t0 = Date.now();
const qs = [{id:'q1',type:'text'},{id:'q2',type:'text'},{id:'q3',type:'number'},{id:'q4',type:'choice'},{id:'q5',type:'text'}];
const truths = {q1:truth,q2:{answer:'Coorg'},q3:{answer:'40'},q4:{answer:'Tea'},q5:{answer:'Mercedes-Benz'}};
const words = ['butter','chicken','pizza','coorg','goa','tea','benz','mercedes','x','naan'];
const guests = Array.from({length:5000},(_,i)=>({name:'G'+i,answers:Object.fromEntries(qs.map(q=>[q.id,Array.from({length:1+i%6},(_,k)=>words[(i*7+k*3+q.id.length)%10]).join(' ')]))}));
guests.forEach(g=>Q.scoreGuest(qs,g,truths,{}));
qs.forEach(q=>Q.groupAnswers(q,guests));
console.log('1. scale: 5000 guests scored + grouped in', Date.now()-t0, 'ms');

// 2. HOSTILE / ODD INPUT: nothing may throw, nothing may match by accident
const odd = ['', ' ', '   \n\t', null, undefined, 0, 12345, '😀🍗', '🍗 butter chicken 🍗', '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>',
  "'; DROP TABLE guests;--", 'a'.repeat(100000), 'butter '.repeat(5000), '\u0000‮', 'ＢＵＴＴＥＲ ＣＨＩＣＫＥＮ', 'butter​chicken', 'BUTTER_CHICKEN', 'butter-chicken', 'butter, chicken', '.', '-', '...'];
let threw = 0, rows = [];
t0 = Date.now();
for (const a of odd) { try { rows.push([JSON.stringify(a == null ? a : String(a).slice(0,28)), v(a), Q.compare({type:'number'},a,{answer:'40'}).verdict]); } catch (e) { threw++; rows.push([String(a).slice(0,20),'THREW '+e.message]); } }
console.log('2. odd inputs: threw =', threw, '| took', Date.now()-t0, 'ms'); rows.forEach(r=>console.log('   ', r.join('  →  ')));

// 3. CHEATING: can someone score without knowing the answer?
const cheats = ['butter chicken pizza biryani pasta', 'butter, pizza, biryani, naan, dal, chicken', 'everything', 'anything with chicken', 'chicken', 'butter', 'not butter chicken', 'NOT butter chicken',
  'butter chicken butter chicken butter chicken', 'murgh', 'chicken butter', 'butterchicken', 'b u t t e r chicken'];
console.log('3. cheats against "Butter chicken":'); cheats.forEach(c=>console.log('   ', c.padEnd(46), v(c)));
const nums = ['39 or 40 or 41', '30-50', '4', '400', '40.5', 'around 40', 'forty-ish', 'minus 40', '-40', '4 0'];
console.log('   numbers vs 40:'); nums.forEach(c=>console.log('   ', c.padEnd(46), Q.compare({type:'number'},c,{answer:'40'}).verdict));
// choice: guest sends something not in the options / odd case
console.log('   choice: "tea"→', Q.compare({type:'choice'},'tea',{answer:'Tea'}).verdict, '| "Tea "→', Q.compare({type:'choice'},'Tea ',{answer:'Tea'}).verdict);

// 4. COLLISIONS: different people, different answers must not merge in groups
const gg = Q.groupAnswers(T,[{name:'a',answers:{id:'x'}},{name:'b',answers:{id:'x'}}]);
console.log('4. groupAnswers with missing question id → groups:', gg.length);
// 5. host-decision keys: prototype pollution style
const evil = {name:'__proto__',answers:{q1:'constructor'}};
try { const r = Q.scoreGuest(qs,evil,truths,{q1:{}}); console.log('5. proto-like name/answer ok, points =', r.points); } catch(e){ console.log('5. THREW', e.message); }
