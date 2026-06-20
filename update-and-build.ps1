# VisioNode - Mise à jour complète + Build + Release
Write-Host "🚀 [PIPELINE_FULL] Initialisation de la maintenance complète..." -ForegroundColor Cyan

# 1. Nettoyage
Write-Host "🧹 Nettoyage des artefacts..."
Remove-Item -Path "out", ".next", "src-tauri/target" -Recurse -Force -ErrorAction SilentlyContinue

# 2. Dépendances
Write-Host "📦 Mise à jour des modules..."
npm install

# 3. Build Web & Desktop
Write-Host "🔨 Lancement de la Forge (Statique & Native)..."
npm run desktop:build

# 4. Release Optionnelle
$release = Read-Host "Voulez-vous synchroniser avec le registre distant ? (y/n)"
if ($release -eq "y") {
    Write-Host "📡 Synchronisation du registre..."
    ./sync.sh web
}

Write-Host "✅ [SUCCÈS] Opération terminée." -ForegroundColor Green
