// Pickup plan data + pure helpers for /pickups. The plan itself (who, where, when) is fixed data here;
// only the driver details (name, phone, car reg) are editable at runtime and live in the `system` store.
// Ids are stable ("p<old group no.>") so saved driver details survive renumbering.

export interface PickupContact { name: string; phone: string }
export interface Pickup {
  id: string; place: string; family: string; day: number; weekday: string;
  time: string; // "h:mm AM/PM", local time at the pickup place
  people: number; car: string; contacts: PickupContact[];
}
export const DRIVERS_KEY = 'pickup_drivers'; // system-store key holding the DriverMap
export interface DriverInfo { name: string; phone: string; reg: string; updated_at: string; by: 'driver' | 'admin' }
export type DriverMap = Record<string, DriverInfo>;
export interface NumberedPickup extends Pickup { group: number }

export const PICKUPS: Pickup[] = [
  { id: 'p0', place: "Hotel Novotel Hyderabad (near airport)", family: "Theresa", day: 12, weekday: 'Mon', time: "10:30 AM", people: 1, car: "Etios", contacts: [{"name":"Theresa Torrance","phone":"+44 7955 792323"}] },
  { id: 'p1', place: "Bidar Station", family: "Tanu + 2", day: 14, weekday: 'Wed', time: "8:45 AM", people: 3, car: "Local", contacts: [] },
  { id: 'p2', place: "Hyderabad Kacheguda", family: "Mali", day: 15, weekday: 'Thu', time: "11:00 PM", people: 1, car: "Etios", contacts: [] },
  { id: 'p3', place: "Bidar Station", family: "Rani's sister + husband", day: 15, weekday: 'Thu', time: "8:30 AM", people: 2, car: "Local", contacts: [] },
  { id: 'p4', place: "Hyderabad Airport", family: "Boby + Serina", day: 15, weekday: 'Thu', time: "6:00 PM", people: 2, car: "Etios", contacts: [{"name":"Serina Salins-Stephen","phone":"+91 94423 07738"}] },
  { id: 'p5', place: "Hyderabad Airport", family: "Sundeep + Jean Maria", day: 16, weekday: 'Fri', time: "6:00 AM", people: 6, car: "Innova", contacts: [{"name":"Sundeep Salins","phone":"+44 7866 367758"},{"name":"Jean Maria Santhosh Pallen","phone":"+971 58 515 2124"}] },
  { id: 'p6', place: "Secunderabad Stations", family: "Madras Group: Sheena + Arun", day: 16, weekday: 'Fri', time: "8:00 AM", people: 7, car: "Innova", contacts: [{"name":"Sheena Sudhakar","phone":"+91 99411 76591"},{"name":"S Arun Paul Christopher","phone":"+91 86810 35174"}] },
  { id: 'p7', place: "Bidar Airport", family: "Chotu + Jaswanth", day: 16, weekday: 'Fri', time: "8:00 AM", people: 8, car: "Local", contacts: [] },
  { id: 'p8', place: "Bidar Station", family: "Srinivasan R + Katherin Aunty + Leena", day: 16, weekday: 'Fri', time: "8:00 AM", people: 3, car: "Local", contacts: [{"name":"Srinivasan R","phone":"+91 98452 83359"}] },
  { id: 'p15', place: "Bus Station", family: "Dilshad + husband", day: 16, weekday: 'Fri', time: "8:00 AM", people: 2, car: "Local", contacts: [{"name":"Dilshad M","phone":"+91 91088 86708"}] },
  { id: 'p9', place: "Bidar Station", family: "Helen Jesie", day: 16, weekday: 'Fri', time: "8:45 AM", people: 5, car: "Local", contacts: [{"name":"Sieti Immanuel","phone":"+91 99722 22611"},{"name":"Helen Jesie","phone":"+91 99001 37691"}] },
  { id: 'p10', place: "Hyderabad Hotel (Necklace / Treebo Seven Lakeview)", family: "Olga Group", day: 16, weekday: 'Fri', time: "9:00 AM", people: 9, car: "Innova + Etios", contacts: [{"name":"Olga David","phone":"+91 91829 31170"}] },
  { id: 'p11', place: "Hyderabad Airport", family: "Thamma Fly", day: 16, weekday: 'Fri', time: "9:00 AM", people: 5, car: "Innova", contacts: [] },
  { id: 'p16', place: "Hyderabad Airport", family: "Marina, Uncle, Kasthuri + Winya + Sughandi", day: 16, weekday: 'Fri', time: "1:00 PM", people: 5, car: "2 Etios", contacts: [{"name":"Kasthuri Rajaretnam","phone":"+91 98408 20508"}] },
  { id: 'p12', place: "Hyderabad Airport", family: "Sheena, Anita, Mallika + Pastor Joe + wife", day: 16, weekday: 'Fri', time: "1:30 PM", people: 5, car: "Innova + Etios", contacts: [{"name":"Sheena George","phone":"+91 99102 72031"},{"name":"Anita","phone":"+91 88473 83906"}] },
  { id: 'p13', place: "Hyderabad Airport", family: "Anil and Sanjay", day: 16, weekday: 'Fri', time: "4:00 PM", people: 6, car: "Innova", contacts: [{"name":"Sanjay Anil","phone":"+44 7920 744120"}] },
  { id: 'p14', place: "Hyderabad Airport", family: "Indu", day: 16, weekday: 'Fri', time: "5:30 PM", people: 1, car: "Etios", contacts: [] },
  { id: 'p17', place: "Bidar Airport", family: "Dr Sam + Beneita", day: 17, weekday: 'Sat', time: "8:00 AM", people: 2, car: "Local", contacts: [] },
  { id: 'p18', place: "Bidar Bus Station", family: "Dr Godfred Victor Singh", day: 17, weekday: 'Sat', time: "8:30 AM", people: 3, car: "Local", contacts: [{"name":"Dr Godfred Victor Singh","phone":"+91 99803 86480"}] },
];

