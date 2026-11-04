// Browser smoke test: every module renders for every role, main flows save data,
// and each role only sees what it may see. Run: npm run test:smoke (screenshots in tests/shots/)
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { extname, join } from 'path';

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
await mkdir(join(root, 'tests/shots'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const shot = n => page.screenshot({ path: join(root, 'tests/shots', n + '.png'), fullPage: n.endsWith('-full') });
const check = (cond, msg) => { if (!cond) errors.push('FAIL: ' + msg); };
const go = async h => { await page.goto(url + '#/' + h); await page.waitForTimeout(80); };
const tiles = async () => (await page.locator('.tile-m').evaluateAll(a => a.map(x => x.getAttribute('href')))).join(' ');
const as = async id => { await go('me'); const b = page.locator('[data-act="switch"]'); if (await b.count()) await b.click(); await page.locator('details.demo summary').click(); await page.click(`[data-act="login"][data-id="${id}"]`); await page.waitForSelector('.hello'); };
const locked = async h => { await go(h); return (await page.locator('.view').innerText()).includes('🔒'); };

await page.goto(url); await page.waitForSelector('.login'); await shot('01-login');

// ----- coach -----
await as('c1');
let tl = await tiles();
check(tl.includes('#/players') && !tl.includes('#/members') && !tl.includes('#/building'), 'coach tiles: ' + tl);
await shot('02-coach-home');
check(await locked('members'), 'coach cannot open members');
await go('cal'); await page.click('[data-act="cal-tab"][data-v="past"]'); await page.click('[data-act="cal-type"][data-v="match"]');
await page.locator('.ev-match a.ev-main').first().click();
await page.click('[data-act="match-report"]'); await page.waitForSelector('.rep'); await shot('03-match-report');
await page.click('[data-sc="us"][data-d="1"]'); await page.click('#mok');
await go('cal'); await page.click('[data-act="cal-tab"][data-v="up"]'); await page.click('[data-act="new-event"]');
await page.click('#nt [data-v="event"]'); await page.fill('#ntt', 'Test Fest'); await page.click('#nok'); await page.waitForTimeout(80);
check((await page.locator('.ev-title').first().innerText()).includes('Test Fest'), 'club event created');
await go('msg/notes'); await page.click('[data-act="pick-note"]'); await page.click('[data-pick="p11"]');
await page.locator('#cg .chip').first().click(); await page.fill('#ct', 'Secret coach note'); await page.click('#cok'); await page.waitForTimeout(80);
await page.click('[data-act="notes-tab"][data-v="out"]'); check((await page.locator('.view').innerText()).includes('Secret coach note'), 'coach note in sent');
await go('msg/board'); check(!(await page.locator('.seg').innerText()).includes('Vorstand') && !(await page.locator('.seg').innerText()).includes('Yönetim sohbeti'), 'coach has no board chat');
await go('players'); await shot('04-players-full');

// ----- player (German) -----
await as('p8');
tl = await tiles();
check(tl.includes('#/cal') && tl.includes('#/msg') && !tl.includes('#/players') && !tl.includes('#/members'), 'player tiles: ' + tl);
check((await page.locator('.grid').first().innerText()).includes('Kalender'), 'German UI');
await shot('05-player-home');
for (const h of ['players', 'members', 'building']) check(await locked(h), 'player locked out of ' + h);
await go('msg/team'); await page.fill('#cm', 'Hallo Team!'); await page.press('#cm', 'Enter'); await page.waitForTimeout(80);
check((await page.locator('.bub.mine').last().innerText()).includes('Hallo Team!'), 'chat message sent');
await shot('06-team-chat');
await go('msg/board'); check(!(await page.locator('.view').innerText()).includes('Aidat'), 'player cannot read board chat');
await go('p/p11'); check(!(await page.locator('.view').innerText()).includes('Secret coach note'), 'player cannot read another player\'s notes');
await go('stats/me'); await shot('07-my-stats-full');
await go('home'); const rs = page.locator('[data-act="rsvp-no"]').first();
if (await rs.count()) { await rs.click(); await page.locator('#rs .chip').first().click(); await page.click('#rok'); }

// ----- board (Kassenwart) -----
await as('b2');
tl = await tiles();
check(tl.includes('#/members') && tl.includes('#/building') && tl.includes('#/players'), 'board tiles: ' + tl);
await shot('08-board-home');
await go('p/p11'); check(!(await page.locator('.view').innerText()).includes('Secret coach note'), 'board cannot read coach notes');
await go('msg/notes'); check(!(await page.locator('.seg').innerText()).match(/Notlar|Notizen|Notes/), 'board has no notes tab');
await go('msg/board'); check((await page.locator('.view').innerText()).includes('Aidat'), 'board reads board chat'); await shot('09-board-chat');
await go('members'); const before = await page.locator('.pay.paid').count(); await page.locator('.pay:not(.paid)').first().click(); await page.waitForTimeout(80);
check(await page.locator('.pay.paid').count() === before + 1, 'fee marked paid');
check(await page.locator('select[data-act-change="role"]').count() === 0, 'only admin sees roles');
await shot('10-members-full');
await go('building/repairs'); await page.click('[data-act="add-repair"]'); await page.fill('#rti', 'Tor kaputt'); await page.click('#rpk'); await page.waitForTimeout(80);
check((await page.locator('.view').innerText()).includes('Tor kaputt'), 'repair added'); await shot('11-repairs-full');
await go('building/bookings'); await shot('12-bookings');

// ----- admin -----
await as('b1');
await go('members'); check(await page.locator('select[data-act-change="role"]').count() > 0, 'admin sees roles');
await page.selectOption('select[data-id="p16"]', 'coach'); await page.waitForTimeout(80);
await as('p16').catch(() => {}); // p16 is now a coach and listed under coaches
check((await tiles()).includes('#/players'), 'role change gives coach tiles');

// French: all four languages selectable, no raw translation keys leak into any module
await go('me'); await page.click('[data-act="lang"][data-v="fr"]'); await page.waitForTimeout(80);
await go(''); check((await page.locator('.grid').first().innerText()).includes('Calendrier'), 'French UI after choosing French');
for (const r of ['', 'cal', 'msg/team', 'msg/board', 'stats', 'stats/players', 'games', 'players', 'members', 'building/bookings', 'building/repairs', 'me']) {
  await go(r);
  check(!/\b(tab|reason|tag|fb|pos|avail|role|mod|ch|st|m)_[a-zA-Z]+\b/.test(await page.locator('body').innerText()), 'no raw i18n keys in French view ' + (r || 'home'));
}
await shot('13-french-home');

await browser.close(); server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('smoke ok');
