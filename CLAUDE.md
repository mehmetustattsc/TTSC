# TTSC Takım – notes for Claude

- Owner: Mehmet (TTSC Buchen). Talk to him in Turkish, short and plain; he is not a developer.
- Plain HTML/CSS/ES modules, no build step. Deployed by `.github/workflows/ci.yml` to GitHub Pages after `npm run test:smoke` passes.
- All data access goes through `js/store.js`; screens must not touch `localStorage` directly. Planned: swap the local backend for a shared server.
- UI strings live in `js/i18n.js` for tr/de/en. Add every new key to all three. Feedback tags and absence reasons are stored as keys so each reader sees their own language.
- Privacy rules (tested): coach notes and self ratings are visible only to that player and coaches; player → coach feedback only to coaches; the board sees stats and attendance, not private notes. Availability is only fit / limited / injured, never a diagnosis.
- Demo names, opponents and results are invented; keep them invented.
- Before pushing: `npm run test:smoke`, then look at the screenshots in `tests/shots/`.
