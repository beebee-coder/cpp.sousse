// scripts/generate-updater-keys.mjs
// Génère une paire de clés ed25519 pour le plugin updater Tauri.
// La clé publique est copiée dans tauri.conf.json (plugins.updater.pubkey).
// La clé privée est sauvegardée dans ~/.tauri/visionode.key et doit être
// fournie via TAURI_SIGNING_PRIVATE_KEY lors du build.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const homeDir = os.homedir();
const tauriDir = path.join(homeDir, '.tauri');
const privateKeyPath = path.join(tauriDir, 'visionode.key');

fs.mkdirSync(tauriDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
console.log(`✅ [KEYS] Clé privée sauvegardée : ${privateKeyPath}`);

const publicKeyPem = publicKey.toString();
console.log('\n📋 [KEYS] Clé publique (à copier dans tauri.conf.json) :');
console.log('---');
console.log(publicKeyPem);
console.log('---');
console.log('\nAjoutez cette valeur dans src-tauri/tauri.conf.json :');
console.log(`"plugins": { "updater": { "pubkey": "${publicKeyPem.replace(/"/g, '\\"')}", ... } }`);
