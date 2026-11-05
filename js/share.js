// Match graphics for Instagram (story 1080×1920, post 1080×1350), drawn on a canvas in the browser.
// Style follows the club's feed: red/black, condensed capitals, torn paper edges, big MATCHDAY / ENDSTAND.
// A photo the user picks stays on the phone; nothing is uploaded.

const RED = '#C8102E', DEEP = '#7E0718', INK = '#0B0B0D';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const DAYS = ['SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG'];

let logo = null;
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
export async function ready() {
  if (!logo) logo = await loadImg('assets/logo.png');
  await Promise.all([document.fonts.load(`700 100px ${COND}`), document.fonts.load(`600 100px ${COND}`)]).catch(() => {});
}

// deterministic "random" so the torn edge looks the same every time for the same match
function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
// a band with a torn edge (top or bottom)
function tornBand(ctx, W, y0, y1, edge, fill, R) {
  ctx.beginPath();
  const tear = y => { const pts = []; for (let x = 0; x <= W + 30; x += 18 + R() * 26) pts.push([x, y + (R() - 0.5) * 34 + Math.sin(x / 90) * 10]); return pts; };
  if (edge === 'bottom') { ctx.moveTo(0, y0); ctx.lineTo(W, y0); tear(y1).reverse().forEach(([x, y]) => ctx.lineTo(x, y)); }
  else { tear(y0).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineTo(W, y1); ctx.lineTo(0, y1); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  // paper fibre: thin light line along the tear
  ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
function fitText(ctx, text, maxW, size, weight = 700) {
  let s = size; do { ctx.font = `${weight} ${s}px ${COND}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
  return s + 2;
}
const initials = name => name.replace(/^(SpG|SV|TSV|FC|VfR|SpVgg|TSG|FV|SC|VfB|SG)\s+/i, '').split(/[\s/-]+/).filter(w => /^\p{L}/u.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function badge(ctx, x, y, r, name, us) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = us ? RED : '#2a2a2e'; ctx.stroke();
  if (us && logo) { const h = r * 1.55, w = h * logo.width / logo.height; ctx.drawImage(logo, x - w / 2, y - h / 2, w, h); }
  else { ctx.fillStyle = '#2a2a2e'; ctx.font = `700 ${r * 0.8}px ${COND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initials(name), x, y + r * 0.05); }
  ctx.restore();
}
function ribbon(ctx, W, y, h, text, color, name, us) {
  ctx.save();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(W * 0.18, y); ctx.lineTo(W - 70, y); ctx.lineTo(W - 70, y + h); ctx.lineTo(W * 0.18 - 40, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  fitText(ctx, text, W * 0.56, h * 0.72); ctx.fillText(text, W - 70 - h * 1.25, y + h / 2 + 3);
  badge(ctx, W - 70 - h * 0.35, y + h / 2, h * 0.78, name, us);
  ctx.restore();
}
function background(ctx, W, H, photo, R) {
  if (photo) { cover(ctx, photo, 0, 0, W, H); return; }
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2A0208'); g.addColorStop(0.55, '#0E0E11'); g.addColorStop(1, '#3B0510');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, H * 0.6); rg.addColorStop(0, 'rgba(200,16,46,.55)'); rg.addColorStop(1, 'rgba(200,16,46,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  // floodlight haze and pitch lines
  ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.82, W * 0.55, H * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-50, H * 0.82); ctx.lineTo(W + 50, H * 0.82); ctx.stroke(); ctx.restore();
  if (logo) { ctx.save(); ctx.globalAlpha = 0.16; const h = H * 0.42, w = h * logo.width / logo.height; ctx.drawImage(logo, (W - w) / 2, H * 0.3, w, h); ctx.restore(); }
  for (let i = 0; i < 140; i++) { ctx.fillStyle = `rgba(255,${60 + R() * 60 | 0},${60 + R() * 40 | 0},${R() * 0.35})`; ctx.fillRect(R() * W, H * 0.25 + R() * H * 0.5, 2 + R() * 3, 2 + R() * 3); }
}
const homeAway = (e, us = 'TTSC BUCHEN') => (e.home ? [us, e.opponent.toUpperCase()] : [e.opponent.toUpperCase(), us]);

// ---------- MATCHDAY ----------
export function matchday(canvas, e, { format = 'story', photo = null } = {}) {
  const W = 1080, H = format === 'story' ? 1920 : 1350, ctx = canvas.getContext('2d'), R = rng(e.id);
  canvas.width = W; canvas.height = H;
  background(ctx, W, H, photo, R);
  // darken photo for legibility
  const sh = ctx.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(0,0,0,.15)'); sh.addColorStop(0.5, 'rgba(0,0,0,.05)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  const topH = format === 'story' ? 520 : 380;
  tornBand(ctx, W, 0, topH, 'bottom', 'rgba(200,16,46,.88)', R);

  // venue (left) and date/time (right)
  const pad = 64, ty = format === 'story' ? 150 : 110, lh = format === 'story' ? 74 : 62, fs = format === 'story' ? 70 : 58;
  const place = (e.place || (e.home ? 'Sportplatz Buchen' : 'Auswärts')).toUpperCase();
  const venue = [e.home ? 'HEIMSPIEL' : 'AUSWÄRTSSPIEL', ...place.split(/,\s*/)].slice(0, 4);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  venue.forEach((l, i) => { fitText(ctx, l, W * 0.5, fs, i ? 600 : 700); ctx.fillText(l, pad, ty + i * lh); });
  const d = new Date(e.date + 'T12:00:00');
  ctx.textAlign = 'right';
  ctx.font = `700 ${fs}px ${COND}`; ctx.fillText(`${DAYS[d.getDay()]}, ${e.date.split('-').reverse().join('.')}`, W - pad, ty);
  ctx.font = `700 ${fs * 1.5}px ${COND}`; ctx.fillText(`${e.time} UHR`, W - pad, ty + lh * 1.45);
  if (e.note) { ctx.font = `600 ${fs * 0.62}px ${COND}`; ctx.globalAlpha = 0.9; ctx.fillText(e.note.toUpperCase(), W - pad, ty + lh * 2.3); ctx.globalAlpha = 1; }

  // MATCHDAY, big and diagonal: outline in front, filled behind
  ctx.save(); ctx.translate(W * 0.5, H * (format === 'story' ? 0.56 : 0.5)); ctx.rotate(-Math.PI * 0.34);
  const big = format === 'story' ? 300 : 230; ctx.font = `700 ${big}px ${COND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('MATCHDAY', 0, -big * 0.46);
  ctx.lineWidth = 7; ctx.strokeStyle = RED; ctx.strokeText('MATCHDAY', 0, big * 0.56);
  ctx.globalAlpha = 0.3; ctx.fillStyle = RED; ctx.fillText('MATCHDAY', 0, big * 0.56);
  ctx.restore();

  // teams
  const botY = H - (format === 'story' ? 470 : 380);
  tornBand(ctx, W, botY, H, 'top', 'rgba(11,11,13,.82)', R);
  const story = format === 'story', [a, b] = homeAway(e), rh = story ? 118 : 92, gap = story ? 46 : 28, y0 = botY + (story ? 110 : 70);
  ribbon(ctx, W, y0, rh, a, a === 'TTSC BUCHEN' ? RED : '#2a2a2e', a, a === 'TTSC BUCHEN');
  ribbon(ctx, W, y0 + rh + gap, rh, b, b === 'TTSC BUCHEN' ? RED : '#2a2a2e', b, b === 'TTSC BUCHEN');
  if (story) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `600 34px ${COND}`; ctx.textAlign = 'left'; ctx.fillText('TTSC BUCHEN E.V. · SEIT 1972', pad, H - 54); }
}

// ---------- ENDSTAND ----------
export function endstand(canvas, e, { format = 'story', photo = null, scorers = [] } = {}) {
  const W = 1080, H = format === 'story' ? 1920 : 1350, ctx = canvas.getContext('2d'), R = rng(e.id + 'x');
  canvas.width = W; canvas.height = H;
  // frame: red and black brush strokes with the shield as watermark
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5E0512'); g.addColorStop(0.5, INK); g.addColorStop(1, '#8E0A1E');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    ctx.save(); ctx.globalAlpha = 0.1 + R() * 0.22; ctx.fillStyle = R() > 0.5 ? RED : '#000';
    ctx.translate(R() * W, R() * H); ctx.rotate(-0.55 + R() * 0.2); ctx.fillRect(-W, -6 - R() * 26, W * 2, 12 + R() * 50); ctx.restore();
  }
  if (logo) { ctx.save(); ctx.globalAlpha = 0.2; const h = H * 0.5, w = h * logo.width / logo.height; ctx.drawImage(logo, -w * 0.55, H * 0.22, w, h); ctx.drawImage(logo, W - w * 0.45, H * 0.22, w, h); ctx.restore(); }

  // photo card
  const m = 80, top = format === 'story' ? 150 : 90, cw = W - 2 * m, ch = H - top - (format === 'story' ? 210 : 110), r = 70;
  const card = () => { ctx.beginPath(); ctx.roundRect(m, top, cw, ch, r); };
  ctx.save(); card(); ctx.clip();
  if (photo) cover(ctx, photo, m, top, cw, ch);
  else { const cg = ctx.createLinearGradient(0, top, 0, top + ch); cg.addColorStop(0, '#26262B'); cg.addColorStop(1, '#0E0E11'); ctx.fillStyle = cg; ctx.fillRect(m, top, cw, ch);
    if (logo) { ctx.globalAlpha = 0.9; const st = format === 'story', h = ch * (st ? 0.34 : 0.27), w = h * logo.width / logo.height; ctx.drawImage(logo, (W - w) / 2, top + (st ? ch * 0.12 : 140), w, h); ctx.globalAlpha = 1; } }
  const sh = ctx.createLinearGradient(0, top + ch * 0.45, 0, top + ch); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.78)');
  ctx.fillStyle = sh; ctx.fillRect(m, top, cw, ch);
  ctx.restore();
  ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; card(); ctx.stroke();

  // ENDSTAND pill, score, team names
  const [a, b] = homeAway(e);
  const us = e.result.us, them = e.result.them, [la, lb] = e.home ? [us, them] : [them, us];
  const cy = top + ch * (format === 'story' ? 0.6 : 0.52);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pw = 520, ph = 128; ctx.fillStyle = 'rgba(126,7,24,.92)'; ctx.beginPath(); ctx.roundRect(W / 2 - pw / 2, cy - ph / 2, pw, ph, ph / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 112px ${COND}`; ctx.fillText('ENDSTAND', W / 2, cy + 6);
  const sy = cy + (format === 'story' ? 250 : 215), sf = format === 'story' ? 300 : 250;
  ctx.font = `700 ${sf}px ${COND}`; ctx.fillText(String(la), W / 2 - 210, sy); ctx.fillText(String(lb), W / 2 + 210, sy); ctx.fillText(':', W / 2, sy - 12);
  ctx.font = `700 56px ${COND}`;
  [[a, W / 2 - 210], [b, W / 2 + 210]].forEach(([n, x]) => { fitText(ctx, n, 390, 56); ctx.fillText(n, x, sy + sf * 0.62); });

  // TTSC scorers (from the match report), outcome word
  const k = us > them ? 'SIEG' : us === them ? 'UNENTSCHIEDEN' : '';
  if (scorers.length) {
    ctx.font = `600 44px ${COND}`; ctx.globalAlpha = 0.95;
    const line = '⚽ ' + scorers.map(s => s.name.split(' ').slice(-1)[0].toUpperCase() + (s.g > 1 ? ` ${s.g}×` : '')).join('  ·  ');
    fitText(ctx, line, cw - 80, 44, 600); ctx.fillText(line, W / 2, sy + sf * 0.62 + 84); ctx.globalAlpha = 1;
  }
  if (k) { ctx.save(); ctx.translate(W / 2, top + 70); ctx.fillStyle = k === 'SIEG' ? RED : '#2a2a2e'; ctx.beginPath(); ctx.roundRect(-150, -38, 300, 76, 38); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 54px ${COND}`; ctx.fillText(k, 0, 4); ctx.restore(); }
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `600 36px ${COND}`; ctx.textAlign = 'center';
  ctx.fillText(`${e.note ? e.note.toUpperCase() + ' · ' : ''}${e.date.split('-').reverse().join('.')}`, W / 2, H - (format === 'story' ? 110 : 52));
}

// share to Instagram/WhatsApp through the phone's share sheet, or download
export async function shareCanvas(canvas, name) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return 'shared'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); return 'downloaded';
}
