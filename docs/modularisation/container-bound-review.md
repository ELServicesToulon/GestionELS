# Container-bound Review Checklist

Ce document sert a confirmer, avec les equipes metier et produit, quelles fonctions doivent imperativement rester dans le projet Apps Script container-bound. Chaque ligne reference la fonction, la raison, l'interlocuteur attendue et l'etat de validation. Mettre a jour la colonne `Status` avec `pending`, `approved`, ou `blocked`.

## Instructions
1. Partager ce tableau lors de la revue de migration.
2. Pour chaque ligne, l'interlocuteur valide que la fonction doit rester dans le container (ou donne son feu vert pour la migrer).
3. Documenter toute decision differente dans une note sous le tableau.

## Fonctions a confirmer

| Domaine | Fonction (fichier:ligne) | Raison de rester container | Owner suggere | Status |
| --- | --- | --- | --- | --- |
| Administration | `calculerCAEnCours` (Administration.gs:20) | Lit directement la feuille Facturation et verifie l'email admin via `Session`. | Finance lead | pending |
| Administration | `obtenirToutesReservationsAdmin` (Administration.gs:101) | Charge l'ensemble de la feuille Facturation pour la vue admin. | Operations lead | pending |
| Administration | `obtenirToutesReservationsPourDate` (Administration.gs:200) | Meme logique mais filtre par date pour l'interface admin. | Operations lead | pending |
| Administration | `obtenirTousLesClients` (Administration.gs:309) | Lit la feuille Clients exposee dans le panneau admin. | Customer success | pending |
| Administration | `creerReservationAdmin` (Administration.gs:355) | Actions declenchees depuis menus admin, depend de `SpreadsheetApp.getUi`. | Operations lead | pending |
| Administration | `supprimerReservation` (Administration.gs:630) | Supprime l'evenement + ligne sheet via commandes admin. | Operations lead | pending |
| Administration | `appliquerRemiseSurTournee` (Administration.gs:690) | Met a jour les remises depuis le sheet actif. | Finance lead | pending |
| Administration | `genererFactures` (Administration.gs:857) | Utilise `SpreadsheetApp.getUi()` pour prompts utilisateur. | Finance lead | pending |
| Administration | `envoyerFacturesControlees` (Administration.gs:1157) | Workflow manuel depuis l'UI; requiert interactions avec le classeur. | Finance lead | pending |
| Administration | `archiverFacturesDuMois` (Administration.gs:1185) | Meme contrainte UI + menu. | Finance lead | pending |
| Administration | `genererDevisPdfDepuisSelection` (Administration.gs:1310) | Selection dans le sheet actif + dialogues UI. | Sales lead | pending |
| Reservation front | `verifierCodePostalAcces` (Reservation.gs:12) | Endpoint appele par l'UI publique `Reservation_JS_*`. | Produit | pending |
| Reservation front | `reserverPanier` (Reservation.gs:37) | Entrypoint des formulaires client, doit rester accessible depuis le container. | Produit | pending |
| Reservation front | `envoyerDevisParEmail` (Reservation.gs:240) | Declenche par le front client; restera un simple proxy vers `BillingService`. | Produit | pending |
| Calendrier front | `obtenirDonneesCalendrierPublic` (Calendrier.gs:337) | Fournit les donnees du calendrier a l'interface publique. | Produit | pending |
| Assistant | `askAssistant` (assistant.gs:140) | Manipule la feuille active pour consigner la conversation. | Support lead | pending |
| Assistant | `menuAskAssistant` (assistant.gs:301) | Ajoute les menus et dialogues via `SpreadsheetApp.getUi()`. | Support lead | pending |
| Assistant | `buildAssistantSessionId_` (assistant.gs:538) | Lit la feuille active pour construire l'identifiant de session. | Support lead | pending |

## Notes / decisions
- Ajouter ici toute decison de migration differente (ex: la fonction est finalement deleguee a une librairie).
