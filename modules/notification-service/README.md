# Notification Service

Gerera toutes les communications emails/push liees aux reservations (confirmation client, devis, alertes internes). Regroupe `envoyerDevisParEmail`, `envoyerIdentifiantAccesClient`, `notifierClientConfirmation` et les assets HTML/branding necessaires (`Utilitaires.gs`).

## Portee
- Composition des emails (logos, templates).
- Intégration Gmail/Apps Script MailApp.
- Future extension: notifications conducteurs (peut reutiliser `apps-script/FcmService.gs`).

## Scripts clasp
1. `cd modules/notification-service`
2. `npx clasp create --type standalone --title "ELS Notification Service"`
3. Renseigner `scriptId` dans `clasp.json`, puis `npx clasp push`.

## Migration notes
- Les modules `billing-service` et `reservation-core` doivent appeler cette librairie pour tout envoi.
- Conserver les drapeaux (ex: `EMAIL_CLIENT_ENABLED`) dans `Configuration.gs` et les passer en parametre.
