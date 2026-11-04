// Browser smoke test: every screen renders for every role, and the main flows save data.
// Run: npm run test:smoke   (screenshots land in tests/shots/)
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;
const shots = process.env.SHOTS !== '0';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const shot = async n => { if (shots) await page.screenshot({ path: join(root, 'tests/shots', n + '.png'), fullPage: n.endsWith('-full') }); };
const check = (cond, msg) => { if (!cond) { errors.push('FAIL: ' + msg); } };

await page.goto(url);
await page.waitForSelector('.login');
await shot('01-login');

// coach
await page.click('[data-act="login"][data-id="c1"]');
await page.waitForSelector('.hello');
check(await page.locator('.alert').count() > 0, 'coach sees alerts');
await shot('02-coach-home');
for (const r of ['cal', 'team', 'stats', 'me']) { await page.goto(url + '#/' + r); await page.waitForTimeout(100); check(await page.locator('.view').innerText() !== '', 'view ' + r); await shot('03-coach-' + r); }
// match report on the last past match
await page.goto(url + '#/cal'); await page.click('[data-act="cal-tab"][data-v="past"]');
await page.locator('.ev-match a.ev-main').first().click();
await page.click('[data-act="match-report"]'); await page.waitForSelector('.rep');
await shot('04-match-report');
await page.click('[data-sc="us"][data-d="1"]');
await page.click('#mok'); await page.waitForTimeout(100);
// new event
await page.goto(url + '#/cal'); await page.click('[data-act="new-event"]');
await page.click('#nt [data-v="match"]'); await page.fill('#no', 'Test FC'); await page.click('#nok');
await page.waitForTimeout(100); check((await page.locator('.ev-title').first().innerText()).includes('Test FC'), 'new match created');
// coach note
await page.goto(url + '#/p/p11'); await page.click('[data-act="coach-note"]');
await page.locator('#cg .chip').first().click(); await page.fill('#ct', 'Test note'); await page.click('#cok');
await page.waitForTimeout(100); check((await page.locator('.note').first().innerText()).includes('Test note'), 'coach note saved');
await shot('05-player-as-coach-full');

// player (German)
await page.click('[data-act="switch"]'); await page.click('[data-act="login"][data-id="p8"]');
await page.waitForSelector('.hello');
check((await page.locator('.tabs').innerText()).includes('Kalender'), 'German UI for German player');
await shot('06-player-home');
await page.locator('[data-act="rsvp-no"]').first().click(); await page.locator('#rs .chip').first().click(); await page.click('#rok');
await page.waitForTimeout(100); check(await page.locator('.rsvp .no.on').count() > 0, 'rsvp no saved');
const self = page.locator('[data-act="self"]').first();
if (await self.count()) { await self.click(); await page.click('#ss [data-v="4"]'); await page.locator('#sg .chip').first().click(); await shot('07-self-sheet'); await page.click('#sok'); }
await page.goto(url + '#/p/p8'); await page.waitForTimeout(100); await shot('08-player-profile-full');
// a player must not see someone else's private notes
await page.goto(url + '#/p/p11'); await page.waitForTimeout(100);
check(await page.locator('.note').count() === 0, 'privacy: no foreign notes for players');
await page.goto(url + '#/stats'); await shot('09-player-stats-full');

// board (Turkish)
await page.goto(url + '#/me'); await page.click('[data-act="switch"]'); await page.click('[data-act="login"][data-id="b1"]');
await page.goto(url + '#/p/p11'); await page.waitForTimeout(100);
check(await page.locator('.note').count() === 0, 'privacy: board does not see coach notes');

await browser.close(); server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('smoke ok');
