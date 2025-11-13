# Guide de création de Pull Request

## Pré-requis
1. Être sur la branche de fonctionnalité (ex: `feature/security-week1`).
2. Avoir exécuté `./validate-config.sh` et corrigé les éventuelles alertes.
3. Vérifier qu’aucun secret ni fichier sensible n’est en attente (`git status`).
4. Confirmer que tous les tests Apps Script nécessaires sont passés.

## Étapes détaillées
### 1. Préparation locale
- `npm install` si ce n’est pas déjà fait.
- `git pull --rebase origin main` pour récupérer les derniers changements.
- Valider l’absence de conflits.

### 2. Vérifications
- `./validate-config.sh`
- `npm run lint`
- `npm run test:clasp`
- Tests manuels : réservation complète, calendrier AM/PM, génération facture PDF.

### 3. Commit
```bash
git add .
git commit -m "🔒 feat: Add comprehensive security layer (Week 1)

- Add .gitignore with complete secret patterns
- Add configuration templates
- Implement Validation.gs with XSS protection
- Secure WebAppService.gs with rate limiting

BREAKING CHANGE: WebAppService.gs API responses changed"
```

### 4. Push
```bash
git push origin feature/security-week1
```

### 5. Création de la PR sur GitHub
1. Ouvrir le lien renvoyé par Git (`https://github.com/ELServicesToulon/GestionELS/pull/new/feature/security-week1`).
2. Remplir le titre : `🔒 Security Week 1: Validation & Configuration Templates`.
3. Copier-coller le contenu de `PR_TEMPLATE.md` dans la description.
4. Ajouter les labels : `security`, `enhancement`, `documentation`, `breaking-change`.
5. Assigner les reviewers concernés.
6. Publier la PR.

### 6. Post-PR
- Partager le lien avec l’équipe sur le canal habituel.
- Ajouter les instructions de test en commentaire.
- Suivre les retours des reviewers et appliquer les correctifs.

## Dépannage rapide
- Conflits Git : utiliser `git status` puis résoudre fichier par fichier; rebase si nécessaire.
- Tests échoués : consulter les logs `clasp` ou la console Apps Script.
- Secrets détectés : déplacer le secret dans les Script Properties puis réécrire l’historique si besoin.
