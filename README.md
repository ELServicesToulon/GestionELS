# GestionELS

## Contributing
See `AGENTS.md` for project structure, coding style, testing steps, and the pull request process.

## Useful Tools
- `./clasp-helper.cmd`: Launches a small GUI to Push/Pull/Version/Deploy and manage snapshots.
- Scripts overview: see `scripts/README.md` for `open-projet*.cmd` launchers.

## Quick Commands
- `clasp open`: Open the Apps Script project in the browser.
- `clasp push -f`: Push local code to Apps Script (force overwrite).

## Script Properties
Define these keys in the Apps Script project via `PropertiesService`:

- `ADRESSE_ENTREPRISE`
- `RIB_ENTREPRISE`
- `BIC_ENTREPRISE`

Run `initScriptProperties()` in `Configuration.gs` to populate default values.
