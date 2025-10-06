# Script PowerShell para probar cambios locales de cdkless en un proyecto objetivo
# Este script automatiza el proceso de build, empaquetado e instalación local
# Uso: .\test-local-changes.ps1 "C:\ruta\a\tu\proyecto"
# Para más información, consulta DEVELOPMENT.md

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

Write-Host "🔨 Building cdkless..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Packing cdkless..." -ForegroundColor Cyan
$tgzFile = npm pack 2>&1 | Select-Object -Last 1

if (-not $tgzFile -or $tgzFile -notmatch "\.tgz$") {
    Write-Host "❌ Pack failed or .tgz file not found!" -ForegroundColor Red
    Write-Host "Output was: $tgzFile" -ForegroundColor Gray
    exit 1
}

$tgzFile = $tgzFile.Trim()

Write-Host "✅ Package created: $tgzFile" -ForegroundColor Green

Write-Host ""
Write-Host "📍 Installing in project: $ProjectPath" -ForegroundColor Cyan

if (-not (Test-Path $ProjectPath)) {
    Write-Host "❌ Project path not found: $ProjectPath" -ForegroundColor Red
    exit 1
}

Push-Location $ProjectPath

# Desinstalar versión anterior si existe
npm uninstall cdkless 2>$null

# Instalar versión local
$cdklessPath = Join-Path $PSScriptRoot $tgzFile
Write-Host "Installing from: $cdklessPath" -ForegroundColor Gray
npm install $cdklessPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ cdkless local version installed successfully in your project!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Now you can test your local changes in the target project." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🧪 Suggested commands to run in your project:" -ForegroundColor Cyan
    Write-Host "  - npm install         (to ensure dependencies are linked)" -ForegroundColor White
    Write-Host "  - npm run build         (to compile your project with the new library)" -ForegroundColor White
    Write-Host "  - npm run cdk synth     (to see the generated CloudFormation)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host "💡 When you're done testing, restore the official version in your project:" -ForegroundColor Gray
Write-Host "   npm uninstall cdkless && npm install cdkless" -ForegroundColor Gray
Write-Host ""