/** Contacts as [name, phone, email]. */
export const CONTACTS: [string, string, string][] = [
  ["Sundeep Salins", "+44 7866 367758", "smsalins@gmail.com"],
  ["Serina Salins-Stephen", "+91 94423 07738", "serinaruthsalins@gmail.com"],
  ["Vineet Meshramkar", "+91 63621 53789", "vineetdm@gmail.com"],
  ["Sheena George", "+91 99102 72031", "georgsheena@gmail.com"],
  ["Sheena Sudhakar", "+91 99411 76591", "sheenasudhakar71@gmail.com"],
  ["Theresa Torrance", "+44 7955 792323", "ttorrance401@gmail.com"],
  ["Olga David", "+91 91829 31170", "ollykupps@rediffmail.com"],
  ["Jaswanth Thomas", "+91 90083 22770", "jaswantht@titan.co.in"],
  ["Indira Agarwal", "+91 98940 25065", "indiraagarwal@cmcvellore.ac.in"],
  ["S Arun Paul Christopher", "+91 86810 35174", "arunpauls@gmail.com"],
  ["Jiji Francis", "+91 79023 38071", "shal0129@yahoo.co.in"],
  ["Rory Kelly", "+61 413 339 935", "rorymichaelkelly@gmail.com"],
  ["Dinakar (Appu) Venkatesh", "+91 96630 33664", "reddy.dinakar@gmail.com"],
  ["Srinivasan R", "+91 98452 83359", "aimjfithom@gmail.com"],
  ["Noel Kotian", "+91 94488 08085", "noelkotian1951@gmail.com"],
  ["Sam Aruputha John", "+91 88702 14240", "samaruputha@yahoo.com"],
  ["Victor S", "+91 98457 16446", "richyrich2k15@gmail.com"],
  ["Anita", "+91 88473 83906", "anitachadha71@gmail.com"],
  ["Sanjay Anil", "+44 7920 744120", "sanjaysalins@gmail.com"],
  ["Mallika Devasahayam", "+91 99948 12981", "mallika_peter@yahoo.co.in"],
  ["Helen Jesie", "+91 99001 37691", "helenjesie@gmail.com"],
  ["Jean Maria Santhosh Pallen", "+971 58 515 2124", "jeanmaria2003@gmail.com"],
  ["Dr Godfred Victor Singh", "+91 99803 86480", "godfredvsingh@gmail.com"],
  ["Dilshad M", "+91 91088 86708", "dilshad1984m@gmail.com"],
  ["Kasthuri Rajaretnam", "+91 98408 20508", "gkasthuriprincette@yahoo.co.in"],
  ["Sieti Immanuel", "+91 99722 22611", "sieti.eco@outlook.com"],
];

export function minutes(t: string): number {
  const m = t.match(/^(\d+):(\d+) (AM|PM)$/);
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
}

export function time24(t: string): string {
  const m = minutes(t);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

const idNum = (id: string) => Number(id.slice(1));

/** Time order (day, then time, then old group no.), numbered 1..n. */
export function orderedPickups(list: Pickup[] = PICKUPS): NumberedPickup[] {
  return [...list]
    .sort((a, b) => a.day - b.day || minutes(a.time) - minutes(b.time) || idNum(a.id) - idNum(b.id))
    .map((p, i) => ({ ...p, group: i + 1 }));
}

export function contactsSorted(): [string, string, string][] {
  const key = (n: string) => n.replace(/^Dr /, '');
  return [...CONTACTS].sort((a, b) => key(a[0]).localeCompare(key(b[0])));
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Clean + validate a driver-details submission. Returns null when the pickup id is unknown. */
export function cleanDriver(id: unknown, name: unknown, phone: unknown, reg: unknown): { id: string; name: string; phone: string; reg: string } | null {
  if (typeof id !== 'string' || !PICKUPS.some((p) => p.id === id)) return null;
  return {
    id,
    name: clip(name, 80),
    phone: clip(phone, 40).replace(/[^0-9+()\-\s]/g, ''),
    reg: clip(reg, 20).toUpperCase(),
  };
}
