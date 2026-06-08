/* ============================================================
   Family Travel Coordinator — prototype data layer (browser only)
   Mirrors the PRD model: registrations → legs, and a separate
   cross-family vehicle_bookings store. Persists to localStorage.
   ============================================================ */

const VEHICLES = [
  ['car','Car',4],
  ['suv_innova','Innova',7],
  ['tempo_traveller','Tempo Traveller',12],
  ['minibus','Minibus',20],
  ['other','Other',0],
];
const vlabel = t => (VEHICLES.find(v=>v[0]===t)||['','—',0])[1];
const vseats = t => (VEHICLES.find(v=>v[0]===t)||['','',0])[2];
function pickVehicle(p){ for(const [t,,s] of VEHICLES){ if(s>=p && s>0) return [t,s]; } return ['minibus',20]; }

/* ---- seed (dummy) data ---- */
function seed(){
  return {
    seq: 0,
    regs: [
      { ref:'BDAY-2026-0042', family:'Khan', contact:'Rashid Khan', phone:'+91 98765 43210', people:4, reviewed:true, legs:[
        { id:'0042-A', dir:'arrival',   from:'Hyderabad Airport', to:'Bidar', date:'2026-10-16', time:'10:15', flight:'6E 7123', people:4, need:true, bookingId:null },
        { id:'0042-I', dir:'internal',  from:'Bidar', to:'Gulbarga', date:'2026-10-18', time:'09:30', flight:'', people:2, need:true, bookingId:null },
        { id:'0042-D', dir:'departure', from:'Bidar', to:'Hyderabad Airport', date:'2026-10-19', leaveBy:'07:00', flightOut:'6E 7124 · 12:10', people:4, need:true, bookingId:null },
      ]},
      { ref:'BDAY-2026-0041', family:'Mathew', contact:'Sara Mathew', phone:'+91 90000 22222', people:2, legs:[
        { id:'0041-A', dir:'arrival',   from:'Hyderabad Airport', to:'Bidar', date:'2026-10-16', time:'10:30', flight:'AI 560', people:2, need:true, bookingId:null },
        { id:'0041-D', dir:'departure', from:'Bidar', to:'Hyderabad Airport', date:'2026-10-19', leaveBy:'07:15', flightOut:'AI 561 · 12:30', people:2, need:true, bookingId:null },
      ]},
      { ref:'BDAY-2026-0040', family:'George', contact:'George P.', phone:'+44 7700 900123', people:6, legs:[
        { id:'0040-A', dir:'arrival',   from:'Hyderabad Airport', to:'Bidar', date:'2026-10-16', time:'10:50', flight:'EK 524', people:6, need:true, bookingId:null },
        { id:'0040-D', dir:'departure', from:'Bidar', to:'Hyderabad Airport', date:'2026-10-19', leaveBy:'06:30', flightOut:'EK 525 · 11:40 (intl)', people:6, need:true, bookingId:null },
      ]},
      { ref:'BDAY-2026-0039', family:'Fatima', contact:'Fatima B.', phone:'+971 50 123 4567', people:3, legs:[
        { id:'0039-A', dir:'arrival',   from:'Hyderabad Airport', to:'Bidar', date:'2026-10-16', time:'14:00', flight:'6E 333', people:3, need:true, bookingId:null },
      ]},
      { ref:'BDAY-2026-0038', family:"D'Souza", contact:"Tom D'Souza", phone:'+91 91111 33333', people:2, legs:[
        { id:'0038-A', dir:'arrival',   from:'Bidar Railway Station', to:'Bidar (hotel)', date:'2026-10-16', time:'09:00', flight:'Train 17013', people:2, need:true, bookingId:null },
      ]},
      { ref:'BDAY-2026-0037', family:'Pereira', contact:'Joan Pereira', phone:'+91 90909 12345', people:3, legs:[
        { id:'0037-A', dir:'arrival', from:'Hyderabad Airport', to:'Bidar', date:null, tbc:true, time:'', flight:'', people:3, need:true, bookingId:null },
      ]},
    ],
    bookings: [],   // VehicleBooking[]
  };
}

/* ---- persistence ---- */
const KEY='ftc_demo_v1';
let STATE = load();
function load(){ try{ const s=localStorage.getItem(KEY); return s?JSON.parse(s):seed(); }catch(e){ return seed(); } }
function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)); }
function resetDemo(){ STATE=seed(); save(); }

/* ---- helpers ---- */
function allLegs(){
  const out=[];
  STATE.regs.forEach(r=>r.legs.forEach(l=>out.push(Object.assign(l,{ref:r.ref, family:r.family, phone:r.phone}))));
  return out;
}
function legById(id){ return allLegs().find(l=>l.id===id); }
function mins(t){ if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; }
function sortTime(l){ return l.dir==='departure' ? (l.leaveBy||'00:00') : (l.time||'12:00'); }
const INR = n => '₹'+(Number(n)||0).toLocaleString('en-IN');
const dmy = iso => { const [y,m,d]=iso.split('-'); return d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]+' '+y; };

