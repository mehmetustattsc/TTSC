// Data layer. Everything the screens need goes through these functions, so the
// local-storage backend can later be swapped for a shared server without touching the UI.
const KEY = 'ttsc-team-v2';
export const TODAY = () => new Date().toISOString().slice(0, 10);

let db = null;
const listeners = new Set();
export const onChange = fn => listeners.add(fn);

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode: keep in memory */ }
  listeners.forEach(fn => fn());
}

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) db = JSON.parse(raw); } catch (e) { db = null; }
  if (!db || db.v !== 2) db = seed();
  return db;
}
export function resetDemo() { db = seed(); persist(); }
export const data = () => db;

const uid = p => p + Math.random().toString(36).slice(2, 9);

// ---------- session ----------
export const me = () => db.users.find(u => u.id === db.session.userId) || null;
export function login(id) { db.session.userId = id; persist(); }
export function logout() { db.session.userId = null; persist(); }
export function setUserLang(l) { const u = me(); if (u) { u.lang = l; persist(); } }

// ---------- people ----------
export const users = () => db.users;
export const user = id => db.users.find(u => u.id === id);
export const players = () => db.users.filter(u => u.role === 'player').sort((a, b) => a.num - b.num);
export const coaches = () => db.users.filter(u => u.role === 'coach');
export const isStaff = u => !!u && ['coach', 'board', 'admin'].includes(u.role);
export const isCoach = u => !!u && u.role === 'coach';
export const isBoard = u => !!u && (u.role === 'board' || u.role === 'admin');
export const isAdmin = u => !!u && u.role === 'admin';
export const ROLES = ['player', 'coach', 'board', 'admin'];

// Who may open which module. The same rules are enforced on the server (supabase/schema.sql).
const PERMS = {
  cal: ROLES, msg: ROLES, stats: ROLES, games: ROLES,
  players: ['coach', 'board', 'admin'], members: ['board', 'admin'], building: ['board', 'admin'],
};
export const can = (u, mod) => !!u && (PERMS[mod] || []).includes(u.role);
// chat channels: the team chat is for everyone, the board chat only for the board
export const channels = u => isBoard(u) ? ['team', 'board'] : ['team'];
// private notes (coach <-> player) are never visible to the board
export const seesNotes = u => !!u && (u.role === 'player' || u.role === 'coach');
export function setRole(id, role) { const x = user(id); if (x && ROLES.includes(role)) { x.role = role; persist(); } }
export function addPlayer({ name, num, pos, lang }) {
  const p = { id: uid('u'), name, num: +num || 0, pos, role: 'player', lang: lang || 'de' };
  db.users.push(p); db.availability[p.id] = { s: 'fit', at: TODAY() }; persist(); return p;
}
export const availability = id => db.availability[id] || { s: 'fit' };
export function setAvailability(id, s) { db.availability[id] = { s, at: TODAY() }; persist(); }

// ---------- events ----------
export const events = () => db.events.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
export const event = id => db.events.find(e => e.id === id);
export const isPast = e => e.date < TODAY();
export const upcoming = () => events().filter(e => !isPast(e));
export const pastEvents = () => events().filter(isPast).reverse();
export function addEvent(ev, weeks = 1) {
  const out = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(ev.date + 'T12:00:00'); d.setDate(d.getDate() + 7 * i);
    const e = { ...ev, id: uid('e'), date: d.toISOString().slice(0, 10), result: null };
    db.events.push(e); out.push(e);
  }
  persist(); return out;
}
export function deleteEvent(id) {
  db.events = db.events.filter(e => e.id !== id);
  delete db.rsvp[id]; delete db.attendance[id]; delete db.stats[id]; persist();
}

