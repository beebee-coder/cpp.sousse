// src/lib/qr/offline-repo.ts
/**
 * @fileOverview Source de vérité OFFLINE pour les collections Q/R (Dataset)
 * en mode Locale / Hybride-offline. Opère directement sur le Registre Physique
 * `.registry/items/{name}.json` (le même FS que `local_db_inject` côté Rust
 * et que `registry/route.ts` en mode local). Aucune dépendance Prisma/Neon,
 * aucun réseau.
 *
 * En mode Web (Vercel serverless, FS read-only) ce module est inutilisé ; tout
 * passe par le cloud (Prisma knowledgeItem). En Desktop offline, il est la
 * SEULE voie de CRUD car l'API Next (`/api/registry`, `/api/local-db`)
 * court-circuite en `STATIC_EXPORT`.
 *
 * Aligné sur le pattern de `procedures/offline-repo.ts` : écriture atomique
 * (tmp + rename), chemins normalisés anti-traversal, listeners de changement.
 */

import fs from 'fs';
import path from 'path';

const REGISTRY_OVERRIDE = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
const REGISTRY_ROOT = REGISTRY_OVERRIDE
  ? REGISTRY_OVERRIDE
  : path.join(process.cwd(), '.registry');
const ITEMS_DIR = path.join(REGISTRY_ROOT, 'items');

export interface QAPair {
  question: string;
  answer: string;
}

export interface OfflineQARecord {
  type: 'qa';
  title: string;
  description?: string;
  pairs: QAPair[];
  createdAt: string;
  registryPath: string;
  [key: string]: any;
}

function sanitizeRegistryPath(inputPath: string): string {
  const cleaned = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter((s) => s !== '.' && s !== '');
  const safe = segments.join('/');
  const full = path.join(REGISTRY_ROOT, safe);
  if (!full.startsWith(REGISTRY_ROOT)) {
    throw new Error('PATH_TRAVERSAL_DETECTED');
  }
  return safe;
}

function ensureItemsDir() {
  try {
    if (!fs.existsSync(ITEMS_DIR)) fs.mkdirSync(ITEMS_DIR, { recursive: true });
  } catch {
    /* FS read-only : ignoré */
  }
}

function itemPath(fileName: string): string {
  const base = fileName.toLowerCase().endsWith('.json') ? fileName : `${fileName}.json`;
  return path.join(ITEMS_DIR, base);
}

function listItemsDir(): string[] {
  ensureItemsDir();
  try {
    return fs.readdirSync(ITEMS_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export function listOfflineQA(): OfflineQARecord[] {
  const out: OfflineQARecord[] = [];
  for (const file of listItemsDir()) {
    const full = path.join(ITEMS_DIR, file);
    try {
      const rec = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (rec && rec.type === 'qa') out.push(rec);
    } catch {
      /* fichier corrompu : ignoré */
    }
  }
  return out.sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export function getOfflineQA(fileName: string): OfflineQARecord | null {
  const full = itemPath(fileName);
  if (!fs.existsSync(full)) return null;
  try {
    const rec = JSON.parse(fs.readFileSync(full, 'utf8'));
    return rec && rec.type === 'qa' ? rec : null;
  } catch {
    return null;
  }
}

export function upsertOfflineQA(record: OfflineQARecord): OfflineQARecord {
  ensureItemsDir();
  const full = itemPath(record.registryPath?.split('/').pop() || `${record.title}.json`);
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, full);
  emitChanged();
  return record;
}

export function deleteOfflineQA(fileName: string): boolean {
  const full = itemPath(fileName);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    emitChanged();
    return true;
  }
  return false;
}

/**
 * Reconstruit un arbre d'arborescence (dossiers + fichiers) compatible avec
 * la forme renvoyée par `postgresClient.getRegistryTree()` / `buildCloudTree`
 * pour l'explorateur de registre offline. On se limite ici au dossier `items`
 * (collections Q/R) en complétant le squelette canonique attendu par l'UI.
 */
const CANONICAL_SKELETON: Record<string, string[]> = {
  '': ['Alarmes', 'bank', 'items', 'procedures', 'ressources humaines'],
  'ressources humaines': ['equipes'],
  'ressources humaines/equipes': ['equipe A', 'equipe B', 'equipe C', 'equipe D'],
};

export function buildOfflineRegistryTree(): any[] {
  const rootChildren: any[] = [];
  const folderMap = new Map<string, any>();

  const ensureFolder = (segments: string[]): any[] => {
    let parentList = rootChildren;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let folder = folderMap.get(acc);
      if (!folder) {
        folder = { id: `dir::${acc}`, name: seg, type: 'folder', isOpen: false, children: [] };
        folderMap.set(acc, folder);
        parentList.push(folder);
      }
      parentList = folder.children;
    }
    return parentList;
  };

  for (const [parent, names] of Object.entries(CANONICAL_SKELETON)) {
    const parentSegs = parent ? parent.split('/').filter(Boolean) : [];
    const parentList = parentSegs.length > 0 ? ensureFolder(parentSegs) : rootChildren;
    for (const name of names) {
      const acc = parent ? `${parent}/${name}` : name;
      if (!folderMap.has(acc)) {
        const folder = { id: `dir::${acc}`, name, type: 'folder', isOpen: false, children: [] };
        folderMap.set(acc, folder);
        parentList.push(folder);
      }
    }
  }

  const itemsFolder = folderMap.get('items');
  if (itemsFolder) {
    for (const rec of listOfflineQA()) {
      const fileName = rec.registryPath?.split('/').pop() || `${rec.title}.json`;
      itemsFolder.children.push({
        id: `items/${fileName}`,
        name: fileName,
        type: 'file',
        metadata: {
          cloudId: undefined,
          type: rec.type,
          category: rec.description || 'General',
          pairCount: Array.isArray(rec.pairs) ? rec.pairs.length : 0,
        },
      });
    }
  }

  return rootChildren;
}

export function readOfflineRegistryFile(relPath: string): string {
  const safe = sanitizeRegistryPath(relPath);
  const full = path.join(REGISTRY_ROOT, safe);
  if (!fs.existsSync(full)) throw new Error('FICHIER_INTROUVABLE');
  return fs.readFileSync(full, 'utf8');
}

let changeListeners: Array<() => void> = [];
export function onQAChanged(cb: () => void): () => void {
  changeListeners.push(cb);
  return () => {
    changeListeners = changeListeners.filter((c) => c !== cb);
  };
}
function emitChanged() {
  for (const cb of changeListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}
