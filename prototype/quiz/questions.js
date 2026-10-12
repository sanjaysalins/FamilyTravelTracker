// Shared by the guest, Sybil and scores pages. 12 scored questions + 1 tiebreaker (closest guess wins ties).
// Choice OPTIONS are suggestions - Sybil/host should edit them to fit her.
var Q = [
 {id:'q1',  text:"If she were NOT an eye doctor, what profession would she have chosen?", type:'text'},
 {id:'q2',  text:"What food can she never say no to?", type:'text'},
 {id:'q3',  text:"Who was her film-star crush growing up?", type:'text'},
 {id:'q4',  text:"Her daily drink?", type:'choice', options:['Tea','Coffee','Both','Neither']},
 {id:'q5',  text:"If we emptied her handbag, what unexpected item would we find the MOST of?", type:'text'},
 {id:'q6',  text:"If she won ₹1 crore tomorrow, what would be her FIRST big purchase?", type:'text'},
 {id:'q7',  text:"A patient says \"Doctor, just give me drops, I don't want surgery.\" Her reaction?", type:'choice', options:['Calmly explains why surgery is needed','Gives the drops, with a warning','Sighs and gives "that look"','Tells a story about another patient']},
 {id:'q8',  text:"She wants to leave a late-night function early. Her go-to excuse?", type:'choice', options:['Early clinic tomorrow','Headache','Tired / long day','Just says goodbye and goes']},
 {id:'q9',  text:"A rare, completely free Sunday in Bidar. How does she spend it?", type:'choice', options:['Sleeping in and resting','Cooking / feeding the family','Shopping or outing','Catching up with friends and phone calls']},
 {id:'q10', text:"How does she mostly use WhatsApp?", type:'choice', options:['Family group chats','Forwards and good-morning messages','Voice notes','Photos and videos']},
 {id:'q11', text:"What was she MOST like as a young girl?", type:'choice', options:['Studious topper','Naughty prankster','Quiet dreamer','Bossy leader']},
 {id:'q12', text:"Her honest attitude to turning 60?", type:'choice', options:['Proud and happy','Still 25 inside!','Please don\'t mention it','Ready to slow down']},
 {id:'q14', text:"Sybil's famous dish - the one everyone asks for at every gathering?", type:'text'},
 {id:'q15', text:"What does Sybil say most often?", type:'choice', options:['"Have you eaten?"','"Wear your glasses properly!"','"I told you so."','"Just five minutes more."']},
 {id:'q16', text:"If Sybil got one superpower tomorrow, she would pick:", type:'choice', options:['X-ray vision (obviously)','Being in Bidar and Bangalore at the same time','Never needing sleep','Making every relative answer the phone on the first ring']},
 {id:'q17', text:"It is 5:30 am. Where is Sybil?", type:'choice', options:['Fast asleep, phone on silent','Already dressed, already on the phone to the hospital','Walking laps of the compound like it is a race','Watering the plants and giving them instructions']},
 {id:'q13', text:"TIEBREAKER - closest guess wins: how many eye surgeries has she done in her career?", type:'number', tiebreak:true},
];
var KEY = 'sybilquiz';
var S = JSON.parse(localStorage.getItem(KEY) || 'null') || {guests:[], truths:{}, decisions:{}};
var save = function(){ localStorage.setItem(KEY, JSON.stringify(S)); };
var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

function input(q, prefix){
  var id = prefix + q.id;
  if (q.type === 'choice') return q.options.map(function(o){ return '<label class="opt"><input type="radio" name="'+id+'" value="'+esc(o)+'"> '+esc(o)+'</label>'; }).join('');
  return '<input '+(q.type==='number'?'type="number" inputmode="numeric"':'type="text"')+' id="'+id+'">';
}
function val(q, prefix){
  if (q.type === 'choice'){ var c = document.querySelector('input[name="'+prefix+q.id+'"]:checked'); return c ? c.value : ''; }
  return $(prefix+q.id).value.trim();
}
