// scripts/copy-installers.mjs
// Copie les installateurs générés par Tauri dans public/installers/ en leur
// attribuant un NOM STABLE (VisioNode_Setup_x64.exe / .msi) attendu par le
// frontend (DownloadApp). Ainsi, même si Tauri nomme l'artefact
// VisioNode_1.0.0_x64-setup.exe, le lien de téléchargement reste valide.
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const bundleDir = 'src-tauri/target/release/bundle';
const outDir = 'public/installers';

mkdirSync(outDir, { recursive: true });

function findLatest(dir, ext) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext)).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

const exe = findLatest(path.join(bundleDir, 'nsis'), '.exe') || findLatest(path.join(bundleDir, 'wix'), '.exe');
const msi = findLatest(path.join(bundleDir, 'msi'), '.msi');

if (exe) {
  cpSync(exe, path.join(outDir, 'VisioNode_Setup_x64.exe'), { force: true });
  console.log(`✅ [INSTALLERS] EXE copié : ${exe} → public/installers/VisioNode_Setup_x64.exe`);
} else {
  console.warn(`⚠️ [INSTALLERS] Aucun EXE trouvé dans ${bundleDir}/nsis|wix`);
}

if (msi) {
  cpSync(msi, path.join(outDir, 'VisioNode_Setup_x64.msi'), { force: true });
  console.log(`✅ [INSTALLERS] MSI copié : ${msi} → public/installers/VisioNode_Setup_x64.msi`);
} else {
  console.warn(`⚠️ [INSTALLERS] Aucun MSI trouvé dans ${bundleDir}/msi`);
}
