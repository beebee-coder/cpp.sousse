#!/bin/bash

# VisioNode Desktop Forge Engine v2.7
# Transformation de l'environnement Next.js en moteur statique hybride haute performance
# Support du mode SIMULATION pour le prototypage en environnement Cloud.

echo "🚀 INITIATING DESKTOP TRANSFORMATION..."
echo "📦 Target Architecture: Windows x64 Bundle"
echo "------------------------------------------"

# 1. Validation de l'environnement
echo "🛠️  Configuring Build Environment..."
export TAURI_ENV=true

if ! command -v cargo &> /dev/null; then
    if [ "$FORGE_SIMULATION" = "true" ]; then
        echo "⚠️  WARNING: Rust/Cargo not found."
        echo "🧪 SIMULATION MODE ACTIVE: Proceeding with virtual forge..."
    else
        echo "❌ ERROR: Rust/Cargo not found. Required for Tauri Forge."
        echo "💡 Tip: Install Rust from https://rustup.rs or enable FORGE_SIMULATION."
        exit 1
    fi
fi

# 2. Nettoyage des artefacts (Clean Phase)
echo "🧹 Cleaning previous build artifacts..."
rm -rf out .next src-tauri/target
echo "✅ Workspace cleaned."

# 3. Phase de Forge Statique (Next.js)
echo "🔨 Building Next.js static engine (Export Mode)..."

if [ "$FORGE_SIMULATION" = "true" ]; then
    echo "⚡ [SIM] Mocking Next.js Export..."
    mkdir -p out
    echo "<html><body>VisioNode Simulation</body></html>" > out/index.html
    sleep 1
else
    npm run build:tauri
fi

if [ ! -d "out" ]; then
    echo "❌ ERROR: Next.js failed to generate 'out' directory."
    exit 1
fi
echo "✅ Static engine forged in /out"

# 4. Phase de Compilation Native (Tauri)
echo "🏗️  Starting Native Rust Compilation..."

if [ "$FORGE_SIMULATION" = "true" ]; then
    echo "⚡ [SIM] Compiling Rust components (Native Bridge)..."
    sleep 2
    echo "⚡ [SIM] Generating MSI/EXE installers..."
    mkdir -p src-tauri/target/release/bundle/msi
    touch src-tauri/target/release/bundle/msi/VisioNode_Simulated.msi
    sleep 1
    echo "------------------------------------------"
    echo "✅ SIMULATED FORGE SUCCESSFUL!"
    echo "📂 Virtual Installers ready in src-tauri/target/"
else
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
fi