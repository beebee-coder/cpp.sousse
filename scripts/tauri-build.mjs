// scripts/tauri-build.mjs
// Build for Tauri (static HTML export).
//
// Tauri serves static files with no Next.js server, so API route handlers
// (which rely on dynamic server APIs) and middleware.ts cannot be statically
// exported and would break `next build` with `output: 'export'`.
//
// La règle hybride unique :
//   - Web (Vercel) : routes API + middleware CORS sont déployés et servis.
//   - Desktop (Tauri) : l'API est appelée via NEXT_PUBLIC_API_URL (cloud).
//     Le client desktop n'exécute ni les routes ni le middleware localement,
//     on les exclut donc du build statique (sauvegarde + restauration).
//
// Note: a plain rename fails on Windows for the `[...nextauth]` folder, so we
// copy to a backup and delete the original instead.
import { cpSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const apiDir = 'src/app/api';
const middlewareFile = 'middleware.ts';
const backupDir = '.tauri-api-backup';
const middlewareBackup = '.tauri-middleware-backup.ts';
const excluded = [];

if (existsSync(apiDir)) {
  cpSync(apiDir, backupDir, { recursive: true });
  rmSync(apiDir, { recursive: true, force: true });
  excluded.push('api');
  console.log('ℹ️  Dossier API ignoré pour l\'export statique Tauri.');
}

if (existsSync(middlewareFile)) {
  cpSync(middlewareFile, middlewareBackup);
  rmSync(middlewareFile, { force: true });
  excluded.push('middleware');
  console.log('ℹ️  middleware.ts ignoré (non supporté en export statique).');
}

let exitCode = 1;
try {
  const result = spawnSync('npx', ['next', 'build'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
    env: { ...process.env, TAURI_ENV: 'true' },
  });
  exitCode = result.status ?? 1;
} finally {
  if (excluded.includes('api')) {
    rmSync(apiDir, { recursive: true, force: true });
    if (existsSync(backupDir)) {
      cpSync(backupDir, apiDir, { recursive: true });
      rmSync(backupDir, { recursive: true, force: true });
    }
    console.log('ℹ️  Dossier API restauré.');
  }
  if (excluded.includes('middleware')) {
    if (existsSync(middlewareBackup)) {
      cpSync(middlewareBackup, middlewareFile);
      rmSync(middlewareBackup, { force: true });
    }
    console.log('ℹ️  middleware.ts restauré.');
  }
}

process.exit(exitCode);
