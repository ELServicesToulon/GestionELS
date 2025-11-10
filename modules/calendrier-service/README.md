# Calendrier Service

Regroupe les calculs de disponibilite et la lecture des evenements Google Calendar. Englobe l'actuel `Calendrier.gs` (hors fonction publique) et les helpers de recurrence dans `Reservation.gs`.

## Portee
- `obtenirCreneauxDisponiblesPourDate`, `obtenirEtatCreneauxPourDate`.
- `normaliserEvenementsPourPlage`, `obtenirEvenementsCalendrierPourPeriode`.
- Les utilitaires de jours feries (ou exposes via `utils-shared`/`date-utils` selon besoin).

## Scripts clasp
1. `cd modules/calendrier-service`
2. `npx clasp create --type standalone --title "ELS Calendrier Service"`
3. Completer `clasp.json` avec le `scriptId`, puis `npx clasp push`.

## Migration notes
- `obtenirDonneesCalendrierPublic` restera dans le container et utilisera cette librairie.
- Prevoir une API type `Calendrier.getSlots(dateString, options)` pour standardiser les appels.
