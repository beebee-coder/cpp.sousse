
#!/bin/bash

# VisioNode Desktop Forge Engine v3.0
# Phase de transformation réelle pour environnement Windows x64.
# Ce script prépare l'environnement pour la compilation native Tauri.

echo "🚀 INITIATING REAL DESKTOP TRANSFORMATION..."
echo "📦 Target Architecture: Windows x64 (MSI/EXE)"
echo "------------------------------------------"

# 1. Validation de l'environnement physique
echo "🛠️  Checking Build Environment..."
export TAURI_ENV=true

if ! command -v cargo &> /dev/null; then
    echo "❌ ERROR: Rust/Cargo not found."
    echo "💡 Note: La forge réelle nécessite Rust. Si vous êtes en environnement Cloud,"
    echo "   utilisez le bouton 'Push' pour déclencher la forge sur GitHub Actions."
    exit 1
fi

# 2. Nettoyage radical
echo "🧹 Cleaning workspace..."
rm -rf out .next src-tauri/target
echo "✅ Workspace cleaned."

# 3. Phase de Forge Statique (Next.js)
echo "🔨 Building Next.js static engine (Export Mode)..."
npm run build:tauri

if [ ! -d "out" ]; then
    echo "❌ ERROR: Next.js failed to generate 'out' directory."
    exit 1
fi
echo "✅ Static engine forged in /out"

# 4. Phase de Compilation Native (Tauri)
echo "🏗️  Starting Native Rust Compilation (Production)..."
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
