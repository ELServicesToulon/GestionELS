# Requires: PowerShell 5+, clasp installed and logged in
# Purpose: Simple modal to Push / Pull / Version for root project or Projet2

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function New-Form {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "Clasp Tools"
  $form.Size = New-Object System.Drawing.Size(430,260)
  $form.StartPosition = "CenterScreen"

  $lblProject = New-Object System.Windows.Forms.Label
  $lblProject.Text = "Projet"
  $lblProject.Location = New-Object System.Drawing.Point(15,20)
  $lblProject.AutoSize = $true
  $form.Controls.Add($lblProject)

  $cmbProject = New-Object System.Windows.Forms.ComboBox
  $cmbProject.DropDownStyle = 'DropDownList'
  $cmbProject.Location = New-Object System.Drawing.Point(150,16)
  $cmbProject.Size = New-Object System.Drawing.Size(250,22)
  $root = Get-Location
  $p2 = Join-Path $root.Path 'Projet2'
  $cmbProject.Items.Add("Projet 1 (Racine)`t$($root.Path)") | Out-Null
  if (Test-Path $p2) { $cmbProject.Items.Add("Projet 2 (Projet2)`t$($p2)") | Out-Null }
  $cmbProject.SelectedIndex = 0
  $form.Controls.Add($cmbProject)

  $lblAction = New-Object System.Windows.Forms.Label
  $lblAction.Text = "Action"
  $lblAction.Location = New-Object System.Drawing.Point(15,60)
  $lblAction.AutoSize = $true
  $form.Controls.Add($lblAction)

  $cmbAction = New-Object System.Windows.Forms.ComboBox
  $cmbAction.DropDownStyle = 'DropDownList'
  $cmbAction.Location = New-Object System.Drawing.Point(150,56)
  $cmbAction.Size = New-Object System.Drawing.Size(250,22)
  @('Push','Pull','Version','Open','Deploy','PullVersion','RestoreVersion','ListDeployments','ReassignDeployment') | ForEach-Object { [void]$cmbAction.Items.Add($_) }
  $cmbAction.SelectedIndex = 0
  $form.Controls.Add($cmbAction)

  $lblVersion = New-Object System.Windows.Forms.Label
  $lblVersion.Text = "Nom / Desc. version"
  $lblVersion.Location = New-Object System.Drawing.Point(15,100)
  $lblVersion.AutoSize = $true
  $form.Controls.Add($lblVersion)

  $txtVersion = New-Object System.Windows.Forms.TextBox
  $txtVersion.Location = New-Object System.Drawing.Point(150,96)
  $txtVersion.Size = New-Object System.Drawing.Size(250,22)
  $txtVersion.Enabled = $false
  $form.Controls.Add($txtVersion)

  $lblVerNum = New-Object System.Windows.Forms.Label
  $lblVerNum.Text = "N° version"
  $lblVerNum.Location = New-Object System.Drawing.Point(15,130)
  $lblVerNum.AutoSize = $true
  $form.Controls.Add($lblVerNum)

  $txtVerNum = New-Object System.Windows.Forms.TextBox
  $txtVerNum.Location = New-Object System.Drawing.Point(150,126)
  $txtVerNum.Size = New-Object System.Drawing.Size(120,22)
  $txtVerNum.Enabled = $false
  $form.Controls.Add($txtVerNum)

  $lblDepId = New-Object System.Windows.Forms.Label
  $lblDepId.Text = "Deployment ID"
  $lblDepId.Location = New-Object System.Drawing.Point(15,160)
  $lblDepId.AutoSize = $true
  $form.Controls.Add($lblDepId)

  $txtDepId = New-Object System.Windows.Forms.TextBox
  $txtDepId.Location = New-Object System.Drawing.Point(150,156)
  $txtDepId.Size = New-Object System.Drawing.Size(250,22)
  $txtDepId.Enabled = $false
  $form.Controls.Add($txtDepId)

  $chkForce = New-Object System.Windows.Forms.CheckBox
  $chkForce.Text = "Forcer (push)"
  $chkForce.Location = New-Object System.Drawing.Point(150,186)
  $chkForce.AutoSize = $true
  $chkForce.Checked = $true
  $form.Controls.Add($chkForce)

  $chkPushAfter = New-Object System.Windows.Forms.CheckBox
  $chkPushAfter.Text = "Pousser après restauration"
  $chkPushAfter.Location = New-Object System.Drawing.Point(270,186)
  $chkPushAfter.AutoSize = $true
  $chkPushAfter.Enabled = $false
  $form.Controls.Add($chkPushAfter)

  $btnRun = New-Object System.Windows.Forms.Button
  $btnRun.Text = "Exécuter"
  $btnRun.Location = New-Object System.Drawing.Point(150,210)
  $btnRun.Size = New-Object System.Drawing.Size(110,30)
  $form.Controls.Add($btnRun)

  $btnCancel = New-Object System.Windows.Forms.Button
  $btnCancel.Text = "Annuler"
  $btnCancel.Location = New-Object System.Drawing.Point(290,210)
  $btnCancel.Size = New-Object System.Drawing.Size(110,30)
  $form.Controls.Add($btnCancel)

  $cmbAction.Add_SelectedIndexChanged({
    $act = [string]$cmbAction.SelectedItem
    $txtVersion.Enabled = ($act -eq 'Version' -or $act -eq 'Deploy')
    $txtVerNum.Enabled = ($act -eq 'PullVersion' -or $act -eq 'RestoreVersion' -or $act -eq 'ReassignDeployment')
    $txtDepId.Enabled = ($act -eq 'ReassignDeployment')
    $chkPushAfter.Enabled = ($act -eq 'RestoreVersion')
  })

  $result = $null

  $btnCancel.Add_Click({ $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel; $form.Close() })
  $btnRun.Add_Click({
    $projInfo = $cmbProject.SelectedItem -split "`t",2
    $projPath = if ($projInfo.Length -ge 2) { $projInfo[1] } else { $root.Path }
    $action = [string]$cmbAction.SelectedItem
    $verName = [string]$txtVersion.Text
    $verNum = [string]$txtVerNum.Text
    $depId  = [string]$txtDepId.Text
    if (($action -eq 'Version' -or $action -eq 'Deploy') -and [string]::IsNullOrWhiteSpace($verName)) {
      [System.Windows.Forms.MessageBox]::Show('Veuillez saisir un nom de version / description.','Clasp Tools',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      return
    }
    if (($action -eq 'PullVersion' -or $action -eq 'RestoreVersion' -or $action -eq 'ReassignDeployment') -and [string]::IsNullOrWhiteSpace($verNum)) {
      [System.Windows.Forms.MessageBox]::Show('Veuillez saisir un numéro de version.','Clasp Tools',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      return
    }
    if ($action -eq 'ReassignDeployment' -and [string]::IsNullOrWhiteSpace($depId)) {
      [System.Windows.Forms.MessageBox]::Show('Veuillez saisir un Deployment ID.','Clasp Tools',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      return
    }
    $result = @{ Path=$projPath; Action=$action; Version=$verName; VersionNumber=$verNum; DeploymentId=$depId; Force=$chkForce.Checked; PushAfter=$chkPushAfter.Checked }
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
  })

  [void]$form.ShowDialog()
  return $result
}

function Ensure-IgnoredSnapshots($projPath){
  $ignore = Join-Path $projPath '.claspignore'
  if (Test-Path $ignore) {
    $raw = Get-Content -Raw -LiteralPath $ignore
    if ($raw -notmatch '(?m)^snapshots/\*\*') { Add-Content -Path $ignore -Value "snapshots/**" }
  } else {
    Set-Content -Path $ignore -Value "snapshots/**"
  }
}

function Run-Clasp($spec){
  if (-not $spec) { return }
  $projPath = $spec.Path
  $action = $spec.Action
  $verName = $spec.Version
  $verNum = $spec.VersionNumber
  $depId  = $spec.DeploymentId
  $force = $spec.Force
  $pushAfter = $spec.PushAfter
  Push-Location $projPath
  try {
    if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
      Write-Host "clasp n'est pas installé dans le PATH." -ForegroundColor Red
      return
    }
    switch ($action) {
      'Push'     { clasp push $(if ($force) { '-f' }) }
      'Pull'     { clasp setting fileExtension gs | Out-Null; clasp pull }
      'Version'  { clasp version $verName }
      'Open'     { clasp open }
      'Deploy'   { clasp deploy -d $verName }
      'ListDeployments' { $out = clasp deployments | Out-String; [System.Windows.Forms.MessageBox]::Show($out,'Deployments') | Out-Null }
      'ReassignDeployment' {
         $desc = if ($verName -ne '') { $verName } else { "Reassign to $verNum" }
         clasp deploy --deploymentId $depId -i $verNum -d $desc
      }
      'PullVersion' {
         if (-not $verNum) { throw 'Numéro de version requis' }
         clasp setting fileExtension gs | Out-Null
         $snap = Join-Path $projPath ("snapshots/v{0}" -f $verNum)
         New-Item -ItemType Directory -Force -Path $snap | Out-Null
         clasp setting rootDir (Resolve-Path $snap) | Out-Null
         clasp pull --versionNumber $verNum
         clasp setting rootDir ./ | Out-Null
         Ensure-IgnoredSnapshots $projPath
         [System.Windows.Forms.MessageBox]::Show(("Version {0} clonée dans {1}" -f $verNum,$snap),"PullVersion") | Out-Null
      }
      'RestoreVersion' {
         if (-not $verNum) { throw 'Numéro de version requis' }
         clasp setting fileExtension gs | Out-Null
         $snap = Join-Path $projPath ("snapshots/v{0}" -f $verNum)
         New-Item -ItemType Directory -Force -Path $snap | Out-Null
         clasp setting rootDir (Resolve-Path $snap) | Out-Null
         clasp pull --versionNumber $verNum
         clasp setting rootDir ./ | Out-Null
         # Remplacer fichiers racine par snapshot
         Get-ChildItem -Path $projPath -File -Include *.gs,*.html,appsscript.json | Remove-Item -Force -ErrorAction SilentlyContinue
         Copy-Item -Path (Join-Path $snap "*") -Destination $projPath -Force -Recurse
         Ensure-IgnoredSnapshots $projPath
         if ($pushAfter) { clasp push -f }
         $msg = if ($pushAfter) { ("Version {0} restaurée depuis {1} et poussée." -f $verNum,$snap) } else { ("Version {0} restaurée depuis {1}." -f $verNum,$snap) }
         [System.Windows.Forms.MessageBox]::Show($msg,"RestoreVersion") | Out-Null
      }
      default    { Write-Host "Action inconnue: $action" -ForegroundColor Red }
    }
  } finally { Pop-Location }
}

$spec = New-Form
Run-Clasp $spec
