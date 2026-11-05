// Who gets which notification. Pure function (no network), shared by the edge function and the tests.
// Notes are private: the notification says that a note arrived, never what it says.

const TXT = {
  tr: {
    newEvent: 'Yeni etkinlik', newEvents: '{n} yeni etkinlik', training: 'Antrenman', match: 'Maç', event: 'Etkinlik',
    coachNote: 'Antrenöründen yeni not', coachNoteBody: '{name} sana bir not yazdı.',
    feedback: 'Oyuncudan geri bildirim', feedbackBody: '{name} antrenörlere yazdı.',
    remind: 'Cevabın bekleniyor', remindBody: '{event} · {when}. Geliyor musun?', board: 'Yönetim',
  },
  de: {
    newEvent: 'Neuer Termin', newEvents: '{n} neue Termine', training: 'Training', match: 'Spiel', event: 'Termin',
    coachNote: 'Neue Notiz von deinem Trainer', coachNoteBody: '{name} hat dir eine Notiz geschrieben.',
    feedback: 'Feedback von einem Spieler', feedbackBody: '{name} hat den Trainern geschrieben.',
    remind: 'Deine Antwort fehlt', remindBody: '{event} · {when}. Bist du dabei?', board: 'Vorstand',
  },
  en: {
    newEvent: 'New event', newEvents: '{n} new events', training: 'Training', match: 'Match', event: 'Event',
    coachNote: 'New note from your coach', coachNoteBody: '{name} wrote you a note.',
    feedback: 'Feedback from a player', feedbackBody: '{name} wrote to the coaches.',
    remind: 'Your answer is missing', remindBody: '{event} · {when}. Are you in?', board: 'Board',
  },
  fr: {
    newEvent: 'Nouvel événement', newEvents: '{n} nouveaux événements', training: 'Entraînement', match: 'Match', event: 'Événement',
    coachNote: 'Nouvelle note de ton entraîneur', coachNoteBody: '{name} t’a écrit une note.',
    feedback: 'Retour d’un joueur', feedbackBody: '{name} a écrit aux entraîneurs.',
    remind: 'Ta réponse manque', remindBody: '{event} · {when}. Tu viens ?', board: 'Comité',
  },
};
const LOC = { tr: 'tr-TR', de: 'de-DE', en: 'en-GB', fr: 'fr-FR' };
const tx = (lang, k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.replaceAll('{' + a + '}', b), (TXT[lang] || TXT.de)[k] || TXT.de[k]);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const MEMBER = ['player', 'coach', 'board', 'admin'];
const isMember = p => MEMBER.includes(p.role);
const isBoard = p => p.role === 'board' || p.role === 'admin';
const isPlaying = p => p.role === 'player' || (p.plays && isMember(p));

function when(e, lang) {
  const d = new Date(e.date + 'T12:00:00Z');
  const day = d.toLocaleDateString(LOC[lang] || 'de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${day} ${String(e.time || '').slice(0, 5)}`.trim();
}
function title(e, lang) {
  if (e.type === 'match') return e.home ? `TTSC – ${e.opponent}` : `${e.opponent} – TTSC`;
  if (e.type === 'event') return e.title || tx(lang, 'event');
  return tx(lang, 'training');
}

/**
 * @param {object} a
 * @param {'messages'|'events'|'notes'|'reminders'} a.type
 * @param {object[]} [a.rows]    new rows (for messages/events/notes)
 * @param {object[]} a.profiles  {id, name, role, plays, lang}
 * @param {object[]} [a.events]  upcoming events (reminders)
 * @param {object[]} [a.rsvps]   {event_id, player_id} (reminders)
 * @param {string}   [a.today]   YYYY-MM-DD (reminders)
 * @returns {{to: string, title: string, body: string, url: string, tag: string}[]}
 */
export function plan({ type, rows = [], profiles, events = [], rsvps = [], today }) {
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
  const out = [];
  const push = (p, t, body, url, tag) => out.push({ to: p.id, title: t, body, url, tag });

  if (type === 'messages') {
    for (const m of rows) {
      const from = byId[m.from_id];
      const who = m.channel === 'board' ? profiles.filter(isBoard) : profiles.filter(isMember);
      for (const p of who) if (p.id !== m.from_id)
        push(p, (from?.name || 'TTSC') + (m.channel === 'board' ? ' · ' + tx(p.lang, 'board') : ''), clip(m.text || '', 180), '#/msg/' + m.channel, 'chat-' + m.channel);
    }
  }

  if (type === 'events' && rows.length) {
    const creator = rows[0].created_by;
    for (const p of profiles.filter(isMember)) {
      if (p.id === creator) continue;
      if (rows.length === 1) push(p, tx(p.lang, 'newEvent'), `${title(rows[0], p.lang)} · ${when(rows[0], p.lang)}`, '#/ev/' + rows[0].id, 'ev-' + rows[0].id);
      else push(p, tx(p.lang, 'newEvents', { n: rows.length }), rows.slice(0, 3).map(e => `${title(e, p.lang)} · ${when(e, p.lang)}`).join('\n'), '#/cal', 'ev-batch');
    }
  }

  if (type === 'notes') {
    for (const n of rows) {
      const from = byId[n.from_id];
      if (n.kind === 'coach' && byId[n.to_id]) {
        const p = byId[n.to_id];
        push(p, tx(p.lang, 'coachNote'), tx(p.lang, 'coachNoteBody', { name: from?.name || '' }), '#/msg/notes', 'note');
      }
      if (n.kind === 'toCoach') for (const p of profiles.filter(x => x.role === 'coach' && x.id !== n.from_id))
        push(p, tx(p.lang, 'feedback'), tx(p.lang, 'feedbackBody', { name: from?.name || '' }), '#/msg/notes', 'feedback');
    }
  }

  if (type === 'reminders') {
    const end = new Date(today + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 2);
    const last = end.toISOString().slice(0, 10);
    const soon = events.filter(e => e.type !== 'event' && e.date > today && e.date <= last);
    const answered = new Set(rsvps.map(r => r.event_id + '/' + r.player_id));
    for (const e of soon) for (const p of profiles.filter(isPlaying))
      if (!answered.has(e.id + '/' + p.id)) push(p, tx(p.lang, 'remind'), tx(p.lang, 'remindBody', { event: title(e, p.lang), when: when(e, p.lang) }), '#/ev/' + e.id, 'remind-' + e.id);
  }
  return out;
}
