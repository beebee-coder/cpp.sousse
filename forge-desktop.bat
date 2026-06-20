@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 INITIATING DESKTOP TRANSFORMATION...
echo 📦 Target Architecture: Windows x64 Bundle
echo ------------------------------------------

echo.
echo 🔢 Incrementing application version...
call npm version patch --no-git-tag-version

echo.
echo 🧹 Cleaning previous build artifacts...
if exist out rmdir /s /q out
if exist .next rmdir /s /q .next
if exist src-tauri\target rmdir /s /q src-tauri\target
echo ✅ Workspace cleaned.

echo.
echo 🛠️  Configuring Build Environment...
set TAURI_ENV=true
echo ✅ Environment set: TAURI_ENV=%TAURI_ENV%

echo.
echo 🔨 Building Next.js static engine (Export Mode)...
call npm run build:tauri

if %errorlevel% neq 0 (
    echo ❌ ERROR: Next.js build failed.
    pause
    exit /b 1
)

if not exist out (
    echo ⚠️  Dossier 'out' non trouvé. Vérification de .next...
    if exist .next (
        echo ✅ Dossier .next trouvé, création d'un lien symbolique...
        mklink /J out .next >nul 2>&1
        echo ✅ Lien symbolique créé
    ) else (
        echo ❌ ERROR: Next.js failed to generate build output.
        pause
        exit /b 1
    )
) else (
    echo ✅ Static engine forged in /out
)

echo.
echo 🏗️  Starting Native Rust Compilation...
echo ⏳ Ce processus peut prendre 5-10 minutes...
echo ⚠️  Ne fermez pas cette fenêtre !

call npx tauri build

if %errorlevel% equ 0 (
    echo.
    echo -----------------------------------------
    echo ✅ FORGE SUCCESSFUL!
    echo 📂 Installers ready in src-tauri/target/release/bundle/
    echo.
    echo 📁 Fichiers générés :
    if exist src-tauri\target\release\bundle\nsis\*.exe (
        for %%f in (src-tauri\target\release\bundle\nsis\*.exe) do (
            echo    ✅ EXE : %%~nxf
        )
    ) else (
        echo    ⚠️  Aucun fichier .exe trouvé
    )
    if exist src-tauri\target\release\bundle\msi\*.msi (
        for %%f in (src-tauri\target\release\bundle\msi\*.msi) do (
            echo    ✅ MSI : %%~nxf
        )
    ) else (
        echo    ⚠️  Aucun fichier .msi trouvé
    )
) else (
    echo.
    echo -----------------------------------------
    echo ❌ FORGE FAILED. Check Rust compiler logs for details.
    pause
    exit /b 1
)

echo.
echo ✨ VisioNode Desktop ready for distribution !
pause