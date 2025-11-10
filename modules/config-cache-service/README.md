# Config Cache Service

Gere l'invalidation et la lecture des configurations en cache pour le container principal. Ce module expose des helpers bases sur `CacheService` et `PropertiesService` utilises par `Administration.gs:12` et `Configuration.gs`.

## Portee
- Reprendre `invaliderCacheConfiguration` et toutes les fonctions futures liees a la mise en cache des parametres.
- Fournir des helpers `getCachedConfig()` et `setCachedConfig()` consommes par les autres modules.

## Scripts clasp
1. `cd modules/config-cache-service`
2. `npx clasp create --type standalone --title "ELS Config Cache Service"` (ou renseigner `scriptId` dans `clasp.json`).
3. `npx clasp push`

## Migration notes
- Conserver l'appel depuis `Administration.gs` pour valider les droits admin via `Session` avant de deleguer au module.
- Tous les flags restent centralises dans `Configuration.gs`; ce module manipule uniquement le cache.
