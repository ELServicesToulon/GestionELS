# Billing Service

Centralise la facturation (enregistrement sur sheet, generation de devis/factures PDF, archivage Drive). Doit recuperer les fonctions de `Administration.gs` (factures), `FeuilleCalcul.gs:306+`, `Facturation_V2.gs`, `FacturationResident.gs` et les templates HTML lies.

## Portee
- `enregistrerReservationPourFacturation`, `genererDevisPdfFromItems`, generation Factur-X.
- Gestion des remises, tournées offertes et export Drive.
- APIs exposees vers le container: `Billing.generateQuoteFromSelection`, `Billing.generateInvoices`.

## Scripts clasp
1. `cd modules/billing-service`
2. `npx clasp create --type standalone --title "ELS Billing Service"`
3. Actualiser `clasp.json` avec le `scriptId`, puis `npx clasp push`.

## Migration notes
- Les fonctions UI (prompts, menus) restent dans le container mais appellent cette librairie.
- Prevoir des tests `test_billingSmoke` accessibles via `npm run test:clasp`.
