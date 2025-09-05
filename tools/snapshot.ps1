param(
  [string]$Version
)

function New-VersionTag {
  $d = Get-Date
  return "v{0}{1}{2}-{3}{4}" -f $d.ToString('yyyy'), $d.ToString('MM'), $d.ToString('dd'), $d.ToString('HH'), $d.ToString('mm')
}

if (-not $Version -or $Version.Trim() -eq '') {
  $Version = New-VersionTag
}

$snapRoot = Join-Path -Path (Resolve-Path ".").Path -ChildPath "snapshots"
$snapDir = Join-Path -Path $snapRoot -ChildPath $Version

New-Item -ItemType Directory -Path $snapDir -Force | Out-Null

$patterns = @('*.gs', '*.html', 'appsscript.json')
$files = Get-ChildItem -File -Path . -Include $patterns

foreach ($f in $files) {
  Copy-Item -Path $f.FullName -Destination (Join-Path $snapDir $f.Name) -Force
}

Write-Output "Snapshot created: $snapDir"
