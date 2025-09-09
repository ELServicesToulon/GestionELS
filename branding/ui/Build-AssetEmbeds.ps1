Param()
$ErrorActionPreference = 'Stop'

function Write-EmbedHtml($pngPath, $htmlPath) {
  if (-not (Test-Path $pngPath)) { throw "Missing asset: $pngPath" }
  $bytes = [IO.File]::ReadAllBytes($pngPath)
  $b64 = [Convert]::ToBase64String($bytes)
  Set-Content -LiteralPath $htmlPath -Value $b64 -NoNewline -Encoding ASCII
  Write-Host ("Wrote {0} ({1} KB) -> {2}" -f (Split-Path $pngPath -Leaf), [math]::Round($bytes.Length/1kb,1), $htmlPath)
}

$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Split-Path -Parent (Split-Path -Parent $uiDir))

Write-Host 'Building base64 HTML embeds from branding/ui PNGs...' -ForegroundColor Cyan

$map = @{
  'branding/ui/capsule1x.png'           = 'Capsule1x_b64.html'
  'branding/ui/capsule2x.png'           = 'Capsule2x_b64.html'
  'branding/ui/blister_vide1x.png'      = 'Blister1x_b64.html'
  'branding/ui/blister_vide2x.png'      = 'Blister2x_b64.html'
  'branding/ui/alu/alu-tile1x.png'      = 'Aluminium1x_b64.html'
  'branding/ui/alu/alu-tile2x.png'      = 'Aluminium2x_b64.html'
  'branding/ui/pill-full1x.png'         = 'PillFull1x_png_b64.html'
  'branding/ui/pill-full2x.png'         = 'PillFull2x_png_b64.html'
  'branding/ui/pill-full1x.webp'        = 'PillFull1x_webp_b64.html'
  'branding/ui/pill-full2x.webp'        = 'PillFull2x_webp_b64.html'
}

foreach ($k in $map.Keys) {
  $src = Join-Path $repoRoot $k
  $dst = Join-Path $repoRoot $map[$k]
  Write-EmbedHtml -pngPath $src -htmlPath $dst
}

Write-Host 'Done.' -ForegroundColor Green
