
#!/bin/bash

# VisioNode Desktop Forge Engine v2.0
echo "🚀 INITIATING DESKTOP TRANSFORMATION..."
echo "📦 Target Architecture: Windows Installer (MSI/EXE)"

# 1. Workspace Preparation
echo "🧹 Cleaning previous build artifacts..."
rm -rf out
rm -rf src-tauri/target

# 2. Dependency & Environment Validation
export TAURI_ENV=true
echo "🛠️  Environment set: TAURI_ENV=$TAURI_ENV"

if ! command -v cargo &> /dev/null; then
    echo "❌ ERROR: Rust/Cargo not found. Required for Tauri Forge."
    exit 1
fi

# 3. Next.js Static Engine Forge
echo "🔨 Building Next.js static engine (Export Mode)..."
npm run build

if [ ! -d "out" ]; then
    echo "❌ ERROR: Next.js failed to generate 'out' directory."
    exit 1
fi

echo "✅ Static engine forged in /out"

# 4. Tauri Desktop Bundle
echo "🏗️  Starting Tauri Desktop Bundle process..."
npm run tauri build

if [ $? -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ FORGE SUCCESSFUL!"
    echo "📂 Installers: src-tauri/target/release/bundle/"
else
    echo "❌ FORGE FAILED. Check Rust compiler logs for details."
    exit 1
fi
