#!/bin/bash

# VisioNode Precision Sync Engine v2.6
# Optimized for Hybrid Transformation Pipelines with robust error handling

REPO_URL="https://github.com/beebee-coder/cpp.sousse.git"
BRANCH="main"
MODE=${1:-"web"} 

echo "🚀 VisioNode Sync Engine"
echo "🛠️  Pipeline Mode: ${MODE^^}"
echo "------------------------------------------"

# 1. Identity & Environment
git config user.email "uplink-bot@visionode.precision"
git config user.name "VisioNode Precision Bot"

if [ -n "$GITHUB_TOKEN" ]; then
    CLEAN_URL=$(echo "$REPO_URL" | sed 's|https://||')
    AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@${CLEAN_URL}"
    git remote set-url origin "$AUTH_URL" 2>/dev/null || git remote add origin "$AUTH_URL"
fi

# 2. Logic Check
if [ "$MODE" == "desktop" ]; then
    echo "🔍 Mode: DESKTOP FORGE"
    COMMIT_PREFIX="[DESKTOP_FORGE]"
else
    echo "🔍 Mode: WEB UPLINK"
    COMMIT_PREFIX="[WEB_UPLINK]"
fi

# 3. Forced Staging
echo "📦 Staging all files..."
git add .

TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")

COMMIT_MSG="$COMMIT_PREFIX v$VERSION - Sync Session ($TIMESTAMP)"

# Only commit if there are changes
if git diff-index --quiet HEAD --; then
    echo "ℹ️ Registry already synchronized. No new changes detected."
else
    echo "💾 Committing changes: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
fi

# 4. Physical Uplink
# We redirect stderr to stdout for the push to prevent false 'Critical Error' flags in the UI,
# but we preserve the exit code.
echo "📡 Initiating physical transfer to $BRANCH..."
git fetch origin "$BRANCH" 2>/dev/null
git push origin "$BRANCH" --force 2>&1

PUSH_STATUS=$?

if [ $PUSH_STATUS -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ ${MODE^^} Uplink Successful!"
    echo "🔗 Registry updated at: $REPO_URL"
else
    echo "------------------------------------------"
    echo "❌ Uplink failed with exit code $PUSH_STATUS."
    exit 1
fi
