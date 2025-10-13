# Repository Guidelines

## Project Structure & Module Organization
- Server Apps Script modules at root: `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- Configuration: `Configuration.gs` is the single source of truth (flags, pricing, rules). Manifest: `appsscript.json`.
- UI fragments: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`.
- Assets: `branding/ui/`; legacy samples: `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local tooling (e.g., `@google/clasp`).
- `npx clasp login` — authenticate to Google.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from the Apps Script editor.
- `npm run test:clasp` — run server tests (e.g., `npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- JS (V8) ES2019+; use `const`/`let`, arrow functions, semicolons; 2‑space indent.
- Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: Montserrat font; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Keep RGAA contrast; avoid inline styles.
- Do not duplicate config; read from `Configuration.gs`.

## Testing Guidelines
- Prefer small server helpers named `test_*`; run via `npx clasp run <name>`.
- Manual checks: reservation E2E; calendar week view (Mon–Sun); AM/PM split when `SLOTS_AMPM_ENABLED=true`; invoicing PDF; client space visibility.
- Keep logs/console free of errors; CI rejects noisy pushes.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>]`, `[no-structure-change]`.
- New behavior must ship behind a disabled‑by‑default feature flag in `Configuration.gs`.
- PRs include scope, rationale, linked issue, screenshots/GIFs of UI, impacted flags in `Configuration.gs`, and rollback notes.

## Security & Configuration Tips
- Never commit secrets; store keys in Script Properties.
- Web App runs as OWNER; treat `Configuration.gs` as authoritative and review changes carefully.

## UI & Layout Conventions
- Preserve widget IDs: `#calendar-panel`, `#basket-section`, `#btn-espace-client`.
- Layout shell `.layout-els`: left hero, center calendar (`.els-center-grid`), right asides. ≤1280px → 2 columns; ≤992px → single column.
- Desktop: `.els-client-col` is sticky; avoid `overflow: hidden` on its ancestors. Ensure wrappers keep `width: 100%` for `#vue-calendrier`; allow `[data-component="calendar"]` to scroll on FHD.

## Agent-Specific Notes
- Scope of this AGENTS.md is the whole repo. Follow config-first changes, keep edits minimal, and avoid unrelated refactors.
