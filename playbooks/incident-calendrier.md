# Incident Calendrier

Objectif: resynchroniser les événements Google Calendar manquants.

## Étapes
1. Activer temporairement le flag `CALENDAR_RESYNC_ENABLED`.
   - Ajouter la Script Property `FLAG_CALENDAR_RESYNC_ENABLED=true` ou modifier `Configuration.gs`.
2. `clasp push -f` puis déployer une nouvelle version si nécessaire.
3. Dans Sheets, menu **EL Services → Vérifier la cohérence du calendrier**, cliquer sur **Resync** pour chaque réservation manquante.
4. Désactiver le flag (`false`) et redéployer la version stable.

## Rollback
- Supprimer la Script Property ou remettre `CALENDAR_RESYNC_ENABLED=false`, puis redéployer.
