# Reservation Core

Contient la logique metier des reservations (creation d'evenements Calendar, calculs de duree/prix, recherche d'alternatives, enregistrement facturation). Couvre l'essentiel de `Reservation.gs:152-688` et les helpers associes dans `FeuilleCalcul.gs`.

## Portee
- `creerReservationUnique`, `reservationIdExiste`, `obtenirReservationsPourClient`.
- Calculs (`calculerInfosTourneeBase`, `calculerPrixEtDureeServeur`, verification recurrence).
- Interaction Calendar + enregistrement facturation (via `BillingService`).

## Scripts clasp
1. `cd modules/reservation-core`
2. `npx clasp create --type standalone --title "ELS Reservation Core"`
3. Renseigner le `scriptId` dans `clasp.json` puis `npx clasp push`

## Migration notes
- Le container garde `reserverPanier` qui delegue vers `ReservationCore.processBasket`.
- Les fonctions de notification/email seront deplacees dans `notification-service`.
