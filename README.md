# GestionELS

## Contributing
See `AGENTS.md` for project structure, coding style, testing steps, and the pull request process.

## Useful Tools
- `./clasp-helper.cmd`: Launches a small GUI to Push/Pull/Version/Deploy and manage snapshots.
- Scripts overview: see `scripts/README.md` for `open-projet*.cmd` launchers.

## Quick Commands
- `clasp open`: Open the Apps Script project in the browser.
- `clasp push -f`: Push local code to Apps Script (force overwrite).

## Resynchronisation du calendrier
Lorsqu'un événement est supprimé manuellement dans Google Calendar, la ligne correspondante de "Facturation" conserve l'ID Réservation mais l'`Event ID` devient invalide.

1. Activer temporairement le flag `CALENDAR_RESYNC_ENABLED` dans `Configuration.gs`.
2. Dans le Sheet, menu **EL Services → Vérifier la cohérence du calendrier**.
3. Pour chaque réservation introuvable, utiliser le bouton **Resync** afin de recréer l'événement et mettre à jour la colonne *Event ID*.
4. Après intervention, désactiver le flag ou supprimer la ligne si l'événement ne doit plus exister.

## Script Properties
Define these keys in the Apps Script project via `PropertiesService`:

- `ADRESSE_ENTREPRISE`
- `RIB_ENTREPRISE`
- `BIC_ENTREPRISE`

Run `initScriptProperties()` in `Configuration.gs` to populate default values.
