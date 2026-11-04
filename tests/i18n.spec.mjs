// Every language must have exactly the same keys and the same {placeholders}.
// Run: npm run test:i18n
import { T, LANGS } from '../js/i18n.js';

const errors = [];
const langs = Object.keys(LANGS);
const ref = Object.keys(T.tr).sort();
const ph = s => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',');
for (const l of langs) {
  if (!T[l]) { errors.push(`missing language block: ${l}`); continue; }
  const keys = Object.keys(T[l]).sort();
  for (const k of ref) if (!keys.includes(k)) errors.push(`${l}: missing key ${k}`);
  for (const k of keys) if (!ref.includes(k)) errors.push(`${l}: extra key ${k}`);
  for (const k of ref) if (T[l][k] !== undefined && ph(T[l][k]) !== ph(T.tr[k])) errors.push(`${l}.${k}: placeholders differ from tr`);
  for (const k of ref) if (T[l][k] !== undefined && !String(T[l][k]).trim()) errors.push(`${l}.${k}: empty`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`i18n ok (${langs.join(', ')}; ${ref.length} keys each)`);