// ---------- answers and attendance ----------
export const rsvp = (eid, pid) => (db.rsvp[eid] || {})[pid] || null;
export function setRsvp(eid, pid, s, reason = '', text = '') {
  (db.rsvp[eid] ||= {})[pid] = { s, reason, text, at: new Date().toISOString() }; persist();
}
export function rsvpCounts(eid) {
  const c = { yes: 0, no: 0, open: 0 };
  players().forEach(p => { const r = rsvp(eid, p.id); c[r ? r.s : 'open']++; });
  return c;
}
// Confirmed attendance; until a coach confirms, the answer counts as a best guess.
export function attended(eid, pid) {
  const a = db.attendance[eid];
  if (a && pid in a) return a[pid];
  const r = rsvp(eid, pid); return r ? r.s === 'yes' : false;
}
export const attendanceConfirmed = eid => !!db.attendance[eid];
export function setAttendance(eid, map) { db.attendance[eid] = map; persist(); }

// ---------- match report ----------
export const matchStats = eid => db.stats[eid] || {};
export function saveMatch(eid, result, stats) {
  const e = event(eid); e.result = result; db.stats[eid] = stats;
  const att = {}; players().forEach(p => { att[p.id] = !!stats[p.id] || rsvp(eid, p.id)?.s === 'yes'; });
  db.attendance[eid] = att; persist();
}

// ---------- notes and self ratings ----------
// kind: 'coach' (coach -> player, private), 'toCoach' (player -> coaches)
export function addNote(n) { db.notes.push({ id: uid('n'), at: new Date().toISOString(), ...n }); persist(); }
export function notesFor(viewer, pid) {
  if (!viewer) return [];
  const canSee = n => viewer.role === 'coach' || n.from === viewer.id || n.to === viewer.id;
  return db.notes.filter(n => (n.to === pid || n.from === pid) && canSee(n)).sort((a, b) => b.at.localeCompare(a.at));
}
export function unreadNotes(viewer) {
  const seen = db.seen[viewer.id] || '';
  if (viewer.role === 'coach') return db.notes.filter(n => n.kind === 'toCoach' && n.at > seen);
  return db.notes.filter(n => n.kind === 'coach' && n.to === viewer.id && n.at > seen);
}
// silent save: called while a screen renders, must not trigger another render
// ---------- chat ----------
export const messages = ch => db.messages.filter(m => m.ch === ch).sort((a, b) => a.at.localeCompare(b.at));
export function sendMessage(ch, from, text) { db.messages.push({ id: uid('m'), ch, from, text, at: new Date().toISOString() }); persist(); }
export const unreadChat = (u, ch) => db.messages.filter(m => m.ch === ch && m.from !== u.id && m.at > (db.seen[u.id + ':' + ch] || '')).length;
export function markChatSeen(u, ch) { db.seen[u.id + ':' + ch] = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }

// ---------- members and fees ----------
export const FEE_YEAR = 2026;
export const members = () => db.members.slice().sort((a, b) => a.name.localeCompare(b.name));
export const member = id => db.members.find(m => m.id === id);
export function addMember(m) { const x = { id: uid('mb'), fees: {}, ...m }; db.members.push(x); persist(); return x; }
export function setFee(id, year, paid) { const m = member(id); if (m) { m.fees[year] = paid ? S_TODAY() : null; persist(); } }
const S_TODAY = () => new Date().toISOString().slice(0, 10);
export function memberSummary(year = FEE_YEAR) {
  const ms = db.members, paid = ms.filter(m => m.fees[year]);
  const due = ms.reduce((s, m) => s + (FEES[m.type] || 0), 0), got = paid.reduce((s, m) => s + (FEES[m.type] || 0), 0);
  return { total: ms.length, paid: paid.length, open: ms.length - paid.length, due, got };
}
export const FEES = { active: 60, passive: 36, support: 120 };

