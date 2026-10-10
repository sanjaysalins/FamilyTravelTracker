// Drop-off (leaving party) plan data for /dropoffs. Same shape and look as /pickups; the plan is fixed
// data here (from the organiser's "Leaving Party" sheet). Contacts reuse the CONTACTS list in pickups.ts.
import { minutes, type PickupContact } from './pickups';

export interface Dropoff {
  id: string; place: string; family: string; day: number; weekday: string;
  time: string; // "h:mm AM/PM"
  people: number; car: string; contacts: PickupContact[];
}
export interface NumberedDropoff extends Dropoff { group: number }

const c = (name: string, phone: string): PickupContact => ({ name, phone });

export const DROPOFFS: Dropoff[] = [
  { id: 'd1', place: 'Hyderabad Airport', family: 'Chotu (4) + Jaswant (4)', day: 18, weekday: 'Sun', time: '9:30 AM', people: 8, car: '2 Innova', contacts: [c('Jaswanth Thomas', '+91 90083 22770')] },
  { id: 'd2', place: 'Hyderabad Airport', family: 'Serina (5) + Indu (1) + Dr Sam (3) + Sheena, Anita, Mallika', day: 18, weekday: 'Sun', time: '9:30 AM', people: 12, car: '2 Innova', contacts: [c('Serina Salins-Stephen', '+91 94423 07738'), c('Sheena George', '+91 99102 72031'), c('Anita', '+91 88473 83906'), c('Mallika Devasahayam', '+91 99948 12981')] },
  { id: 'd3', place: 'Bidar Station', family: 'Helen Jesie', day: 18, weekday: 'Sun', time: '2:40 PM', people: 5, car: 'Local', contacts: [c('Sieti Immanuel', '+91 99722 22611'), c('Helen Jesie', '+91 99001 37691')] },
  { id: 'd4', place: 'Hyderabad Hotel', family: 'Theresa', day: 19, weekday: 'Mon', time: '7:45 AM', people: 1, car: 'Etios', contacts: [c('Theresa Torrance', '+44 7955 792323')] },
  { id: 'd5', place: 'Bidar Station', family: 'Olga Group', day: 19, weekday: 'Mon', time: '11:00 AM', people: 9, car: 'Local', contacts: [c('Olga David', '+91 91829 31170')] },
  { id: 'd6', place: 'Bidar Station', family: 'Srinivasan R', day: 19, weekday: 'Mon', time: '11:00 AM', people: 2, car: 'Local', contacts: [c('Srinivasan R', '+91 98452 83359')] },
  { id: 'd7', place: 'Hyderabad Airport', family: 'Marina, Uncle, Kasthuri', day: 19, weekday: 'Mon', time: '5:00 AM', people: 3, car: 'Etios', contacts: [c('Kasthuri Rajaretnam', '+91 98408 20508')] },
  { id: 'd8', place: 'Hyderabad City', family: 'Madras Group: Sheena (3) + Arun (4)', day: 19, weekday: 'Mon', time: '10:00 AM', people: 7, car: 'Innova', contacts: [c('Sheena Sudhakar', '+91 99411 76591'), c('S Arun Paul Christopher', '+91 86810 35174')] },
  { id: 'd9', place: 'Hyderabad Airport', family: 'Pastor Joe', day: 19, weekday: 'Mon', time: '9:30 AM', people: 2, car: 'Etios', contacts: [] },
  { id: 'd10', place: 'Hyderabad Airport', family: 'Jean Maria (Chinkoo friend)', day: 19, weekday: 'Mon', time: '10:00 PM', people: 1, car: 'Etios', contacts: [c('Jean Maria Santhosh Pallen', '+971 58 515 2124')] },
  { id: 'd11', place: 'Bidar Station', family: 'Sundeep', day: 20, weekday: 'Tue', time: '5:30 PM', people: 5, car: 'Local', contacts: [c('Sundeep Salins', '+44 7866 367758')] },
  { id: 'd12', place: 'Bidar Bus Station', family: 'Dr Godfred V Singh', day: 20, weekday: 'Tue', time: '8:00 PM', people: 3, car: 'Local', contacts: [c('Dr Godfred Victor Singh', '+91 99803 86480')] },
  { id: 'd13', place: 'Hyderabad Airport', family: 'Anil (2) + Sanjay (4) + Sybil (3) + Vasantha (2) + Sudgandhi (1)', day: 21, weekday: 'Wed', time: '8:00 AM', people: 12, car: '13 Seater Bus', contacts: [c('Sanjay Anil', '+44 7920 744120')] },
];

const idNum = (id: string) => Number(id.slice(1));

/** Time order (day, then time, then sheet group no.), numbered 1..n — same rule as /pickups. */
export function orderedDropoffs(list: Dropoff[] = DROPOFFS): NumberedDropoff[] {
  return [...list]
    .sort((a, b) => a.day - b.day || minutes(a.time) - minutes(b.time) || idNum(a.id) - idNum(b.id))
    .map((p, i) => ({ ...p, group: i + 1 }));
}
