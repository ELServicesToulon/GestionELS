# Repository Guidelines

## Project Structure & Module Organization
- Server Apps Script modules live at the repo root (`Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`).
- `Configuration.gs` is the single source of truth for flags, pricing, and business rules; do not duplicate values elsewhere.
- UI fragments sit in `Reservation_Interface.html`, `Reservation_JS_*.html`, and `Styles.html`; shared assets belong to `branding/ui/`. Legacy samples stay in `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local tooling such as `@google/clasp`.
- `npx clasp login` — authenticate before interacting with Apps Script.
- `npm run clasp:open` — open the remote Apps Script project in the browser.
- `npm run clasp:push` / `npx clasp pull` — sync local and remote sources.
- `npm run test:clasp` — run server sanity checks (`npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- Target ES2019, use `const`/`let`, arrow functions, and semicolons with 2-space indentation.
- Naming: camelCase for variables/functions, PascalCase for constructors, UPPER_SNAKE_CASE for constants/flags.
- UI must keep Montserrat font and brand colors `#8e44ad`, `#3498db`, `#5dade2`; avoid inline styles and read config from `Configuration.gs`.

## Testing Guidelines
- Prefer small Apps Script helpers named `test_*`; execute with `npx clasp run <name>`.
- Manual smoke checks: reservation flow end-to-end, calendar week view (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF, and client-space visibility.
- Keep logs clean; pushes with console noise are rejected.

## Commit & Pull Request Guidelines
- Commit prefixes: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:` with optional tags like `[flag:<NAME>]` or `[no-structure-change]`.
- Ship new behavior behind disabled-by-default flags in `Configuration.gs`.
- Pull requests should document scope, rationale, linked issue, screenshots or GIFs for UI, impacted flags, and rollback notes.

## Security & Configuration Tips
- Never commit secrets; store credentials in Script Properties.
- The web app executes as OWNER—treat configuration changes as sensitive and review carefully.

## UI & Layout Conventions
- Preserve IDs such as `#calendar-panel`, `#basket-section`, `#btn-espace-client`.
- Respect layout shell `.layout-els`: left hero, center calendar `.els-center-grid`, right asides; adapt to ≤1280 px (two columns) and ≤992 px (single column).
- Ensure `.els-client-col` remains sticky without ancestor overflow; keep `#vue-calendrier` containers at `width: 100%` and allow `[data-component="calendar"]` to scroll on FHD.

## Agent-Specific Notes
- Scope these instructions to the entire repo, prefer configuration-first changes, keep edits minimal, and avoid unrelated refactors.
