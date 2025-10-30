$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,
  [Parameter(Mandatory = $true)]
  [string]$XmlPath,
  [string]$OutputPath = "out_facturx.pdf"
)

$facturxUrl = $env:FACTURX_URL
if (-not $facturxUrl) { $facturxUrl = "http://localhost:8080/embed" }

$token = $env:FACTURX_TOKEN
if (-not $token) { $token = "dev-token" }

Write-Host "▶️  Envoi vers $facturxUrl"

curl.exe -X POST $facturxUrl `
  -H "Authorization: Bearer $token" `
  -F "pdf=@$PdfPath;type=application/pdf" `
  -F "xml=@$XmlPath;type=application/xml" `
  --output $OutputPath

Write-Host "✅ PDF Factur-X sauvegardé dans $OutputPath"
