# GestionELS

## Contributing
See `AGENTS.md` for project structure, coding style, testing steps, and the pull request process.

## Installation locale

Installez les dépendances Node locales :

```bash
npm install
```

## Useful Tools
- `./clasp-helper.cmd`: Launches a small GUI to Push/Pull/Version/Deploy and manage snapshots.
- Scripts overview: see `scripts/README.md` for `open-projet*.cmd` launchers.

## Quick Commands
- `clasp open`: Open the Apps Script project in the browser.
- `clasp push -f`: Push local code to Apps Script (force overwrite).

## Accès au calendrier
1. Ouvrir l'éditeur Apps Script puis **Deploy → Manage deployments**.
2. Sur la ligne du déploiement actif, copier l'URL du Web App pour accéder au calendrier.
3. Si le lien est perdu, créer un nouveau déploiement : chaque version génère une URL unique.

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

- `NOM_ENTREPRISE` – nom affiché sur les factures
- `SIRET` – identifiant légal pour la facturation
- `ADRESSE_ENTREPRISE` – adresse postale de l'entreprise
- `EMAIL_ENTREPRISE` – contact principal pour les clients
- `ADMIN_EMAIL` – destinataire des notifications internes
- `RIB_ENTREPRISE` – IBAN utilisé pour les paiements
- `BIC_ENTREPRISE` – BIC associé au RIB
- `ID_DOCUMENT_CGV` – document des conditions générales de vente
- `ID_MODELE_FACTURE` – modèle Google Docs pour générer les factures
- `ID_DOSSIER_ARCHIVES` – dossier Drive d'archivage des factures
- `ID_DOSSIER_TEMPORAIRE` – dossier Drive temporaire pour génération des PDF
- `DOSSIER_PUBLIC_FOLDER_ID` – dossier Drive public (alias : `DOCS_PUBLIC_FOLDER_ID`)
- `ID_FEUILLE_CALCUL` – feuille de calcul principale
- `ID_CALENDRIER` – calendrier Google utilisé pour les créneaux
- `ELS_SHARED_SECRET` – clé secrète pour signer les liens d'accès à l'espace client

Open the Apps Script editor, go to **File → Project properties → Script properties**, and add each key with its value.

## Sécurité & accès
- Web App exécutée en tant que propriétaire et accessible à toute personne disposant du lien.
- Les liens client peuvent être signés via `ELS_SHARED_SECRET` et expirent après `CLIENT_PORTAL_LINK_TTL_HOURS` heures.
- Les sessions client expirent après `CLIENT_SESSION_TTL_HOURS` heures.

