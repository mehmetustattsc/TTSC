// Who gets which push notification (supabase/functions/notify/logic.js). Run: npm run test:notify
import { plan } from '../supabase/functions/notify/logic.js';

const errors = [];
const check = (c, m) => { if (!c) errors.push('FAIL: ' + m); };
const P = [
  { id: 'a', name: 'Admin', role: 'admin', lang: 'tr' },
  { id: 'b', name: 'Kassier', role: 'board', lang: 'de' },
  { id: 'c', name: 'Muhammet', role: 'coach', plays: true, lang: 'tr' },
  { id: 'd', name: 'Co', role: 'coach', lang: 'de' },
  { id: 'p1', name: 'Spieler Eins', role: 'player', lang: 'de' },
  { id: 'p2', name: 'Oyuncu İki', role: 'player', lang: 'tr' },
  { id: 'x', name: 'Neu', role: 'pending', lang: 'de' },
];
const to = r => r.map(x => x.to).sort().join(',');

// team chat: every member except the sender, never a pending person
let r = plan({ type: 'messages', rows: [{ channel: 'team', from_id: 'p1', text: 'Hallo' }], profiles: P });
check(to(r) === 'a,b,c,d,p2', 'team chat recipients: ' + to(r));
check(r.find(x => x.to === 'p2').title === 'Spieler Eins' && r[0].url === '#/msg/team', 'team chat title and link');
// board chat: board and admin only
r = plan({ type: 'messages', rows: [{ channel: 'board', from_id: 'a', text: 'Kasse' }], profiles: P });
check(to(r) === 'b', 'board chat recipients: ' + to(r));
check(r[0].title === 'Admin · Vorstand', 'board chat title in the reader\'s language');

// one new match: everyone but the creator, in their own language
r = plan({ type: 'events', rows: [{ id: 'e1', type: 'match', opponent: 'SV Test', home: true, date: '2026-11-08', time: '14:30:00', created_by: 'c' }], profiles: P });
check(to(r) === 'a,b,d,p1,p2', 'event recipients: ' + to(r));
check(r.find(x => x.to === 'p1').title === 'Neuer Termin' && r.find(x => x.to === 'p2').title === 'Yeni etkinlik', 'event titles per language');
check(r[0].body.startsWith('TTSC – SV Test') && r[0].body.includes('14:30') && r[0].url === '#/ev/e1', 'event body and link: ' + r[0].body);
// four weekly trainings: one notification per person
r = plan({ type: 'events', rows: [1, 2, 3, 4].map(i => ({ id: 'e' + i, type: 'training', date: '2026-11-1' + i, time: '19:00', created_by: 'c' })), profiles: P });
check(r.length === 5 && r.find(x => x.to === 'p1').title === '4 neue Termine', 'batch of events is one notification each');

// coach note: only that player, without the note text
r = plan({ type: 'notes', rows: [{ kind: 'coach', from_id: 'c', to_id: 'p1', text: 'geheim' }], profiles: P });
check(to(r) === 'p1' && !JSON.stringify(r).includes('geheim'), 'coach note goes only to the player, no content');
// player feedback: only coaches (not the board), without the text
r = plan({ type: 'notes', rows: [{ kind: 'toCoach', from_id: 'p2', text: 'özel' }], profiles: P });
check(to(r) === 'c,d' && !JSON.stringify(r).includes('özel'), 'feedback goes to coaches only, no content');

// reminders: playing people without an answer, for trainings/matches in the next two days
r = plan({ type: 'reminders', today: '2026-11-05', profiles: P,
  events: [{ id: 't1', type: 'training', date: '2026-11-06', time: '19:00' }, { id: 'm9', type: 'match', opponent: 'Fern', home: false, date: '2026-11-15', time: '12:30' }, { id: 'f', type: 'event', title: 'Fest', date: '2026-11-06', time: '18:00' }],
  rsvps: [{ event_id: 't1', player_id: 'p2' }] });
check(to(r) === 'c,p1', 'reminder recipients (player-coach included, answered skipped): ' + to(r));
check(r.every(x => x.url === '#/ev/t1'), 'only events within two days, no club events');

r = plan({ type: 'test', profiles: P });
check(to(r) === 'a' && r[0].body === 'Bildirimler çalışıyor!', 'test goes to admins only');

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('notify ok');
