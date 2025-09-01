# Repository Guidelines

## Project Structure & Modules
- Root `.gs`: server-side Apps Script logic (e.g., `Code.gs`, `Gestion.gs`, `Reservation.gs`).
- UI templates: `.html` files rendered via `HtmlService` (e.g., `Admin_Interface.html`, `Client_Espace.html`, `Reservation_Interface.html`).
- Config: `appsscript.json` (time zone, scopes, web app settings).
- Tools: `tools/` PowerShell helpers for clasp and deployment.
- Scripts: `scripts/` convenience launchers (e.g., `scripts/open-projet1.cmd`).
- Snapshots: `snapshots/v<version>/` created by tooling for pulled versions; ignored on push.

## Build, Test, and Dev Commands
- `clasp open`: opens the Apps Script project in the browser.
- `clasp push -f`: uploads local `.gs/.html/appsscript.json` to Apps Script (force overwrite).
- `clasp pull`: pulls remote files locally (uses `.gs` extension per tooling).
- `clasp version "vYYYYMMDD-HHmm"`: creates a version tag.
- `clasp deploy -d "desc"`: deploys the web app with a description.
- Helper UI: run `./clasp-helper.cmd` to use a simple GUI for Push/Pull/Version/Deploy and snapshot actions.
- Deploy scripts: `pwsh tools/deploy-projet1.ps1` (and `tools/deploy-projet2.ps1` if `Projet2/` exists).

## Coding Style & Naming
- Indentation: 2 spaces; avoid tabs.
- JavaScript (Apps Script): camelCase for functions/variables; UPPER_SNAKE_CASE for constants.
- File names: concise PascalCase for modules (e.g., `Validation.gs`), descriptive template names (e.g., `Debug_Interface.html`).
- HTML templates: use `<?!= include('File') ?>` pattern with `include(name)` helper in `Code.gs`.

## Testing Guidelines
- Manual suite: run `lancerTousLesTests()` (see `Debug.gs`) or use the “Debug → Lancer tous les tests” menu in Sheets.
- Logs: check `Logger` output (or `lancerTousLesTestsEtRetournerLogs()` for a single string result).
- No automated CI tests are configured; verify critical flows (reservation, calendar, client, admin) before deploy.

## Commit & PR Guidelines
- Messages: imperative mood, short scope first when helpful (e.g., `Reservation: calcule prix urgent`), French/English acceptable.
- Examples: `Ajoute envoyerFacturesControlees()`, `Update Configuration.gs`, `Restore root code to snapshot v829`.
- PRs: include purpose, linked issue/ref, screenshots for UI changes, and confirmation that `clasp push -f` and manual tests passed.

## Security & Config Tips
- Scopes are defined in `appsscript.json`; request only what’s required.
- Store secrets in Script Properties; never hardcode credentials.
- For web app, review `webapp.access` and `executeAs` before deploy.