## Scopes OAuth minimaux
Les scopes nécessaires sont définis dans `appsscript.json` :

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/script.scriptapp`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/script.send_mail`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/script.container.ui`

Pour ajouter ou retirer un scope : éditer `appsscript.json`, puis exécuter `clasp push -f` et redéployer.

## Flags
| Flag | Description | Défaut |
| ---- | ----------- | ------ |
| CLIENT_PORTAL_ENABLED | Active l'espace client | true |
| CLIENT_PORTAL_SIGNED_LINKS | Exige un lien signé pour l'espace client | false |
| PRIVACY_LINK_ENABLED | Affiche le lien vers les informations de confidentialité | false |
| SLOTS_AMPM_ENABLED | Sépare les créneaux matin/après-midi | false |
| CLIENT_SESSION_OPAQUE_ID_ENABLED | Stocke un identifiant client opaque | false |
| SEND_MAIL_SCOPE_CHECK_ENABLED | Vérifie la présence du scope d'envoi d'email | false |
| BILLING_MULTI_SHEET_ENABLED | Agrège les feuilles « Facturation* » | false |
| CA_EN_COURS_ENABLED | Affiche le CA en cours dans l'admin | false |
| CALENDAR_RESYNC_ENABLED | Resynchronise les événements manquants | true |
| CALENDAR_PURGE_ENABLED | Purge les Event ID inexistants | true |
| CALENDAR_BAR_OPACITY_ENABLED | Module l'opacité de la barre de disponibilité | false |
| ADMIN_OPTIMISTIC_CREATION_ENABLED | Création optimiste des courses admin | false |
| ADMIN_SLOTS_PNG_ENABLED | Colonne des créneaux PNG dans la modale admin | false |
| RESERVATION_VERIFY_ENABLED | Vérifie création d'événement et unicité des ID | false |
| RESERVATION_UI_V2_ENABLED | Nouvelle interface de réservation | true |
| RESIDENT_BILLING_ENABLED | Facturation directe au résident | false |
| BILLING_MODAL_ENABLED | Modale de coordonnées de facturation | false |
| CART_RESET_ENABLED | Réinitialisation du panier côté client | false |
| RETURN_IMPACTS_ESTIMATES_ENABLED | Inclut le retour dans les estimations | false |
| PRICING_RULES_V2_ENABLED | Règles de tarification V2 | false |
| PROOF_SOCIAL_ENABLED | Affiche les preuves sociales | false |
| PRO_QA_ENABLED | Module Q/R pour professionnels | false |
| EXTRA_ICONS_ENABLED | Pictogrammes supplémentaires | false |
| DEBUG_MENU_ENABLED | Sous-menu Debug | false |
| DEMO_RESERVATION_ENABLED | Mode démo de réservation | false |
| BILLING_V2_DRYRUN | Mode facturation V2 sans effet | false |
| BILLING_LOG_ENABLED | Journalisation de facturation | false |
| BILLING_ID_PDF_CHECK_ENABLED | Vérifie l'ID PDF de facturation | false |
| REQUEST_LOGGING_ENABLED | Journalisation des requêtes | false |
| POST_ENDPOINT_ENABLED | Active l'endpoint POST | false |
| CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED | Limite les tentatives d'accès au portail | false |
| CONFIG_CACHE_ENABLED | Cache la configuration | false |
| RESERVATION_CACHE_ENABLED | Cache les réservations | false |
| THEME_V2_ENABLED | Thème v2 activé | true |
| ELS_UI_THEMING_ENABLED | Théming UI ELS | true |

Pour surcharger un flag sans modifier le code : ajouter une Script Property `FLAG_<NOM>` (`true` ou `false`). Supprimer la propriété après usage.

## Déploiements
1. `clasp push -f` pour pousser les sources locales.
2. Dans l'éditeur Apps Script : **Deploy → Manage deployments → New deployment**.
3. Choisir « Web app », exécuter en tant que propriétaire et partager via l'URL générée.
4. Rollback : éditer le déploiement et sélectionner une version antérieure ou désactiver le flag impliqué.

## Playbooks
- [Incident calendrier](playbooks/incident-calendrier.md)
- [Purge des Event ID](playbooks/purge-calendrier.md)
- [Facture en double](playbooks/facture-en-double.md)
- [Quota mails](playbooks/quota-mails.md)

## Obligations lors de la livraison de médicaments

### Conditionnement
- ✅ Paquet scellé, opaque, nominatif
- ✅ Boîte ou sac fermé permettant de vérifier toute ouverture

### Médicaments sensibles
- ✅ Respect de la chaîne du froid (conteneurs isothermes adaptés)
- ⚠️ Ne jamais laisser sans surveillance

### Stupéfiants et produits à usage restreint
- ✅ Emballage séparé et sécurisé
- ✅ Livraison uniquement contre signature d’une personne habilitée (pharmacien, infirmier référent, cadre de santé)
- ✅ Traçabilité assurée (registre / fiche de suivi signée à chaque transfert)

### Remise
- ✅ En main propre au patient ou au professionnel désigné
- ⚠️ Jamais déposés en libre accès

### Références officielles
- Code de la santé publique – art. R.5125-47 à R.5125-52
- Ordre des pharmaciens – livraison et dispensation
- OMéDIT – Transport en EHPAD

## License
Ce projet est distribué sous la licence MIT. Consultez le fichier `LICENSE` pour plus d'informations.
