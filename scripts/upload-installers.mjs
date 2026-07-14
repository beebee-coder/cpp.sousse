// scripts/upload-installers.mjs
// Upload les installateurs Tauri vers Vercel Blob et génère public/installers/installers.json
// (manifest léger, versionné) consommé par DownloadApp. Évite de committer des binaires lourds.
//
// Prérequis : BLOB_READ_WRITE_TOKEN défini (local .env + variables projet Vercel).
// Exécuté automatiquement par `npm run desktop:build`.
import { put } from '@vercel/blob';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('❌ [INSTALLERS] BLOB_READ_WRITE_TOKEN manquant. Définissez-le (local .env + env projet Vercel).');
  process.exit(1);
}
const bundleDir = 'src-tauri/target/release/bundle';

function findLatest(dir, ext) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext)).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

const exe = findLatest(path.join(bundleDir, 'nsis'), '.exe') || findLatest(path.join(bundleDir, 'wix'), '.exe');
const msi = findLatest(path.join(bundleDir, 'msi'), '.msi');

async function upload(file, pathname, contentType) {
  const data = readFileSync(file);
  const blob = await put(pathname, data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
    contentType,
  });
  console.log(`✅ [INSTALLERS] Uploadé : ${pathname} → ${blob.url}`);
  return blob.url;
}

const manifest = { windows: { exe: '', msi: '' } };

if (exe) {
  manifest.windows.exe = await upload(exe, 'installers/VisioNode_Setup_x64.exe', 'application/octet-stream');
} else {
  console.warn('⚠️ [INSTALLERS] Aucun EXE trouvé dans', `${bundleDir}/nsis|wix`);
}

if (msi) {
  manifest.windows.msi = await upload(msi, 'installers/VisioNode_Setup_x64.msi', 'application/x-msi');
} else {
  console.warn('⚠️ [INSTALLERS] Aucun MSI trouvé dans', `${bundleDir}/msi`);
}

mkdirSync('public/installers', { recursive: true });
writeFileSync('public/installers/installers.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log('✅ [INSTALLERS] Manifest écrit : public/installers/installers.json');
