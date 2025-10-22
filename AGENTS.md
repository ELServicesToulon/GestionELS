# Repository Guidelines

## Project Structure & Module Organization
Core Apps Script services reside at the repository root: `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, and `Validation.gs`. Configuration is centralized in `Configuration.gs`; reference flags and prices from there rather than duplicating values. Client UI fragments live in `Reservation_Interface.html`, `Reservation_JS_*.html`, and `Styles.html`, while shared branding assets belong under `branding/ui/`. Legacy references stay inside `archive/` to avoid polluting production logic.

## Build, Test, and Development Commands
- `npm install` — install local tooling (includes `@google/clasp`).
- `npx clasp login` — authenticate against the Apps Script project before syncing.
- `npm run clasp:push` / `npx clasp pull` — push local changes or pull remote sources.
- `npm run clasp:open` — open the linked Apps Script project in the browser editor.
- `npm run test:clasp` — execute server sanity checks via `npx clasp run test_sanity`.

## Coding Style & Naming Conventions
Target ES2019 with `const`/`let`, arrow functions, and 2-space indentation. Terminate statements with semicolons. Use camelCase for functions and variables, PascalCase for constructors, and UPPER_SNAKE_CASE for constants and feature flags. Favor configuration-first changes by reading from `Configuration.gs`. Keep added comments succinct and purposeful.

## Testing Guidelines
Create lightweight Apps Script tests named `test_*` and run them with `npx clasp run <name>`. The baseline sanity suite lives behind `npm run test:clasp`. Before pushing, smoke-test the reservation flow, weekly calendar (Mon–Sun), AM/PM slot split when `SLOTS_AMPM_ENABLED=true`, invoicing PDFs, and the client space. Ensure logs remain clean—console noise blocks deployment.

## Commit & Pull Request Guidelines
Prefix commits with `feat:`, `fix:`, `chore:`, `SEO:`, or `branding:` and optionally tag flags (e.g., `feat: add new tariff [flag:NEW_PLAN]`). Ship new behaviors behind disabled-by-default flags declared in `Configuration.gs`. Pull requests must summarize scope, rationale, linked issues, UI captures for visual changes, impacted flags, and rollback notes.

## Security & Configuration Tips
Never commit secrets—store credentials in Script Properties. The web app executes as the owner, so review configuration changes carefully. Preserve required DOM IDs such as `#calendar-panel`, `#basket-section`, and `#btn-espace-client`, maintain Montserrat font with palette `#8e44ad`, `#3498db`, `#5dade2`, and avoid inline styles.

## Agent-Specific Instructions
Respect the layout shell (`.layout-els`, `.els-center-grid`, `.els-client-col`) and keep `[data-component="calendar"]` scrollable. Avoid broad refactors; keep edits narrowly scoped, and prefer additive updates that align with the existing structure.
