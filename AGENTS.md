# Repository Guidelines

This repo hosts a Google Apps Script web app managed with `clasp`. Keep changes focused, small, and verifiable.

## Project Structure & Module Organization
- Root `.gs`: server-side code (e.g., `Code.gs`, `Gestion.gs`, `Reservation.gs`).
- UI templates: `.html` for `HtmlService` (e.g., `Admin_Interface.html`, `Client_Espace.html`). Use `<?!= include('File') ?>` via `include(name)` in `Code.gs`.
- Config: `appsscript.json` (time zone, scopes, web app settings).
- Tools: `tools/` PowerShell helpers for `clasp` and deployment.
- Scripts: `scripts/` convenience launchers (e.g., `scripts/open-projet1.cmd`).
- Snapshots: `snapshots/v<version>/` created by tooling; excluded on push.

## Build, Test, and Development Commands
- `clasp open`: open the Apps Script project.
- `clasp push -f`: upload local `.gs/.html/appsscript.json` (force overwrite).
- `clasp pull`: pull remote files locally.
- `clasp version "vYYYYMMDD-HHmm"`: create a version tag.
- `clasp deploy -d "desc"`: deploy the web app with a description.
- `./clasp-helper.cmd`: guided Push/Pull/Version/Deploy and snapshots.
- `pwsh tools/deploy-projet1.ps1`: one-step deploy (and `tools/deploy-projet2.ps1` if `Projet2/` exists).

## Coding Style & Naming Conventions
- Indentation: 2 spaces; no tabs.
- JavaScript (Apps Script): camelCase for functions/variables; UPPER_SNAKE_CASE for constants.
- File names: concise PascalCase for modules (e.g., `Validation.gs`); descriptive template names (e.g., `Debug_Interface.html`).
- HTML templates: prefer partials with `include()`; keep logic in `.gs`.

## Testing Guidelines
- Manual suite: run `lancerTousLesTests()` (see `Debug.gs`) or menu “Debug → Lancer tous les tests” in Sheets.
- Logs: inspect `Logger` or call `lancerTousLesTestsEtRetournerLogs()` for a single-string summary.
- Before deploy: verify critical flows (reservation, calendar, client, admin).

## Commit & Pull Request Guidelines
- Commits: imperative, scoped messages. Examples: `Reservation: calcule prix urgent`, `Ajoute envoyerFacturesControlees()`, `Update Configuration.gs`.
- PRs: state purpose, link issue/ref, add screenshots for UI changes, confirm `clasp push -f` and manual tests passed.

## Security & Configuration Tips
- Scopes live in `appsscript.json`; request only what’s required.
- Store secrets in Script Properties (`PropertiesService.getScriptProperties()`); never hardcode.
- For the web app, review `webapp.access` and `executeAs` before deploying.
- Avoid logging sensitive data in `Logger`.

