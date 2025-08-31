Param()
Add-Type -AssemblyName Microsoft.VisualBasic
$default = "v" + (Get-Date -Format 'yyyyMMdd-HHmm')
$desc = [Microsoft.VisualBasic.Interaction]::InputBox("Description du déploiement:", "Clasp Deploy - Projet 2", $default)
if ([string]::IsNullOrWhiteSpace($desc)) { return }
$repo = Split-Path $PSScriptRoot -Parent
$proj = Join-Path $repo 'Projet2'
Push-Location $proj
try {
  clasp deploy -d $desc
} finally { Pop-Location }

