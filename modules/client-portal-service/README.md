# Client Portal Service

Expose les operations de securisation de l'espace client (liens signes, verification des signatures, chargement de la configuration). Remplace la logique disseminee entre `Administration.gs:55`, `Utilitaires.gs:680-756` et `Reservation.gs`.

## Portee
- Generation de liens signes (`generateSignedClientLink`, `verifySignedLink`).
- Helpers pour l'assertion client (`assertClient`, `assertReservationId`).
- Interactions avec `PropertiesService` pour stocker les secrets necessaires.

## Scripts clasp
1. `cd modules/client-portal-service`
2. `npx clasp create --type standalone --title "ELS Client Portal Service"` puis renseigner l'ID dans `clasp.json`.
3. `npx clasp push`

## Migration notes
- Les fonctions container continuent de verifier `Session.getActiveUser()` avant d'appeler la librairie.
- Prevoir une fonction `ClientPortal.generateLink(email, ttlSeconds)` pour remplacer `genererLienEspaceClient`.
