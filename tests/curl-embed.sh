#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <pdf> <xml> [output]" >&2
  exit 1
fi

PDF_PATH="$1"
XML_PATH="$2"
OUTPUT_PATH="${3:-out_facturx.pdf}"
FACTURX_URL="${FACTURX_URL:-http://localhost:8080/embed}"
FACTURX_TOKEN="${FACTURX_TOKEN:-dev-token}"

echo "▶️  Envoi vers ${FACTURX_URL}"
curl -X POST "${FACTURX_URL}" \
  -H "Authorization: Bearer ${FACTURX_TOKEN}" \
  -F "pdf=@${PDF_PATH};type=application/pdf" \
  -F "xml=@${XML_PATH};type=application/xml" \
  --output "${OUTPUT_PATH}"

echo "✅ PDF Factur-X sauvegardé dans ${OUTPUT_PATH}"
