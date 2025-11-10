# Utils Shared

Bibliotheque commune pour les formats de dates, montants, logos Drive, gestion des secrets et inclusions HTML. Derive de `Utilitaires.gs` et des snippets utilises dans plusieurs fichiers.

## Portee
- Fonctions de formatage (`formaterDateEnYYYYMMDD`, `formatMontantEuro`, etc.).
- Gestion des logos (`getLogoBlob`, `getLogoEmailBlockHtml`), conversion blob/base64.
- Acces aux secrets (`getSecret`, `setSecret`) et helpers de normalisation.

## Scripts clasp
1. `cd modules/utils-shared`
2. `npx clasp create --type standalone --title "ELS Utils Shared"`
3. Mettre a jour `clasp.json` avec le `scriptId`, puis `npx clasp push`.

## Migration notes
- Servira de dependance pour toutes les autres librairies; definir une API stable avant extraction.
- Garder le code 100% pur (pas de `SpreadsheetApp` ni d'UI).
