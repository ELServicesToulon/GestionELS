# Matrice UI vs Modules - GestionELS

Ce document classe chaque fonction critique entre **container-bound** (doit rester dans le projet principal Apps Script car elle parle directement a l'UI ou au classeur) et **module autonome** (peut vivre dans une librairie Apps Script independante). Les references de fichiers suivent le depot racine (`Administration.gs:12` signifie ligne 12 du fichier).

| Domaine / Fichier | Fonctions (references) | Statut | Module cible / Commentaires |
| --- | --- | --- | --- |
| **Administration (panneau admin)**<br>`Administration.gs` | `invaliderCacheConfiguration` (12) | Module | `ConfigCacheService` - manipule uniquement `CacheService`, aucun lien UI. |
| | `calculerCAEnCours` (20) | Container | Lit le classeur facturation (`SpreadsheetApp` + `Session`). |
| | `genererLienEspaceClient` (55) | Module | `ClientPortalService` - expose creation de liens signes, necessite juste `Session` pour verifier l'admin. |
| | `obtenirLienFactureParIdAdmin` (72) | Module | `BillingService` - logique Drive + recherche facture, peut etre partagee. |
| | `obtenirToutesReservationsAdmin` (101) | Container | Acces direct au sheet + privilegie `Calendar.Events` mais resultat destine aux ecrans admin. |
| | `obtenirToutesReservationsPourDate` (200) | Container | Filtre sur la feuille et renvoie l'etat pour l'UI admin. |
| | `obtenirTousLesClients` (309) | Container | Lit le classeur clients, renvoie un JSON lie aux menus. |
| | `creerReservationAdmin` (355) | Container (facade) | Reste exposee mais doit deleguer a `ReservationCore` pour la logique metier. |
| | `supprimerReservation` (630) | Container (facade) | Supprime evenements + lignes; pourrait appeler `ReservationCore.delete`. |
| | `appliquerRemiseSurTournee` (690) | Container (facade) | Interaction directe avec la feuille. |
| | `genererFactures`, `envoyerFacturesControlees`, `archiverFacturesDuMois` (857-1186) | Container | Tous declenchent `SpreadsheetApp.getUi()` et des prompts. |
| | `genererDevisPdfDepuisSelection` (1310) | Container (facade) | UI-bound; la generation PDF partira dans `BillingService`. |
| **Reservations (front client)**<br>`Reservation.gs` | `verifierCodePostalAcces` (12) | Container | Appelee par l'UI publique, reste facade. |
| | `reserverPanier` (37) | Container (facade) | Orchestration UI -> doit deleguer a `ReservationCore.processBasket`. |
| | `creerReservationUnique` (152) | Module | `ReservationCore` - logique metier + Calendar. |
| | `envoyerDevisParEmail` (240) | Container (facade) | Exposee a l'UI mais devrait appeler `BillingService.generateQuote`. |
| | `genererDevisPdfFromItems` (318) | Module | Partageable via `BillingService`. |
| | `envoyerIdentifiantAccesClient`, `notifierClientConfirmation` (420, 490) | Module | `NotificationService` - envoi d'e-mails systemique. |
| | `formaterDateEnFrancais` (526) | Module | Mutualiser via `UtilsShared` (doublon avec `Utilitaires.gs`). |
| | `calculerInfosTourneeBase`, `calculerPrixEtDureeServeur` (535, 561) | Module | `ReservationCore` - calculs purs. |
| | `verifierDisponibiliteRecurrence`, `trouverAlternativeProche` (596, 629) | Module | `CalendrierService` (logique agenda). |
| | `obtenirReservationsPourClient`, `reservationIdExiste` (652, 688) | Module | `ReservationCore` - pas d'UI directe. |
| **Calendrier**<br>`Calendrier.gs` | Fonctions date (`calculerDatePaques`, `ajouterJours`, `obtenirSetJoursFeriesFrance`, `estJourFerieFrancais`) (16-101) | Module | `DateUtilsModule`. |
| | `normaliserEvenementsPourPlage`, `obtenirEvenementsCalendrierPourPeriode` (101-155) | Module | `CalendrierService` - lecture GCal pure. |
| | `obtenirCreneauxDisponiblesPourDate`, `obtenirEtatCreneauxPourDate` (155-337) | Module | `CalendrierService`; seule la couche UI dans le container exposera les donnees. |
| | `obtenirDonneesCalendrierPublic` (337+) | Container (facade) | Sert directement `Reservation_JS_*`. |
| **Utilitaires / Securite**<br>`Utilitaires.gs` | Tous (formats date/heure/montant, logos, secrets, signature) (15-756) | Module | `UtilsShared` + `SecurityService`. Rien ne depend du classeur ou UI. |
| **Assistant**<br>`assistant.gs` | `callChatGPT`, `askAssistantOnThread`, `buildAssistantContext_*`, `scrubChatMessage_`, `read/writeAssistantUsage_`, `isAssistantFeatureEnabled_` (25-617) | Module | `AssistantService` - logique conversationnelle + quotas; communique via `PropertiesService` et `Sheet`, mais ne necessite pas l'UI. |
| | `askAssistant`, `menuAskAssistant`, `buildAssistantSessionId_` (140, 301, 538) | Container | Interactions menu/Sheets actifs. |
| **Feuille de calcul & config clients**<br>`FeuilleCalcul.gs` | `calculerIdentifiantClient`, `enregistrerOuMajClient`, `obtenirInfosClientParEmail`, `codePostalAutorise`, `decrementerTourneesOffertesClient`, `enregistrerReservationPourFacturation`, `obtenirPlagesBloqueesPourDate`, `rechercherClientParEmail` (12-398) | Module | `ClientDataService` / `BillingService` - acces feuille programmatique, pas d'UI. Container gardera seulement les entrees de menu qui appellent ces services. |
| **Facturation & PDF**<br>`Facturation_V2.gs`, `FacturationResident.gs`, `Facture.html`, `Modele_Facture_ELS.html` | Fonctions de generation PDF + Drive | Module | `BillingService` - reutilisable cote admin et automatisations. |
| **Apps-script/ (PWA, FacturX, notifications)** | `apps-script/CalendarWorker.gs`, `FacturX.gs`, `DriveStore.gs`, `SheetStore.gs`, `FcmService.gs`, `Security.gs`, `Tests.gs`, etc. | Modules existants | Ces fichiers sont deja dans des projets autonomes; lors de la migration, s'assurer de les convertir en bibliotheques officielles ou de les regrouper dans `modules/`. |

## Synthese par module cible

1. **ConfigCacheService** : `Administration.gs:12`, lecture/ecriture Cache/Properties.
2. **ClientPortalService** : gestion liens signes + securite client (`Administration.gs:55`, `Utilitaires.gs:680`, `728`, `740`).
3. **ReservationCore** : coeur metier des tournees (`Reservation.gs:152-688`, `FeuilleCalcul.gs` helpers lies aux reservations).
4. **CalendrierService / DateUtils** : tout `Calendrier.gs` + portions `Reservation.gs:596-629`.
5. **BillingService** : acces factures (`Administration.gs:72`, `genererDevisPdfDepuisSelection`), `FeuilleCalcul.gs:306`, `Facturation_*.gs`, `Facture.html`.
6. **NotificationService** : e-mails confirmations/devis (`Reservation.gs:240-526`, `Utilitaires.gs` pour logos).
7. **AssistantService** : toute la logique GPT hors menus (`assistant.gs:25-617`).
8. **UtilsShared / SecurityService** : `Utilitaires.gs` complet, `Configuration.gs` lecteur unique.

Chaque module exposera une API documentee, tandis que le projet container-bound conservera uniquement :
- Triggers UI (`onOpen`, menus, boutons) et endpoints HTML (`doGet`, fonctions `google.script.run`).
- Les controles d'acces directs (`Session.getActiveUser()`), avant de deleguer aux modules.
- Les interactions ponctuelles avec `SpreadsheetApp.getUi()` (alertes, prompts) impossibles cote librairie.

Cette matrice servira de reference pour automatiser la migration (scripts `modules:push` et generation des bibliotheques). Ajuster les statuts si l'equipe produit decide de garder certaines operations critiques dans le container pour des raisons de gouvernance.
