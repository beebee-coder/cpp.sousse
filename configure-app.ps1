
# 🚀 VisioNode - Script de Configuration Initiale
# Ce script prépare l'environnement local après l'installation.

$timestamp = Get-Date -Format "HH:mm:ss"
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host "🛠️ [$timestamp] INITIALISATION COPILOTE-CCPE" -ForegroundColor Cyan
Write-Host "------------------------------------------"

$envExample = ".env.example"
$envFile = ".env"

if (Test-Path $envFile) {
    Write-Host "✅ Fichier .env déjà présent. Prêt pour le pilotage." -ForegroundColor Green
} else {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "📝 Fichier .env créé à partir de l'exemple." -ForegroundColor Yellow
        Write-Host "⚠️  ACTION REQUISE : Veuillez éditer le fichier .env avec vos clés API." -ForegroundColor Red
        Write-Host "📂 Emplacement : $(Get-Location)\$envFile" -ForegroundColor Gray
    } else {
        Write-Host "❌ Erreur : .env.example introuvable." -ForegroundColor Red
    }
}

Write-Host "------------------------------------------"
Write-Host "🚀 Configuration terminée. Lancez VisioNode.exe" -ForegroundColor Green