// ---------- clubhouse: bookings and repairs ----------
export const bookings = () => db.bookings.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
export function addBooking(b) { db.bookings.push({ id: uid('bk'), ...b }); persist(); }
export function deleteBooking(id) { db.bookings = db.bookings.filter(b => b.id !== id); persist(); }
export const repairs = () => db.repairs.slice().sort((a, b) => ({ open: 0, doing: 1, done: 2 }[a.status] - { open: 0, doing: 1, done: 2 }[b.status]) || b.at.localeCompare(a.at));
export function addRepair(r) { db.repairs.push({ id: uid('r'), status: 'open', at: new Date().toISOString(), ...r }); persist(); }
export function setRepairStatus(id, status) { const r = db.repairs.find(x => x.id === id); if (r) { r.status = status; r.updated = new Date().toISOString(); persist(); } }

export function markSeen(viewer) { db.seen[viewer.id] = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }
export function addSelf(s) {
  db.self = db.self.filter(x => !(x.pid === s.pid && x.eid === s.eid));
  db.self.push({ id: uid('s'), at: new Date().toISOString(), ...s }); persist();
}
export const selfFor = pid => db.self.filter(s => s.pid === pid).sort((a, b) => b.at.localeCompare(a.at));
export const selfOf = (pid, eid) => db.self.find(s => s.pid === pid && s.eid === eid);
export function pendingSelf(pid) {
  const lim = new Date(); lim.setDate(lim.getDate() - 10); const from = lim.toISOString().slice(0, 10);
  return pastEvents().filter(e => e.type !== 'event' && e.date >= from && attended(e.id, pid) && !selfOf(pid, e.id));
}

// ---------- statistics ----------
export function playerStats(pid) {
  const past = pastEvents().filter(e => e.type !== 'event');
  const trainings = past.filter(e => e.type === 'training');
  const matches = past.filter(e => e.type === 'match' && e.result);
  const tAtt = trainings.filter(e => attended(e.id, pid)).length;
  let m = 0, min = 0, g = 0, a = 0, y = 0, r = 0;
  matches.forEach(e => { const s = matchStats(e.id)[pid]; if (s) { m++; min += s.min; g += s.g; a += s.a; y += s.y; r += s.r; } });
  const all = past.length ? past.filter(e => attended(e.id, pid)).length / past.length : 0;
  return { trainings: trainings.length, tAtt, rate: Math.round(all * 100), tRate: trainings.length ? Math.round(tAtt / trainings.length * 100) : 0, m, min, g, a, y, r };
}
export function teamRecord() {
  const ms = pastEvents().filter(e => e.type === 'match' && e.result).reverse();
  const rec = { w: 0, d: 0, l: 0, gf: 0, ga: 0, form: [] };
  ms.forEach(e => {
    const { us, them } = e.result; rec.gf += us; rec.ga += them;
    const k = us > them ? 'w' : us === them ? 'd' : 'l'; rec[k]++; rec.form.push({ k, e });
  });
  rec.form = rec.form.slice(-5); return rec;
}
// Smart hints for the coach: who keeps missing, who is injured, is the next match short of players.
export function coachAlerts() {
  const out = [];
  const nextMatch = upcoming().find(e => e.type === 'match');
  if (nextMatch) {
    const c = rsvpCounts(nextMatch.id);
    if (c.yes < 13) out.push({ k: 'alert_low_squad', v: { n: c.yes, min: 13 }, eid: nextMatch.id, level: 'warn' });
    if (c.open > 0) out.push({ k: 'alert_open', v: { n: c.open }, eid: nextMatch.id, level: 'info' });
  }
  const tr = pastEvents().filter(e => e.type === 'training').slice(0, 3);
  if (tr.length === 3) players().forEach(p => {
    if (tr.every(e => !attended(e.id, p.id)) && availability(p.id).s !== 'injured') out.push({ k: 'alert_missed', v: { name: p.name, n: 3 }, pid: p.id, level: 'warn' });
  });
  const inj = players().filter(p => availability(p.id).s === 'injured');
  if (inj.length) out.push({ k: 'alert_injured', v: { names: inj.map(p => p.name.split(' ')[0]).join(', ') }, level: 'info' });
  return out;
}

// ---------- demo data ----------
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

