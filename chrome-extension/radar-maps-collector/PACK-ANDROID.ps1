$ErrorActionPreference = "Stop"

$ExtensionRoot = $PSScriptRoot
$ParentDir = Split-Path $ExtensionRoot -Parent
$FolderName = Split-Path $ExtensionRoot -Leaf
$VersionFile = Join-Path $ExtensionRoot "VERSION"
$Version = if (Test-Path $VersionFile) { (Get-Content $VersionFile -Raw).Trim() } else { "dev" }

$Candidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
  "${env:LOCALAPPDATA}\Microsoft\Edge SxS\Application\msedge.exe",
  "${env:LOCALAPPDATA}\Microsoft\Edge Beta\Application\msedge.exe",
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $Candidates -or $Candidates.Count -eq 0) {
  throw "Microsoft Edge ou Google Chrome não encontrado neste Windows."
}

$Browser = $Candidates[0]
$KeyDir = Join-Path $env:LOCALAPPDATA "RadarLocal\Keys"
$KeyFile = Join-Path $KeyDir "radar-maps-collector.pem"
New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null

$GeneratedCrx = Join-Path $ParentDir "$FolderName.crx"
$GeneratedPem = Join-Path $ParentDir "$FolderName.pem"

Remove-Item $GeneratedCrx -Force -ErrorAction SilentlyContinue

Write-Host "Empacotando Radar Local $Version..."
Write-Host "Browser: $Browser"

if (Test-Path $KeyFile) {
  & $Browser "--pack-extension=$ExtensionRoot" "--pack-extension-key=$KeyFile"
} else {
  Remove-Item $GeneratedPem -Force -ErrorAction SilentlyContinue
  & $Browser "--pack-extension=$ExtensionRoot"
  if (Test-Path $GeneratedPem) {
    Move-Item $GeneratedPem $KeyFile -Force
    Write-Host "Chave privada salva fora do repositório em: $KeyFile"
  }
}

$Deadline = (Get-Date).AddSeconds(20)
while (-not (Test-Path $GeneratedCrx) -and (Get-Date) -lt $Deadline) {
  Start-Sleep -Milliseconds 300
}

if (-not (Test-Path $GeneratedCrx)) {
  throw "O navegador não gerou o CRX. Abra edge://extensions no desktop, ative o Modo do desenvolvedor e use 'Empacotar extensão' nesta pasta."
}

$Downloads = Join-Path $env:USERPROFILE "Downloads"
$Output = Join-Path $Downloads "radar-local-$Version-android.crx"
Copy-Item $GeneratedCrx $Output -Force

Write-Host ""
Write-Host "CRX pronto para o Android:"
Write-Host $Output
Write-Host ""
Write-Host "No Edge Canary Android: Configurações > Sobre o Microsoft Edge > toque 5x no número da versão > Opções do desenvolvedor > Extension install by crx."
