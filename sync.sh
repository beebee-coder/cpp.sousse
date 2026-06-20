
#!/bin/bash

# VisioNode Precision Sync Engine v2.7
# Support hybride complet : web (uplink), desktop (forge), pull (downlink)

REPO_URL="https://github.com/beebee-coder/cpp.sousse.git"
BRANCH="main"
MODE=${1:-"web"} 

echo "🚀 VisioNode Sync Engine"
echo "🛠️  Mode Pipeline : ${MODE^^}"
echo "------------------------------------------"

# 1. Identity & Environment
git config user.email "uplink-bot@visionode.precision"
git config user.name "VisioNode Precision Bot"

if [ -n "$GITHUB_TOKEN" ]; then
    CLEAN_URL=$(echo "$REPO_URL" | sed 's|https://||')
    AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@${CLEAN_URL}"
    git remote set-url origin "$AUTH_URL" 2>/dev/null || git remote add origin "$AUTH_URL"
fi

# 2. Logique de Mode
if [ "$MODE" == "pull" ]; then
    echo "📡 Initiation DOWNLINK depuis Registre..."
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    echo "✅ Downlink Successful!"
    exit 0
fi

if [ "$MODE" == "desktop" ]; then
    echo "🏗️  Initiation FORGE DESKTOP..."
    # Note: On laisse le script forge-desktop.sh ou tauri gérer le build lourd
    echo "📦 Staging current state for build traceability..."
fi

# 3. Forced Staging (Uplink / Web)
echo "📦 Analyse des modifications..."
git add .

TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
COMMIT_MSG="[${MODE^^}_SESSION] v1.0 - Sync ($TIMESTAMP)"

if git diff-index --quiet HEAD --; then
    echo "ℹ️ Registre déjà synchronisé."
else
    echo "💾 Création du point de restauration : $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
fi

# 4. physical transfer
echo "📡 Transmission vers $BRANCH..."
git fetch origin "$BRANCH" 2>/dev/null
git push origin "$BRANCH" --force 2>&1

PUSH_STATUS=$?

if [ $PUSH_STATUS -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ ${MODE^^} Uplink Successful!"
    echo "🔗 Registre à jour : $REPO_URL"
else
    echo "------------------------------------------"
    echo "❌ Échec de transmission (Code $PUSH_STATUS)."
    exit 1
fi
