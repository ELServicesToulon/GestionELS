# GestionELS

## Contributing
See `AGENTS.md` for project structure, coding style, testing steps, and the pull request process.

## Useful Tools
- `./clasp-helper.cmd`: Launches a small GUI to Push/Pull/Version/Deploy and manage snapshots.
- Scripts overview: see `scripts/README.md` for `open-projet*.cmd` launchers.

## Quick Commands
- `clasp open`: Open the Apps Script project in the browser.
- `clasp push -f`: Push local code to Apps Script (force overwrite).

## Tarifs
Les tarifs sont centralisés dans `Configuration.gs` via l'objet `TARIFS`.

- **Normal** – livraisons standard du lundi au vendredi.
- **Samedi** – appliqué aux livraisons du samedi.
- **Urgent** – déclenché si la réservation est dans le seuil `URGENT_THRESHOLD_MINUTES`.
- **Special** – base pour tarifs ponctuels ou expérimentaux.

Chaque entrée suit la forme `{ base: <prix premier arrêt>, arrets: [<arrêt 2>, ...] }`.
Dupliquez une entrée existante pour ajouter un nouveau type puis ajustez les montants.

## Clasp Version
Le projet utilise `@google/clasp` version `2.5.0` en local comme en CI.

- Installation locale : `npm install -g @google/clasp@2.5.0`.

- Vérifier la version : `clasp -v` (doit retourner `2.5.0`).

- Le workflow GitHub Actions (`.github/workflows/clasp.yml`) installe la même version.

### Mettre à jour
1. Modifier `.github/workflows/clasp.yml` avec la nouvelle version.
2. Exécuter `npm install -g @google/clasp@<nouvelle_version>` sur chaque poste.
3. Mettre à jour cette section du README.

## CI/CD
 Le dépôt fournit un workflow GitHub Actions (`.github/workflows/clasp.yml`) qui exécute `clasp push -f` à l'aide des secrets `CLASP_CREDENTIALS` et `CLASP_SCRIPT_ID`.

### Reprise manuelle
1. Exécuter `./clasp-helper.cmd` puis choisir **Push**, ou se connecter via `npx @google/clasp login --creds <fichier>`.
2. Lancer `npx @google/clasp push -f`.
3. En cas de conflit, exécuter `npx @google/clasp pull` avant de retenter.

## Sélecteur de thème
1. Activer `THEME_SELECTION_ENABLED` dans `Configuration.gs` (désactivé par défaut).
2. `clasp push -f` puis créer une nouvelle version pour déploiement.
3. Pour rollback, remettre le flag à `false` et redéployer la version précédente.

## Menu Debug
1. Activer `DEBUG_MENU_ENABLED` dans `Configuration.gs`.
2. `clasp push -f` puis créer une nouvelle version pour déploiement.
3. Pour rollback, remettre le flag à `false` et redéployer la version précédente.

## Cache des réservations
- Activer `RESERVATION_CACHE_ENABLED` dans `Configuration.gs` pour limiter l'accès à la feuille.
- Les résultats sont mis en cache par semaine (`week_<ISO>`) et par jour (`day_<ISO>`).
- Lors de la création d'une réservation, les entrées correspondantes sont automatiquement invalidées.

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
Set the following keys in the Apps Script editor (File → Project properties → Script properties):

- `SIRET`
- `RIB_ENTREPRISE`
- `BIC_ENTREPRISE`
- `ID_CALENDRIER`
- `ID_DOCUMENT_CGV`
- `ID_FEUILLE_CALCUL`
- `ID_MODELE_FACTURE`
- `ID_DOSSIER_ARCHIVES`
- `ID_DOSSIER_TEMPORAIRE`
- `ELS_SHARED_SECRET` – jeton partagé pour l'authentification des requêtes

Open the Apps Script editor, go to **File → Project properties → Script properties**, and add each key with its value.

## Authentification des requêtes
Les fonctions `doGet` et `doPost` appellent `checkSharedSecret(e)` pour valider le jeton stocké dans `ELS_SHARED_SECRET`.

Fournissez ce jeton :

- En-tête HTTP `X-ELS-TOKEN: <votre_jeton>`
- ou paramètre `token=<votre_jeton>` dans l'URL ou le corps

Sans jeton valide, la web app renvoie `{"error":"Forbidden"}`.
