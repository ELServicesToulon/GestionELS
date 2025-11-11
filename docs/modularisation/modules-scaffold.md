# Modules Scaffold Guide

Ce guide explique comment initialiser chaque librairie Apps Script creee dans `modules/`. Toutes utilisent le meme squelette (`src/` + `clasp.json`) et doivent recevoir un `scriptId` reel apres creation via `clasp`.

## Commandes communes
```bash
cd modules/<module-name>
npx clasp create --type standalone --title "<ELS Module Name>"
# ou, si le projet existe deja:
npx clasp clone <scriptId>
npx clasp push
```

## Apercu des modules

| Module | Dossier | Objet | Fichiers sources a migrer | Notes |
| --- | --- | --- | --- | --- |
| Config Cache Service | `modules/config-cache-service` | Cache de configuration (invalidation, lecture) | `Administration.gs:12`, `Configuration.gs` helpers | Doit exposer `invalidate()` + `getConfig()`. |
| Client Portal Service | `modules/client-portal-service` | Liens signes, assertions client | `Administration.gs:55`, `Utilitaires.gs:680-756` | Necessite secrets via Script Properties. |
| Reservation Core | `modules/reservation-core` | Creation reservations, calculs, persistence | `Reservation.gs:152-688`, `FeuilleCalcul.gs` (parties metier) | Depend de `utils-shared`, `billing-service`, `calendrier-service`. |
| Calendrier Service | `modules/calendrier-service` | Slots calendrier, jours feries | `Calendrier.gs`, `Reservation.gs:596-629` | Garder pur (pas de UI). |
| Billing Service | `modules/billing-service` | Facturation, devis, Factur-X | `Administration.gs:72+`, `Facturation_*.gs`, `FeuilleCalcul.gs:306+` | Doit consommer `utils-shared` pour logos/secrets. |
| Notification Service | `modules/notification-service` | Emails clients/admin | `Reservation.gs:240-526`, templates HTML | Peut reutiliser `branding/` et `Utils`. |
| Assistant Service | `modules/assistant-service` | GPT, contexte, quotas | `assistant.gs:25-617` | Prevoir templating pour prompts. |
| Utils Shared | `modules/utils-shared` | Formats, logos, secrets | `Utilitaires.gs` | Premiere librairie a publier (fondation); le container conserve une implementation locale jusqu'a son activation. |

## Prochaines etapes suggerees
1. Publier `utils-shared` afin que les autres modules puissent le referencer pendant le dev (`npm run modules:push` pousse tous les modules avec `clasp push -f`).
2. Deplacer incrementalement les fonctions en respectant la matrice `matrice-ui-vs-module.md`.
3. Utiliser `npm run modules:pull` / `modules:status` avant/apres extraction pour garder les projets sync.
