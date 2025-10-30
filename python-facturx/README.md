# Factur-X Embedding Micro-service

Service FastAPI qui reçoit un PDF et un XML Factur-X (profil EN16931) et renvoie un PDF/A-3 contenant le XML embarqué. Authentification via jeton Bearer (`FACTURX_TOKEN`).

## Prérequis

- Python 3.11+ ou Docker
- Variables d’environnement : `FACTURX_TOKEN`

## Installation locale

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
FACTURX_TOKEN=dev-token uvicorn app:app --reload --port 8080
```

## Docker

```bash
docker build -t els-facturx .
docker run --rm -p 8080:8080 -e FACTURX_TOKEN=dev-token els-facturx
```

## Utilisation

Endpoint unique `POST /embed` :

- Headers : `Authorization: Bearer <FACTURX_TOKEN>`
- Form-data :
  - `pdf` : fichier `application/pdf`
  - `xml` : fichier `application/xml`

Réponse : `application/pdf` avec l’en-tête `X-Request-Id`.

## Exemple de test

Voir les scripts `../tests/curl-embed.sh` et `../tests/curl-embed.ps1` pour générer un PDF Factur-X via `curl`/PowerShell.

## Déploiement Cloud Run (exemple)

```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/els-facturx
gcloud run deploy els-facturx \
  --image gcr.io/<PROJECT_ID>/els-facturx \
  --region europe-west1 \
  --allow-unauthenticated=false \
  --set-env-vars FACTURX_TOKEN=<SECRET>
```

## Journalisation

Chaque requête comporte un `request_id` (header `X-Request-Id`) propagé dans les logs (`embed_start`, `embed_success`, erreurs). Les payloads sont limités à 10 Mo pour prévenir les abus.
