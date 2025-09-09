# Repository Guidelines

This repository hosts a Google Apps Script (V8) project for ELS reservation and administration. Keep changes focused, behind flags, and console‑error free.

## Project Structure & Module Organization
- Server code: `.gs` files at root (e.g., `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`).
- HTMLService UI: `.html` views/fragments (e.g., `Reservation_Interface.html`, `Reservation_JS_*.html`).
- Single source of truth: `Configuration.gs` for pricing, rules, and feature flags (do not duplicate values elsewhere).
- Config/CI: `appsscript.json`, `.github/workflows/clasp.yml`, `package.json`.

## Build, Test, and Development Commands
- `npm install` — install local `@google/clasp`.
- `npx clasp login` — authenticate once in your browser.
- `npm run clasp:open` — open the Apps Script project.
- `npm run clasp:push` — push local files to Apps Script.
- `npx clasp pull` — pull edits made in the Script Editor.
- `npm run test:clasp` — run server‑side test entry points if defined.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; ES2019+ (V8). Use `const`/`let`, arrow functions where appropriate; always end lines with semicolons.
- Naming: `camelCase` (vars/functions), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- UI: Montserrat only; brand colors `#8e44ad`, `#3498db`, `#5dade2`. Maintain RGAA contrast and visible focus states. Avoid green/orange.
- Flags and rules live in `Configuration.gs` and must gate new behavior.

## Testing Guidelines
- No formal unit framework; add small server‑side helpers named `test_*` and run with `clasp run <name>`.
- Manual acceptance: reservation flow, calendar week view (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDF generation, and client space visibility.

## Commit & Pull Request Guidelines
- Commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optional tags: `[flag:<NAME>] [no-structure-change]`.
- PRs include scope, rationale, linked issue, screenshots/GIFs for UI, affected flags in `Configuration.gs`, and rollback notes.
- New behavior must be behind a disabled‑by‑default flag in `Configuration.gs`.

## Security & Configuration Tips
- Never commit secrets; configure Script Properties in the Apps Script editor.
- Web App runs as OWNER; create versioned deployments.
- Do not change project structure or add external dependencies without written approval.

