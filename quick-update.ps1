# quick-build.ps1
# VisioNode - Build rapide sans synchronisation

Write-Host "⚡ BUILD RAPIDE - VisioNode" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Nettoyer
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force src-tauri/target -ErrorAction SilentlyContinue

# Build
npm run build
cd src-tauri
cargo build --release
cargo tauri build
cd ..

Write-Host "✅ Build terminé !" -ForegroundColor Green
Read-Host "`nAppuyez sur Entrée pour fermer"