# release-tagger.ps1
# VisioNode Release Tagger v2.0 - Processus de Release Automatisé

Write-Host "🏷️  VISIONODE - PROCESSUS DE RELEASE" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "📅 $(Get-Date -Format 'dd/MM/yyyy HH:mm')" -ForegroundColor Gray

# 1. Vérification des modifications non commitées
Write-Host "`n🔍 Étape 1: Vérification du workspace..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  Des modifications non commitées sont détectées :" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
    $continue = Read-Host "Voulez-vous les inclure dans cette release ? (Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        Write-Host "❌ Release annulée" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Workspace vérifié" -ForegroundColor Green

# 2. Choisir le type d'incrémentation
Write-Host "`n📊 Étape 2: Type d'incrémentation..." -ForegroundColor Yellow
Write-Host "   - 1: Patch (x.x.X) - Correction de bug" -ForegroundColor Gray
Write-Host "   - 2: Minor (x.X.0) - Nouvelle fonctionnalité" -ForegroundColor Gray
Write-Host "   - 3: Major (X.0.0) - Changement majeur" -ForegroundColor Gray
$incrementType = Read-Host "Votre choix (1-3)"

$incrementMap = @{
    "1" = "patch"
    "2" = "minor" 
    "3" = "major"
}
$increment = $incrementMap[$incrementType]

if (-not $increment) {
    Write-Host "❌ Choix invalide" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type sélectionné : $increment" -ForegroundColor Green

# 3. Incrémentation de la version
Write-Host "`n🔢 Étape 3: Incrémentation de la version ($increment)..." -ForegroundColor Yellow
$oldVersion = node -p "require('./package.json').version"
npm version $increment --no-git-tag-version

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'incrémentation" -ForegroundColor Red
    exit 1
}
$newVersion = node -p "require('./package.json').version"
Write-Host "✅ Version : $oldVersion → $newVersion" -ForegroundColor Green

# 4. Mise à jour de tauri.conf.json (si présent)
Write-Host "`n📝 Étape 4: Mise à jour des fichiers de configuration..." -ForegroundColor Yellow
if (Test-Path "src-tauri/tauri.conf.json") {
    $tauriConfig = Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json
    $tauriConfig.version = $newVersion
    $tauriConfig | ConvertTo-Json -Depth 10 | Set-Content "src-tauri/tauri.conf.json"
    Write-Host "✅ tauri.conf.json mis à jour (version $newVersion)" -ForegroundColor Green
}

# 5. Demander un message de release
Write-Host "`n📝 Étape 5: Message de release..." -ForegroundColor Yellow
Write-Host "   Entrez une description des changements (ou laissez vide)" -ForegroundColor Gray
$releaseMessage = Read-Host "Message"
if ($releaseMessage -eq "") {
    $releaseMessage = "Release VisioNode v$newVersion"
}

# 6. Commit des changements
Write-Host "`n📦 Étape 6: Commit des changements..." -ForegroundColor Yellow
git add .
git commit -m "[RELEASE] VisioNode v$newVersion - $releaseMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du commit" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Commit effectué" -ForegroundColor Green

# 7. Création du tag
Write-Host "`n🏷️ Étape 7: Création du tag..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$tagName = "v$newVersion"
$tagFullName = "$tagName-build-$timestamp"

git tag -a $tagFullName -m "Release VisioNode v$newVersion ($timestamp) - $releaseMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la création du tag" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Tag créé : $tagFullName" -ForegroundColor Green

# 8. Push sur GitHub
Write-Host "`n📡 Étape 8: Push sur GitHub..." -ForegroundColor Yellow
git push origin main --tags

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du push" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Push effectué" -ForegroundColor Green

# 9. Résumé
Write-Host "`n--------------------------------------------------" -ForegroundColor Magenta
Write-Host "✅ RELEASE v$newVersion PUBLIÉE AVEC SUCCÈS !" -ForegroundColor Green
Write-Host "   📦 Version : $newVersion" -ForegroundColor Cyan
Write-Host "   🏷️  Tag : $tagFullName" -ForegroundColor Cyan
Write-Host "   📝 Message : $releaseMessage" -ForegroundColor Cyan
Write-Host "   🔗 GitHub : https://github.com/beebee-coder/cpp.sousse/releases" -ForegroundColor Cyan

# 10. Proposer le build
Write-Host "`n🏗️ Voulez-vous lancer le build maintenant ? (Y/N)" -ForegroundColor Yellow
$buildChoice = Read-Host
if ($buildChoice -eq "Y" -or $buildChoice -eq "y") {
    Write-Host "`n🚀 Lancement du build..." -ForegroundColor Yellow
    .\update-and-build.ps1
}

Write-Host "`n✨ PROCESSUS DE RELEASE TERMINÉ." -ForegroundColor Green
Read-Host "`nAppuyez sur Entrée pour fermer"