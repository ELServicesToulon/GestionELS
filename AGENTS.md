# Repository Guidelines

## Project Structure & Module Organization
- Core Apps Script services live at the repo root: `Administration.gs`, `Reservation.gs`, `Calendrier.gs`, `Utilitaires.gs`, `Validation.gs`.
- Centralize config in `Configuration.gs`; read flags/prices from there (no duplicates).
- Client UI: `Reservation_Interface.html`, `Reservation_JS_*.html`, `Styles.html`.
- Branding assets: `branding/ui/`.
- Legacy references: `archive/`.

## Build, Test, and Development Commands
- `npm install` — install local tooling (includes `@google/clasp`).
- `npx clasp login` — authenticate to the Apps Script project.
- `npm run clasp:push` / `npx clasp pull` — sync local ↔ remote sources.
- `npm run clasp:open` — open the linked Apps Script editor.
- `npm run test:clasp` — run sanity checks (`npx clasp run test_sanity`).

## Coding Style & Naming Conventions
- Target ES2019; use `const`/`let`, arrow functions, 2-space indentation, and semicolons.
- Naming: `camelCase` (functions/vars), `PascalCase` (constructors), `UPPER_SNAKE_CASE` (constants/flags).
- Configuration-first: read from `Configuration.gs`; keep comments short and purposeful.

## Testing Guidelines
- Create lightweight Apps Script tests named `test_*`; run with `npx clasp run <name>`.
- Smoke-test: reservation flow, weekly calendar (Mon–Sun), AM/PM split when `SLOTS_AMPM_ENABLED=true`, invoicing PDFs, and the client space.
- Keep logs clean; console noise blocks deployment.

## Commit & Pull Request Guidelines
- Prefix commits: `feat:`, `fix:`, `chore:`, `SEO:`, `branding:`. Optionally tag flags (e.g., `feat: new tariff [flag:NEW_PLAN]`).
- Ship new behavior behind disabled-by-default flags declared in `Configuration.gs`.
- PRs include scope, rationale, linked issues, UI captures for visual changes, impacted flags, and rollback notes.

## Security & Configuration Tips
- Never commit secrets; store credentials in Script Properties.
- The web app executes as the owner—review configuration changes carefully.
- Preserve DOM IDs: `#calendar-panel`, `#basket-section`, `#btn-espace-client`; maintain Montserrat and palette `#8e44ad`, `#3498db`, `#5dade2`; avoid inline styles.

## Agent-Specific Instructions
- Respect the layout shell (`.layout-els`, `.els-center-grid`, `.els-client-col`); keep `[data-component="calendar"]` scrollable.
- Favor small, additive changes; avoid broad refactors.
