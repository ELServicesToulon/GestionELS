# Quota mails

Objectif: gérer les dépassements de quota d'envoi d'e-mails.

## Étapes
1. Identifier l'erreur `Service invoked too many times` dans les logs.
2. Appliquer un backoff (attendre puis réessayer).
3. Si le quota reste saturé, remplacer temporairement `MailApp.sendEmail` par `GmailApp.sendEmail` dans les scripts concernés.
4. Retirer la modification une fois le quota réinitialisé.

## Rollback
- Restaurer l'utilisation de `MailApp.sendEmail` et déployer à nouveau.
