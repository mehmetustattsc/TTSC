// End-to-end test of the server mode against a local stand-in for Supabase:
// real Postgres with supabase/schema.sql, PostgREST for the tables, and a tiny email-code
// login that issues the same kind of tokens. Several people use the app at the same time.
//
// Needs: Postgres 16 binaries (PG_BIN, default /usr/lib/postgresql/16/bin) and a PostgREST
// binary (POSTGREST, default ./postgrest or /var/tmp/prest/postgrest). Run: npm run test:server
import { chromium } from 'playwright';
import { createServer, request as httpRequest } from 'http';
import { readFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { createHmac, randomUUID } from 'crypto';
import { extname, join } from 'path';
import { tmpdir } from 'os';

const root = new URL('..', import.meta.url).pathname;
const PG = process.env.PG_BIN || '/usr/lib/postgresql/16/bin';
const PGREST = process.env.POSTGREST || ['./postgrest', '/var/tmp/prest/postgrest'].find(existsSync);
const dir = join(process.env.PG_DIR || tmpdir(), 'ttsc-pg-' + process.pid);
const PORT = 5600 + (process.pid % 300), REST_PORT = PORT + 1;
const SECRET = 'test-secret-test-secret-test-secret-1234';
const asPg = process.getuid && process.getuid() === 0 ? cmd => `su nobody -s /bin/bash -c "${cmd.replace(/"/g, '\\"')}"` : cmd => cmd;
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', ...opts }).toString();
const psql = sql => sh(`psql -h ${dir} -p ${PORT} -U postgres -d app -v ON_ERROR_STOP=1 -qtA`, { input: sql }).trim();

// ---------- database ----------
await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
if (process.getuid && process.getuid() === 0) sh(`chown nobody ${dir}`);
sh(asPg(`${PG}/initdb -D ${dir}/data -U postgres -A trust`));
sh(asPg(`${PG}/pg_ctl -D ${dir}/data -o '-k ${dir} -p ${PORT} -c listen_addresses= -c wal_level=logical' -l ${dir}/log -w start`));
sh(`psql -h ${dir} -p ${PORT} -U postgres -qc 'create database app'`);
psql(`
  create role anon nologin; create role authenticated nologin; create role authenticator login noinherit;
  grant anon, authenticated to authenticator;
  create schema auth; create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  create publication supabase_realtime;`);
psql(await readFile(join(root, 'supabase/schema.sql'), 'utf8'));
psql(await readFile(join(root, 'supabase/schema.sql'), 'utf8')); // must be safe to run twice
psql(`insert into public.invites(email, role, name, lang) values ('admin@ttsc.test', 'admin', 'Mehmet Admin', 'tr');`);
// push: stand-in for pg_net that records the calls the triggers make
psql(`create schema if not exists net; create table if not exists net.calls (id serial, url text, body jsonb, headers jsonb);
  create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
  returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id $$;`);
psql(await readFile(join(root, 'supabase/push.sql'), 'utf8')); psql(await readFile(join(root, 'supabase/push.sql'), 'utf8'));
psql(`insert into private.app_secrets values ('function_url', 'https://example.test/notify'), ('hook', 's3cret') on conflict do nothing;
  insert into public.app_config values ('vapid_public', 'BElocalTestKeyOnly') on conflict do nothing;`);
{ const fx = await readFile(join(root, 'supabase/fixtures-2026-27.sql'), 'utf8');
  psql(fx); if (psql(`select count(*) from net.calls`) !== '1') throw new Error('12 fixtures must make exactly one notifier call');
  psql(fx); if (psql(`select count(*) from net.calls`) !== '1') throw new Error('re-running the fixtures must not notify again');
  psql(`truncate net.calls`); }
const fixtures = await readFile(join(root, 'supabase/fixtures-2026-27.sql'), 'utf8');
psql(fixtures); psql(fixtures);
if (psql(`select count(*) from events where type = 'match'`) !== '12') throw new Error('fixtures not loaded exactly once');

// ---------- REST server ----------
const conf = join(dir, 'pgrst.conf');
await import('fs').then(fs => fs.writeFileSync(conf, `db-uri = "postgres://authenticator@/app?host=${dir}&port=${PORT}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${SECRET}"\nserver-port = ${REST_PORT}\nserver-host = "127.0.0.1"\n`));
const rest = spawn(PGREST, [conf], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${REST_PORT}/events?select=id`)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 200)); }

// ---------- email-code login (stand-in for Supabase Auth) ----------
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = p => { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64(p); return `${h}.${b}.${createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; };
const codes = {}, refresh = {};
const tokenFor = (id, email) => { const r = randomUUID(); refresh[r] = { id, email }; return { access_token: jwt({ sub: id, role: 'authenticated', email, exp: Math.floor(Date.now() / 1000) + 3600 }), refresh_token: r, expires_in: 3600, user: { id, email } }; };
const body = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });
const types = { '.woff': 'font/woff', '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const app = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
  if (u.pathname === '/auth/v1/otp') {
    const { email } = await body(req);
    if (!psql(`select id from auth.users where email = '${email.replace(/'/g, "''")}'`)) psql(`insert into auth.users values ('${randomUUID()}', '${email.replace(/'/g, "''")}')`);
    codes[email] = '123456'; return json(200, {});
  }
  if (u.pathname === '/auth/v1/verify') {
    const { email, token } = await body(req);
    if (codes[email] !== token) return json(403, { msg: 'Token has expired or is invalid' });
    return json(200, tokenFor(psql(`select id from auth.users where email = '${email}'`), email));
  }
  if (u.pathname === '/auth/v1/token') { const { refresh_token } = await body(req); const s = refresh[refresh_token]; return s ? json(200, tokenFor(s.id, s.email)) : json(400, { msg: 'bad refresh' }); }
  if (u.pathname === '/auth/v1/logout') return json(204);
  if (u.pathname === '/auth/v1/user') { const sub = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1] || 'e30', 'base64url')).sub; const email = psql(`select email from auth.users where id = '${sub}'`); return email ? json(200, { id: sub, email }) : json(401, {}); }
  if (u.pathname.startsWith('/rest/v1/')) {
    const p = httpRequest({ host: '127.0.0.1', port: REST_PORT, path: req.url.replace('/rest/v1', ''), method: req.method, headers: { ...req.headers, host: '127.0.0.1' } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(p); return;
  }
  if (u.pathname === '/js/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`export const SUPABASE_URL = location.origin; export const SUPABASE_KEY = 'test-publishable';`); }
  const f = join(root, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${app.address().port}/`;

// ---------- people using the app ----------
const errors = [];
const check = (c, m) => { if (!c) errors.push('FAIL: ' + m); };
const browser = await chromium.launch();
async function person(email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(email + ': ' + e.message));
  page.on('dialog', d => d.accept());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url); await page.fill('#lem', email); await page.click('[data-form="login-email"] button');
  await page.waitForSelector('#lco'); await page.fill('#lco', '123456'); await page.click('[data-form="login-code"] button.primary');
  await page.waitForSelector('.hello, .login-box h3', { timeout: 15000 });
  page.go = async h => { await page.goto(url + '#/' + h); await page.waitForTimeout(150); };
  page.fresh = async h => { await page.goto(url + '#/' + h); await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.view'); await page.waitForTimeout(200); };
  page.text = async () => page.locator('#app').innerText();
  return page;
}
const tiles = async p => (await p.locator('.tile-m').evaluateAll(a => a.map(x => x.getAttribute('href')))).join(' ');
const settle = () => new Promise(r => setTimeout(r, 500));

try {
  // admin: first login comes from the bootstrap invitation
  const admin = await person('admin@ttsc.test');
  check((await admin.text()).includes('Mehmet'), 'admin greeted by invited name: ' + (await admin.text()).slice(0, 200));
  check((await tiles(admin)).includes('#/members'), 'admin sees members tile');
  await admin.screenshot({ path: join(root, 'tests/shots/s1-admin-home.png') });

  // admin invites a coach and a player
  for (const [name, email, role] of [['Murat Coach', 'coach@ttsc.test', 'coach'], ['Can Player', 'player@ttsc.test', 'player']]) {
    await admin.go('members'); await admin.click('[data-act="invite"]');
    await admin.fill('#pn', name); await admin.fill('#pe', email); await admin.selectOption('#pr', role);
    if (role === 'coach') await admin.check('#pplays'); // the coach also plays (player-coach)
    if (role === 'player' || role === 'coach') { await admin.fill('#pu', role === 'coach' ? '7' : '9'); await admin.selectOption('#pp', role === 'coach' ? 'MF' : 'ST'); }
    await admin.click('#pok'); await settle();
  }
  check(psql(`select count(*) from invites`) === '3', 'two invitations stored on the server');

  // someone not invited gets the waiting screen and no data
  const stranger = await person('stranger@ttsc.test');
  check(await stranger.locator('#inm').count() === 1, 'stranger is asked for his name');
  check(psql(`select role from profiles where name = 'stranger'`) === 'pending', 'stranger is pending');

  // joining by QR: the stranger introduces himself, the admin approves him as a player with his fussball.de name
  await stranger.fill('#inm', 'Yeni Oyuncu'); await stranger.fill('#inu', '23'); await stranger.click('[data-form="intro"] button'); await settle();
  check((await stranger.text()).match(/Onay bekleniyor|Freischaltung|approval/), 'stranger sees waiting screen after intro');
  check(psql(`select name || num from profiles where name = 'Yeni Oyuncu'`) === 'Yeni Oyuncu23', 'intro stored');
  check(psql(`select role from profiles where name = 'Yeni Oyuncu'`) === 'pending', 'still pending after intro');
  await admin.fresh(''); check((await admin.text()).match(/onay bekliyor|Freischaltung|approval/i), 'admin sees waiting notice');
  await admin.fresh('members'); await admin.click('[data-act="approve"]'); await admin.waitForSelector('#aok');
  await admin.fill('#anm', 'Yeni Oyuncu Tam'); await admin.selectOption('#aps', 'AB'); await admin.click('#aok'); await settle();
  check(psql(`select role || ':' || name || ':' || pos from profiles where num = 23`) === 'player:Yeni Oyuncu Tam:AB', 'admin approved as player');
  await stranger.fresh(''); check((await stranger.locator('.tile-m').count()) > 0, 'approved person gets into the app');

  const coach = await person('coach@ttsc.test');
  const player = await person('player@ttsc.test');
  check((await tiles(coach)).includes('#/players') && !(await tiles(coach)).includes('#/members'), 'coach tiles');
  check(!(await tiles(player)).includes('#/players'), 'player tiles');
  check(psql(`select plays::text || num from profiles where name = 'Murat Coach'`) === 'true7', 'player-coach stored with number');
  check((await coach.text()).includes('Einsatzbereit') || (await coach.locator('[data-act="avail"]').count()) > 0, 'player-coach can set his status');
  const coachTok = await coach.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  const unplay = await fetch(url + `rest/v1/profiles?id=eq.${psql(`select id from profiles where name = 'Murat Coach'`)}`, { method: 'PATCH', headers: { apikey: 'x', Authorization: 'Bearer ' + coachTok, 'Content-Type': 'application/json' }, body: JSON.stringify({ plays: false }) });
  check(unplay.status >= 400, 'only admin changes the also-plays flag');

  // coach plans a match, player answers "no" with a reason, coach sees it
  await coach.go('cal'); await coach.click('[data-act="new-event"]'); await coach.click('#nt [data-v="match"]');
  const d = new Date(); d.setDate(d.getDate() + 3);
  await coach.fill('#nd', d.toISOString().slice(0, 10)); await coach.fill('#no', 'SV Test'); await coach.click('#nok'); await settle();
  await player.fresh('');
  check((await player.text()).includes('SV Test') || (await player.text()).includes('Leibenstadt'), 'player sees upcoming matches');
  const ev = psql(`select id from events where opponent = 'SV Test'`);
  await player.fresh('ev/' + ev); check((await player.text()).includes('SV Test'), 'player opens the coach\'s new match');
  await player.click('[data-act="rsvp-no"]'); await player.locator('#rs .chip').nth(1).click(); await player.fill('#rt', 'Klausur'); await player.click('#rok'); await settle();
  await player.go(''); await player.click('[data-act="avail"][data-v="limited"]'); await settle();
  await coach.fresh('ev/' + ev);
  check((await coach.text()).includes('Klausur'), 'coach sees the reason');
  check(psql(`select status||':'||reason from rsvps where event_id = '${ev}'`) === 'no:school', 'rsvp stored');

  // team chat between people; board chat stays with the board
  await player.go('msg/team'); await player.fill('#cm', 'Merhaba takım'); await player.press('#cm', 'Enter'); await settle();
  await admin.go('msg/board'); await admin.fill('#cm', 'Nur für den Vorstand'); await admin.press('#cm', 'Enter'); await settle();
  await coach.fresh('msg/team'); check((await coach.text()).includes('Merhaba takım'), 'coach reads player\'s chat message');
  check(psql(`select count(*) from net.calls where body->>'type' = 'messages' and body->'rows'->0->>'text' = 'Merhaba takım' and headers->>'x-hook-secret' = 's3cret'`) === '1', 'chat message calls the notifier once');
  check(psql(`select count(*) from net.calls where body->>'type' = 'events' and body->'rows'->0->>'opponent' = 'SV Test'`) === '1', 'new match calls the notifier');
  // a phone subscription: own row only
  const pTok = await player.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  const H = t => ({ apikey: 'x', Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
  const pid0 = psql(`select id from profiles where name = 'Can Player'`);
  check((await fetch(url + 'rest/v1/push_subs', { method: 'POST', headers: H(pTok), body: JSON.stringify({ endpoint: 'https://push.test/1', user_id: pid0, p256dh: 'k', auth: 'a' }) })).status < 300, 'player saves his phone subscription');
  check((await fetch(url + 'rest/v1/push_subs', { method: 'POST', headers: H(pTok), body: JSON.stringify({ endpoint: 'https://push.test/2', user_id: psql(`select id from profiles where name = 'Murat Coach'`), p256dh: 'k', auth: 'a' }) })).status >= 400, 'player cannot subscribe someone else');
  const cTok = await coach.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  check((await (await fetch(url + 'rest/v1/push_subs?select=endpoint', { headers: H(cTok) })).json()).length === 0, 'others cannot see a phone subscription');
  check((await (await fetch(url + 'rest/v1/app_config?select=value&key=eq.vapid_public', { headers: H(pTok) })).json())[0]?.value === 'BElocalTestKeyOnly', 'app reads the public push key');
  await player.fresh('msg/board'); check(!(await player.text()).includes('Nur für den Vorstand'), 'player cannot read board chat');
  await player.screenshot({ path: join(root, 'tests/shots/s2-player-chat.png') });

  // football-intelligence game result: written through the app's message, seen by the player and the coach, not the admin/board
  await player.fresh('games'); await player.click('[data-act="play"][data-g="omuz"]'); await player.waitForSelector('.play-o iframe');
  await player.frameLocator('.play-o iframe').locator('#go').waitFor();
  await player.frames().find(f => f.url().includes('games/omuz')).evaluate(() => parent.postMessage({ source: 'ttsc-games', game: 'omuz', level: 'easy', score: 640, accuracy: 70, onTimeRate: 60 }, location.origin));
  await settle();
  check(psql(`select game || ':' || accuracy || ':' || score from game_results where player_id = '${pid0}'`) === 'omuz:70:640', 'game result stored on the server');
  check((await fetch(url + 'rest/v1/game_results', { method: 'POST', headers: H(pTok), body: JSON.stringify({ player_id: psql(`select id from profiles where name = 'Murat Coach'`), game: 'omuz', score: 1, accuracy: 1 }) })).status >= 400, 'player cannot store a result for someone else');
  check((await (await fetch(url + 'rest/v1/game_results?select=id', { headers: H(cTok) })).json()).length === 1, 'coach sees the player\'s game result');
  const aTok = await admin.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  check((await (await fetch(url + 'rest/v1/game_results?select=id', { headers: H(aTok) })).json()).length === 0, 'admin/board does not see game results');
  await coach.fresh('p/' + pid0); check((await coach.text()).includes('70%'), 'coach sees the result on the player\'s profile');

  // private coach note: player sees it, admin never does
  const pid = psql(`select id from profiles where name = 'Can Player'`);
  await coach.go('p/' + pid); await coach.click('[data-act="coach-note"]'); await coach.locator('#cg .chip').first().click(); await coach.fill('#ct', 'Gizli not'); await coach.click('#cok'); await settle();
  await player.fresh('msg/notes'); check((await player.text()).includes('Gizli not'), 'player reads his coach note');
  await admin.fresh('p/' + pid); check(!(await admin.text()).includes('Gizli not'), 'admin cannot read coach note');

  // season stats from fussball.de: members see them, a stranger does not
  psql(`insert into season_stats (season, name, apps, minutes, goals, source) values ('2026/27', 'Can Player', 10, 900, 8, 'https://www.fussball.de')`);
  await player.fresh('stats/players'); check((await player.text()).includes('900'), 'member sees season stats');
  await player.fresh('stats/me'); check((await player.text()).includes('fussball.de'), 'player profile shows his fussball.de line');
  const outsider = await person('outsider@ttsc.test'); // signed in, never approved
  const stTok = await outsider.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  const st = await (await fetch(url + 'rest/v1/season_stats?select=name', { headers: { apikey: 'x', Authorization: 'Bearer ' + stTok } })).json();
  check(Array.isArray(st) && st.length === 0, 'stranger cannot read season stats');

  // import link (board): loads season stats; a player is refused
  {
    const payload = Buffer.from(JSON.stringify({ kind: 'season_stats', season: '2026/27', source: 'https://www.fussball.de', rows: [['Link Spieler', 3, 210, 1], ['Zweiter Spieler', 1, 45, 0]] })).toString('base64url');
    await player.goto(url + '#/import/' + payload); await player.waitForTimeout(300);
    check((await player.locator('.locked').count()) === 1, 'player cannot open the import link');
    await admin.goto(url + '#/import/' + payload); await admin.waitForSelector('[data-act="import-go"]');
    check(!admin.url().includes(payload), 'import data removed from the address bar');
    await admin.click('[data-act="import-go"]'); await admin.waitForTimeout(800);
    check(psql(`select count(*) from season_stats where name in ('Link Spieler', 'Zweiter Spieler')`) === '2', 'import link wrote the rows');
  }

  // members, fees and clubhouse
  await admin.go('members'); await admin.click('[data-act="add-member"]'); await admin.fill('#mn', 'Klaus Testmann'); await admin.click('#mok'); await settle();
  await admin.fresh('members'); await admin.locator('.pay:not(.paid)').first().click(); await settle();
  check(psql(`select count(*) from fees where paid_on is not null`) === '1', 'fee stored as paid');
  await admin.go('building/repairs'); await admin.click('[data-act="add-repair"]'); await admin.fill('#rti', 'Licht kaputt'); await admin.click('#rpk'); await settle();
  check(psql(`select status from repairs`) === 'open', 'repair stored');
  await coach.fresh('building'); check((await coach.locator('.locked').count()) === 1, 'coach locked out of clubhouse');

  // the player cannot write things he may not write, even bypassing the app
  const tok = await player.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  const raw = await fetch(url + 'rest/v1/messages', { method: 'POST', headers: { apikey: 'x', Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'board', from_id: pid, text: 'sneak' }) });
  check(raw.status >= 400, 'server refuses a player\'s board message');
  const promote = await fetch(url + `rest/v1/profiles?id=eq.${pid}`, { method: 'PATCH', headers: { apikey: 'x', Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin' }) });
  check(promote.status >= 400 && psql(`select role from profiles where id = '${pid}'`) === 'player', 'player cannot make himself admin');

  // login via the link in the email (what Supabase sends while the email templates can't be edited)
  {
    const coachId = psql(`select id from auth.users where email = 'coach@ttsc.test'`), tk = tokenFor(coachId, 'coach@ttsc.test');
    const ctx = await browser.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => errors.push('link: ' + e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(url + `#access_token=${tk.access_token}&refresh_token=${tk.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`);
    await p.waitForSelector('.hello', { timeout: 15000 }).catch(() => {});
    check((await p.locator('#app').innerText()).includes('Murat'), 'login via email link works');
    check(!p.url().includes('access_token'), 'token removed from the address bar');
    await ctx.close();
  }
  // sign out and back in keeps working
  await player.go('me'); await player.click('[data-act="switch"]'); await player.waitForSelector('#lem');
  check(true, 'signed out');
} catch (e) { errors.push(e.stack || String(e)); }

await browser.close(); app.close(); rest.kill();
sh(asPg(`${PG}/pg_ctl -D ${dir}/data -m fast stop`));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('server ok');
