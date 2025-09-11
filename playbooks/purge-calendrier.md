# Purge des Event ID

Objectif: supprimer les identifiants d'événements Google Calendar inexistants.

## Étapes
1. Activer temporairement le flag `CALENDAR_PURGE_ENABLED`.
   - Ajouter la Script Property `FLAG_CALENDAR_PURGE_ENABLED=true` ou modifier `Configuration.gs`.
2. `clasp push -f` puis déployer une nouvelle version si nécessaire.
3. Dans Sheets, menu **EL Services → Vérifier la cohérence du calendrier**, sélectionner les réservations puis cliquer sur **Purger sélection**.
4. Désactiver le flag (`false`) et redéployer la version stable.

## Rollback
- Supprimer la Script Property ou remettre `CALENDAR_PURGE_ENABLED=false`, puis redéployer.