function seed() {
  const R = rng(1972);
  const pick = a => a[Math.floor(R() * a.length)];
  const P = [
    ['Emre Yılmaz', 1, 'TW', 'tr'], ['Jonas Becker', 4, 'AB', 'de'], ['Burak Kaya', 5, 'AB', 'tr'], ['Luca Romano', 3, 'AB', 'de'],
    ['Mert Demir', 2, 'AB', 'tr'], ['Ardit Krasniqi', 6, 'MF', 'de'], ['Hakan Öztürk', 8, 'MF', 'tr'], ['Tim Schneider', 10, 'MF', 'de'],
    ['Serkan Aydın', 7, 'MF', 'tr'], ['Dimitri Petrov', 14, 'MF', 'en'], ['Can Arslan', 9, 'ST', 'tr'], ['Kevin Hoffmann', 11, 'ST', 'de'],
    ['Ali Şahin', 15, 'AB', 'tr'], ['Marko Jovanović', 16, 'MF', 'en'], ['Yusuf Koç', 19, 'ST', 'tr'], ['David Weber', 22, 'TW', 'de'],
  ];
  const users = P.map(([name, num, pos, lang], i) => ({ id: 'p' + (i + 1), name, num, pos, role: 'player', lang }));
  users.push({ id: 'c1', name: 'Murat Çelik', role: 'coach', lang: 'tr', title: 'Trainer' });
  users.push({ id: 'c2', name: 'Stefan Braun', role: 'coach', lang: 'de', title: 'Co-Trainer' });
  users.push({ id: 'b1', name: 'Mehmet U.', role: 'admin', lang: 'tr', title: 'Vorstand · Admin' });
  users.push({ id: 'b2', name: 'Hasan Yıldız', role: 'board', lang: 'tr', title: 'Kassenwart' });
  const pl = users.filter(u => u.role === 'player');
  // how reliable each player is, so the stats tell a story
  const rel = {}; pl.forEach((p, i) => { rel[p.id] = [0.95, 0.9, 0.85, 0.8, 0.7, 0.92, 0.88, 0.97, 0.75, 0.6, 0.9, 0.82, 0.55, 0.78, 0.65, 0.5][i]; });

  const opp = ['SV Waldhausen', 'TSV Odenheim', 'FC Bergfeld', 'SC Talbach', 'VfR Neudorf', 'SpVgg Lindental', 'FV Steinbach', 'TSG Rosenau', 'SV Eichtal', 'FC Mühlbach', 'TSV Kirchberg'];
  const events = [], rsvp = {}, attendance = {}, stats = {};
  const today = TODAY();
  const start = new Date('2026-09-01T12:00:00');
  const end = new Date(today + 'T12:00:00'); end.setDate(end.getDate() + 21);
  let oi = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10), wd = d.getDay();
    if (wd === 2 || wd === 4) events.push({ id: 'e' + iso, type: 'training', date: iso, time: '19:00', place: 'Sportplatz Buchen', note: '' });
    if (wd === 0) { const home = oi % 2 === 0; events.push({ id: 'm' + iso, type: 'match', date: iso, time: '15:00', place: home ? 'Sportplatz Buchen' : '', opponent: opp[oi++ % opp.length], home, note: '', result: null }); }
  }
  events.push({ id: 'x1', type: 'event', title: 'Mitgliederversammlung', date: '2026-11-20', time: '19:30', place: 'Vereinsheim', note: '' });
  events.push({ id: 'x2', type: 'event', title: 'Weihnachtsfeier', date: '2026-12-12', time: '18:00', place: 'Vereinsheim', note: '' });
  events.push({ id: 'x0', type: 'event', title: 'Saisonauftakt-Grillen', date: '2026-09-05', time: '17:00', place: 'Vereinsheim', note: '' });
  const injured = new Set(['p13']); // one injured player in the demo
  events.forEach(e => {
    const past = e.date < today, soon = !past && (new Date(e.date) - new Date(today)) / 864e5 < 8;
    rsvp[e.id] = {};
    pl.forEach(p => {
      if (!past && !soon) return;
      if (!past && R() < 0.3) return; // some still open for the next events
      const yes = injured.has(p.id) && e.date > '2026-10-20' ? false : R() < rel[p.id];
      rsvp[e.id][p.id] = yes ? { s: 'yes', reason: '', text: '', at: e.date } : { s: 'no', reason: injured.has(p.id) ? 'injured' : pick(['work', 'work', 'school', 'family', 'sick', 'travel']), text: '', at: e.date };
    });
    if (past) {
      attendance[e.id] = {};
      pl.forEach(p => { const r = rsvp[e.id][p.id]; attendance[e.id][p.id] = r && r.s === 'yes' && R() > 0.05; });
      if (e.type === 'match') {
        const avail = pl.filter(p => attendance[e.id][p.id]);
        const gk = avail.find(p => p.pos === 'TW') || avail[0];
        const field = avail.filter(p => p !== gk);
        const starters = [gk, ...field.slice(0, 10)], subs = field.slice(10, 13);
        const st = {};
        starters.forEach(p => { st[p.id] = { min: 90, g: 0, a: 0, y: 0, r: 0 }; });
        subs.forEach((p, i) => { const m = [30, 20, 10][i]; st[p.id] = { min: m, g: 0, a: 0, y: 0, r: 0 }; if (starters[10 - i]) st[starters[10 - i].id].min = 90 - m; });
        const us = Math.floor(R() * 4), them = Math.floor(R() * 3.2);
        const scorers = [...starters, ...subs].filter(p => p && p.pos !== 'TW');
        const w = p => (p.pos === 'ST' ? 4 : p.pos === 'MF' ? 2 : 0.6);
        for (let i = 0; i < us; i++) {
          let tot = scorers.reduce((s, p) => s + w(p), 0), x = R() * tot, s = scorers[0];
          for (const p of scorers) { x -= w(p); if (x <= 0) { s = p; break; } }
          st[s.id].g++;
          if (R() < 0.7) { const a = pick(scorers.filter(p => p !== s)); if (a) st[a.id].a++; }
        }
        if (R() < 0.8) st[pick(scorers).id].y++;
        stats[e.id] = st; e.result = { us, them };
        Object.keys(attendance[e.id]).forEach(id => { attendance[e.id][id] = !!st[id] || attendance[e.id][id]; });
      }
    }
  });
  const availability = {}; pl.forEach(p => { availability[p.id] = { s: injured.has(p.id) ? 'injured' : p.id === 'p10' ? 'limited' : 'fit', at: today }; });

  const lastMatch = events.filter(e => e.type === 'match' && e.date < today).pop();
  const lastTraining = events.filter(e => e.type === 'training' && e.date < today).pop();
  const ago = h => new Date(Date.now() - h * 36e5).toISOString();
  const notes = [
    { id: 'n1', kind: 'coach', from: 'c1', to: 'p11', eid: lastMatch?.id, good: ['finish', 'press'], improve: ['header'], text: 'İkinci yarıda çok iyi baskı yaptın. Kafa toplarında zamanlamayı çalışalım.', at: ago(30) },
    { id: 'n2', kind: 'coach', from: 'c2', to: 'p8', eid: lastMatch?.id, good: ['pass', 'lead'], improve: ['defend'], text: 'Starke Spielübersicht. Nach Ballverlust schneller zurück.', at: ago(28) },
    { id: 'n3', kind: 'coach', from: 'c1', to: 'p10', eid: lastTraining?.id, good: ['attitude'], improve: ['stamina'], text: '', at: ago(20) },
    { id: 'n4', kind: 'toCoach', from: 'p8', to: 'coaches', tags: ['training'], text: 'Mehr Spielformen im Training wären super.', at: ago(10) },
    { id: 'n5', kind: 'toCoach', from: 'p3', to: 'coaches', tags: ['tired', 'time'], text: 'Perşembe işten geç çıkıyorum, 19:30 olabilir mi?', at: ago(5) },
  ];
  const self = [];
  events.filter(e => e.date < today).slice(-8).forEach(e => {
    pl.slice(0, 10).forEach(p => {
      if (attendance[e.id]?.[p.id] && R() < 0.55) self.push({ id: uid('s'), pid: p.id, eid: e.id, rating: 2 + Math.floor(R() * 4), good: [pick(['pass', 'press', 'talk', 'attitude', 'speed'])], improve: [pick(['finish', 'stamina', 'header', 'touch'])], text: '', at: e.date + 'T21:00:00.000Z' });
    });
  });
  const msg = (ch, from, text, h) => ({ id: uid('m'), ch, from, text, at: ago(h) });
  const messages = [
    msg('team', 'c1', 'Perşembe antrenman 19:00\'da, herkes zamanında gelsin. 💪', 26),
    msg('team', 'p8', 'Wer kann Sonntag Leute mitnehmen? Ich hab noch 3 Plätze.', 20),
    msg('team', 'p6', 'Ich bin dabei 👍', 19),
    msg('team', 'p11', 'Ben de geliyorum, saat kaçta buluşuyoruz?', 18),
    msg('team', 'c2', 'Treffpunkt 13:45 am Vereinsheim.', 17),
    msg('team', 'p10', 'Can someone send me the address of the away pitch?', 4),
    msg('board', 'b2', 'Aidat hatırlatmasını bu hafta gönderelim mi? Hâlâ ödemeyenler var.', 30),
    msg('board', 'b1', 'Olur. Bir de duş arızası için tesisatçıya yazdım.', 29),
  ];
  const first = ['Ahmet', 'Klaus', 'Fatma', 'Peter', 'Elif', 'Thomas', 'Hüseyin', 'Sabine', 'Osman', 'Uwe', 'Zeynep', 'Frank', 'Ramazan', 'Monika'];
  const last = ['Kılıç', 'Müller', 'Doğan', 'Fischer', 'Çetin', 'Wagner', 'Polat', 'Koch', 'Aksoy', 'Richter', 'Güneş', 'Wolf', 'Erdem', 'Klein'];
  const members = [
    ...pl.map((p, i) => ({ id: 'mb' + p.id, name: p.name, type: 'active', userId: p.id, since: 2019 + (i % 7), fees: { 2026: i % 5 === 3 ? null : '2026-0' + (2 + i % 6) + '-15' } })),
    ...first.map((f, i) => ({ id: 'mbx' + i, name: f + ' ' + last[(i * 5) % last.length], type: i % 4 === 0 ? 'support' : 'passive', since: 2008 + i, fees: { 2026: i % 3 === 1 ? null : '2026-03-0' + (1 + i % 8) } })),
  ];
  const bookings = [
    { id: 'bk1', title: 'Mitgliederversammlung', date: '2026-11-20', time: '19:30', who: 'Vorstand', note: '' },
    { id: 'bk2', title: 'Geburtstag (Vermietung)', date: '2026-11-28', time: '16:00', who: 'Familie Kılıç', note: 'Kaution 100 € erhalten' },
    { id: 'bk3', title: 'Weihnachtsfeier', date: '2026-12-12', time: '18:00', who: 'Vorstand', note: '' },
  ];
  const repairs = [
    { id: 'r1', title: 'Dusche: kein Warmwasser', text: 'Kabine 2 bleibt kalt.', by: 'c2', status: 'open', at: ago(50) },
    { id: 'r2', title: 'Flutlicht Mast 2 flackert', text: '', by: 'c1', status: 'doing', at: ago(120) },
    { id: 'r3', title: 'Kühlschrank Küche', text: 'Tür schließt nicht richtig.', by: 'b2', status: 'done', at: ago(300) },
  ];
  return { v: 2, session: { userId: null }, users, events, rsvp, attendance, stats, availability, notes, self, messages, members, bookings, repairs, seen: {} };
}
