# Repository Guidelines

## Project Structure & Module Organization
- Root holds Apps Script server `.gs` modules and UI `.html` fragments.
- Server modules: `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- Configuration: `Configuration.gs` is the single source of truth (flags, pricing, rules). Do not duplicate config. Manifest in `appsscript.json`.
- UI views: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`. Assets in `branding/ui/`; legacy in `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local dev tools (e.g., `@google/clasp`).
- `npx clasp login` — authenticate to Google.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from the Apps Script editor.
- `npm run test:clasp` — run server-side tests (e.g., `npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- JavaScript (V8) ES2019+; use `const`/`let`, arrow functions; always end lines with semicolons; 2-space indentation.
- Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: font Montserrat; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Maintain RGAA contrast and visible focus states. Keep views modular; avoid inline styles.

## Testing Guidelines
- Prefer small server-side helpers named `test_*`; run with `npx clasp run <name>`.
- Manual acceptance: reservation E2E; calendar week view (Mon–Sun); AM/PM split when `SLOTS_AMPM_ENABLED=true`; invoicing PDF; client space visibility.
- Keep the console free of errors/warnings; CI validates pushes.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>]` `[no-structure-change]`.
- New behavior must be behind a disabled-by-default feature flag in `Configuration.gs`.
- PRs: include scope, rationale, linked issue, UI screenshots/GIFs, affected flags in `Configuration.gs`, and rollback notes.

## Security & Configuration Tips
- Never commit secrets; store keys in Script Properties.
- Web App runs as OWNER; deployments are versioned. Treat `Configuration.gs` as authoritative and review changes carefully.

## UI & Layout Conventions
- Preserve widget IDs (e.g., `#calendar-panel`, `#basket-section`, `#btn-espace-client`).
- Layout: 3‑column shell `.layout-els` — left hero, center calendar (`.els-center-grid`), right asides. ≤1280px: 2 columns; ≤992px: single column order.
- Desktop: `.els-client-col` is sticky; avoid `overflow: hidden` on its ancestors. For FHD, let `[data-component="calendar"]` scroll; ensure wrappers keep `width: 100%` for `#vue-calendrier`.
# Repository Guidelines

## Project Structure & Module Organization
- Server sources: `.gs` at root (e.g., `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`).
- Configuration: `Configuration.gs` is the single source of truth (flags, pricing, rules). Manifest: `appsscript.json`.
- UI: HTML fragments (e.g., `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`).
- Assets: `branding/ui/`. Legacy samples in `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local dev tooling (e.g., `@google/clasp`).
- `npx clasp login` — authenticate to Google.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from the Apps Script editor.
- `npm run test:clasp` — run server tests (e.g., `npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- JavaScript (V8) ES2019+; prefer `const`/`let`, arrow functions; end lines with semicolons; 2‑space indentation.
- Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: use Montserrat font; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Keep views modular; avoid inline styles.

## Testing Guidelines
- Add small server‑side helpers named `test_*`; run via `npx clasp run <name>`.
- Manual checks: reservation E2E, calendar week (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF, client space visibility.
- Keep console free of errors/warnings; CI validates pushes.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`; optional tags `[flag:<NAME>]`, `[no-structure-change]`.
- New behavior must ship behind a disabled‑by‑default flag in `Configuration.gs`.
- PRs: include scope, rationale, linked issue, UI screenshots/GIFs, impacted flags, and rollback notes.

## Security & Configuration Tips
- Never commit secrets; store keys in Script Properties.
- Web App runs as OWNER; deployments are versioned. Treat `Configuration.gs` as authoritative and review changes carefully.

## UI & Layout Conventions
- Preserve widget IDs (e.g., `#calendar-panel`, `#basket-section`, `#btn-espace-client`).
- Layout: 3‑column shell `.layout-els` — left hero, center calendar (`.els-center-grid`), right asides. ≤1280px: 2 columns; ≤992px: single column order.
- Desktop: `.els-client-col` is sticky; avoid `overflow: hidden` on its ancestors. For FHD, let `[data-component="calendar"]` scroll; ensure wrappers keep `width: 100%` for `#vue-calendrier`.
