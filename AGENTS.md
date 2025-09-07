# Repository Guidelines

## Project Structure & Module Organization
- Root contains Apps Script sources: `.gs` (server) and `.html` (HTMLService views/fragments). Examples: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- `Configuration.gs`: single source of truth for pricing, rules, and feature flags (do not duplicate elsewhere).
- `appsscript.json`: manifest; `.github/workflows/clasp.yml`: CI push; `package.json`: local scripts.

## Build, Test, and Development Commands
- `npm install`: install local `@google/clasp`.
- `npx clasp login`: authenticate once.
- `npm run clasp:open`: open the Apps Script project.
- `npm run clasp:push`: push local files to Apps Script.
- `npx clasp pull`: pull changes made in the editor.
- `npm run test:clasp`: runs server-side test runner if defined; otherwise see Testing.

## Coding Style & Naming Conventions
- Indentation 2 spaces; use ES2019+ in V8 (const/let, arrow where appropriate). Always end lines with semicolons.
- Names: `camelCase` for vars/functions, `PascalCase` for constructors, `UPPER_SNAKE_CASE` for constants/flags.
- UI: Montserrat only; brand colors `#8e44ad`, `#3498db`, `#5dade2`. No green/orange. Maintain RGAA contrast and focus states.

## Testing Guidelines
- No formal unit framework in repo; prefer small server-side helpers named `test_*` and run with `clasp run <name>`.
- Manual acceptance: reservation flow, calendar week view (Mon–Sun), AM/PM split if `SLOTS_AMPM_ENABLED=true`, invoicing PDF generation, and client space visibility.
- CI validates push; keep console error-free.

## Commit & Pull Request Guidelines
- Commit style: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Append tags when relevant: `[flag:<NAME>] [no-structure-change]`.
- PRs must include: scope, rationale, linked issue, screenshots/GIFs for UI, affected flags in `Configuration.gs`, and rollback notes.
- New behavior must be behind a disabled-by-default feature flag in `Configuration.gs`.

## Security & Configuration Tips
- Never commit secrets. Configure Script Properties in the Apps Script editor (see keys listed in README).
- Web App runs as OWNER; deployments are versioned. Do not change project structure or add external deps without written approval.

