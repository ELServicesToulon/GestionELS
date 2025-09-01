# [Scope]: Short summary

> Contributor guide: see [AGENTS.md](../AGENTS.md) for structure, style, tests, and deploy steps.

## Description
- Purpose and context of this change.
- Link to issue/incident (if any).

## Changes
- High-level list of changes (modules, files, behavior).

## Screenshots (UI)
- Before/after or key states, if applicable.

## Testing
- [ ] Ran `lancerTousLesTests()` and reviewed `Logger` output (`Debug.gs`).
- [ ] Verified critical flows: reservation, calendar, client, admin.
- [ ] Smoke tested the web app locally via `clasp open` where relevant.

## Deployment
- [ ] Ran `clasp push -f`.
- [ ] Created a version `clasp version "vYYYYMMDD-HHmm"` (if needed).
- [ ] Deployed or reassigned deployment `clasp deploy -d "desc"` (if needed).

## Notes
- Additional risks, roll-back plan, or follow-ups.
