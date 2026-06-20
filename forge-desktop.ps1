# forge-desktop.ps1
# VisioNode Desktop Forge Engine v2.5 - Windows Edition
# CCP Industrial Vision

Write-Host "🚀 INITIATING DESKTOP TRANSFORMATION..." -ForegroundColor Cyan
Write-Host "📦 Target Architecture: Windows x64 Bundle" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Gray

# 1. Gestion de la version
Write-Host "`n🔢 Incrementing application version..." -ForegroundColor Yellow
npm version patch --no-git-tag-version

# 2. Nettoyage des artefacts (Clean Phase)
Write-Host "`n🧹 Cleaning previous build artifacts..." -ForegroundColor Yellow
if (Test-Path "out") { Remove-Item -Recurse -Force out }
if (Test-Path ".next") { Remove-Item -Recurse -Force .next }
if (Test-Path "src-tauri/target") { Remove-Item -Recurse -Force src-tauri/target }
Write-Host "✅ Workspace cleaned." -ForegroundColor Green

# 3. Validation de l'environnement
Write-Host "`n🛠️  Configuring Build Environment..." -ForegroundColor Yellow
$env:TAURI_ENV = "true"
Write-Host "✅ Environment set: TAURI_ENV=$env:TAURI_ENV" -ForegroundColor Green

# 4. Phase de Forge Statique (Next.js)
Write-Host "`n🔨 Building Next.js static engine (Export Mode)..." -ForegroundColor Yellow
npm run build:tauri

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Next.js build failed. Check logs." -ForegroundColor Red
    Read-Host "`nAppuyez sur Entrée pour fermer"
    exit 1
}

if (-not (Test-Path "out")) {
    Write-Host "❌ ERROR: Next.js failed to generate 'out' directory." -ForegroundColor Red
    Write-Host "⚠️  Checking if '.next' exists instead..." -ForegroundColor Yellow
    if (Test-Path ".next") {
        Write-Host "✅ '.next' found. Creating symbolic link 'out' -> '.next'..." -ForegroundColor Yellow
        New-Item -ItemType Junction -Path "out" -Target ".next" -Force | Out-Null
        Write-Host "✅ Symbolic link created." -ForegroundColor Green
    } else {
        Write-Host "❌ ERROR: No build output found." -ForegroundColor Red
        Read-Host "`nAppuyez sur Entrée pour fermer"
        exit 1
    }
}
Write-Host "✅ Static engine ready" -ForegroundColor Green

# 5. Phase de Compilation Native (Tauri)
Write-Host "`n🏗️  Starting Native Rust Compilation..." -ForegroundColor Yellow
Write-Host "⏳ Ce processus peut prendre 5-10 minutes..." -ForegroundColor Gray
Write-Host "⚠️  Ne fermez pas cette fenêtre !" -ForegroundColor Red

npx tauri build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n------------------------------------------" -ForegroundColor Gray
    Write-Host "✅ FORGE SUCCESSFUL!" -ForegroundColor Green
    Write-Host "📂 Installers ready in src-tauri/target/release/bundle/" -ForegroundColor Cyan
    
    Write-Host "`n📁 Fichiers générés :" -ForegroundColor Yellow
    
    $exeFiles = Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue
    if ($exeFiles) {
        foreach ($file in $exeFiles) {
            $size = [math]::Round($file.Length / 1MB, 2)
            Write-Host "   ✅ EXE : $($file.Name) ($size MB)" -ForegroundColor Green
        }
    } else {
        Write-Host "   ⚠️  Aucun fichier .exe trouvé" -ForegroundColor Yellow
    }
    
    $msiFiles = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        foreach ($file in $msiFiles) {
            $size = [math]::Round($file.Length / 1MB, 2)
            Write-Host "   ✅ MSI : $($file.Name) ($size MB)" -ForegroundColor Green
        }
    } else {
        Write-Host "   ⚠️  Aucun fichier .msi trouvé" -ForegroundColor Yellow
    }
    
    Write-Host "`n📂 Chemins complets :" -ForegroundColor Cyan
    Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "   📁 $($_.FullName)" -ForegroundColor Gray
    }
    Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "   📁 $($_.FullName)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n------------------------------------------" -ForegroundColor Gray
    Write-Host "❌ FORGE FAILED. Check Rust compiler logs for details." -ForegroundColor Red
    Read-Host "`nAppuyez sur Entrée pour fermer"
    exit 1
}

Write-Host "`n✨ VisioNode Desktop ready for distribution !" -ForegroundColor Cyan
Write-Host "`n" -ForegroundColor Yellow
Read-Host "Appuyez sur Entrée pour fermer"