const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bundleRoot = path.join(root, 'src-tauri', 'target', 'release', 'bundle');
const destRoot = path.join(root, 'public', 'installers');

const platformMappings = [
  { bundleDir: 'nsis', matcher: /\.exe$/i, destName: 'VisioNode_Setup_x64.exe' },
  { bundleDir: 'msi', matcher: /\.msi$/i, destName: 'VisioNode_Setup_x64.msi' },
  { bundleDir: 'dmg', matcher: /\.dmg$/i, destName: 'VisioNode.dmg' },
  { bundleDir: 'appimage', matcher: /\.appimage$/i, destName: 'VisioNode.AppImage' }
];

if (!fs.existsSync(bundleRoot)) {
  console.error(`Erreur : le répertoire de bundle Tauri est introuvable : ${bundleRoot}`);
  process.exit(1);
}

fs.mkdirSync(destRoot, { recursive: true });

let copiedCount = 0;

for (const { bundleDir, matcher, destName } of platformMappings) {
  const sourceDir = path.join(bundleRoot, bundleDir);
  if (!fs.existsSync(sourceDir)) {
    continue;
  }

  const files = fs.readdirSync(sourceDir);
  const sourceFile = files.find((file) => matcher.test(file));
  if (!sourceFile) {
    continue;
  }

  const sourcePath = path.join(sourceDir, sourceFile);
  const destPath = path.join(destRoot, destName);
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copie ${sourceFile} → ${path.relative(root, destPath)}`);
  copiedCount += 1;
}

if (copiedCount === 0) {
  console.error('Aucun installateur n’a été trouvé dans les bundles Tauri.');
  process.exit(1);
}

console.log(`Installateurs copiés dans ${path.relative(root, destRoot)} (${copiedCount} fichiers).`);
process.exit(0);
