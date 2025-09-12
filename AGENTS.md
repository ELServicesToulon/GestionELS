# Repository Guidelines

## Project Structure & Module Organization
- Root contains Apps Script sources: `.gs` (server) and `.html` (HTMLService views/fragments).
- Do not duplicate config; use `Configuration.gs` as the single source of truth.
- Quick map:
  - `appsscript.json` — manifest
  - `Configuration.gs` — single source of truth (flags/pricing/rules)
  - `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`
  - `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`
  - `branding/ui/`, `archive/`
-
  Keep web app views in separate `.html` fragments; reuse components and avoid inline styles.

## Build, Test, and Development Commands
- `npm install` — install local dev tools (e.g., `@google/clasp`).
- `npx clasp login` — authenticate with your Google account.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from the Apps Script editor.
- `npm run test:clasp` — run server-side tests (if defined). Example: `npx clasp run test_sanity`.

## Coding Style & Naming Conventions
- JavaScript (V8) ES2019+; prefer `const`/`let`, arrow functions where appropriate; always end lines with semicolons.
- Indentation: 2 spaces. Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: font Montserrat; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Maintain RGAA contrast and visible focus states. Avoid green/orange.
- Follow existing patterns; do not add external dependencies without written approval.

## Testing Guidelines
- Prefer small server-side helpers named `test_*` and run with `npx clasp run <name>`.
- Manual acceptance: reservation flow E2E, calendar week view (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF generation, client space visibility.
- CI validates pushes; keep console free of errors and warnings.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>] [no-structure-change]`.
- PRs include scope, rationale, linked issue, screenshots/GIFs for UI, affected flags in `Configuration.gs`, and rollback notes.
- New behavior must be behind a disabled-by-default feature flag in `Configuration.gs`.

## Security & Configuration Tips
- Never commit secrets. Store keys in Script Properties via the Apps Script editor.
- Web App runs as OWNER; deployments are versioned. Treat `Configuration.gs` as authoritative configuration; review changes carefully.
