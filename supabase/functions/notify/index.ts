// Edge function "notify": called by database triggers (supabase/push.sql) and the daily reminder.
// Works out who should get what (logic.js) and sends Web Push messages to their phones.
import webpush from 'npm:web-push@3.6.7';
import { plan } from './logic.js';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:info@ttscbuchen.de', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

const db = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

Deno.serve(async (req) => {
  if (req.headers.get('x-hook-secret') !== Deno.env.get('HOOK_SECRET')) return new Response('forbidden', { status: 403 });
  const { type, rows = [] } = await req.json();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const profiles = await db('profiles?select=id,name,role,plays,lang');
  const extra = type === 'reminders'
    ? { events: await db(`events?select=id,type,title,opponent,home,date,time&date=gt.${today}`), rsvps: await db('rsvps?select=event_id,player_id'), today }
    : {};
  const messages = plan({ type, rows, profiles, ...extra });
  if (!messages.length) return Response.json({ sent: 0 });

  const ids = [...new Set(messages.map(m => m.to))];
  const subs: { endpoint: string; user_id: string; p256dh: string; auth: string }[] = await db(`push_subs?select=*&user_id=in.(${ids.join(',')})`);
  let sent = 0, gone = 0;
  await Promise.all(messages.flatMap(m => subs.filter(s => s.user_id === m.to).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }), { TTL: 60 * 60 * 24, urgency: 'normal' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { gone++; await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }); }
      else console.error('push failed', code, String(e));
    }
  })));
  return Response.json({ sent, gone });
});
