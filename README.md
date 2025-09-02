# GestionELS

## Contributing
See `AGENTS.md` for project structure, coding style, testing steps, and the pull request process.

## Useful Tools
- `./clasp-helper.cmd`: Launches a small GUI to Push/Pull/Version/Deploy and manage snapshots.
- Scripts overview: see `scripts/README.md` for `open-projet*.cmd` launchers.

## Quick Commands
- `clasp open`: Open the Apps Script project in the browser.
- `clasp push -f`: Push local code to Apps Script (force overwrite).

## CI/CD
Le dépôt fournit un workflow GitHub Actions (`.github/workflows/clasp.yml`) qui exécute `clasp push -f` à l'aide de secrets `CLASP_CREDENTIALS` et `GAS_SCRIPT_ID`.

### Reprise manuelle
1. Exécuter `./clasp-helper.cmd` puis choisir **Push**, ou se connecter via `npx @google/clasp login --creds <fichier>`.
2. Lancer `npx @google/clasp push -f`.
3. En cas de conflit, exécuter `npx @google/clasp pull` avant de retenter.

## Sélecteur de thème
1. Activer `THEME_SELECTION_ENABLED` dans `Configuration.gs`.
2. `clasp push -f` puis créer une nouvelle version pour déploiement.
3. Pour rollback, remettre le flag à `false` et redéployer la version précédente.

## Tests Manuels
- Déplacer une facture vers `Facturation_Aout_2025` puis vérifier qu'elle reste visible et envoyable depuis l'espace client.

## Resynchronisation du calendrier
Lorsqu'un événement est supprimé manuellement dans Google Calendar, la ligne correspondante de "Facturation" conserve l'ID Réservation mais l'`Event ID` devient invalide.

1. Activer temporairement le flag `CALENDAR_RESYNC_ENABLED` dans `Configuration.gs`.
2. Dans le Sheet, menu **EL Services → Vérifier la cohérence du calendrier**.
3. Pour chaque réservation introuvable, utiliser le bouton **Resync** afin de recréer l'événement et mettre à jour la colonne *Event ID*.
4. Après intervention, désactiver le flag ou supprimer la ligne si l'événement ne doit plus exister.

## Purge des Event ID inexistants
Si un événement supprimé ne doit pas être recréé, on peut purger sa référence dans "Facturation" sans toucher à la ligne de réservation.

1. Activer temporairement le flag `CALENDAR_PURGE_ENABLED` dans `Configuration.gs`.
2. Dans le Sheet, menu **EL Services → Vérifier la cohérence du calendrier**.
3. Sélectionner les réservations à purger via les cases à cocher puis cliquer sur **Purger sélection**.
   La colonne *Event ID* est vidée et "À vérifier" est ajouté dans *Note Interne*.
4. Désactiver le flag une fois l'opération terminée.

## Script Properties
Define these keys in the Apps Script project via `PropertiesService`:

- `ADRESSE_ENTREPRISE`
- `RIB_ENTREPRISE`
- `BIC_ENTREPRISE`

Run `initScriptProperties()` in `Configuration.gs` to populate default values.
