# Résumé rapide – Security Week 1

- **Branche** : `feature/security-week1`
- **Objectif** : renforcer la sécurité Apps Script et consolider la configuration.
- **Composants clés** : Validation.gs, WebAppService.gs, templates de configuration.
- **Breaking change** : réponses API ajustées (flag nécessaire côté clients externes).
- **Tests à exécuter** : `npm run lint`, `npm run test:clasp`, validation manuelle du flux de réservation.
- **Déploiement** : nouvelle version Web App, exécution en tant que propriétaire, accès avec lien.
- **Rollback** : désactivation du flag puis redeploiement de la version précédente.
