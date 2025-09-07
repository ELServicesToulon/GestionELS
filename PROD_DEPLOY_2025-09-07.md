# Production Deployment Note — 2025-09-07

- Scope: Fix startup error when `THEME_SELECTION_ENABLED` is undefined in HTML templates.
- Commits:
  - cb373dc fix: guard HTML against missing THEME_SELECTION_ENABLED [no-structure-change]
- Impact: No functional change unless the flag exists and is true. Prevents fatal template error on Admin and Client pages.
- Affected files: `Admin_Interface.html`, `Client_Espace.html`.
- Feature flags: None added/changed. Theme selection remains disabled.

## Deploy Steps
- Already run: `npx @google/clasp@2.5.0 push -f` (pushed 37 files).
- In Apps Script UI: Create a new version, then Deploy > Manage deployments > Edit > select new version > Save.
  - Execute as: Owner
  - Access: Anyone with the link

## Post-Deploy Checks
- Open `?page=gestion` and Client space: page loads; no “THEME_SELECTION_ENABLED is not defined”.
- Browser console: 0 errors.
- Visual regressions: none; theme selector remains hidden.

## Rollback
- Deploy the previous Web App version in Apps Script (Manage deployments > Edit > select prior version > Save).
- No data migrations required.

## Notes
- Optional hardening: define `const THEME_SELECTION_ENABLED = false;` in `Configuration.gs` to make default explicit (not required).
