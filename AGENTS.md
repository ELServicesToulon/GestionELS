# Repository Guidelines

## Project Structure & Modules
- Root `.gs`: server-side Apps Script (e.g., `Code.gs`, `Gestion.gs`, `Reservation.gs`).
- UI templates: `.html` rendered via `HtmlService` (e.g., `Admin_Interface.html`, `Client_Espace.html`).
- Config: `appsscript.json` (time zone, scopes, web app settings).
- Tools: `tools/` PowerShell helpers for clasp and deployment.
- Scripts: `scripts/` convenience launchers (e.g., `scripts/open-projet1.cmd`).
- Snapshots: `snapshots/v<version>/` created by tooling; ignored on push.

## Build, Test, and Development Commands
- `clasp open`: open the Apps Script project in the browser.
- `clasp push -f`: upload local `.gs/.html/appsscript.json` (force overwrite).
- `clasp pull`: pull remote files locally (tooling uses `.gs`).
- `clasp version "vYYYYMMDD-HHmm"`: create a version tag.
- `clasp deploy -d "desc"`: deploy the web app with a description.
- `./clasp-helper.cmd`: helper UI for Push/Pull/Version/Deploy and snapshots.
- `pwsh tools/deploy-projet1.ps1`: deploy script (and `tools/deploy-projet2.ps1` if `Projet2/` exists).

## Coding Style & Naming Conventions
- Indentation: 2 spaces; avoid tabs.
- JavaScript (Apps Script): camelCase for functions/variables; UPPER_SNAKE_CASE for constants.
- File names: concise PascalCase for modules (e.g., `Validation.gs`); descriptive template names (e.g., `Debug_Interface.html`).
- HTML templates: use `<?!= include('File') ?>` with `include(name)` helper in `Code.gs`.

## Testing Guidelines
- Manual suite: run `lancerTousLesTests()` (see `Debug.gs`) or menu “Debug → Lancer tous les tests” in Sheets.
- Logs: inspect `Logger` output or use `lancerTousLesTestsEtRetournerLogs()` to get a single string summary.
- Before deploy: verify critical flows (reservation, calendar, client, admin).

## Commit & Pull Request Guidelines
- Messages: imperative mood, short scope when helpful. Examples: `Reservation: calcule prix urgent`, `Ajoute envoyerFacturesControlees()`, `Update Configuration.gs`.
- PRs: state purpose, link issue/ref, add screenshots for UI changes, and confirm `clasp push -f` + manual tests passed.

## Security & Configuration Tips
- Scopes live in `appsscript.json`; request only what’s required.
- Store secrets in Script Properties; never hardcode credentials.
- For the web app, review `webapp.access` and `executeAs` before deploying.
