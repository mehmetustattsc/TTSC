import { t, setLang, getLang, locale, LANGS, TAGS, FB_TAGS, REASONS } from './i18n.js';
import * as S from './store.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
// league table (data/league.json, taken from fussball.de)
let STATIC_LEAGUE = null; // fallback until the daily import has stored the table
fetch('data/league.json').then(r => r.json()).then(j => { STATIC_LEAGUE = j; if (document.querySelector('.view')) render(); }).catch(() => {});
let installEvt = null; // the browser's install offer (Android/desktop Chrome), shown on the home screen

// The club's own games (each is its own app on GitHub Pages).
const GAMES = [
  { name: 'FootWare', url: 'https://mehmetustattsc.github.io/FootWare/', emoji: '⚽', c: '#16834A',
    desc: { tr: 'Futbol bilgi oyunu: transfer yolu, kim bu, ortak kulüp', de: 'Fußball-Quiz: Transferweg, Wer ist das, gemeinsamer Verein', en: 'Football quiz: transfer path, who is it, shared club', fr: 'Quiz foot : parcours de transferts, qui est-ce, club commun' } },
  { name: 'Pusula', url: 'https://mehmetustattsc.github.io/Pusula/', img: 'assets/games/pusula.png',
    desc: { tr: 'Bil ve fethet: bilgi ve strateji', de: 'Wissen und erobern: Quiz und Strategie', en: 'Know and conquer: trivia and strategy', fr: 'Savoir et conquérir : quiz et stratégie' } },
  { name: 'Sancak', url: 'https://mehmetustattsc.github.io/sancak/', img: 'assets/games/sancak.png',
    desc: { tr: 'Avrupa haritasında sıra tabanlı strateji', de: 'Rundenstrategie auf der Europakarte', en: 'Turn-based strategy on the map of Europe', fr: "Stratégie au tour par tour sur la carte de l'Europe" } },
  { name: 'Petek Ustası', url: 'https://mehmetustattsc.github.io/puzzle-game/', img: 'assets/games/petek.png',
    desc: { tr: 'Arılarla renkli petek bulmacası', de: 'Waben-Farbpuzzle mit Bienen', en: 'Hexagon colour puzzle with bees', fr: 'Puzzle de couleurs en alvéoles avec des abeilles' } },
];
// Football-intelligence games: they live in games/… inside this app, open in an overlay and report
// each finished game with a window message (stored by S.addGameResult, seen by the player and coaches).
const IQ = [
  { id: 'omuz', path: 'games/omuz/index.html', name: 'Omuz', sk: 'sk_scan', c: '#C98A0B', icon: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21c.5-4.5 3.2-7 7-7s6.5 2.5 7 7M4 9.5C2.8 8 2.8 6 4 4.5M20 9.5c1.2-1.5 1.2-3.5 0-5' },
  { id: 'sonkare', path: 'games/son-kare/index.html', name: 'Son Kare', sk: 'sk_antic', c: '#23408E', icon: 'M4 5h16v14H4zM9 5v14M15 5v14M4 12h16M7 8.5h.01M18 15.5h.01' },
  { id: 'kornokta', path: 'games/kor-nokta/index.html', name: 'Kör Nokta', sk: 'sk_offball', c: '#0E6E86', icon: 'M12 4L4 18h16zM12 10v4M12 16.5h.01' },
  { id: 'taktik-karar', path: 'games/taktik/index.html', name: 'Taktik', sk: 'sk_decide', c: '#0F6B54', icon: 'M4 4h16v16H4zM4 12h16M12 4v16M8 8l2 2M16 14l-2 2' },
];
// Public club links (website, Instagram, fan shop).
const CLUB = [
  { k: 'club_web', url: 'https://ttscbuchen.de', label: 'ttscbuchen.de', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z', c: '#C8102E' },
  { k: 'club_insta', url: 'https://www.instagram.com/ttscbuchen/', label: '@ttscbuchen', icon: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM17.5 6.5h.01', c: '#D62976' },
  { k: 'club_fussball', url: 'https://www.fussball.de/verein/ttsc-buchen-baden/-/id/00ES8GN9B800002IVV0AG08LVUPGND5I', label: 'fussball.de', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5l4 3-1.5 4.8h-5L8 10.5z', c: '#16834A' },
  { k: 'club_shop', url: 'https://ttsc-buchen.fan12.de', label: 'ttsc-buchen.fan12.de', icon: 'M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0', c: '#17181C' },
];

// Module tiles on the home screen. Which ones a person sees comes from S.can().
const ICONS = {
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3',
  msg: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  games: 'M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5.2 2L14 15h-4l-1.8 2A3 3 0 0 1 3 15v-3a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 14h.01',
  players: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4',
  members: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.4 3.5 5.2',
  building: 'M3 21h18M5 21V10l7-6 7 6v11M10 21v-6h4v6',
  club: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM12 7l1.2 2.5 2.8.3-2 1.9.5 2.8L12 13.2 9.5 14.5l.5-2.8-2-1.9 2.8-.3z',
};
const MODS = [
  { k: 'cal', c: '#C8102E' }, { k: 'msg', c: '#1F6FEB' }, { k: 'stats', c: '#16834A' }, { k: 'games', c: '#E08A00' }, { k: 'club', c: '#9E0B23' },
  { k: 'players', c: '#17181C', staff: true }, { k: 'members', c: '#6A3FB5', staff: true }, { k: 'building', c: '#8A5A2B', staff: true },
];
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

// ---------- helpers ----------
const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), opts);
const fmtTime = iso => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
function relDay(iso) {
  const d = Math.round((new Date(iso + 'T12:00:00') - new Date(S.TODAY() + 'T12:00:00')) / 864e5);
  return d === 0 ? t('today') : d === 1 ? t('tomorrow') : d > 1 && d < 8 ? t('days_left', { n: d }) : '';
}
const initials = n => n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const avatar = (u, cls = '') => u ? `<span class="av ${cls} av-${u.role}">${S.isPlaying(u) && u.num ? u.num : initials(u.name)}</span>` : '';
const evTitle = e => e.type === 'match' ? `${e.home ? 'TTSC' : esc(e.opponent)} – ${e.home ? esc(e.opponent) : 'TTSC'}` : e.type === 'event' ? esc(e.title) : t('training');
const evIcon = e => ({ match: '⚽', training: '🏃', event: '🎉' }[e.type]);
const evType = e => e.type === 'match' ? t('match') + ' · ' + t(e.home ? 'home' : 'away') : e.type === 'event' ? t('club_event') : t('training');
const chip = (k, on, attr) => `<button type="button" class="chip ${on ? 'on' : ''}" ${attr}>${esc(t(k))}</button>`;
const availBadge = id => { const a = S.availability(id).s; return a === 'fit' ? '' : `<span class="badge b-${a}">${t('avail_' + a)}</span>`; };
const seg = (act, cur, items) => `<div class="seg">${items.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
const tabsNav = (base, cur, items) => `<div class="seg">${items.map(([v, l, n]) => `<a href="#/${base}/${v}" class="${cur === v ? 'on' : ''}">${l}${n ? ` <i class="nb">${n}</i>` : ''}</a>`).join('')}</div>`;
const resultBadge = e => {
  if (!e.result) return '';
  const { us, them } = e.result, k = us > them ? 'w' : us === them ? 'd' : 'l';
  return `<span class="res res-${k}">${e.home ? us + ':' + them : them + ':' + us}</span>`;
};
const empty = () => `<div class="row muted">${t('no_items')}</div>`;
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1800);
}

// ---------- bottom sheet ----------
function sheet(html, onMount) {
  closeSheet();
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap'; wrap.id = 'sheet';
  wrap.innerHTML = `<div class="sheet-bg" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-top"><div class="grab"></div><button class="sheet-x" data-act="close-sheet" aria-label="${t('close')}">✕</button></div>${html}</div>`;
  document.body.appendChild(wrap); requestAnimationFrame(() => wrap.classList.add('open'));
  onMount && onMount($('.sheet', wrap));
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }
const chosen = (el, sel) => [...el.querySelectorAll(sel + ' .chip.on')].map(b => b.dataset.v);
const btns = id => `<div class="sheet-btns"><button class="btn" data-act="close-sheet">${t('cancel')}</button><button class="btn primary" id="${id}">${t('save')}</button></div>`;

// ---------- badges on the tiles ----------
function badges(u) {
  const b = {};
  b.msg = S.channels(u).reduce((n, ch) => n + S.unreadChat(u, ch), 0) + (S.seesNotes(u) ? S.unreadNotes(u).length : 0);
  if (S.isPlaying(u)) b.cal = S.upcoming().filter(e => relDay(e.date) && !S.rsvp(e.id, u.id)).length;
  if (S.can(u, 'players')) b.players = S.coachAlerts().filter(a => a.level === 'warn').length;
  if (S.can(u, 'building')) b.building = S.repairs().filter(r => r.status === 'open').length;
  if (S.can(u, 'members')) b.members = S.memberSummary().open + (S.isAdmin(u) ? S.pendingUsers().length : 0);
  return b;
}

// ---------- router ----------
const routes = { import: viewImport, '': viewHome, cal: viewCal, ev: viewEvent, msg: viewMsg, stats: viewStats, p: viewPlayer, games: viewGames, club: viewClub, players: viewPlayers, members: viewMembers, building: viewBuilding, me: viewMe };
const MOD_OF = { import: 'members', cal: 'cal', ev: 'cal', msg: 'msg', stats: 'stats', p: 'stats', games: 'games', club: 'club', players: 'players', members: 'members', building: 'building' };
// The back arrow goes one level up, not to the previous screen: a match → calendar,
// a player → player tracking (staff) or player stats, any module (and its tabs) → home.
function parentOf({ r }, u) {
  if (r === 'ev') return 'cal';
  if (r === 'p') return S.can(u, 'players') ? 'players' : 'stats/players';
  return '';
}
function parse() { if (/access_token=|error_description=/.test(location.hash)) return { r: '' }; const [r, id] = location.hash.replace(/^#\/?/, '').split('/'); return { r: r || '', id }; }

let lastRoute = null;
export function render() {
  const u = S.me();
  setLang(u ? u.lang : (localStorage.getItem('ttsc-lang') || 'tr'));
  // an import link opened before signing in: keep it for after the login
  if (!u && location.hash.startsWith('#/import/')) { try { sessionStorage.setItem('ttsc-import', location.hash); } catch (e) { /* ignore */ } }
  if (u && u.role !== 'pending') { let k = null; try { k = sessionStorage.getItem('ttsc-import'); sessionStorage.removeItem('ttsc-import'); } catch (e) { /* ignore */ } if (k) { location.hash = k; return; } }
  if (!u || u.role === 'pending') {
    // keep what is being typed on the login screen when a refresh re-renders it
    const keepEm = $('#lem')?.value, keepCode = $('#lco')?.value;
    app.className = ''; lastRoute = null;
    app.innerHTML = S.isDemo() ? viewDemoLogin() : S.signedIn() ? viewWaiting(u) : viewLogin();
    if (keepEm && $('#lem')) $('#lem').value = keepEm;
    if (keepCode && $('#lco')) $('#lco').value = keepCode;
    return;
  }
  const { r, id } = parse();
  const route = r + '/' + (id || '');
  const draft = $('.composer #cm')?.value || '', focused = document.activeElement?.id === 'cm';
  const sy = window.scrollY, chatList = $('.chat-list'), atBottom = !chatList || window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
  const mod = MOD_OF[r];
  const view = routes[r] || viewHome;
  const body = mod && !S.can(u, mod) ? `<div class="card empty">🔒 ${t('no_access')}</div>` : view(id, u);
  const title = r === '' ? t('appName') : r === 'me' ? t('mod_me') : t('mod_' + mod);
  app.className = r === 'msg' && id !== 'notes' && S.can(u, 'msg') ? 'chat-mode' : '';
  app.innerHTML = `
    <header class="top">
      ${r === '' ? `<a href="#/" class="brand"><img src="assets/logo.png" alt="" width="30" height="31"><span>${t('appName')}</span></a>`
        : `<button class="back-btn" data-act="back" aria-label="${t('back')}">‹</button><span class="top-t">${esc(title)}</span>`}
      <a class="me-chip" href="#/me">${avatar(u, 'sm')}<span>${esc(u.name.split(' ')[0])}</span></a>
    </header>
    <main class="view">${body}</main>`;
  const same = route === lastRoute; lastRoute = route;
  if (app.className === 'chat-mode') {
    const c = $('.composer #cm'); if (c && same) { c.value = draft; if (focused) c.focus(); }
    if (!same || atBottom) window.scrollTo(0, document.body.scrollHeight); else window.scrollTo(0, sy);
  } else window.scrollTo(0, same ? sy : 0);
}

// ---------- login ----------
let loginStep = 'email', loginEmail = '', loginBusy = false;
const langRow = () => `<div class="lang-row">${Object.entries(LANGS).map(([k, v]) => `<button class="chip ${getLang() === k ? 'on' : ''}" data-act="login-lang" data-v="${k}">${v}</button>`).join('')}</div>`;
const loginHead = () => `<img src="assets/logo.png" alt="TTSC Buchen" class="login-logo" width="92" height="96"><h1>${t('appName')}</h1><p class="muted">${t('tagline')}</p>${langRow()}`;
function viewLogin() {
  const box = loginStep === 'email'
    ? `<form class="card login-box" data-form="login-email">
        <label class="fld"><span>${t('login_email')}</span><input type="email" id="lem" required autocomplete="email" inputmode="email" placeholder="name@example.com" value="${esc(loginEmail)}"></label>
        <button class="btn primary block" ${loginBusy ? 'disabled' : ''}>${loginBusy ? '…' : t('login_send')}</button><small>${t('login_once')}</small></form>`
    : `<form class="card login-box" data-form="login-code">
        <p class="small">${t('login_code_sent', { email: esc(loginEmail) })}</p>
        <label class="fld"><span>${t('login_code')}</span><input id="lco" required inputmode="numeric" autocomplete="one-time-code" maxlength="10" class="code-in" placeholder="123456"></label>
        <button class="btn primary block" ${loginBusy ? 'disabled' : ''}>${loginBusy ? '…' : t('login_verify')}</button>
        <button type="button" class="btn danger-ghost block" data-act="login-restart">${t('login_other_email')}</button></form>`;
  return `<div class="login">${loginHead()}${box}<button class="link-btn" data-act="demo-on">${t('login_try_demo')}</button><a class="link-btn" href="datenschutz.html">${t('privacy')}</a></div>`;
}
function viewWaiting(u) {
  const busy = S.status.loading || !S.data().loaded;
  return `<div class="login">${loginHead()}<section class="card login-box">${busy && !S.status.error
    ? `<p class="center">${t('loading')}</p>`
    : S.status.error ? `<p>⚠️ ${esc(S.status.error)}</p><button class="btn block" data-act="retry">${t('retry')}</button>`
    : !u ? `<p class="center">${t('loading')}</p>`
    : S.pref('intro-' + u.id) ? `<h3>${t('wait_title')}</h3><p class="small">${t('wait_text', { name: esc(u.name) })}</p><button class="btn block" data-act="retry">${t('retry')}</button><button class="link-btn" data-act="intro-edit">${t('wait_edit')}</button>`
    : `<h3>${t('intro_title')}</h3><p class="small">${t('intro_text')}</p>
       <form data-form="intro"><label class="fld"><span>${t('name')}</span><input id="inm" required maxlength="50" autocomplete="name" placeholder="Vorname Nachname"></label>
       <label class="fld"><span>${t('number')} (${t('note_optional').replace(/^[^(]*\(|\)$/g, '')})</span><input id="inu" type="number" inputmode="numeric" min="1" max="99"></label>
       <button class="btn primary block">${t('send')}</button></form>`}
    <button class="btn danger-ghost block" data-act="switch">${t('logout')}</button></section></div>`;
}
function viewDemoLogin() {
  return `<div class="login">${loginHead()}<div class="demo-banner">${t('demo_banner')}</div>
    ${['admin', 'board', 'coach', 'player'].map(g => `<div class="sec-t">${t('role_' + g)}</div><div class="card list">${S.users().filter(u => u.role === g).map(u => `
      <button class="row" data-act="login" data-id="${u.id}">${avatar(u)}<span class="grow"><b>${esc(u.name)}</b><small>${u.role === 'player' ? t('pos_' + u.pos) : esc(u.title || '')} · ${LANGS[u.lang]}</small></span><span class="chev">›</span></button>`).join('')}</div>`).join('')}
    <button class="btn block" data-act="demo-off">${t('login_back_real')}</button></div>`;
}

// ---------- home ----------
function viewHome(_, u) {
  const next = S.upcoming()[0], b = badges(u);
  let html = `<h1 class="hello">${t('hello')}, ${esc(u.name.split(' ')[0])} 👋</h1>`;
  if (S.isPlaying(u)) {
    const a = S.availability(u.id).s;
    html += `<section class="card"><div class="card-h">${t('avail_title')}</div>
      <div class="seg">${['fit', 'limited', 'injured'].map(s => `<button class="${a === s ? 'on s-' + s : ''}" data-act="avail" data-v="${s}">${t('avail_' + s)}</button>`).join('')}</div></section>`;
    S.pendingSelf(u.id).slice(0, 1).forEach(e => { html += `<button class="card notice ghost" data-act="self" data-eid="${e.id}"><span>📝</span><span class="grow"><b>${t('to_assess')}</b><small>${evIcon(e)} ${evTitle(e)} · ${fmtDate(e.date)}</small></span><span class="chev">›</span></button>`; });
  }
  html += installCard();
  html += pushCard(true);
  if (S.isAdmin(u) && S.pendingUsers().length) html += `<a class="card notice" href="#/members"><span class="dot"></span><b>${t('pending_n', { n: S.pendingUsers().length })}</b><span class="chev">›</span></a>`;
  if (next) html += `<div class="sec-t">${t('next_event')}</div>${eventCard(next, u, true)}`;
  const tile = m => `<a class="tile-m" href="#/${m.k}" style="--c:${m.c}"><span class="ti">${svg(ICONS[m.k])}</span><span class="tl">${t('mod_' + m.k)}</span>${b[m.k] ? `<i class="tb">${b[m.k]}</i>` : ''}</a>`;
  const general = MODS.filter(m => !m.staff && S.can(u, m.k)), staff = MODS.filter(m => m.staff && S.can(u, m.k));
  html += `<div class="sec-t">${t('modules')}</div><div class="grid">${general.map(tile).join('')}</div>`;
  if (staff.length) html += `<div class="sec-t">${t(u.role === 'coach' ? 'role_coach' : 'for_board')}</div><div class="grid">${staff.map(tile).join('')}</div>`;
  return html;
}

function eventCard(e, u, big = false) {
  const c = S.rsvpCounts(e.id), mine = S.isPlaying(u) ? S.rsvp(e.id, u.id) : null, rd = relDay(e.date);
  const past = S.isPast(e);
  return `<article class="card ev ${big ? 'big' : ''} ev-${e.type}">
    <a href="#/ev/${e.id}" class="ev-main">
      <span class="ev-date"><b>${new Date(e.date + 'T12:00:00').getDate()}</b><small>${fmtDate(e.date, { month: 'short' })}</small></span>
      <span class="grow"><span class="ev-type">${evIcon(e)} ${evType(e)}${rd ? ` · <em>${rd}</em>` : ''}</span>
        <b class="ev-title">${evTitle(e)}</b><small class="muted">${fmtDate(e.date, { weekday: 'long' })} ${e.time}${e.place ? ' · ' + esc(e.place) : ''}</small></span>
      ${past ? resultBadge(e) : `<span class="counts"><i class="c-yes">${c.yes}</i><i class="c-no">${c.no}</i><i class="c-open">${c.open}</i></span>`}
    </a>
    ${!past && S.isPlaying(u) ? `<div class="rsvp">
      <button class="yes ${mine?.s === 'yes' ? 'on' : ''}" data-act="rsvp-yes" data-eid="${e.id}">✓ ${t('rsvp_yes')}</button>
      <button class="no ${mine?.s === 'no' ? 'on' : ''}" data-act="rsvp-no" data-eid="${e.id}">✕ ${t('rsvp_no')}</button></div>
      ${mine?.s === 'no' ? `<div class="reason small muted">${t('reason_' + mine.reason)}${mine.text ? ' · ' + esc(mine.text) : ''}</div>` : ''}` : ''}
  </article>`;
}

// Shown until the app runs from the home screen: Android gets an install button, iPhone the two taps.
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
  if (standalone() || S.pref('install-hidden')) return '';
  const body = installEvt ? `<button class="btn primary sm" data-act="install">${t('install_now')}</button>`
    : isIOS() ? `<small>${t('install_ios')}</small>` : `<small>${t('install_other')}</small>`;
  return `<section class="card install"><span class="inst-ic"><img src="assets/icon-192.png" alt="" width="44" height="44"></span><div class="grow"><b>${t('install_title')}</b>${body}</div><button class="x" data-act="install-hide" aria-label="${t('close')}">✕</button></section>`;
}

// ---------- calendar ----------
let calTab = 'up', calType = 'all';
function viewCal(_, u) {
  const list = (calTab === 'up' ? S.upcoming() : S.pastEvents()).filter(e => calType === 'all' || e.type === calType);
  let lastM = '', html = `${S.isStaff(u) ? `<button class="btn primary block" data-act="new-event">+ ${t('new_event')}</button>` : ''}
    ${seg('cal-tab', calTab, [['up', t('upcoming')], ['past', t('past')]])}
    <div class="chips filt">${[['all', 'all'], ['match', 'match'], ['training', 'training'], ['event', 'event']].map(([v, k]) => `<button class="chip ${calType === v ? 'on' : ''}" data-act="cal-type" data-v="${v}">${t(k)}</button>`).join('')}</div>`;
  if (!list.length) html += `<div class="card empty">${t('no_events')}</div>`;
  list.forEach(e => {
    const m = fmtDate(e.date, { month: 'long', year: 'numeric' });
    if (m !== lastM) { html += `<div class="sec-t">${m}</div>`; lastM = m; }
    html += eventCard(e, u);
  });
  return html;
}

// ---------- event detail ----------
function viewEvent(id, u) {
  const e = S.event(id); if (!e) return `<div class="card empty">–</div>`;
  const past = S.isPast(e), coach = S.isCoach(u);
  let html = eventCard(e, u, true);
  if (e.note) html += `<div class="card small">${esc(e.note)}</div>`;
  if (past && e.type !== 'event' && S.isPlaying(u) && S.attended(e.id, u.id)) {
    const s = S.selfOf(u.id, e.id);
    html += `<button class="btn block" data-act="self" data-eid="${e.id}">📝 ${t('to_assess')}${s ? ' · ' + '★'.repeat(s.rating) : ''}</button>`;
  }
  if (past && coach && e.type !== 'event') {
    html += e.type === 'match'
      ? `<button class="btn primary block" data-act="match-report" data-eid="${e.id}">⚽ ${t('match_report')}${e.result ? ' ✓' : ''}</button>`
      : `<button class="btn primary block" data-act="attendance" data-eid="${e.id}">✓ ${t('confirm_attendance')}${S.attendanceConfirmed(e.id) ? ' ✓' : ''}</button>`;
  }
  if (e.type === 'match' && S.isStaff(u)) html += `<button class="btn block share-btn" data-act="graphic" data-eid="${e.id}">📸 ${t('graphic')}</button>`;
  if (past && e.type === 'match' && e.result) {
    const st = S.matchStats(e.id);
    const rows = Object.entries(st).map(([pid, s]) => ({ p: S.user(pid), s })).filter(x => x.p).sort((a, b) => b.s.min - a.s.min || a.p.num - b.p.num);
    html += `<div class="sec-t">${t('played')}</div><section class="card list">${rows.map(({ p, s }) => `<a class="row" href="#/p/${p.id}">${avatar(p, 'sm')}<span class="grow">${esc(p.name)}</span><span class="mini-stats">${s.min}'${s.g ? ` <b>⚽${s.g > 1 ? '×' + s.g : ''}</b>` : ''}${s.a ? ` 🅰${s.a > 1 ? '×' + s.a : ''}` : ''}${s.y ? ' 🟨' : ''}${s.r ? ' 🟥' : ''}</span></a>`).join('')}</section>`;
  }
  const groups = { yes: [], no: [], open: [] };
  S.players().forEach(p => { const r = S.rsvp(e.id, p.id); groups[r ? r.s : 'open'].push({ p, r }); });
  html += `<div class="sec-t">${past ? t('attendance') : t('responses')}</div>`;
  if (past && S.attendanceConfirmed(e.id)) {
    const came = S.players().filter(p => S.attended(e.id, p.id));
    html += `<section class="card"><div class="avs">${came.map(p => avatar(p, 'sm')).join('')}</div><small class="muted">${came.length} ${t('attended')}</small></section>`;
  }
  html += `<section class="card list">${['yes', 'no', 'open'].map(k => groups[k].length ? `<div class="grp-h g-${k}">${{ yes: t('coming'), no: t('not_coming'), open: t('open') }[k]} · ${groups[k].length}</div>` + groups[k].map(({ p, r }) => `
    <a class="row" href="#/p/${p.id}">${avatar(p, 'sm')}<span class="grow">${esc(p.name)} ${availBadge(p.id)}${r?.s === 'no' ? `<small>${t('reason_' + r.reason)}${r.text ? ' · ' + esc(r.text) : ''}</small>` : ''}</span></a>`).join('') : '').join('')}</section>`;
  if (S.isStaff(u) && !past) html += `<button class="btn danger-ghost block" data-act="del-event" data-eid="${e.id}">${t('delete')}</button>`;
  return html;
}

// ---------- messages: team chat, board chat, private notes ----------
function viewMsg(tab, u) {
  const chs = S.channels(u);
  const tabs = [...chs.map(ch => [ch, t('ch_' + ch), S.unreadChat(u, ch)]), ...(S.seesNotes(u) ? [['notes', t('ch_notes'), S.unreadNotes(u).length]] : [])];
  if (!tabs.some(x => x[0] === tab)) tab = 'team';
  const nav = tabsNav('msg', tab, tabs);
  if (tab === 'notes') return nav + viewNotes(u);
  const list = S.messages(tab);
  let lastDay = '', out = '';
  list.forEach(m => {
    const day = m.at.slice(0, 10);
    if (day !== lastDay) { out += `<div class="day-sep"><span>${fmtDate(day)}</span></div>`; lastDay = day; }
    const from = S.user(m.from), mine = m.from === u.id;
    out += `<div class="bub ${mine ? 'mine' : ''}">${mine ? '' : avatar(from, 'xs')}<div class="bb">${mine ? '' : `<b class="who r-${from?.role}">${esc(from?.name || '?')}</b>`}<p>${esc(m.text)}</p><small>${fmtTime(m.at)}</small></div></div>`;
  });
  S.markChatSeen(u, tab);
  return `${nav}<div class="chat-list">${out || empty()}</div>
    <form class="composer" data-ch="${tab}"><input id="cm" autocomplete="off" maxlength="1000" placeholder="${t('type_message')}" aria-label="${t('type_message')}"><button class="send" aria-label="${t('send')}">${svg('M4 12l16-8-6 16-2.5-6.5z')}</button></form>`;
}
let notesTab = 'in';
function viewNotes(u) {
  const coach = S.isCoach(u);
  const all = S.data().notes.filter(n => coach ? (n.kind === 'toCoach' || n.from === u.id || n.kind === 'coach') : (n.to === u.id || n.from === u.id));
  const inbox = all.filter(n => coach ? n.kind === 'toCoach' : n.kind === 'coach' && n.to === u.id);
  const sent = all.filter(n => n.from === u.id);
  const list = (notesTab === 'in' ? inbox : sent).sort((a, b) => b.at.localeCompare(a.at));
  const html = `<button class="btn primary block" data-act="${coach ? 'pick-note' : 'fb-coach'}">✍️ ${coach ? t('write_note') : t('write_to_coach')}</button>
    ${seg('notes-tab', notesTab, [['in', t('notes_in')], ['out', t('notes_out')]])}
    <section class="card list">${list.length ? list.map(n => noteRow(n, u, true)).join('') : `<div class="row muted">${t('no_notes')}</div>`}</section>
    <p class="private-note">🔒 ${t('private_area')}</p>`;
  S.markSeen(u);
  return html;
}

// ---------- stats ----------
let sortKey = 'rate';
function viewStats(tab, u) {
  const tabs = [['team', t('team_stats')], ['players', t('player_stats_tab')], ...(S.isPlaying(u) ? [['me', t('my_stats')]] : [])];
  if (!tabs.some(x => x[0] === tab)) tab = 'team';
  const nav = tabsNav('stats', tab, tabs);
  if (tab === 'me') return nav + playerBody(u.id, u);
  if (tab === 'players') {
    const rows = S.players().map(p => ({ p, s: S.playerStats(p.id) })).sort((a, b) => b.s[sortKey] - a.s[sortKey] || a.p.num - b.p.num);
    const cols = [['rate', t('attendance_rate')], ['m', t('matches')], ['min', t('minutes')], ['g', t('goals')], ['a', t('assists')], ['y', t('yellow')]];
    if (!rows.length) return `${nav}<div class="card empty">${t('no_app_players')}</div>${seasonTable()}`;
    return `${nav}${S.isStaff(u) ? `<button class="btn block" data-act="csv">⬇ ${t('export_csv')}</button>` : ''}
      <section class="card tbl-wrap"><table class="tbl"><thead><tr><th></th>${cols.map(([k, l]) => `<th><button data-act="sort" data-v="${k}" class="${sortKey === k ? 'on' : ''}">${l}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(({ p, s }) => `<tr><td><a href="#/p/${p.id}">${esc(p.name.split(' ')[0])} ${esc((p.name.split(' ')[1] || '')[0] || '')}.</a></td><td>${s.rate}%</td><td>${s.m}</td><td>${s.min}</td><td>${s.g}</td><td>${s.a}</td><td>${s.y}</td></tr>`).join('')}</tbody></table></section>
      ${seasonTable()}`;
  }
  const rec = S.teamRecord();
  const ms = S.pastEvents().filter(e => e.type === 'match' && e.result).reverse();
  const maxG = Math.max(4, ...ms.map(e => Math.max(e.result.us, e.result.them)));
  const scorers = S.players().map(p => ({ p, s: S.playerStats(p.id) })).filter(r => r.s.g).sort((a, b) => b.s.g - a.s.g).slice(0, 5);
  return `${nav}<div class="tiles four">
      <div class="tile"><b class="c-w">${rec.w}</b><small>${t('wins')}</small></div><div class="tile"><b>${rec.d}</b><small>${t('draws')}</small></div>
      <div class="tile"><b class="c-l">${rec.l}</b><small>${t('losses')}</small></div><div class="tile"><b>${rec.gf}:${rec.ga}</b><small>${t('goals_for')} : ${t('goals_against')}</small></div>
    </div>
    <section class="card"><div class="card-h">${t('record')} · ${t('season')}</div><div class="match-chart">${ms.map(e => `<a href="#/ev/${e.id}" class="mc" title="${esc(e.opponent)}"><span class="mc-us" style="height:${e.result.us / maxG * 100}%"></span><span class="mc-them" style="height:${e.result.them / maxG * 100}%"></span><small>${esc(e.opponent.split(' ').pop().slice(0, 3))}</small></a>`).join('')}</div>
      <div class="legend small muted"><span class="sw us"></span>TTSC <span class="sw them"></span>${t('opponent')}</div></section>
    ${leagueTable()}
    <section class="card form-card">${rec.form.map(f => `<span class="fm fm-${f.k}" title="${esc(f.e.opponent)}">${t({ w: 'wins', d: 'draws', l: 'losses' }[f.k])}</span>`).join('')}<span class="grow"></span><b>${t('form')}</b></section>
    ${scorers.length ? `<div class="sec-t">${t('top_scorers')}</div><section class="card list">${scorers.map((r, i) => `<a class="row" href="#/p/${r.p.id}"><span class="rank">${i + 1}</span>${avatar(r.p, 'sm')}<span class="grow">${esc(r.p.name)}</span><b>${r.s.g}</b></a>`).join('')}</section>` : ''}`;
}

function seasonTable() {
  const rows = S.seasonStats(); if (!rows.length) return '';
  const d = new Date((rows[0].updated_on || S.TODAY()) + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `<section class="card tbl-wrap league"><div class="card-h">${t('ss_title')}</div>
    <table class="tbl"><thead><tr><th></th><th>${t('ss_apps')}</th><th>${t('minutes')}</th><th>${t('goals')}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td class="tn">${esc(r.name)}</td><td>${r.apps}</td><td>${r.minutes}</td><td>${r.goals ? '<b>' + r.goals + '</b>' : 0}</td></tr>`).join('')}</tbody></table>
    <a class="small link src" href="${esc(rows[0].source || 'https://www.fussball.de')}" target="_blank" rel="noopener">${t('lt_source', { date: d })} ›</a></section>`;
}
function leagueTable() {
  const LEAGUE = S.league() || STATIC_LEAGUE;
  if (!LEAGUE) return '';
  const d = new Date(LEAGUE.asOf + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `<section class="card tbl-wrap league"><div class="card-h">${t('lt_title')} · ${esc(LEAGUE.league)}</div>
    <table class="tbl"><thead><tr><th>#</th><th></th><th>${t('lt_played')}</th><th>${t('wins')}</th><th>${t('draws')}</th><th>${t('losses')}</th><th>${t('lt_goals')}</th><th>${t('lt_pts')}</th></tr></thead>
    <tbody>${LEAGUE.rows.map(([pos, team, p, w, dr, l, g, pts]) => `<tr class="${team === LEAGUE.us ? 'us' : ''}"><td>${pos}</td><td class="tn">${esc(team)}</td><td>${p}</td><td>${w}</td><td>${dr}</td><td>${l}</td><td>${g}</td><td><b>${pts}</b></td></tr>`).join('')}</tbody></table>
    <a class="small link src" href="${LEAGUE.source}" target="_blank" rel="noopener">${t('lt_source', { date: d })} ›</a></section>`;
}

// ---------- player profile ----------
function viewPlayer(id, u) { return playerBody(id, u); }
function playerBody(id, u) {
  const p = S.user(id); if (!p || !S.isPlaying(p)) return `<div class="card empty">–</div>`;
  const st = S.playerStats(id), mine = u.id === id, coach = S.isCoach(u), canPrivate = mine || coach;
  const recent = S.pastEvents().filter(e => e.type !== 'event').slice(0, 14).reverse();
  let html = `<section class="profile-h">${avatar(p, 'xl')}<div><h1>${esc(p.name)}</h1><div class="muted">${t('pos_' + p.pos)} · #${p.num} · ${LANGS[p.lang]} ${availBadge(id)}</div></div></section>
    <div class="tiles">
      <div class="tile"><b>${st.rate}%</b><small>${t('attendance_rate')}</small></div>
      <div class="tile"><b>${st.m}</b><small>${t('matches')}</small></div>
      <div class="tile"><b>${st.min}'</b><small>${t('minutes')}</small></div>
      <div class="tile"><b>${st.g}</b><small>${t('goals')}</small></div>
      <div class="tile"><b>${st.a}</b><small>${t('assists')}</small></div>
      <div class="tile"><b>${st.y}<span class="yc"></span> ${st.r}<span class="rc"></span></b><small>${t('yellow')} / ${t('red')}</small></div>
    </div>
    ${(() => { const f = S.seasonOf(p.name); return f ? `<div class="small muted fb-line">fussball.de · ${t('season')}: ${f.apps} ${t('ss_apps')} · ${f.minutes}' · ${f.goals} ${t('goals')}</div>` : ''; })()}
    <div class="sec-t">${t('last_events')}</div>
    <section class="card"><div class="strip">${recent.map(e => `<a href="#/ev/${e.id}" class="sq ${S.attended(e.id, id) ? 'in' : 'out'}" title="${fmtDate(e.date)} · ${evTitle(e)}">${e.type === 'match' ? '⚽' : ''}</a>`).join('')}</div>
      <div class="legend small muted"><span class="sq in"></span>${t('attended')} <span class="sq out"></span>${t('missed')} · ⚽ ${t('match')}</div></section>`;
  if (!canPrivate) return html;
  html += `<div class="private-note">🔒 ${t('private_area')}</div>`;
  if (coach && !mine) html += `<button class="btn primary block" data-act="coach-note" data-pid="${id}">✍️ ${t('write_note')}</button>`;
  const notes = S.notesFor(u, id);
  html += `<div class="sec-t">${t('notes_thread')}</div><section class="card list">${notes.length ? notes.map(n => noteRow(n, u)).join('') : `<div class="row muted">${t('no_notes')}</div>`}</section>`;
  html += `<div class="sec-t">${t('iq_title')}</div>${iqCard(id, mine)}`;
  const selfs = S.selfFor(id).slice(0, 10);
  if (selfs.length) {
    html += `<div class="sec-t">${t('self_history')}</div><section class="card"><div class="bars">${selfs.slice().reverse().map(s => { const e = S.event(s.eid); return `<span class="bar" style="height:${s.rating * 20}%" title="${e ? fmtDate(e.date) : ''}"><i>${s.rating}</i></span>`; }).join('')}</div></section>
      <section class="card list">${selfs.slice(0, 4).map(s => { const e = S.event(s.eid); return `<div class="row col"><small class="muted">${e ? evIcon(e) + ' ' + evTitle(e) + ' · ' + fmtDate(e.date) : ''} · ${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)}</small>${tagLine(s.good, 'good')}${tagLine(s.improve, 'imp')}${s.text ? `<p>${esc(s.text)}</p>` : ''}</div>`; }).join('')}</section>`;
  }
  return html;
}
const tagLine = (tags, cls) => tags && tags.length ? `<div class="tags">${tags.map(k => `<span class="tag t-${cls}">${t('tag_' + k)}</span>`).join('')}</div>` : '';
function noteRow(n, viewer, withTarget = false) {
  const from = S.user(n.from), to = S.user(n.to), when = new Date(n.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const head = n.kind === 'coach' ? `${t('coach_note')} · ${esc(from?.name || '')}${withTarget && to ? ' → ' + esc(to.name) : ''}` : `${from?.id === viewer.id ? t('you') : esc(from?.name || '')} → ${t('to_coaches')}`;
  return `<div class="row col note n-${n.kind}"><small class="muted">${head} · ${when}</small>
    ${tagLine(n.good, 'good')}${tagLine(n.improve, 'imp')}${n.tags ? `<div class="tags">${n.tags.map(k => `<span class="tag">${t('fb_' + k)}</span>`).join('')}</div>` : ''}
    ${n.text ? `<p>${esc(n.text)}</p>` : ''}${viewer.role === 'coach' && (n.kind === 'toCoach' || withTarget) ? `<a class="small link" href="#/p/${n.kind === 'toCoach' ? n.from : n.to}">${t('view_profile')} ›</a>` : ''}</div>`;
}

// ---------- games ----------
function iqCard(pid, mine) {
  const prof = S.iqProfile(pid);
  if (!prof.some(p => p.n)) return `<section class="card"><div class="row muted">${t(mine ? 'iq_empty' : 'iq_none')}</div></section>`;
  return `<section class="card list iq-card">${prof.map(p => { const g = IQ.find(x => x.id === p.game);
    return `<div class="row"><span class="ti sm" style="--c:${g.c}">${svg(g.icon)}</span><span class="grow"><b>${t(g.sk)}</b><small>${g.name} · ${p.n ? t('iq_played', { n: p.n }) + ' · ' + t('iq_best', { n: p.best }) : '–'}</small>
      ${p.trend.length > 1 ? `<span class="spark">${p.trend.map(v => `<i style="height:${Math.max(8, v)}%"></i>`).join('')}</span>` : ''}</span>
      ${p.acc == null ? '<span class="pct muted">–</span>' : `<span class="meter"><span style="width:${p.acc}%" class="${p.acc < 50 ? 'low' : p.acc < 75 ? 'mid' : ''}"></span></span><span class="pct">${p.acc}%</span>`}</div>`; }).join('')}
    <div class="row small muted">${t('iq_note')}</div></section>`;
}
function viewGames(_, u) {
  return `<div class="sec-t">${t('iq_title')}</div><p class="muted small iq-hint">${t('iq_hint')}</p>
    <div class="grid games">${IQ.map(g => `<button type="button" class="tile-m game iq" data-act="play" data-g="${g.id}" style="--c:${g.c}"><span class="ti">${svg(g.icon)}</span><span class="tl">${g.name}</span><small>${t('g_' + g.id.replace('-', '_'))}</small></button>`).join('')}</div>
    <div class="sec-t">${t('iq_mine')}</div>${iqCard(u.id, true)}
    <div class="sec-t">${t('other_games')}</div>
    <div class="grid games">${GAMES.map(g => `<a class="tile-m game" href="${g.url}" target="_blank" rel="noopener" style="--c:${g.c || '#E08A00'}">
      ${g.img ? `<img class="gi" src="${g.img}" alt="" width="64" height="64">` : `<span class="ti emoji">${g.emoji}</span>`}<span class="tl">${g.name}</span><small>${g.desc[getLang()] ?? g.desc.en}</small></a>`).join('')}</div>
    <p class="muted small center">${t('games_soon')}</p>`;
}

// ---------- club: public links ----------
function viewClub() {
  return `<section class="card club-h"><img src="assets/logo.png" alt="TTSC Buchen" width="72" height="75"><div><h1>TTSC Buchen e.V.</h1><p class="muted">${t('club_since')}</p></div></section>
    <section class="card list">${CLUB.map(l => `<a class="row" href="${l.url}" target="_blank" rel="noopener"><span class="ti sm" style="--c:${l.c}">${svg(l.icon)}</span><span class="grow"><b>${t(l.k)}</b><small>${l.label}</small></span><span class="chev">›</span></a>`).join('')}</section>
    <button class="btn primary block" data-act="share-app">↗ ${t('share_app')}</button>
    ${S.isStaff(S.me()) ? `<button class="btn block" data-act="show-qr">▦ ${t('join_qr')}</button>` : ''}
    <a class="link-btn" href="datenschutz.html">${t('privacy')}</a>`;
}

// ---------- player tracking (coach, board) ----------
function viewPlayers(_, u) {
  const pl = S.players(), al = S.coachAlerts();
  const cnt = s => pl.filter(p => S.availability(p.id).s === s).length;
  return `<section class="card"><div class="card-h">${t('squad_overview')}</div><div class="tags big">
      <span class="tag t-good">${t('available_n', { n: cnt('fit') })}</span><span class="tag t-imp">${t('limited_n', { n: cnt('limited') })}</span><span class="tag t-bad">${t('injured_n', { n: cnt('injured') })}</span></div></section>
    <div class="sec-t">${t('coach_alerts')}</div><section class="card list">${al.length ? al.map(a => `
      <a class="row alert a-${a.level}" href="${a.eid ? '#/ev/' + a.eid : a.pid ? '#/p/' + a.pid : '#/players'}"><span class="ai">${a.level === 'warn' ? '!' : 'i'}</span><span class="grow">${esc(t(a.k, a.v))}</span><span class="chev">›</span></a>`).join('') : `<div class="row muted">${t('all_good')}</div>`}</section>
    ${S.isStaff(u) ? `<button class="btn block" data-act="add-player">+ ${t('add_player')}</button>` : ''}
    ${invitedList()}
    ${['TW', 'AB', 'MF', 'ST'].map(pos => `<div class="sec-t">${t('pos_' + pos)}</div><section class="card list">${pl.filter(p => p.pos === pos).map(p => {
      const st = S.playerStats(p.id);
      return `<a class="row" href="#/p/${p.id}">${avatar(p)}<span class="grow"><b>${esc(p.name)}</b> ${availBadge(p.id)}<small>${LANGS[p.lang]}</small></span>
        <span class="meter"><span style="width:${st.rate}%" class="${st.rate < 60 ? 'low' : st.rate < 80 ? 'mid' : ''}"></span></span><span class="pct">${st.rate}%</span></a>`;
    }).join('')}</section>`).join('')}`;
}

const pendingList = () => { const p = S.pendingUsers(); return p.length ? `<div class="sec-t">${t('pending_list')} · ${p.length}</div><section class="card list">${p.map(x => `<div class="row">${avatar(x, 'sm')}<span class="grow"><b>${esc(x.name)}</b>${x.num ? `<small>#${x.num}</small>` : ''}</span><button class="btn sm primary" data-act="approve" data-id="${x.id}">${t('approve')}</button></div>`).join('')}</section>` : ''; };
const invitedList = () => { const inv = S.invites(); return inv.length ? `<div class="sec-t">${t('invites_pending')}</div><section class="card list">${inv.map(i => `<div class="row"><span class="av sm av-pending">✉</span><span class="grow"><b>${esc(i.name)}</b><small>${esc(i.email)} · ${t('role_' + i.role)}${i.plays ? ' · ' + t('also_plays') : ''}</small></span></div>`).join('')}</section>` : ''; };
// ---------- members and fees (board) ----------
let onlyOpen = false;
function viewMembers(_, u) {
  const y = S.FEE_YEAR, sum = S.memberSummary(y);
  const list = S.members().filter(m => !onlyOpen || !m.fees[y]);
  let html = `<div class="tiles four">
      <div class="tile"><b>${sum.total}</b><small>${t('members_total')}</small></div><div class="tile"><b class="c-w">${sum.paid}</b><small>${t('fees_paid')}</small></div>
      <div class="tile"><b class="c-l">${sum.open}</b><small>${t('fees_open')}</small></div><div class="tile"><b>${sum.got}€</b><small>${t('fees_sum')} / ${sum.due}€</small></div></div>
    <div class="head-row"><label class="check"><input type="checkbox" data-act="only-open" ${onlyOpen ? 'checked' : ''}> ${t('only_open')}</label><button class="btn sm" data-act="add-member">+ ${t('add_member')}</button></div>
    <div class="sec-t">${t('fee_year', { y })}</div><section class="card list">${list.map(m => `
      <div class="row"><span class="grow"><b>${esc(m.name)}</b>${m.userId ? ' <span class="badge b-app">' + t('app_user') + '</span>' : ''}<small>${t('m_' + m.type)} · ${S.FEES[m.type]}€ · ${t('member_since', { y: m.since })}</small></span>
        <button class="pay ${m.fees[y] ? 'paid' : ''}" data-act="fee" data-id="${m.id}">${m.fees[y] ? '✓ ' + t('mark_paid') : t('mark_open')}</button></div>`).join('') || empty()}</section>`;
  if (S.isAdmin(u)) {
    html += pendingList() + `<button class="btn block" data-act="show-qr">▦ ${t('join_qr')}</button>`;
    html += `<div class="sec-t">${t('roles_title')}</div>${S.isDemo() ? '' : `<button class="btn primary block" data-act="invite">✉ ${t('invite_person')}</button>${invitedList()}`}<div class="sec-t">${t('in_app')}</div><section class="card list">${S.users().filter(x => !S.isPlaying(x) || x.role !== 'player').concat(S.players().filter(x => x.role === 'player')).map(x => `
      <div class="row">${avatar(x, 'sm')}<span class="grow">${esc(x.name)}</span><select data-act-change="role" data-id="${x.id}" ${x.id === u.id ? 'disabled' : ''}>${S.ROLES.map(r => `<option value="${r}" ${x.role === r ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select>
        ${x.role !== 'player' ? `<label class="plays"><input type="checkbox" data-act-change="plays" data-id="${x.id}" ${x.plays ? 'checked' : ''}> ${t('also_plays')}</label>` : ''}</div>`).join('')}</section>`;
  }
  return html;
}

// ---------- import link (board): #/import/<base64url JSON> ----------
// Data travels in the part of the link after '#', which the browser never sends to any server,
// so names in it don't end up in the public repository or in server logs.
let pendingImport = null;
function readImport(id) {
  if (!id) return null;
  try {
    const bin = atob(id.replace(/-/g, '+').replace(/_/g, '/'));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (d.kind !== 'season_stats' || !Array.isArray(d.rows)) return null;
    return d;
  } catch (e) { return null; }
}
function viewImport(id) {
  if (id) { pendingImport = readImport(id) || pendingImport; history.replaceState(null, '', location.pathname + '#/import'); }
  const d = pendingImport;
  if (!d) return `<div class="card empty">${t('import_bad')}</div>`;
  if (S.isDemo()) return `<div class="card empty">${t('import_demo')}</div>`;
  const goals = d.rows.reduce((s, r) => s + (r[3] || 0), 0);
  return `<section class="card"><div class="card-h">${t('ss_title')} · ${esc(d.season)}</div>
      <p class="small">${t('import_what', { n: d.rows.length, g: goals })}</p>
      <button class="btn primary block" data-act="import-go">${t('import_go')}</button></section>
    <section class="card tbl-wrap league"><table class="tbl"><thead><tr><th></th><th>${t('ss_apps')}</th><th>${t('minutes')}</th><th>${t('goals')}</th></tr></thead>
      <tbody>${d.rows.map(r => `<tr><td class="tn">${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></section>`;
}

// ---------- clubhouse: bookings and repairs (board) ----------
function viewBuilding(tab, u) {
  if (!['bookings', 'repairs'].includes(tab)) tab = 'bookings';
  const open = S.repairs().filter(r => r.status === 'open').length;
  const nav = tabsNav('building', tab, [['bookings', t('bookings')], ['repairs', t('repairs'), open]]);
  if (tab === 'bookings') {
    const list = S.bookings().filter(b => b.date >= S.TODAY());
    return `${nav}<button class="btn primary block" data-act="add-booking">+ ${t('add_booking')}</button>
      <section class="card list">${list.map(b => `<div class="row"><span class="ev-date"><b>${new Date(b.date + 'T12:00:00').getDate()}</b><small>${fmtDate(b.date, { month: 'short' })}</small></span>
        <span class="grow"><b>${esc(b.title)}</b><small>${fmtDate(b.date, { weekday: 'long' })} ${b.time} · ${esc(b.who)}${b.note ? ' · ' + esc(b.note) : ''}</small></span>
        <button class="x" data-act="del-booking" data-id="${b.id}" aria-label="${t('delete')}">✕</button></div>`).join('') || empty()}</section>`;
  }
  return `${nav}<button class="btn primary block" data-act="add-repair">+ ${t('add_repair')}</button>
    <section class="card list">${S.repairs().map(r => `<div class="row col rep-${r.status}"><div class="head-row"><b>${esc(r.title)}</b><span class="badge st-${r.status}">${t('st_' + r.status)}</span></div>
      ${r.text ? `<p class="small">${esc(r.text)}</p>` : ''}<small>${t('reported_by')}: ${esc(S.user(r.by)?.name || '?')} · ${new Date(r.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</small>
      <div class="seg mini">${['open', 'doing', 'done'].map(s => `<button class="${r.status === s ? 'on' : ''}" data-act="repair-st" data-id="${r.id}" data-v="${s}">${t('st_' + s)}</button>`).join('')}</div></div>`).join('') || empty()}</section>`;
}

// ---------- me ----------
// notifications card (profile page; also on home until switched on or dismissed)
let pushOn = null;
function pushCard(home = false) {
  if (!S.pushReady()) return '';
  const sup = S.pushSupport();
  if (pushOn === null) S.pushState().then(v => { pushOn = v === 'on'; render(); });
  if (home && (pushOn !== false || S.pref('push-hidden') || sup === 'no')) return '';
  const body = sup === 'ios-install' ? `<small>${t('push_ios')}</small>`
    : sup === 'denied' ? `<small>${t('push_denied')}</small>`
    : sup === 'no' ? `<small>${t('push_no')}</small>`
    : pushOn ? `<small>✓ ${t('push_on')}</small><button class="btn sm" data-act="push-off">${t('push_turn_off')}</button>`
    : `<small>${t('push_why')}</small><button class="btn primary sm" data-act="push-on">${t('push_turn_on')}</button>`;
  return `<section class="card install push"><span class="inst-ic">🔔</span><div class="grow"><b>${t('push_title')}</b>${body}</div>${home ? `<button class="x" data-act="push-hide" aria-label="${t('close')}">✕</button>` : ''}</section>`;
}
function viewMe(_, u) {
  return `<section class="card profile-h sm">${avatar(u, 'lg')}<div><b>${esc(u.name)}</b><div class="muted small">${t('role_' + u.role)}${u.plays ? ' · ' + t('also_plays') : ''}${u.title ? ' · ' + esc(u.title) : ''}</div></div>${S.isPlaying(u) ? `<a class="btn sm" href="#/stats/me">${t('my_stats')}</a>` : ''}</section>
    ${pushCard()}
    <div class="sec-t">${t('language')}</div><section class="card"><div class="seg">${Object.entries(LANGS).map(([k, v]) => `<button class="${u.lang === k ? 'on' : ''}" data-act="lang" data-v="${k}">${v}</button>`).join('')}</div><small class="muted">${t('multi_hint')}</small></section>
    ${S.isDemo() ? `<div class="demo-banner">${t('demo_banner')}</div>` : ''}
    <a class="btn block" href="datenschutz.html">🔒 ${t('privacy')}</a>
    <button class="btn block" data-act="switch">${t('logout')}</button>
    ${S.isDemo() ? `<button class="btn danger-ghost block" data-act="reset">${t('reset_demo')}</button><button class="btn danger-ghost block" data-act="demo-off">${t('login_back_real')}</button>` : ''}`;
}

// ---------- sheets ----------
function reasonSheet(eid, u) {
  const cur = S.rsvp(eid, u.id);
  sheet(`<h3>${t('pick_reason')}</h3><div class="chips" id="rs">${REASONS.map(r => chip('reason_' + r, cur?.reason === r, `data-act="pick-one" data-v="${r}"`)).join('')}</div>
    <label class="fld"><span>${t('note_optional')}</span><input id="rt" maxlength="120" value="${esc(cur?.text || '')}"></label>${btns('rok')}`, el => {
    $('#rok', el).onclick = () => { S.setRsvp(eid, u.id, 'no', chosen(el, '#rs')[0] || 'other', $('#rt', el).value.trim()); closeSheet(); };
  });
}

function newEventSheet() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  sheet(`<h3>${t('new_event')}</h3>
    <div class="seg" id="nt"><button class="on" data-act="seg" data-v="training">${t('training')}</button><button data-act="seg" data-v="match">${t('match')}</button><button data-act="seg" data-v="event">${t('event')}</button></div>
    <label class="fld" id="tx" hidden><span>${t('event_title')}</span><input id="ntt" maxlength="60"></label>
    <div class="two"><label class="fld"><span>${t('date')}</span><input type="date" id="nd" value="${d.toISOString().slice(0, 10)}"></label><label class="fld"><span>${t('time')}</span><input type="time" id="nh" value="19:00"></label></div>
    <div id="mx" hidden><label class="fld"><span>${t('opponent')}</span><input id="no" maxlength="40"></label>
      <div class="seg" id="nha"><button class="on" data-act="seg" data-v="home">${t('home')}</button><button data-act="seg" data-v="away">${t('away')}</button></div></div>
    <label class="fld"><span>${t('place')}</span><input id="np" value="Sportplatz Buchen" maxlength="60"></label>
    <label class="fld"><span>${t('note_optional')}</span><input id="nn" maxlength="140"></label>
    <label class="check" id="rpw"><input type="checkbox" id="nr"> ${t('repeat_weekly')}</label>${btns('nok')}`, el => {
    el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-act="seg"]'); if (!b || !b.closest('#nt')) return;
      const v = b.dataset.v; $('#mx', el).hidden = v !== 'match'; $('#tx', el).hidden = v !== 'event';
      $('#np', el).value = v === 'match' ? '' : v === 'event' ? 'Vereinsheim' : 'Sportplatz Buchen';
    });
    $('#nok', el).onclick = () => {
      const type = $('#nt .on', el).dataset.v;
      const evt = { type, date: $('#nd', el).value, time: $('#nh', el).value, place: $('#np', el).value.trim(), note: $('#nn', el).value.trim() };
      if (type === 'match') { evt.opponent = $('#no', el).value.trim() || '?'; evt.home = $('#nha .on', el).dataset.v === 'home'; }
      if (type === 'event') { evt.title = $('#ntt', el).value.trim() || t('club_event'); }
      if (!evt.date) return;
      const created = S.addEvent(evt, $('#nr', el).checked ? 4 : 1); closeSheet(); location.hash = '#/ev/' + created[0].id;
    };
  });
}

function attendanceSheet(eid) {
  sheet(`<h3>${t('confirm_attendance')}</h3><div class="card list flat">${S.players().map(p => `<label class="row"><input type="checkbox" class="att" data-id="${p.id}" ${S.attended(eid, p.id) ? 'checked' : ''}>${avatar(p, 'sm')}<span class="grow">${esc(p.name)}</span><small class="muted">${S.rsvp(eid, p.id)?.s === 'no' ? t('reason_' + S.rsvp(eid, p.id).reason) : ''}</small></label>`).join('')}</div>${btns('aok')}`, el => {
    $('#aok', el).onclick = () => { const m = {}; el.querySelectorAll('.att').forEach(c => { m[c.dataset.id] = c.checked; }); S.setAttendance(eid, m); closeSheet(); toast(t('attendance_saved')); };
  });
}

function matchSheet(eid) {
  const e = S.event(eid), cur = S.matchStats(eid);
  const pl = S.players().sort((a, b) => (S.rsvp(eid, b.id)?.s === 'yes') - (S.rsvp(eid, a.id)?.s === 'yes') || a.num - b.num);
  const st = {}; pl.forEach(p => { st[p.id] = cur[p.id] ? { ...cur[p.id], on: true } : { min: 90, g: 0, a: 0, y: 0, r: 0, on: !Object.keys(cur).length && S.rsvp(eid, p.id)?.s === 'yes' }; });
  const res = e.result || { us: 0, them: 0 };
  const step = (pid, k) => `<span class="step"><button data-st="${pid}" data-k="${k}" data-d="-1">−</button><i id="v-${pid}-${k}">${st[pid][k]}</i><button data-st="${pid}" data-k="${k}" data-d="1">+</button></span>`;
  sheet(`<h3>${t('match_report')} · ${evTitle(e)}</h3><p class="small muted">${t('report_hint')}</p>
    <div class="score"><div><small>TTSC</small>${scoreStep('us', res.us)}</div><b>:</b><div><small>${esc(e.opponent)}</small>${scoreStep('them', res.them)}</div></div>
    <div class="rep">${pl.map(p => `<div class="rep-row ${st[p.id].on ? 'on' : ''}" id="r-${p.id}">
      <label class="rep-name"><input type="checkbox" data-on="${p.id}" ${st[p.id].on ? 'checked' : ''}>${avatar(p, 'sm')}<span>${esc(p.name.split(' ')[0])}</span></label>
      <div class="rep-vals"><label class="mins"><input type="number" inputmode="numeric" min="0" max="120" data-min="${p.id}" value="${st[p.id].min}">'</label>
        <span class="lab">⚽</span>${step(p.id, 'g')}<span class="lab">🅰</span>${step(p.id, 'a')}
        <span class="cards"><button class="card-btn y ${st[p.id].y ? 'on' : ''}" data-card="${p.id}" data-k="y" aria-label="${t('yellow')}"></button><button class="card-btn r ${st[p.id].r ? 'on' : ''}" data-card="${p.id}" data-k="r" aria-label="${t('red')}"></button></span></div></div>`).join('')}</div>
    <div class="sheet-btns sticky"><button class="btn" data-act="close-sheet">${t('cancel')}</button><button class="btn primary" id="mok">${t('save')}</button></div>`, el => {
    const setOn = (pid, on) => { st[pid].on = on; $('#r-' + pid, el).classList.toggle('on', on); $(`[data-on="${pid}"]`, el).checked = on; };
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.st) { const s = st[b.dataset.st], k = b.dataset.k; s[k] = Math.max(0, Math.min(9, s[k] + +b.dataset.d)); $(`#v-${b.dataset.st}-${k}`, el).textContent = s[k]; if (s[k] && !s.on) setOn(b.dataset.st, true); }
      if (b.dataset.card) { const s = st[b.dataset.card]; s[b.dataset.k] = s[b.dataset.k] ? 0 : 1; b.classList.toggle('on', !!s[b.dataset.k]); }
      if (b.dataset.sc) { const i = $('#sc-' + b.dataset.sc, el); i.textContent = Math.max(0, Math.min(30, +i.textContent + +b.dataset.d)); }
    });
    el.addEventListener('change', ev => { const c = ev.target; if (c.dataset.on) setOn(c.dataset.on, c.checked); if (c.dataset.min) st[c.dataset.min].min = Math.max(0, Math.min(120, +c.value || 0)); });
    $('#mok', el).onclick = () => {
      const out = {}; Object.entries(st).forEach(([pid, s]) => { if (s.on) out[pid] = { min: s.min, g: s.g, a: s.a, y: s.y, r: s.r }; });
      S.saveMatch(eid, { us: +$('#sc-us', el).textContent, them: +$('#sc-them', el).textContent }, out); closeSheet(); toast(t('report_saved'));
    };
  });
}
const scoreStep = (k, v) => `<span class="step big"><button data-sc="${k}" data-d="-1">−</button><i id="sc-${k}">${v}</i><button data-sc="${k}" data-d="1">+</button></span>`;
const tagPicker = (id, keys, prefix, sel = []) => `<div class="chips" id="${id}">${keys.map(k => chip(prefix + k, sel.includes(k), `data-act="toggle" data-v="${k}"`)).join('')}</div>`;

function pickPlayerSheet(coach) {
  sheet(`<h3>${t('pick_player')}</h3><div class="card list flat">${S.players().map(p => `<button class="row" data-pick="${p.id}">${avatar(p, 'sm')}<span class="grow">${esc(p.name)}</span><span class="chev">›</span></button>`).join('')}</div>`, el => {
    el.addEventListener('click', ev => { const b = ev.target.closest('[data-pick]'); if (b) coachNoteSheet(b.dataset.pick, coach); });
  });
}
function coachNoteSheet(pid, coach) {
  const p = S.user(pid), last = S.pastEvents().find(e => S.attended(e.id, pid));
  sheet(`<h3>${t('note_to', { name: esc(p.name) })}</h3><p class="small muted">🔒 ${t('private_hint')} ${t('multi_hint')}</p>
    <div class="lbl good">👍 ${t('went_well')}</div>${tagPicker('cg', TAGS, 'tag_')}
    <div class="lbl imp">🎯 ${t('to_improve')}</div>${tagPicker('ci', TAGS, 'tag_')}
    <label class="fld"><span>${t('note_optional')}</span><textarea id="ct" rows="3" maxlength="500"></textarea></label>${btns('cok')}`, el => {
    $('#cok', el).textContent = t('send');
    $('#cok', el).onclick = () => {
      const good = chosen(el, '#cg'), improve = chosen(el, '#ci'), text = $('#ct', el).value.trim();
      if (!good.length && !improve.length && !text) return;
      S.addNote({ kind: 'coach', from: coach.id, to: pid, eid: last?.id, good, improve, text }); closeSheet(); toast(t('note_sent'));
    };
  });
}
function feedbackSheet(u) {
  sheet(`<h3>${t('feedback_coach')}</h3><p class="small muted">🔒 ${t('feedback_hint')}</p>${tagPicker('ft', FB_TAGS, 'fb_')}
    <label class="fld"><span>${t('note')}</span><textarea id="fx" rows="4" maxlength="500"></textarea></label>${btns('fok')}`, el => {
    $('#fok', el).textContent = t('send');
    $('#fok', el).onclick = () => {
      const tags = chosen(el, '#ft'), text = $('#fx', el).value.trim(); if (!tags.length && !text) return;
      S.addNote({ kind: 'toCoach', from: u.id, to: 'coaches', tags, text }); closeSheet(); toast(t('note_sent'));
    };
  });
}
function selfSheet(eid, u) {
  const e = S.event(eid), cur = S.selfOf(u.id, eid) || { rating: 0, good: [], improve: [], text: '' };
  let rating = cur.rating;
  sheet(`<h3>${t('assess_prompt', { event: evTitle(e) })}</h3><p class="small muted">${fmtDate(e.date)} · 🔒 ${t('private_area')}</p>
    <div class="lbl">${t('rating')}</div><div class="stars" id="ss">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}" class="${i <= rating ? 'on' : ''}">★</button>`).join('')}</div>
    <div class="lbl good">👍 ${t('went_well')}</div>${tagPicker('sg', TAGS, 'tag_', cur.good)}
    <div class="lbl imp">🎯 ${t('to_improve')}</div>${tagPicker('si', TAGS, 'tag_', cur.improve)}
    <label class="fld"><span>${t('note_optional')}</span><textarea id="sx" rows="2" maxlength="300">${esc(cur.text)}</textarea></label>${btns('sok')}`, el => {
    $('#ss', el).onclick = ev => { const b = ev.target.closest('button'); if (!b) return; rating = +b.dataset.v; el.querySelectorAll('#ss button').forEach(x => x.classList.toggle('on', +x.dataset.v <= rating)); };
    $('#sok', el).onclick = () => {
      if (!rating) { $('#ss', el).classList.add('shake'); setTimeout(() => $('#ss', el).classList.remove('shake'), 400); return; }
      S.addSelf({ pid: u.id, eid, rating, good: chosen(el, '#sg'), improve: chosen(el, '#si'), text: $('#sx', el).value.trim() }); closeSheet(); toast(t('self_saved'));
    };
  });
}
function addPlayerSheet(role = 'player', admin = false) {
  const server = !S.isDemo();
  sheet(`<h3>${admin ? t('invite_person') : t('add_player')}</h3>
    ${server ? `<p class="small muted">${t('invite_hint')}</p>` : ''}
    <label class="fld"><span>${t('name')}</span><input id="pn" maxlength="40"></label>
    ${server ? `<label class="fld"><span>${t('email')}</span><input id="pe" type="email" inputmode="email" autocomplete="off" maxlength="120"></label>` : ''}
    ${admin ? `<label class="fld"><span>${t('role')}</span><select id="pr">${S.ROLES.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select></label>` : ''}
    ${admin ? `<label class="check" id="ppw"><input type="checkbox" id="pplays"> ${t('also_plays')}</label>` : ''}
    <div class="two" id="pfx"><label class="fld"><span>${t('number')}</span><input id="pu" type="number" inputmode="numeric" min="1" max="99"></label>
      <label class="fld"><span>${t('position')}</span><select id="pp">${['TW', 'AB', 'MF', 'ST'].map(p => `<option value="${p}">${t('pos_' + p)}</option>`).join('')}</select></label></div>
    <label class="fld"><span>${t('language')}</span><select id="pl">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === getLang() ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${btns('pok')}`, el => {
    const pr = $('#pr', el), pp = $('#pplays', el);
    if (pr) { const sync = () => { const pl = pr.value === 'player'; $('#ppw', el).hidden = pl; $('#pfx', el).hidden = !pl && !pp.checked; }; pr.onchange = sync; pp.onchange = sync; sync(); }
    $('#pok', el).onclick = () => {
      const name = $('#pn', el).value.trim(), email = $('#pe', el)?.value.trim() || '';
      if (!name || (server && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) { el.querySelector(name ? '#pe' : '#pn').focus(); return; }
      const r = pr ? pr.value : 'player', plays = r === 'player' || !!pp?.checked;
      const d = { name, email, num: plays ? $('#pu', el).value : '', pos: plays ? $('#pp', el).value : '', lang: $('#pl', el).value };
      if (server) { if (r === 'player') S.addPlayer(d); else S.invite({ ...d, role: r, plays }); closeSheet(); toast(t('invite_sent')); return; }
      const p = S.addPlayer(d); closeSheet(); location.hash = '#/p/' + p.id;
    };
  });
}
// Instagram graphics (js/share.js), loaded only when needed
let gfx = { kind: null, format: 'story', photo: null };
async function graphicSheet(eid) {
  const e = S.event(eid); if (!e) return;
  const G = await import('./share.js'); await G.ready();
  gfx.kind = e.result ? 'end' : 'pre';
  const logoUrl = await S.clubLogo(e.opponent); gfx.opp = logoUrl ? await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = logoUrl; }) : null;
  sheet(`<h3>📸 ${t('graphic')}</h3>
    <div class="seg" id="gk"><button data-v="pre">${t('gfx_pre')}</button><button data-v="end" ${e.result ? '' : 'disabled'}>${t('gfx_end')}</button></div>
    <div class="seg" id="gf"><button data-v="story">Story 9:16</button><button data-v="post">Post 4:5</button></div>
    <div class="gfx-wrap"><canvas id="gc"></canvas></div>
    <label class="btn block"><input type="file" accept="image/*" id="gp" hidden>🖼 ${t('gfx_photo')}</label>
    <p class="small muted">${t('gfx_hint')}</p>
    <div class="sheet-btns"><button class="btn" id="gd">⬇ ${t('gfx_save')}</button><button class="btn primary" id="gs">↗ ${t('gfx_share')}</button></div>
    <button class="btn danger-ghost block" data-act="close-sheet">${t('cancel')}</button>`, el => {
    const cv = $('#gc', el);
    const scorers = () => Object.entries(S.matchStats(e.id)).filter(([, s]) => s.g).map(([pid, s]) => ({ name: S.user(pid)?.name || '', g: s.g })).sort((a, b) => b.g - a.g);
    const draw = () => {
      el.querySelectorAll('#gk button').forEach(b => b.classList.toggle('on', b.dataset.v === gfx.kind));
      el.querySelectorAll('#gf button').forEach(b => b.classList.toggle('on', b.dataset.v === gfx.format));
      if (gfx.kind === 'end' && e.result) G.endstand(cv, e, { format: gfx.format, photo: gfx.photo, scorers: scorers(), opp: gfx.opp });
      else G.matchday(cv, e, { format: gfx.format, photo: gfx.photo, opp: gfx.opp });
    };
    $('#gk', el).onclick = ev => { const b = ev.target.closest('button'); if (b && !b.disabled) { gfx.kind = b.dataset.v; draw(); } };
    $('#gf', el).onclick = ev => { const b = ev.target.closest('button'); if (b) { gfx.format = b.dataset.v; draw(); } };
    $('#gp', el).onchange = ev => { const f = ev.target.files[0]; if (!f) return; const i = new Image(); i.onload = () => { gfx.photo = i; draw(); }; i.src = URL.createObjectURL(f); };
    const name = () => `ttsc-${gfx.kind === 'end' ? 'endstand' : 'matchday'}-${e.date}-${gfx.format}.png`;
    $('#gs', el).onclick = () => G.shareCanvas(cv, name()).catch(() => {});
    // phones: the share menu has 'Save Image' (goes to Photos); computers: download the file
    $('#gd', el).onclick = () => { toast(t('gfx_save_hint')); G.shareCanvas(cv, name()).catch(() => {}); };
    draw();
  });
}
function qrSheet() {
  sheet(`<h3>${t('join_qr')}</h3><p class="small muted">${t('join_qr_hint')}</p>
    <img class="qr" src="assets/join-qr.svg" alt="QR" width="280" height="280">
    <p class="center small"><b>mehmetustattsc.github.io/TTSC</b></p>
    <a class="btn block" href="afis.html" target="_blank" rel="noopener">🖨 ${t('join_poster')}</a>
    <div class="sheet-btns"><button class="btn" data-act="close-sheet">${t('close')}</button></div>`);
}
function approveSheet(id) {
  const x = S.user(id); if (!x) return;
  const taken = new Set(S.users().map(u => u.name));
  const fb = S.seasonStats().filter(r => !taken.has(r.name) || r.name === x.name);
  const guess = fb.find(r => r.name.toLowerCase() === x.name.toLowerCase()) || fb.find(r => r.name.toLowerCase().split(' ').some(w => w.length > 2 && x.name.toLowerCase().includes(w)));
  sheet(`<h3>${t('approve')}: ${esc(x.name)}</h3>
    ${fb.length ? `<label class="fld"><span>${t('fb_name')}</span><select id="afb"><option value="">${t('fb_none')}</option>${fb.map(r => `<option ${guess === r ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
    <label class="fld"><span>${t('name')}</span><input id="anm" maxlength="50" value="${esc(guess ? guess.name : x.name)}"></label>
    <label class="fld"><span>${t('role')}</span><select id="arl">${S.ROLES.map(r => `<option value="${r}" ${r === 'player' ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select></label>
    <label class="check" id="apw" hidden><input type="checkbox" id="apl"> ${t('also_plays')}</label>
    <div class="two" id="afx"><label class="fld"><span>${t('number')}</span><input id="anu" type="number" inputmode="numeric" min="1" max="99" value="${x.num || ''}"></label>
      <label class="fld"><span>${t('position')}</span><select id="aps">${['TW', 'AB', 'MF', 'ST'].map(p => `<option value="${p}" ${p === 'MF' ? 'selected' : ''}>${t('pos_' + p)}</option>`).join('')}</select></label></div>${btns('aok')}`, el => {
    const rl = $('#arl', el), pl = $('#apl', el);
    const sync = () => { const p = rl.value === 'player'; $('#apw', el).hidden = p; $('#afx', el).hidden = !p && !pl.checked; };
    rl.onchange = sync; pl.onchange = sync; sync();
    const f = $('#afb', el); if (f) f.onchange = () => { if (f.value) $('#anm', el).value = f.value; };
    $('#aok', el).textContent = t('approve');
    $('#aok', el).onclick = () => {
      const name = $('#anm', el).value.trim(); if (!name) return;
      S.approve(id, { role: rl.value, plays: pl.checked, name, num: $('#anu', el).value, pos: $('#aps', el).value });
      closeSheet(); toast(t('approved', { name }));
    };
  });
}
function addMemberSheet() {
  sheet(`<h3>${t('add_member')}</h3><label class="fld"><span>${t('name')}</span><input id="mn" maxlength="50"></label>
    <div class="two"><label class="fld"><span>${t('member_type')}</span><select id="mt">${['active', 'passive', 'support'].map(k => `<option value="${k}">${t('m_' + k)} (${S.FEES[k]}€)</option>`).join('')}</select></label>
    <label class="fld"><span>${t('member_since', { y: '' }).replace(/[:\s]+$/, '')}</span><input id="ms" type="number" value="${new Date().getFullYear()}"></label></div>${btns('mok')}`, el => {
    $('#mok', el).onclick = () => { const name = $('#mn', el).value.trim(); if (!name) return; S.addMember({ name, type: $('#mt', el).value, since: +$('#ms', el).value }); closeSheet(); };
  });
}
function addBookingSheet() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  sheet(`<h3>${t('add_booking')}</h3><label class="fld"><span>${t('event_title')}</span><input id="bt" maxlength="60"></label>
    <div class="two"><label class="fld"><span>${t('date')}</span><input type="date" id="bd" value="${d.toISOString().slice(0, 10)}"></label><label class="fld"><span>${t('time')}</span><input type="time" id="bh" value="18:00"></label></div>
    <label class="fld"><span>${t('organizer')}</span><input id="bw" maxlength="60"></label><label class="fld"><span>${t('note_optional')}</span><input id="bn" maxlength="120"></label>${btns('bok')}`, el => {
    $('#bok', el).onclick = () => { const title = $('#bt', el).value.trim(); if (!title) return; S.addBooking({ title, date: $('#bd', el).value, time: $('#bh', el).value, who: $('#bw', el).value.trim(), note: $('#bn', el).value.trim() }); closeSheet(); };
  });
}
function addRepairSheet(u) {
  sheet(`<h3>${t('add_repair')}</h3><label class="fld"><span>${t('event_title')}</span><input id="rti" maxlength="60"></label>
    <label class="fld"><span>${t('description')}</span><textarea id="rtx" rows="3" maxlength="400"></textarea></label>${btns('rpk')}`, el => {
    $('#rpk', el).onclick = () => { const title = $('#rti', el).value.trim(); if (!title) return; S.addRepair({ title, text: $('#rtx', el).value.trim(), by: u.id }); closeSheet(); };
  });
}

function exportCsv() {
  const head = ['Nr', 'Name', 'Position', 'Anwesenheit %', 'Trainings', 'Trainings besucht', 'Spiele', 'Minuten', 'Tore', 'Vorlagen', 'Gelb', 'Rot'];
  const rows = S.players().map(p => { const s = S.playerStats(p.id); return [p.num, p.name, p.pos, s.rate, s.trainings, s.tAtt, s.m, s.min, s.g, s.a, s.y, s.r]; });
  const csv = '﻿' + [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `ttsc-statistik-${S.TODAY()}.csv`; a.click();
}

// ---------- game overlay ----------
let gameO = null;
function openGame(id) {
  const g = IQ.find(x => x.id === id); if (!g) return;
  closeGame(true);
  gameO = document.createElement('div'); gameO.className = 'play-o';
  gameO.innerHTML = `<div class="play-bar"><button type="button" class="back-btn" data-act="play-close" aria-label="${t('back')}">‹</button><span class="top-t">${esc(g.name)}</span></div><iframe src="${g.path}?lang=${getLang()}" title="${esc(g.name)}"></iframe>`;
  document.body.appendChild(gameO); document.body.classList.add('playing');
  try { history.pushState({ play: id }, ''); } catch (e) { /* ignore */ }
}
function closeGame(silent) {
  if (!gameO) return;
  gameO.remove(); gameO = null; document.body.classList.remove('playing');
  if (!silent) render();
}
window.addEventListener('popstate', () => closeGame());
window.addEventListener('message', e => {
  const d = e.data;
  if (e.origin !== location.origin || !gameO || !d || d.source !== 'ttsc-games') return;
  if (e.source !== gameO.querySelector('iframe').contentWindow) return;
  if (S.addGameResult(d)) toast(t('iq_saved'));
});

// ---------- actions ----------
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const u = S.me(), a = b.dataset.act;
  switch (a) {
    case 'login': S.login(b.dataset.id); location.hash = '#/'; break;
    case 'play': openGame(b.dataset.g); break;
    case 'play-close': { const own = history.state && history.state.play; closeGame(); if (own) history.back(); break; } // close at once, then drop our history step
    case 'login-lang': localStorage.setItem('ttsc-lang', b.dataset.v); render(); break;
    case 'login-restart': loginStep = 'email'; render(); break;
    case 'intro-edit': { const me = S.me(); if (me) S.setPref('intro-' + me.id, ''); render(); break; }
    case 'approve': approveSheet(b.dataset.id); break;
    case 'show-qr': qrSheet(); break;
    case 'graphic': graphicSheet(b.dataset.eid); break;
    case 'demo-on': S.useDemo(true); break;
    case 'demo-off': S.logout(); S.useDemo(false); location.hash = '#/'; break;
    case 'retry': S.reload(); render(); break;
    case 'invite': addPlayerSheet('player', true); break;
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } break;
    case 'import-go': { const d = pendingImport; if (!d) break; b.disabled = true;
      S.importSeason(d).then(() => { pendingImport = null; toast(t('import_done', { n: d.rows.length })); location.hash = '#/stats/players'; })
        .catch(e => { b.disabled = false; toast(t('sync_error') + ': ' + e.message); }); break; }
    case 'push-on': b.disabled = true; S.enablePush().then(() => { pushOn = true; toast(t('push_on')); render(); })
      .catch(e => { b.disabled = false; toast(e.message === 'permission' ? t('push_denied') : t('sync_error') + ': ' + e.message); render(); }); break;
    case 'push-off': S.disablePush().then(() => { pushOn = false; render(); }); break;
    case 'push-hide': S.setPref('push-hidden', '1'); render(); break;
    case 'install-hide': S.setPref('install-hidden', '1'); render(); break;
    case 'share-app': { const d = { title: 'TTSC Buchen', text: t('share_text'), url: location.origin + location.pathname };
      if (navigator.share) navigator.share(d).catch(() => {}); else navigator.clipboard?.writeText(d.url).then(() => toast(t('link_copied'))); break; }
    case 'switch': S.logout(); loginStep = 'email'; location.hash = '#/'; break;
    case 'back': location.hash = '#/' + parentOf(parse(), u); break;
    case 'lang': S.setUserLang(b.dataset.v); break;
    case 'avail': S.setAvailability(u.id, b.dataset.v); break;
    case 'rsvp-yes': S.setRsvp(b.dataset.eid, u.id, 'yes'); break;
    case 'rsvp-no': reasonSheet(b.dataset.eid, u); break;
    case 'cal-tab': calTab = b.dataset.v; render(); break;
    case 'cal-type': calType = b.dataset.v; render(); break;
    case 'notes-tab': notesTab = b.dataset.v; render(); break;
    case 'new-event': newEventSheet(); break;
    case 'del-event': if (confirm(t('delete') + '?')) { S.deleteEvent(b.dataset.eid); location.hash = '#/cal'; } break;
    case 'attendance': attendanceSheet(b.dataset.eid); break;
    case 'match-report': matchSheet(b.dataset.eid); break;
    case 'coach-note': coachNoteSheet(b.dataset.pid, u); break;
    case 'pick-note': pickPlayerSheet(u); break;
    case 'fb-coach': feedbackSheet(u); break;
    case 'self': selfSheet(b.dataset.eid, u); break;
    case 'add-player': addPlayerSheet(); break;
    case 'add-member': addMemberSheet(); break;
    case 'only-open': onlyOpen = b.checked; render(); break;
    case 'fee': { const m = S.member(b.dataset.id); S.setFee(m.id, S.FEE_YEAR, !m.fees[S.FEE_YEAR]); break; }
    case 'add-booking': addBookingSheet(); break;
    case 'del-booking': if (confirm(t('delete') + '?')) S.deleteBooking(b.dataset.id); break;
    case 'add-repair': addRepairSheet(u); break;
    case 'repair-st': S.setRepairStatus(b.dataset.id, b.dataset.v); break;
    case 'sort': sortKey = b.dataset.v; render(); break;
    case 'csv': exportCsv(); break;
    case 'reset': if (confirm(t('reset_confirm'))) { S.resetDemo(); location.hash = '#/'; } break;
    case 'close-sheet': closeSheet(); break;
    case 'toggle': b.classList.toggle('on'); break;
    case 'pick-one': b.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); b.classList.add('on'); break;
    case 'seg': b.parentElement.querySelectorAll('button').forEach(c => c.classList.remove('on')); b.classList.add('on'); break;
  }
});
document.addEventListener('change', ev => {
  const c = ev.target.closest('[data-act-change]'); if (!c) return;
  if (c.dataset.actChange === 'role') S.setRole(c.dataset.id, c.value);
  if (c.dataset.actChange === 'plays') S.setPlays(c.dataset.id, c.checked);
});
document.addEventListener('submit', async ev => {
  const intro = ev.target.closest('[data-form="intro"]');
  if (intro) { ev.preventDefault(); const name = $('#inm').value.trim(); if (name.length < 3) return; S.setMyIntro({ name, num: $('#inu').value }); return; }
  const lf = ev.target.closest('[data-form]');
  if (lf) {
    ev.preventDefault(); if (loginBusy) return;
    loginBusy = true;
    try {
      if (lf.dataset.form === 'login-email') { loginEmail = $('#lem').value.trim(); render(); await S.sendCode(loginEmail); loginStep = 'code'; }
      else { const code = $('#lco').value; render(); await S.verifyCode(loginEmail, code); loginStep = 'email'; location.hash = '#/'; }
    } catch (e) { toast(lf.dataset.form === 'login-code' ? t('login_wrong') : (e.message || t('sync_error'))); }
    loginBusy = false; render(); const c = $('#lco'); if (c) c.focus();
    return;
  }
  const f = ev.target.closest('.composer'); if (!f) return; ev.preventDefault();
  const i = $('#cm', f), text = i.value.trim(); if (!text) return;
  S.sendMessage(f.dataset.ch, S.me().id, text);
  const n = $('.composer #cm'); if (n) n.focus();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

S.load();
S.onChange(render);
S.onError(e => toast(t('sync_error') + (e?.message ? ': ' + e.message : '')));
window.addEventListener('hashchange', () => { sessionStorage.setItem('ttsc-nav', '1'); closeSheet(); render(); });
render();
// ---------- installable app (PWA) ----------
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; S.setPref('install-hidden', '1'); render(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // a new version took over: offer a one-tap reload instead of silently running old code
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) updateBanner(); });
}
function updateBanner() {
  if ($('#upd')) return;
  const b = document.createElement('button'); b.id = 'upd'; b.className = 'upd'; b.textContent = t('update_ready');
  b.onclick = () => location.reload(); document.body.appendChild(b);
}
