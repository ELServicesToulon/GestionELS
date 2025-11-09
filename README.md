Module Livreur – Livraison EHPAD
===============================

Résumé
------
Implémentation complète d'un module livreur pour Android basé sur PWA + TWA + Apps Script + FCM. Le projet couvre la capture terrain offline, la synchronisation append-only RGPD compatible et les notifications automatiques liées à Google Calendar.

Prérequis
---------
- Domaine HTTPS `DOMAIN` pointant vers l'hébergement PWA.
- Accès Google Workspace avec agenda `CALENDAR_ID` et comptes livreurs.
- Projet Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_SENDER_ID`).
- Identifiant de web app Apps Script `WEB_APP_URL` (déployée « exécuter en tant que moi »).
- Dossier Google Drive pour photos (`DRIVE_PHOTOS_FOLDER_ID`) et signatures (`DRIVE_SIG_FOLDER_ID`).
- Google Sheet journal (`SHEET_ID`) contenant feuilles `journal` et `devices`.
- ScriptProperty `FCM_SA_JSON` contenant le JSON du compte de service FCM.

Structure
---------
```
/pwa
/android-twa
/apps-script
```

Mise en place PWA
-----------------
1. Installer dépendances locales:
   ```bash
   npm install --save-dev esbuild typescript workbox-build
   ```
2. Compiler TypeScript:
   ```bash
   npx esbuild pwa/app.ts pwa/ui.ts pwa/idb.ts pwa/barcode.ts pwa/signature.ts pwa/geo.ts --bundle --format=esm --outdir=pwa/dist --sourcemap
   ```
   Adapter `index.html` pour charger `./dist/app.js` si bundler différent.
3. Déployer le dossier `pwa/` sur un hébergement HTTPS sous `https://DOMAIN/`.
4. Publier `assetlinks.json` sur `https://DOMAIN/.well-known/assetlinks.json`.
5. Vérifier l'installation PWA (Chrome Android > Ajouter à l'écran d'accueil).

Intégration Firebase Web
------------------------
- Créer une application Web Firebase et récupérer `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_SENDER_ID`, `apiKey`.
- Ajouter le fichier `firebase-config.js` (non fourni, à créer dans `pwa/`) exposant `initializeApp`. Exemple:
  ```js
  export const firebaseConfig = {
    apiKey: 'TODO',
    appId: 'FIREBASE_APP_ID',
    projectId: 'FIREBASE_PROJECT_ID',
    messagingSenderId: 'FIREBASE_SENDER_ID'
  };
  ```
- Importer ce module dans `app.ts` (voir section `TODO` commentée).

Mise en place Apps Script
-------------------------
1. Copier le contenu de `/apps-script` dans votre projet Apps Script (via `clasp` ou éditeur).
2. Dans `Configuration.gs`, déclarer les constantes:
   ```gs
   const CFG_TOURNEES_SHEET_ID = 'SHEET_ID';
   const CFG_DRIVE_PHOTOS_FOLDER_ID = 'DRIVE_PHOTOS_FOLDER_ID';
   const CFG_DRIVE_SIG_FOLDER_ID = 'DRIVE_SIG_FOLDER_ID';
   const CFG_CALENDAR_ID = 'CALENDAR_ID';
   const CFG_PWA_DOMAIN = 'https://DOMAIN';
   const CFG_WEB_APP_URL = 'WEB_APP_URL';
   const CFG_FIREBASE_PROJECT_ID = 'FIREBASE_PROJECT_ID';
   ```
3. Créer les feuilles `journal` et `devices` via `chatProvisionSheets()` si non présent.
4. Déployer la Web App (`Publier > Déployer en tant qu'application web`).
5. Ajouter dans `Script Properties` la clé `FCM_SA_JSON` contenant le JSON du compte de service FCM.
6. Créer un déclencheur time-driven toutes les 5 minutes sur `CalendarWorker.checkAndNotify`.

Google Sheet
------------
Feuille `journal` (append-only):
```
ts_srv,eventId,cmd,status,lat,lng,accuracy,items_json,temp,receiver_name,receiver_role,sign_fileId,photo_fileIds,deviceId,battery,appVersion,clientUUID,seq,userEmail
```
Feuille `devices`:
```
driverEmail,fcmToken,platform,updated_ts
```

Apps Script Tests
-----------------
Exécuter:
```
clasp run test_sheetStoreIdempotence
clasp run test_fcmJwtGeneration
clasp run test_endToEndSimulation
```

Android TWA
-----------
1. Installer bubblewrap et initialiser:
   ```bash
   npm install -g @bubblewrap/cli
   cd android-twa
   bubblewrap init --manifest ../pwa/manifest.webmanifest
   ```
2. Ajouter le module Firebase Cloud Messaging (Gradle déjà configuré).
3. Ouvrir le projet dans Android Studio, synchroniser Gradle.
4. Mettre à jour `applicationId`, `package` et `asset_statements.json` si nécessaire.
5. Générer l'APK/Bundle:
   ```bash
   ./gradlew assembleRelease
   ```
6. Signer et déployer sur Play Console (Internal Testing).

Firebase Cloud Messaging côté serveur
-------------------------------------
- Le script Apps Script `FcmService.gs` génère un JWT RS256 et appelle l'API FCM HTTP v1.
- Vérifier que le compte de service dispose du rôle « Firebase Admin SDK Administrator Service Agent ».

Google Calendar
---------------
- Les événements doivent suivre la nomenclature:
  - Titre: `Livraison {EHPAD} – {Créneau} – {CMD}`.
  - Location: `https://DOMAIN/app/?eventId={EVENT_ID}&cmd={CMD}`.
  - Description: clés `EHPAD`, `adresse`, `conducteur`, `fenetre` séparées par lignes.

Vérifications post-déploiement
------------------------------
- PWA installable et fonctionnement offline (activer mode avion).
- Notifications H-15/H-5/H+5 reçues par les livreurs.
- Ouverture notification → fiche correspondante.
- Signature et photos stockées dans Drive dossiers dédiés.
- Entrées `journal` append-only avec timestamps serveur cohérents.
- Table `devices` mise à jour à chaque nouvelle session.

Maintenance & RGPD
------------------
- Les données sont minimisées (pas de noms patients).
- Prévoir un script d'archivage annuel pour anonymiser les entrées >12 mois.
- Export possible via Google Sheet (filtre sur période).

