# Repository Guidelines

## Project Structure & Module Organization
- Root: Apps Script sources — server `.gs`, UI `.html` fragments.
- Server modules: `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- Config: `Configuration.gs` is the single source of truth (flags/pricing/rules). Do not duplicate config. Manifest in `appsscript.json`.
- UI views: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`. Keep views modular; avoid inline styles. Assets in `branding/ui/`; historical in `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local dev tools (e.g., `@google/clasp`).
- `npx clasp login` — authenticate to Google.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from Apps Script editor.
- `npm run test:clasp` — run server-side tests (e.g., `npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- JavaScript (V8) ES2019+; prefer `const`/`let`, arrow functions; always end lines with semicolons; 2-space indentation.
- Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: font Montserrat; brand colors `#8e44ad`, `#3498db`, `#5dade2`; maintain RGAA contrast and visible focus states.

## Testing Guidelines
- Prefer small server-side helpers named `test_*`; run with `npx clasp run <name>`.
- Manual acceptance: reservation E2E, calendar week view (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF, client space visibility.
- Keep console free of errors/warnings; CI validates pushes.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>]` `[no-structure-change]`.
- PRs: include scope, rationale, linked issue, screenshots/GIFs for UI, affected flags in `Configuration.gs`, and rollback notes.
- New behavior must be behind a disabled-by-default feature flag in `Configuration.gs`.

## Security & Configuration Tips
- Never commit secrets; store keys in Script Properties.
- Web App runs as OWNER; deployments are versioned. Treat `Configuration.gs` as authoritative and review changes carefully.

## UI & Layout Conventions
- Preserve widget IDs (e.g., `#calendar-panel`, `#basket-section`, `#btn-espace-client`).
- Layout: 3‑column shell `.layout-els` — left hero, center calendar (`.els-center-grid`), right asides (stops/options). On ≤1280px use 2 columns; ≤992px single column: hero → calendar → basket+client → stops → options → footer.
- Desktop: `.els-client-col` is sticky; avoid `overflow: hidden` on its ancestors. For FHD, let calendar container scroll (e.g., `[data-component="calendar"] { overflow: auto; }`); ensure wrappers keep `width: 100%` for `#vue-calendrier`.

