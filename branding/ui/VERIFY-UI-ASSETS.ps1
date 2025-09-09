Param()
$ErrorActionPreference = 'Stop'

function Get-ImageInfo($path) {
  Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue | Out-Null
  $img = [System.Drawing.Image]::FromFile($path)
  try {
    return [PSCustomObject]@{
      Path   = $path
      Name   = [IO.Path]::GetFileName($path)
      Width  = $img.Width
      Height = $img.Height
      KB     = [math]::Round((Get-Item $path).Length/1kb, 1)
    }
  } finally {
    $img.Dispose()
  }
}

function Check-Pair($oneX, $twoX) {
  $a = Get-ImageInfo $oneX
  $b = Get-ImageInfo $twoX
  $ok = ($b.Width -eq 2*$a.Width) -and ($b.Height -eq 2*$a.Height)
  [PSCustomObject]@{
    Asset  = (Split-Path $oneX -LeafBase)
    OneX   = "$($a.Width)x$($a.Height)"
    TwoX   = "$($b.Width)x$($b.Height)"
    Ratio  = if ($a.Width -gt 0) { [math]::Round($b.Width / $a.Width, 2) } else { 0 }
    OK     = $ok
  }
}

Write-Host 'Scanning branding/ui for UI assets...' -ForegroundColor Cyan
$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$pairs = @(
  @{One=(Join-Path $uiDir 'capsule1x.png');         Two=(Join-Path $uiDir 'capsule2x.png')},
  @{One=(Join-Path $uiDir 'blister_vide1x.png');    Two=(Join-Path $uiDir 'blister_vide2x.png')},
  @{One=(Join-Path $uiDir 'alu/aluminium1x.png');   Two=(Join-Path $uiDir 'alu/aluminium2x.png')}
)

$results = foreach ($p in $pairs) {
  if (-not (Test-Path $p.One) -or -not (Test-Path $p.Two)) {
    [PSCustomObject]@{ Asset=$p.One; OneX='missing'; TwoX='missing'; Ratio=0; OK=$false }
  } else {
    Check-Pair -oneX $p.One -twoX $p.Two
  }
}

$results | Format-Table -AutoSize

$allOk = -not ($results | Where-Object { -not $_.OK })
if ($allOk) {
  Write-Host 'All UI asset pairs are properly normalized (2x = 2×1x).' -ForegroundColor Green
  exit 0
} else {
  Write-Warning 'Some assets are not normalized. Please ensure 2x dimensions are exactly double of 1x.'
  exit 1
}
