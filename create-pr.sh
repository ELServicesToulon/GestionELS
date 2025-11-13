#!/usr/bin/env bash
set -euo pipefail

BRANCH="feature/security-week1"
COMMIT_MSG=$'\360\237\224\222 feat: Add comprehensive security layer (Week 1)\n\n- Add .gitignore with complete secret patterns\n- Add configuration templates\n- Implement Validation.gs with XSS protection\n- Secure WebAppService.gs with rate limiting\n\nBREAKING CHANGE: WebAppService.gs API responses changed'

function log_step() {
  printf "\n\033[1;35m==> %s\033[0m\n" "$1"
}

log_step "Vérification prérequise"
./validate-config.sh

git status --short

log_step "Installation des dépendances"
npm install

log_step "Tests lint"
npm run lint

log_step "Tests Apps Script"
npm run test:clasp

log_step "Création de la branche ${BRANCH}"
git checkout -B "${BRANCH}"

log_step "Ajout des fichiers"
git add .

log_step "Commit"
git commit -m "${COMMIT_MSG}"

log_step "Push"
git push -u origin "${BRANCH}"

log_step "Lien vers la Pull Request"
PR_URL="https://github.com/ELServicesToulon/GestionELS/pull/new/${BRANCH}"
echo "Ouvrir la PR : ${PR_URL}"
