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
  $cmbProject.Items.Add("Projet 1 (Racine)``t$($root.Path)") | Out-Null
  if (Test-Path $p2) { $cmbProject.Items.Add("Projet 2 (Projet2)``t$($p2)") | Out-Null }
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
  @('Push','Pull','Version') | ForEach-Object { [void]$cmbAction.Items.Add($_) }
  $cmbAction.SelectedIndex = 0
  $form.Controls.Add($cmbAction)

  $lblVersion = New-Object System.Windows.Forms.Label
  $lblVersion.Text = "Nom de version"
  $lblVersion.Location = New-Object System.Drawing.Point(15,100)
  $lblVersion.AutoSize = $true
  $form.Controls.Add($lblVersion)

  $txtVersion = New-Object System.Windows.Forms.TextBox
  $txtVersion.Location = New-Object System.Drawing.Point(150,96)
  $txtVersion.Size = New-Object System.Drawing.Size(250,22)
  $txtVersion.Enabled = $false
  $form.Controls.Add($txtVersion)

  $chkForce = New-Object System.Windows.Forms.CheckBox
  $chkForce.Text = "Forcer (push)"
  $chkForce.Location = New-Object System.Drawing.Point(150,130)
  $chkForce.AutoSize = $true
  $chkForce.Checked = $true
  $form.Controls.Add($chkForce)

  $btnRun = New-Object System.Windows.Forms.Button
  $btnRun.Text = "Exécuter"
  $btnRun.Location = New-Object System.Drawing.Point(150,170)
  $btnRun.Size = New-Object System.Drawing.Size(110,30)
  $form.Controls.Add($btnRun)

  $btnCancel = New-Object System.Windows.Forms.Button
  $btnCancel.Text = "Annuler"
  $btnCancel.Location = New-Object System.Drawing.Point(290,170)
  $btnCancel.Size = New-Object System.Drawing.Size(110,30)
  $form.Controls.Add($btnCancel)

  $cmbAction.Add_SelectedIndexChanged({
    $txtVersion.Enabled = ($cmbAction.SelectedItem -eq 'Version')
  })

  $result = $null

  $btnCancel.Add_Click({ $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel; $form.Close() })
  $btnRun.Add_Click({
    $projInfo = $cmbProject.SelectedItem -split "`t",2
    $projPath = if ($projInfo.Length -ge 2) { $projInfo[1] } else { $root.Path }
    $action = [string]$cmbAction.SelectedItem
    $verName = [string]$txtVersion.Text
    if ($action -eq 'Version' -and [string]::IsNullOrWhiteSpace($verName)) {
      [System.Windows.Forms.MessageBox]::Show('Veuillez saisir un nom de version.','Clasp Tools',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      return
    }
    $result = @{ Path=$projPath; Action=$action; Version=$verName; Force=$chkForce.Checked }
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
  })

  [void]$form.ShowDialog()
  return $result
}

function Run-Clasp($spec){
  if (-not $spec) { return }
  $projPath = $spec.Path
  $action = $spec.Action
  $verName = $spec.Version
  $force = $spec.Force
  Push-Location $projPath
  try {
    if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
      Write-Host 'clasp n\'est pas installé dans le PATH.' -ForegroundColor Red
      return
    }
    switch ($action) {
      'Push'    { clasp push $(if ($force) { '-f' }) }
      'Pull'    { clasp setting fileExtension gs | Out-Null; clasp pull }
      'Version' { clasp version $verName }
      default   { Write-Host "Action inconnue: $action" -ForegroundColor Red }
    }
  } finally { Pop-Location }
}

$spec = New-Form
Run-Clasp $spec

