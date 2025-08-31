Param()
Add-Type -AssemblyName Microsoft.VisualBasic
$default = "v" + (Get-Date -Format 'yyyyMMdd-HHmm')
$desc = [Microsoft.VisualBasic.Interaction]::InputBox("Description du déploiement:", "Clasp Deploy - Projet 1", $default)
if ([string]::IsNullOrWhiteSpace($desc)) { return }
$repo = Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
  clasp deploy -d $desc
} finally { Pop-Location }

