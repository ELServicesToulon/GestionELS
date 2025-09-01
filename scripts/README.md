# Scripts

This folder contains convenience launchers for the Apps Script projects.

- `open-projet1.cmd`: Opens the root Apps Script project (`GestionELS`).
- `open-projet2.cmd`: Opens the secondary project located in `Projet2/` (if present).

Requirements:
- `clasp` installed and authenticated (`npm i -g @google/clasp` and `clasp login`).
- Access to the target Apps Script projects.

Usage (Windows):
- Double-click the CMD file, or run from a terminal:
  - `scripts\\open-projet1.cmd`
  - `scripts\\open-projet2.cmd`

For deployment/versioning and snapshot utilities, use `clasp-helper.cmd` at repo root, which launches the GUI defined in `tools/clasp-helper.ps1`.
