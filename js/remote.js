// Talks to Supabase over plain HTTP (no library): email-code login and table access.
// Every request runs as the signed-in person, so the server's access rules apply.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SKEY = 'ttsc-session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { session = null; }
const saveSession = s => { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } };

export const configured = () => !!(SUPABASE_URL && SUPABASE_KEY);
export const userId = () => session?.user?.id || null;

async function call(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...headers };
  if (auth && session) { await fresh(); h.Authorization = 'Bearer ' + session.access_token; }
  const r = await fetch(SUPABASE_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) { const e = new Error(data?.msg || data?.message || data?.error_description || r.statusText); e.status = r.status; throw e; }
  return data;
}

function keep(d) { saveSession({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user.id, email: d.user.email } }); }
async function fresh() {
  if (!session || session.expires_at - 60 > Date.now() / 1000) return;
  try { keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false })); }
  catch (e) { saveSession(null); throw e; }
}

// ---------- login with the link from the email (fallback when the email has no code) ----------
// Supabase sends the person back to the app with #access_token=…&refresh_token=… in the address.
export async function takeLinkLogin() {
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  if (h.get('error_description')) { history.replaceState(null, '', location.pathname); throw new Error(h.get('error_description')); }
  const at = h.get('access_token'); if (!at) return false;
  history.replaceState(null, '', location.pathname);
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + at } });
  if (!r.ok) throw new Error('login link expired');
  const u = await r.json();
  keep({ access_token: at, refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user: u });
  return true;
}

// ---------- login with a one-time code ----------
export const sendCode = email => call('/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: { email, create_user: true }, auth: false });
export async function verifyCode(email, token) { keep(await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token }, auth: false })); return userId(); }
export async function signOut() { try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* offline is fine */ } saveSession(null); }

// ---------- tables ----------
export const select = (table, query = 'select=*') => call(`/rest/v1/${table}?${query}`);
export const insert = (table, rows) => call(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=minimal' } });
export const upsert = (table, rows, onConflict) => call(`/rest/v1/${table}?on_conflict=${onConflict}`, { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
export const update = (table, filter, patch) => call(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=minimal' } });
export const remove = (table, filter) => call(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
