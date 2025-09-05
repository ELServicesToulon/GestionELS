param(
  [string]$Desc
)

function New-VersionTag {
  $d = Get-Date
  return "v{0}{1}{2}-{3}{4}" -f $d.ToString('yyyy'), $d.ToString('MM'), $d.ToString('dd'), $d.ToString('HH'), $d.ToString('mm')
}

$versionTag = New-VersionTag
if (-not $Desc -or $Desc.Trim() -eq '') {
  $Desc = "Auto deploy $versionTag"
}

Write-Host "[ELS] Pushing local files to Apps Script..." -ForegroundColor Cyan
clasp push -f
if ($LASTEXITCODE -ne 0) { Write-Error "clasp push failed ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host "[ELS] Creating version: $versionTag" -ForegroundColor Cyan
clasp version $versionTag
if ($LASTEXITCODE -ne 0) { Write-Error "clasp version failed ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host "[ELS] Deploying web app: $Desc" -ForegroundColor Cyan
clasp deploy -d "$Desc"
if ($LASTEXITCODE -ne 0) { Write-Error "clasp deploy failed ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host "[ELS] Creating snapshot for $versionTag" -ForegroundColor Cyan
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "tools/snapshot.ps1" -Version $versionTag
if ($LASTEXITCODE -ne 0) { Write-Error "snapshot failed ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host "[ELS] Done. Version: $versionTag" -ForegroundColor Green
