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
    if (role === 'player') { await admin.fill('#pu', '9'); await admin.selectOption('#pp', 'ST'); }
    await admin.click('#pok'); await settle();
  }
  check(psql(`select count(*) from invites`) === '3', 'two invitations stored on the server');

  // someone not invited gets the waiting screen and no data
  const stranger = await person('stranger@ttsc.test');
  check((await stranger.text()).match(/Davet bekleniyor|Einladung|invitation/i), 'stranger waits for invitation');
  check(psql(`select role from profiles where name = 'stranger'`) === 'pending', 'stranger is pending');

  const coach = await person('coach@ttsc.test');
  const player = await person('player@ttsc.test');
  check((await tiles(coach)).includes('#/players') && !(await tiles(coach)).includes('#/members'), 'coach tiles');
  check(!(await tiles(player)).includes('#/players'), 'player tiles');

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
  await player.fresh('msg/board'); check(!(await player.text()).includes('Nur für den Vorstand'), 'player cannot read board chat');
  await player.screenshot({ path: join(root, 'tests/shots/s2-player-chat.png') });

  // private coach note: player sees it, admin never does
  const pid = psql(`select id from profiles where name = 'Can Player'`);
  await coach.go('p/' + pid); await coach.click('[data-act="coach-note"]'); await coach.locator('#cg .chip').first().click(); await coach.fill('#ct', 'Gizli not'); await coach.click('#cok'); await settle();
  await player.fresh('msg/notes'); check((await player.text()).includes('Gizli not'), 'player reads his coach note');
  await admin.fresh('p/' + pid); check(!(await admin.text()).includes('Gizli not'), 'admin cannot read coach note');

  // season stats from fussball.de: members see them, a stranger does not
  psql(`insert into season_stats (season, name, apps, minutes, goals, source) values ('2026/27', 'Can Player', 10, 900, 8, 'https://www.fussball.de')`);
  await player.fresh('stats/players'); check((await player.text()).includes('900'), 'member sees season stats');
  await player.fresh('stats/me'); check((await player.text()).includes('fussball.de'), 'player profile shows his fussball.de line');
  const stTok = await stranger.evaluate(() => JSON.parse(localStorage.getItem('ttsc-session')).access_token);
  const st = await (await fetch(url + 'rest/v1/season_stats?select=name', { headers: { apikey: 'x', Authorization: 'Bearer ' + stTok } })).json();
  check(Array.isArray(st) && st.length === 0, 'stranger cannot read season stats');

  // members, fees and clubhouse
  await admin.go('members'); await admin.click('[data-act="add-member"]'); await admin.fill('#mn', 'Klaus Testmann'); await admin.click('#mok'); await settle();
  await admin.fresh('members'); await admin.locator('.pay:not(.paid)').first().click(); await settle();
  check(psql(`select count(*) from fees where paid_on is not null`) === '1', 'fee stored as paid');
  await admin.go('building/repairs'); await admin.click('[data-act="add-repair"]'); await admin.fill('#rti', 'Licht kaputt'); await admin.click('#rpk'); await settle();
  check(psql(`select status from repairs`) === 'open', 'repair stored');
  await coach.fresh('building'); check((await coach.text()).includes('🔒'), 'coach locked out of clubhouse');

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
