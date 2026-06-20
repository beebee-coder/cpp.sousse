#!/bin/bash

# VisioNode Desktop Forge Engine v2.5
# Transformation de l'environnement Next.js en moteur statique hybride haute performance

echo "🚀 INITIATING DESKTOP TRANSFORMATION..."
echo "📦 Target Architecture: Windows x64 Bundle"
echo "------------------------------------------"

# 1. Gestion de la version
echo "🔢 Incrementing application version..."
npm version patch --no-git-tag-version

# 2. Nettoyage des artefacts (Clean Phase)
echo "🧹 Cleaning previous build artifacts..."
rm -rf out .next src-tauri/target
echo "✅ Workspace cleaned."

# 3. Validation de l'environnement
echo "🛠️  Configuring Build Environment..."
export TAURI_ENV=true

# 4. Phase de Forge Statique (Next.js)
echo "🔨 Building Next.js static engine (Export Mode)..."
npm run build:tauri

if [ ! -d "out" ]; then
    echo "❌ ERROR: Next.js failed to generate 'out' directory. Check for SSR dependencies."
    echo "⚠️  Checking if '.next' exists instead..."
    if [ -d ".next" ]; then
        echo "✅ '.next' found. Creating symbolic link 'out' -> '.next'..."
        ln -sf .next out
        echo "✅ Symbolic link created."
    else
        echo "❌ ERROR: No build output found."
        exit 1
    fi
fi
echo "✅ Static engine forged in /out"

# 5. Phase de Compilation Native (Tauri)
echo "🏗️  Starting Native Rust Compilation..."
echo "⏳ This process may take 5-10 minutes..."
npx tauri build

if [ $? -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ FORGE SUCCESSFUL!"
    echo "📂 Installers ready in src-tauri/target/release/bundle/"
    echo ""
    echo "📁 Generated files:"
    ls -lh src-tauri/target/release/bundle/nsis/*.exe 2>/dev/null || echo "   ⚠️  No .exe files found"
    ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null || echo "   ⚠️  No .msi files found"
else
    echo "------------------------------------------"
    echo "❌ FORGE FAILED. Check Rust compiler logs for details."
    exit 1
fi

echo ""
echo "✨ VisioNode Desktop ready for distribution!"