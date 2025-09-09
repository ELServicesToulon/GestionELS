# Repository Guidelines

## Project Structure & Module Organization
- Root contains Apps Script sources: `.gs` (server) and `.html` (HTMLService views/fragments).
- Key files: `Configuration.gs` (single source of truth for pricing/rules/flags), `appsscript.json` (manifest), `.github/workflows/clasp.yml` (CI), `package.json` (local scripts).
- Typical files: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- Do not duplicate config/constants outside `Configuration.gs`. Keep web app views in separate `.html` fragments where possible.

## Build, Test, and Development Commands
- `npm install` — install local `@google/clasp`.
- `npx clasp login` — authenticate once to your Google account.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local sources to Apps Script.
- `npx clasp pull` — pull edits from the Apps Script editor.
- `npm run test:clasp` — run server-side test runner (if defined).

## Coding Style & Naming Conventions
- JavaScript (V8): ES2019+, `const`/`let`, arrow functions where appropriate; always end lines with semicolons.
- Indentation: 2 spaces. Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: font Montserrat only; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Maintain RGAA contrast and visible focus states. Avoid green/orange.
- Follow existing patterns; do not add external dependencies without written approval.

## Testing Guidelines
- Prefer small server-side helpers named `test_*` and run with `clasp run <name>`.
- Manual acceptance: reservation flow end-to-end, calendar week view (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF generation, and client space visibility.
- CI validates pushes; keep console free of errors and warnings.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>] [no-structure-change]`.
- PRs must include scope, rationale, linked issue, screenshots/GIFs for UI, affected flags in `Configuration.gs`, and rollback notes.
- New behavior must be behind a disabled-by-default feature flag in `Configuration.gs`.

## Security & Configuration Tips
- Never commit secrets. Store keys in Script Properties via the Apps Script editor.
- Web App runs as OWNER; deployments are versioned. Do not change project structure or add external deps without written approval.
- Treat `Configuration.gs` as the authoritative configuration; changes here should be reviewed carefully.

