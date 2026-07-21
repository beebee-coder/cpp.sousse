// scripts/upload-installers.mjs
// Upload les installateurs Tauri vers Vercel Blob et génère :
// - public/installers/installers.json (manifest léger pour DownloadApp)
// - public/installers/latest.json (manifest Tauri updater avec signatures)
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

// Read package version
let packageVersion = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  packageVersion = pkg.version || packageVersion;
} catch {}

function findLatest(dir, ext) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext)).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

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

function readBase64(file) {
  if (!file || !existsSync(file)) return null;
  return readFileSync(file, 'utf8').replace(/\s/g, '');
}

const exe = findLatest(path.join(bundleDir, 'nsis'), '.exe') || findLatest(path.join(bundleDir, 'wix'), '.exe');
const msi = findLatest(path.join(bundleDir, 'msi'), '.msi');
const exeSig = exe ? exe + '.sig' : null;
const msiSig = msi ? msi + '.sig' : null;

const manifest = { windows: { exe: '', msi: '' } };

if (exe) {
  manifest.windows.exe = await upload(exe, 'installers/VisioNode_Setup_x64.exe', 'application/octet-stream');
  if (exeSig && existsSync(exeSig)) {
    await upload(exeSig, 'installers/VisioNode_Setup_x64.exe.sig', 'application/octet-stream');
  }
} else {
  console.warn('⚠️ [INSTALLERS] Aucun EXE trouvé dans', `${bundleDir}/nsis|wix`);
}

if (msi) {
  manifest.windows.msi = await upload(msi, 'installers/VisioNode_Setup_x64.msi', 'application/x-msi');
  if (msiSig && existsSync(msiSig)) {
    await upload(msiSig, 'installers/VisioNode_Setup_x64.msi.sig', 'application/octet-stream');
  }
} else {
  console.warn('⚠️ [INSTALLERS] Aucun MSI trouvé dans', `${bundleDir}/msi`);
}

mkdirSync('public/installers', { recursive: true });
writeFileSync('public/installers/installers.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log('✅ [INSTALLERS] Manifest écrit : public/installers/installers.json');

// Tauri updater manifest (latest.json)
const exeSigB64 = readBase64(exeSig);
const msiSigB64 = readBase64(msiSig);
const pubDate = new Date().toISOString();

const platforms = {};
if (manifest.windows.exe) {
  platforms['windows-x86_64'] = {
    signature: exeSigB64 || '',
    url: manifest.windows.exe,
  };
}
if (manifest.windows.msi) {
  platforms['windows-msi-x86_64'] = {
    signature: msiSigB64 || '',
    url: manifest.windows.msi,
  };
}

const latest = {
  version: packageVersion,
  notes: `VisioNode ${packageVersion} — déploiement automatique`,
  pub_date: pubDate,
  platforms,
};

writeFileSync('public/installers/latest.json', JSON.stringify(latest, null, 2), 'utf8');
console.log('✅ [INSTALLERS] Manifest updater écrit : public/installers/latest.json');
