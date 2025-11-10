# Assistant Service

Isoler la logique GPT/assistant (construction de contexte, anonymisation, quotas, appels API externes). Actuellement dans `assistant.gs` (lignes 25-617). Le container gardera uniquement les menus et l'integration UI.

## Portee
- `callChatGPT`, `askAssistantOnThread`, `buildAssistantContext_*`.
- Gestion des proprietes (usage, limites), sanitisation des messages, anonymisation.
- API prevue: `Assistant.ask(threadId, prompt, options)`.

## Scripts clasp
1. `cd modules/assistant-service`
2. `npx clasp create --type standalone --title "ELS Assistant Service"`
3. Completer `clasp.json` puis `npx clasp push`.

## Migration notes
- Necessite un mecanisme pour injecter la cle API (via Script Properties) sans la commiter.
- Ajouter des tests `test_assistantRateLimit` pour couvrir le throttling.
