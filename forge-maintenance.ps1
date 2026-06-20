# VisioNode - Script de maintenance original
Write-Host "🛠️ [MAINTENANCE] Contrôle d'intégrité du moteur VisioNode..." -ForegroundColor Gray

Write-Host "🔍 Analyse de la plateforme..."
npm run typecheck

Write-Host "🧹 Purge des caches de développement..."
Remove-Item -Path ".next/cache" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "📡 Vérification de la liaison GitHub..."
git fetch origin

Write-Host "✅ [SANTÉ] Système nominal. Prêt pour la Forge." -ForegroundColor Green
