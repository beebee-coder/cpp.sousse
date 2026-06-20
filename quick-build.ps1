# VisioNode - Build rapide sans synchronisation
Write-Host "⚡ [QUICK_BUILD] Lancement d'une compilation locale..." -ForegroundColor Yellow

Write-Host "🔨 Compilation Next.js (Mode Export)..."
npm run build:tauri

Write-Host "🏗️  Forge Desktop (Tauri)..."
npx tauri build

Write-Host "✅ [SUCCÈS] Binaire généré dans src-tauri/target/release/bundle/" -ForegroundColor Green
