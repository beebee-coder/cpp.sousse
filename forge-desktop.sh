#!/bin/bash

# VisioNode Desktop Forge Engine v2.6
# Transformation de l'environnement Next.js en moteur statique hybride haute performance

echo "🚀 INITIATING DESKTOP TRANSFORMATION..."
echo "📦 Target Architecture: Windows x64 Bundle"
echo "------------------------------------------"

# 1. Validation de l'environnement
echo "🛠️  Configuring Build Environment..."
export TAURI_ENV=true

if ! command -v cargo &> /dev/null; then
    echo "❌ ERROR: Rust/Cargo not found. Required for Tauri Forge."
    exit 1
fi

# 2. Nettoyage des artefacts (Clean Phase)
echo "🧹 Cleaning previous build artifacts..."
rm -rf out .next src-tauri/target
echo "✅ Workspace cleaned."

# 3. Phase de Forge Statique (Next.js)
echo "🔨 Building Next.js static engine (Export Mode)..."
npm run build:tauri

if [ ! -d "out" ]; then
    echo "❌ ERROR: Next.js failed to generate 'out' directory."
    echo "⚠️  Checking for fallback..."
    if [ -d ".next" ]; then
        echo "✅ '.next' found. Forcing rename to 'out'..."
        mv .next out
    else
        echo "❌ ERROR: No build output found. Aborting."
        exit 1
    fi
fi
echo "✅ Static engine forged in /out"

# 4. Phase de Compilation Native (Tauri)
echo "🏗️  Starting Native Rust Compilation..."
npx tauri build

if [ $? -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ FORGE SUCCESSFUL!"
    echo "📂 Installers: src-tauri/target/release/bundle/"
else
    echo "------------------------------------------"
    echo "❌ FORGE FAILED. Check Rust compiler logs."
    exit 1
fi
