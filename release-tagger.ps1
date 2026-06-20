# VisioNode - Création de version uniquement
Write-Host "🏷️ [RELEASE_TAGGER] Préparation d'une nouvelle version..." -ForegroundColor Magenta

$versionType = Read-Host "Type de version (patch/minor/major)"
if (-not $versionType) { $versionType = "patch" }

Write-Host "🔢 Incrémentation de la version..."
npm version $versionType --no-git-tag-version

$newVersion = node -p "require('./package.json').version"
Write-Host "📌 Nouvelle version : v$newVersion"

Write-Host "💾 Marquage du registre (Tagging)..."
git add package.json
git commit -m "[RELEASE] v$newVersion - New Industrial Build"
git tag "v$newVersion"
git push origin main --tags

Write-Host "✅ [SUCCÈS] Version v$newVersion publiée." -ForegroundColor Green
