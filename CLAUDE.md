# TTSC Takım – notes for Claude

- Owner: Mehmet (TTSC Buchen). Talk to him in Turkish, short and plain; he is not a developer.
- Plain HTML/CSS/ES modules, no build step. Deployed by `.github/workflows/ci.yml` to GitHub Pages after `npm run test:smoke` passes.
- All data access goes through `js/store.js`; screens must not touch `localStorage` directly. Two modes: server (Supabase, `js/remote.js` + `js/config.js`, plain fetch, no library) and demo (invented data on the device, from the login screen). Server writes are optimistic; a failed write reloads from the server.
- `npm run test:server` runs the app against real Postgres + `supabase/schema.sql` + PostgREST with a stand-in email-code login, several people at once. Keep it passing.
- UI strings live in `js/i18n.js` for tr/de/en/fr. Add every new key to all four (`npm run test:i18n` checks it). Feedback tags and absence reasons are stored as keys so each reader sees their own language.
- Roles: player, coach, board, admin (admin = board + role management). `plays` marks a coach/board member who also plays (player-coach, e.g. Muhammet); use `S.isPlaying(u)`, never `role === 'player'`, for anything player-side. Module access: `can()` in `js/store.js`, mirrored by row-level security in `supabase/schema.sql`. Keep both in sync.
- Login on the server: email one-time code, only invited emails (invites table) get a role; others stay 'pending'.
- Privacy rules (tested): coach notes and self ratings are visible only to that player and coaches; player → coach feedback only to coaches; the board sees stats and attendance, not private notes. Availability is only fit / limited / injured, never a diagnosis.
- No requests to other sites on load (fonts are local; the smoke test checks it). When adding a new kind of personal data or a new service, update `datenschutz.html` (DE + TR).
- The real coach is Muhammet; never invent names of real club people.
- Demo names, opponents and results are invented; keep them invented.
- Before pushing: `npm run test:smoke`, then look at the screenshots in `tests/shots/`.