/* ---- clustering → suggestions (unbooked legs only) ---- */
function suggestions(){
  // only legs we can actually plan a vehicle for: needs transport, not booked, has a real date
  const open = allLegs().filter(l=>l.need && !l.bookingId && l.date && !l.tbc);
  const groups={};
  open.forEach(l=>{ const k=[l.dir,l.date,l.from,l.to].join('||'); (groups[k]=groups[k]||[]).push(l); });
  const out=[];
  Object.values(groups).forEach(g=>{
    g.sort((a,b)=>sortTime(a).localeCompare(sortTime(b)));
    let cur=[g[0]];
    for(let i=1;i<g.length;i++){
      if(mins(sortTime(g[i]))-mins(sortTime(cur[cur.length-1]))<=60) cur.push(g[i]);
      else { out.push(cur); cur=[g[i]]; }
    }
    out.push(cur);
  });
  return out.map(g=>{
    const people=g.reduce((s,l)=>s+l.people,0);
    const [vt,seats]=pickVehicle(people);
    const dir=g[0].dir;
    const depart = dir==='departure' ? sortTime(g[0]) : sortTime(g[g.length-1]); // dep: earliest leave; arr: last to land
    return { legs:g, people, vehicle_type:vt, seats, depart, dir, date:g[0].date, from:g[0].from, to:g[0].to };
  }).sort((a,b)=> (a.date+a.depart).localeCompare(b.date+b.depart));
}

/* ---- create / edit bookings ---- */
function newId(){ STATE.seq++; return 'VEH-2026-'+String(STATE.seq).padStart(4,'0'); }
function createBooking(sug){
  const id=newId();
  const b={
    id, date:sug.date, purpose:sug.dir, route_from:sug.from, route_to:sug.to, depart_time:sug.depart,
    vehicle_type:sug.vehicle_type, seats:sug.seats,
    operator_name:'', operator_contact:'', quote_amount:null, currency:'INR',
    driver_name:'', driver_phone:'', vehicle_reg:'', status:'to_book',
    covered: sug.legs.map(l=>({ref:l.ref, leg_id:l.id, family:l.family, people:l.people, phone:l.phone})),
    notes:'',
  };
  sug.legs.forEach(l=>{ legById(l.id).bookingId=id; });
  STATE.bookings.push(b); save(); return b;
}
function deleteBooking(id){
  allLegs().forEach(l=>{ if(l.bookingId===id) l.bookingId=null; });
  STATE.bookings = STATE.bookings.filter(b=>b.id!==id); save();
}
function updateBooking(id, patch){
  const b=STATE.bookings.find(x=>x.id===id); if(!b) return;
  Object.assign(b, patch);
  // assigning a driver copies it onto covered legs (the family email cache)
  if('driver_name' in patch || 'driver_phone' in patch){
    b.covered.forEach(c=>{ const l=legById(c.leg_id); if(l){ l.driver_name=b.driver_name; l.driver_phone=b.driver_phone; } });
  }
  save();
}
function bookingPeople(b){ return b.covered.reduce((s,c)=>s+c.people,0); }

/* ---- admin "what needs you" task counts + lists ---- */
function carrier(l){ return l.dir==='departure' ? l.flightOut : l.flight; }
function chaseLegs(){ return allLegs().filter(l=>l.need && l.dir!=='internal' && (l.tbc || !l.date || !carrier(l))); }
function needDriverBookings(){ return STATE.bookings.filter(b=>b.status!=='cancelled' && !b.driver_name); }
function confirmableBookings(){ return STATE.bookings.filter(b=>b.driver_name && b.status==='assigned'); }
function unreviewedRegs(){ return STATE.regs.filter(r=>!r.reviewed); }
function adminTasks(){
  return {
    review:  { n: unreviewedRegs().length,     title:'New registrations to review',  sub:'Check details look complete',           href:'admin-list.html' },
    book:    { n: suggestions().length,          title:'Pickups ready to book a vehicle', sub:'Accept the suggested groupings',     href:'admin-reports.html' },
    driver:  { n: needDriverBookings().length,   title:'Vehicles need a driver',       sub:'Assign driver, phone and reg',          href:'admin-assign.html' },
    confirm: { n: confirmableBookings().length,  title:'Families ready to confirm',    sub:'Send the pickup details (no cost)',     href:'admin-confirm.html' },
    chase:   { n: chaseLegs().length,            title:'Missing flight / date info',   sub:'Ask the family to fill it in',          href:'admin-list.html' },
  };
}
