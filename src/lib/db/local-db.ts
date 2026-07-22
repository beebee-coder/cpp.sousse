import fs from 'fs';
import path from 'path';
import { isDesktop } from '../platform';

/**
 * @fileOverview Base de données locale physique [LOCAL_DB].
 * Structure arborescente pour l'Explorateur BDD et l'exploitation IA.
 *
 * Répertoires principaux (miroirs de l'arborescence de la BDD Web / Registre) :
 * 1. INDEX_CHROMA            - Résultat accumulatif des fichiers injectés lors de la sync.
 *                              Gestion des doublons par nom de fichier via dossiers indexés.
 * 2. Centrale / Groupes      - Arborescence centralisée de l'installation (issue de l'arborescence).
 * 3. Alarmes                 - Répertoire des alarmes.
 * 4. ressources humaines     - Répertoire des équipes / ressources humaines.
 * 5. bank                     - Banque d'Images (miroir du dossier `bank` du Registre Web).
 *                              Concordant avec la BDD Web afin de recevoir les actifs binaires
 *                              (images/vidéos) et leurs métadonnées, puis d'être indexé/vectorisé
 *                              dans l'arborescence Vecteurs ChromaDB.
 */

const currentRoot_INITIAL = (() => {
  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  if (override) {
    const alignedRoot = path.join(path.dirname(override), '.local-db');
    const cwdRoot = path.join(process.cwd(), '.local-db');
    if (fs.existsSync(alignedRoot)) {
      return alignedRoot;
    }
    if (fs.existsSync(cwdRoot)) {
      try {
        fs.mkdirSync(path.dirname(alignedRoot), { recursive: true });
        fs.renameSync(cwdRoot, alignedRoot);
        return alignedRoot;
      } catch {
        return cwdRoot;
      }
    }
    return alignedRoot;
  }
  return path.join(process.cwd(), '.local-db');
})();

let currentRoot: string = currentRoot_INITIAL;

let INDEX_CHROMA_DIR = path.join(currentRoot, 'INDEX_CHROMA');
let CENTRALE_DIR = path.join(currentRoot, 'Centrale');
let GROUPES_DIR = path.join(currentRoot, 'Groupes');
let ALARMES_DIR = path.join(currentRoot, 'Alarmes');
let RESSOURCES_HUMAINES_DIR = path.join(currentRoot, 'ressources humaines');
let BANK_DIR = path.join(currentRoot, 'bank');
let MANIFEST_FILE = path.join(currentRoot, 'local-db-manifest.json');
let MANIFEST_LOCK_FILE = path.join(currentRoot, '.manifest.lock');
let WEB_SYNC_DIR = path.join(currentRoot, 'web-sync');

const updateDerivedPaths = () => {
  INDEX_CHROMA_DIR = path.join(currentRoot, 'INDEX_CHROMA');
  CENTRALE_DIR = path.join(currentRoot, 'Centrale');
  GROUPES_DIR = path.join(currentRoot, 'Groupes');
  ALARMES_DIR = path.join(currentRoot, 'Alarmes');
  RESSOURCES_HUMAINES_DIR = path.join(currentRoot, 'ressources humaines');
  BANK_DIR = path.join(currentRoot, 'bank');
  MANIFEST_FILE = path.join(currentRoot, 'local-db-manifest.json');
  MANIFEST_LOCK_FILE = path.join(currentRoot, '.manifest.lock');
  WEB_SYNC_DIR = path.join(currentRoot, 'web-sync');
};

async function resolveLocalDBRoot(): Promise<string> {
  if (currentRoot !== currentRoot_INITIAL) return currentRoot;

  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  if (override) {
    currentRoot = path.join(path.dirname(override), '.local-db');
    updateDerivedPaths();
    return currentRoot;
  }

  if (isDesktop) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tauriRoot = await invoke<string>('get_local_db_root');
      if (tauriRoot && tauriRoot !== currentRoot) {
        const oldRoot = currentRoot;
        currentRoot = tauriRoot;
        updateDerivedPaths();
        if (fs.existsSync(oldRoot) && !fs.existsSync(currentRoot)) {
          try {
            fs.mkdirSync(path.dirname(currentRoot), { recursive: true });
            fs.renameSync(oldRoot, currentRoot);
          } catch {
            currentRoot = oldRoot;
            updateDerivedPaths();
          }
        }
      }
      return currentRoot;
    } catch {
      return currentRoot;
    }
  }

  return currentRoot;
}

export function getLocalDBRoot(): string {
  return currentRoot;
}

// R1 — Aligne la racine `.registry` sur la même que le moteur Rust en Desktop
// (REGISTRY_ROOT_OVERRIDE, issu de get_registry_root) pour éviter toute
// divergence de chemin entre l'écriture JS (seed/index) et la lecture native.
const REGISTRY_ROOT_DIR = (() => {
  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  return override ? override : path.join(process.cwd(), '.registry');
})();

export { currentRoot as LOCAL_DB_ROOT, resolveLocalDBRoot };

interface LocalDBManifestEntry {
  id: string;
  originalName: string;
  resolvedPath: string;
  type: string;
  knowledgeType?: string;
  cloudId?: string;
  timestamp: number;
  size: number;
  tags?: string[];
}

interface LocalDBManifest {
  files: LocalDBManifestEntry[];
  lastSync: string;
  version: string;
  /** Amorçage unique depuis le Registre physique (.registry) déjà effectué. */
  seededFromRegistry?: boolean;
  /** Timestamp du registre au moment de la dernière indexation Chroma. */
  registryLastIndexedAt?: string;
}

interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  timestamp?: number;
  children?: FSNode[];
  isOpen?: boolean;
  metadata?: {
    knowledgeType?: string;
    cloudId?: string;
    indexed?: boolean;
  };
}

const ensureLocalDB = () => {
  const root = currentRoot;
  try {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    [INDEX_CHROMA_DIR, CENTRALE_DIR, GROUPES_DIR, ALARMES_DIR, RESSOURCES_HUMAINES_DIR, BANK_DIR, WEB_SYNC_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    const rhEquipesDir = path.join(RESSOURCES_HUMAINES_DIR, 'equipes');
    if (!fs.existsSync(rhEquipesDir)) fs.mkdirSync(rhEquipesDir, { recursive: true });
    ['equipe A', 'equipe B', 'equipe C', 'equipe D'].forEach(equipe => {
      const target = path.join(rhEquipesDir, equipe);
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    });
    if (!fs.existsSync(MANIFEST_FILE)) {
      const initial: LocalDBManifest = {
        files: [],
        lastSync: new Date(0).toISOString(),
        version: '1.0.0'
      };
      fs.writeFileSync(MANIFEST_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('[LOCAL_DB] FS read-only, création de .local-db ignorée:', (e as Error).message);
  }
};

const loadManifest = (): LocalDBManifest => {
  ensureLocalDB();
  try {
    const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { files: [], lastSync: new Date(0).toISOString(), version: '1.0.0' };
  }
};

const saveManifest = (manifest: LocalDBManifest) => {
  manifest.lastSync = new Date().toISOString();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
};

const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const MAX_DUPLICATE_VERSIONS = 5;

let manifestLockDepth = 0;
let manifestLockHeld = false;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withManifestLock = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  if (manifestLockDepth > 0) {
    manifestLockDepth++;
    return fn();
  }

  ensureLocalDB();
  const lockPath = MANIFEST_LOCK_FILE;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      manifestLockHeld = true;
      try {
        manifestLockDepth = 1;
        return await fn();
      } finally {
        manifestLockDepth = 0;
        if (manifestLockHeld) {
          try { fs.closeSync(fd); } catch { /* ignore */ }
          try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
          manifestLockHeld = false;
        }
      }
    } catch (e: any) {
      if (e?.code === 'EEXIST' && Date.now() < deadline) {
        await sleep(25);
        continue;
      }
      break;
    }
  }

  try {
    manifestLockDepth = 1;
    return await fn();
  } finally {
    manifestLockDepth = 0;
  }
};

let initializationPromise: Promise<void> | null = null;

export async function ensureLocalDBInitialized(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    await resolveLocalDBRoot();
    await localDB.initialize();
  })();
  return initializationPromise;
}

export const localDB = {
  /**
   * Retourne l'arborescence complète de la BDD locale.
   */
  async getTree(): Promise<FSNode[]> {
    ensureLocalDB();
    const manifest = loadManifest();

    const scanDirectory = (dir: string, baseName: string): FSNode[] => {
      if (!fs.existsSync(dir)) return [];

      const items = fs.readdirSync(dir, { withFileTypes: true });
      return items.map(item => {
        const absPath = path.join(dir, item.name);
        const relPath = path.posix.join(baseName, item.name).replace(/\\/g, '/');

        if (item.isDirectory()) {
          const children = scanDirectory(absPath, relPath);
          return {
            id: relPath,
            name: item.name,
            type: 'folder',
            children
          };
        }

        const stats = fs.statSync(absPath);
        const manifestEntry = manifest.files.find(f => f.resolvedPath === relPath);

        return {
          id: relPath,
          name: item.name,
          type: 'file',
          size: stats.size,
          timestamp: stats.mtimeMs,
          metadata: manifestEntry ? {
            knowledgeType: manifestEntry.knowledgeType,
            cloudId: manifestEntry.cloudId
          } : undefined
        };
      });
    };

    const indexChromaTree: FSNode[] = scanDirectory(INDEX_CHROMA_DIR, 'INDEX_CHROMA');
    const centraleTree: FSNode[] = scanDirectory(CENTRALE_DIR, 'Centrale');
    const groupesTree: FSNode[] = scanDirectory(GROUPES_DIR, 'Groupes');
    const alarmesTree: FSNode[] = scanDirectory(ALARMES_DIR, 'Alarmes');
    const ressourcesHumainesTree: FSNode[] = scanDirectory(RESSOURCES_HUMAINES_DIR, 'ressources humaines');
    const bankTree: FSNode[] = scanDirectory(BANK_DIR, 'bank');
    const webSyncTree: FSNode[] = scanDirectory(WEB_SYNC_DIR, 'web-sync');

    const rootNodes: FSNode[] = [];

    rootNodes.push({
      id: 'INDEX_CHROMA',
      name: 'INDEX_CHROMA',
      type: 'folder',
      isOpen: true,
      children: indexChromaTree,
      metadata: { knowledgeType: 'chroma-index' }
    });

    rootNodes.push({
      id: 'Centrale',
      name: 'Centrale',
      type: 'folder',
      isOpen: false,
      children: centraleTree,
      metadata: { knowledgeType: 'centrale' }
    });

    rootNodes.push({
      id: 'Groupes',
      name: 'Groupes',
      type: 'folder',
      isOpen: false,
      children: groupesTree,
      metadata: { knowledgeType: 'groupes' }
    });

    rootNodes.push({
      id: 'Alarmes',
      name: 'Alarmes',
      type: 'folder',
      isOpen: false,
      children: alarmesTree,
      metadata: { knowledgeType: 'alarmes' }
    });

    rootNodes.push({
      id: 'ressources humaines',
      name: 'ressources humaines',
      type: 'folder',
      isOpen: false,
      children: ressourcesHumainesTree,
      metadata: { knowledgeType: 'ressources-humaines' }
    });

    rootNodes.push({
      id: 'bank',
      name: 'bank',
      type: 'folder',
      isOpen: false,
      children: bankTree,
      metadata: { knowledgeType: 'bank' }
    });

    rootNodes.push({
      id: 'web-sync',
      name: 'WEB SYNC',
      type: 'folder',
      isOpen: true,
      children: webSyncTree,
      metadata: { knowledgeType: 'web-sync' }
    });

    // Marque les fichiers déjà indexés/vectorisés vers ChromaDB
    const indexedSet = (() => {
      try {
        const mp = path.join(currentRoot, 'chroma-index.json');
        if (fs.existsSync(mp)) {
          const data = JSON.parse(fs.readFileSync(mp, 'utf8'));
          return new Set<string>((data.entries || []).map((e: any) => e.relPath));
        }
      } catch {}
      return new Set<string>();
    })();

    const tagIndexed = (nodes: FSNode[]): FSNode[] => nodes.map(n => ({
      ...n,
      metadata: n.type === 'file' && indexedSet.has(n.id)
        ? { ...n.metadata, indexed: true }
        : n.metadata,
      children: n.children ? tagIndexed(n.children) : undefined
    }));

    return tagIndexed(rootNodes);
  },

  /**
   * Injecte un fichier dans INDEX_CHROMA avec gestion des doublons.
   */
  async injectFile(fileName: string, content: string, metadata?: {
    knowledgeType?: string;
    cloudId?: string;
    tags?: string[];
  }, targetDir?: string): Promise<{ success: boolean; path: string; isDuplicate: boolean }> {
    ensureLocalDB();

    const baseDir = targetDir
      ? (path.isAbsolute(targetDir) ? targetDir : path.join(currentRoot, targetDir))
      : INDEX_CHROMA_DIR;
    const fullBasePath = path.join(baseDir, fileName);

    if (!fs.existsSync(fullBasePath)) {
      const fullPath = path.join(baseDir, fileName);
      const targetPath = path.relative(currentRoot, fullPath).replace(/\\/g, '/');
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (content.startsWith('data:')) {
        const base64Data = content.split(',')[1];
        fs.writeFileSync(fullPath, Buffer.from(base64Data), 'base64');
      } else {
        fs.writeFileSync(fullPath, content, 'utf8');
      }

      const stats = fs.statSync(fullPath);
      await withManifestLock(async () => {
        const manifest = loadManifest();
        manifest.files.push({
          id: generateId(),
          originalName: fileName,
          resolvedPath: targetPath,
          type: path.extname(fileName).slice(1) || 'unknown',
          knowledgeType: metadata?.knowledgeType,
          cloudId: metadata?.cloudId,
          timestamp: Date.now(),
          size: stats.size,
          tags: metadata?.tags
        });
        saveManifest(manifest);
      });

      console.log(`✅ [LOCAL_DB] [INJECT] ${fileName} → ${targetPath}`);
      return { success: true, path: targetPath, isDuplicate: false };
    }

    // ────────────────────────────────────────────────────────────────────────
    // GESTION DES DOUBLONS
    // Si un fichier de même nom existe déjà dans le répertoire cible :
    //
    //  1ère collision → transform en répertoire :
    //     baseDir/fileName              (fichier existant)
    //     baseDir/fileName/1_fileName   (version initiale déplacée)
    //     baseDir/fileName/2_fileName   (nouvelle version)
    //
    //  Nième collision (le répertoire existe déjà) :
    //     baseDir/fileName/N_fileName   (version ajoutée)
    // ────────────────────────────────────────────────────────────────────────

    const pathStat = fs.statSync(fullBasePath);

    if (pathStat.isFile()) {
      const folderPath = path.join(baseDir, fileName);
      const tempBase = `${fullBasePath}.tmp_${Date.now()}`;
      fs.renameSync(fullBasePath, tempBase);
      fs.mkdirSync(folderPath, { recursive: true });
      fs.renameSync(tempBase, path.join(folderPath, `1_${fileName}`));
      console.log(`📁 [LOCAL_DB] [DUPLICATE] Dossier versionné créé : ${fileName}/`);
    }
    // Après la création du dossier (ou s'il existait déjà), injecter la nouvelle version
    const folderPath = path.join(baseDir, fileName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Compter toutes les versions déjà présentes (avec ou sans extension)
    const existingVersions = fs.readdirSync(folderPath).filter(f => {
      const match = f.match(/^(\d+)_.+$/);
      return match !== null;
    });
    const nextIndex = existingVersions.length + 1;
    const fullPath = path.join(folderPath, `${nextIndex}_${fileName}`);
    const targetPath = path.relative(currentRoot, fullPath).replace(/\\/g, '/');

    if (content.startsWith('data:')) {
      const base64Data = content.split(',')[1];
      fs.writeFileSync(fullPath, Buffer.from(base64Data), 'base64');
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }

    const fileStats = fs.statSync(fullPath);
      await withManifestLock(async () => {
        const manifest = loadManifest();
      manifest.files.push({
        id: generateId(),
        originalName: fileName,
        resolvedPath: targetPath,
        type: path.extname(fileName).slice(1) || 'unknown',
        knowledgeType: metadata?.knowledgeType,
        cloudId: metadata?.cloudId,
        timestamp: Date.now(),
        size: fileStats.size,
        tags: metadata?.tags
      });
      saveManifest(manifest);
    });

    if (existingVersions.length >= MAX_DUPLICATE_VERSIONS) {
      const versionsToDelete = existingVersions
        .map(f => {
          const match = f.match(/^(\d+)_.+$/);
          return match ? { name: f, index: parseInt(match[1], 10) } : null;
        })
        .filter((v): v is { name: string; index: number } => v !== null)
        .sort((a, b) => a.index - b.index)
        .slice(0, existingVersions.length - MAX_DUPLICATE_VERSIONS + 1);

      for (const v of versionsToDelete) {
        const oldPath = path.join(folderPath, v.name);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          await withManifestLock(async () => {
            const manifest = loadManifest();
            manifest.files = manifest.files.filter(f => f.resolvedPath !== path.relative(currentRoot, oldPath).replace(/\\/g, '/'));
            saveManifest(manifest);
          });
          console.log(`🗑️ [LOCAL_DB] [PRUNE] Ancienne version supprimée : ${v.name}`);
        }
      }
    }

    console.log(`🔁 [LOCAL_DB] [DUPLICATE] ${fileName} → ${targetPath} (version ${nextIndex})`);

    return { success: true, path: targetPath, isDuplicate: true };
  },

  /**
   * Lit le contenu d'un fichier dans la BDD locale.
   */
  async getFile(relativePath: string): Promise<string> {
    const fullPath = path.join(currentRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('FICHIER_INTROUVABLE');
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm'].includes(ext)) {
      const buffer = fs.readFileSync(fullPath);
      const mime = ext === '.mp4' || ext === '.webm' ? `video/${ext.slice(1)}` : `image/${ext.slice(1)}`;
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }

    return fs.readFileSync(fullPath, 'utf8');
  },

  /**
   * Supprime un fichier ou un dossier de la BDD locale.
   */
  async deleteItem(relativePath: string): Promise<boolean> {
    const fullPath = path.join(currentRoot, relativePath);
    if (!fs.existsSync(fullPath)) return false;

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

      await withManifestLock(async () => {
        const manifest = loadManifest();
      const prefix = `${relativePath}/`;
      manifest.files = manifest.files.filter(f => f.resolvedPath !== relativePath && !f.resolvedPath.startsWith(prefix));
      saveManifest(manifest);
    });

    try {
      const { deleteChromaItem } = await import('@/lib/local-indexer');
      await deleteChromaItem(relativePath);
    } catch (e) {
      console.warn('[LOCAL_DB] Chroma cleanup échoué:', (e as Error).message);
    }

    console.log(`🗑️ [LOCAL_DB] [DELETE] ${relativePath}`);
    return true;
  },

  /**
   * Renomme un fichier ou un dossier dans la BDD locale.
   */
  async renameItem(oldPath: string, newName: string): Promise<{ success: boolean }> {
    const oldFullPath = path.join(currentRoot, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    if (!fs.existsSync(oldFullPath)) {
      throw new Error('ELEMENT_INTROUVABLE');
    }
    const isDir = fs.statSync(oldFullPath).isDirectory();
    fs.renameSync(oldFullPath, newFullPath);
    const newRelPath = path.relative(currentRoot, newFullPath).replace(/\\/g, '/');

      await withManifestLock(async () => {
        const manifest = loadManifest();
      const oldPrefix = isDir ? `${oldPath}/` : null;
      manifest.files.forEach(entry => {
        if (oldPrefix && entry.resolvedPath.startsWith(oldPrefix)) {
          entry.resolvedPath = `${newRelPath}/${entry.resolvedPath.slice(oldPrefix.length)}`;
        } else if (!oldPrefix && entry.resolvedPath === oldPath) {
          entry.resolvedPath = newRelPath;
        }
      });
      saveManifest(manifest);
    });

    try {
      const { deleteChromaItem, indexLocalDBFile, indexLocalDBFolder } = await import('@/lib/local-indexer');
      await deleteChromaItem(oldPath);

      if (fs.existsSync(newFullPath)) {
        if (fs.statSync(newFullPath).isDirectory()) {
          await indexLocalDBFolder(newRelPath);
        } else {
          await indexLocalDBFile(newRelPath);
        }
      }
    } catch (e) {
      console.warn('[LOCAL_DB] Chroma rename cleanup échoué:', (e as Error).message);
    }

    console.log(`📝 [LOCAL_DB] [RENAME] ${oldPath} -> ${newName}`);
    return { success: true };
  },

  /**
   * Écrit le contenu d'un fichier dans la BDD locale (PUT).
   */
  async writeFile(relativePath: string, content: string): Promise<{ success: boolean; path: string }> {
    ensureLocalDB();
    const fullPath = path.join(currentRoot, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (content.startsWith('data:') && content.includes(';base64,')) {
      const base64Data = content.split(',')[1];
      fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    const targetPath = path.relative(currentRoot, fullPath).replace(/\\/g, '/');
    console.log(`✏️ [LOCAL_DB] [WRITE] ${targetPath}`);
    return { success: true, path: targetPath };
  },

  /**
   * Persiste un actif de la Banque d'Images (binaire + métadonnées) dans le
   * dossier `bank` de la BDD Locale, en miroir concordant du Registre Web.
   * Le chemin relatif est exprimé par rapport à `bank/` (ex: `nom/nom.jpg`).
   */
  async saveBankAsset(assetRelPath: string, content: string): Promise<{ success: boolean; path: string }> {
    ensureLocalDB();
    const safeRel = assetRelPath.replace(/^\/+/, '');
    const fullPath = path.join(BANK_DIR, safeRel);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (content.startsWith('data:')) {
      const base64Data = content.split(',')[1];
      fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    const targetPath = path.relative(currentRoot, fullPath).replace(/\\/g, '/');
    console.log(`🏦 [LOCAL_DB] [BANK] Actif persisté : ${targetPath}`);
    return { success: true, path: targetPath };
  },

  /**
   * Recherche dans l'INDEX_CHROMA par nom de fichier ou métadonnées.
   * Utilisé par l'IA pour structurer les réponses.
   */
  async searchByQuery(query: string): Promise<LocalDBManifestEntry[]> {
    const manifest = loadManifest();
    const lowerQuery = query.toLowerCase();

    return manifest.files.filter(entry => {
      const searchable = [
        entry.originalName,
        entry.type,
        entry.knowledgeType || '',
        ...(entry.tags || [])
      ].join(' ').toLowerCase();

      return searchable.includes(lowerQuery);
    });
  },

  /**
   * Obtient le contenu d'un fichier par son originalName pour l'IA.
   */
  async getFileByName(originalName: string): Promise<string | null> {
    const manifest = loadManifest();
    const entry = manifest.files.find(f => f.originalName === originalName);

    if (!entry) return null;

    try {
      return await this.getFile(entry.resolvedPath);
    } catch {
      return null;
    }
  },

  /**
   * Retourne le manifest complet pour l'exploitation IA.
   */
  async getManifest(): Promise<LocalDBManifest> {
    return loadManifest();
  },

  /**
   * Initialise la structure physique si elle n'existe pas.
   * Déclenche l'amorçage unique depuis le Registre physique (.registry) afin que
   * les arborescences BDD Locale et Vecteurs ChromaDB ne soient pas vides après
   * une installation locale / hybride fraîche.
   */
  async initialize(): Promise<void> {
    ensureLocalDB();
    await this.seedFromRegistryIfEmpty();
    console.log('✅ [LOCAL_DB] Structure initialisée.');
  },

  /**
   * Amorçage au premier lancement (mode local / hybride) :
   * injecte le contenu textuel du Registre physique (.registry) dans INDEX_CHROMA
   * puis vectorise vers ChromaDB, afin que les arborescences BDD Locale et
   * Vecteurs ChromaDB reflètent le Registre même sans synchronisation cloud.
   * Idempotent : protégé par le flag `seededFromRegistry` du manifest.
   */
  async seedFromRegistryIfEmpty(): Promise<{ seeded: number; indexed?: number }> {
    ensureLocalDB();
    let seeded = 0;
    let indexed: number | undefined;

    let shouldIndex = false;
      await withManifestLock(async () => {
        const manifest = loadManifest();
      if (manifest.seededFromRegistry) {
        seeded = 0;
        return;
      }

      const walk = (dir: string, base: string) => {
        if (!fs.existsSync(dir)) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, ent.name);
          const rel = base ? `${base}/${ent.name}` : ent.name;
          if (ent.isDirectory()) {
            walk(abs, rel);
          } else if (ent.name.toLowerCase().endsWith('.json')) {
            let raw = '';
            try {
              raw = fs.readFileSync(abs, 'utf8');
            } catch {
              continue;
            }
            const targetDir = base ? `INDEX_CHROMA/${base}` : 'INDEX_CHROMA/items';
            try {
              this.injectFile(ent.name, raw, {
                knowledgeType: base.split('/')[0] || 'items',
                tags: ['registry', `regpath:${rel.replace(/\.json$/i, '')}`],
              }, targetDir);
              seeded++;
            } catch (e) {
              console.warn(`[LOCAL_DB] [SEED] Échec injection ${rel}:`, (e as Error).message);
            }
          }
        }
      };

      walk(REGISTRY_ROOT_DIR, '');

      manifest.seededFromRegistry = true;
      saveManifest(manifest);
      shouldIndex = true;
    });

    if (shouldIndex) {
      try {
        const { indexLocalDBFolder } = await import('@/lib/local-indexer');
        const res = await indexLocalDBFolder('INDEX_CHROMA');
        indexed = res.indexed;
      } catch (e) {
        console.warn('[LOCAL_DB] [SEED] Indexation Chroma ignorée :', (e as Error).message);
      }
    }

    try {
      const stat = fs.statSync(REGISTRY_ROOT_DIR);
      const manifest = loadManifest();
      manifest.registryLastIndexedAt = new Date(stat.mtime).toISOString();
      saveManifest(manifest);
    } catch {
      // ignore si .registry n'existe pas encore
    }

    console.log(`✅ [LOCAL_DB] [SEED] Amorçage terminé : ${seeded} fichier(s) injecté(s), ${indexed ?? 0} vectorisé(s).`);
    return { seeded, indexed };
  },

  async ensureIndexedFromRegistry(): Promise<{ reindexed: boolean; indexed?: number }> {
    ensureLocalDB();
    if (process.env.VERCEL === '1') {
      return { reindexed: false };
    }

    const registryStat = fs.statSync(REGISTRY_ROOT_DIR);
    const manifest = loadManifest();
    const lastIndexed = manifest.registryLastIndexedAt ? new Date(manifest.registryLastIndexedAt) : null;

    if (lastIndexed && registryStat.mtime <= lastIndexed) {
      return { reindexed: false };
    }

    try {
      const { indexLocalDBFolder } = await import('@/lib/local-indexer');
      const res = await indexLocalDBFolder('INDEX_CHROMA');
      manifest.registryLastIndexedAt = new Date(registryStat.mtime).toISOString();
      saveManifest(manifest);
      return { reindexed: true, indexed: res.indexed };
    } catch (e: any) {
      console.warn('[LOCAL_DB] [REINDEX] Échec ré-indexation:', e.message);
      return { reindexed: false };
    }
  },

  /**
   * Crée récursivement dans INDEX_CHROMA le squelette de répertoires du Registre.
   * Préserve la structure architecturale exacte (même arborescence de sous-dossiers).
   * Les répertoires vides sont créés et prêts à recevoir les fichiers lors de la sync.
   */
  async mirrorRegistryStructure(): Promise<{ mirrored: string[] }> {
    ensureLocalDB();
    const mirrored: string[] = [];

    // Miroir dédié du dossier « bank » de la BDD Web (Registre) vers la BDD Locale.
    // Recopie l'arborescence COMPLÈTE (dossiers + fichiers binaires et metadata.json)
    // afin que les actifs peuplés en mode Web (Banque d'Images) aient un répertoire
    // concordant dans la BDD Locale, prêt à être indexé/vectorisé dans Vecteurs ChromaDB.
    const mirrorBankSubtree = (dir: string, targetBase: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const src = path.join(dir, entry.name);
        const dest = path.join(targetBase, entry.name);
        if (entry.isDirectory()) {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
            mirrored.push(path.relative(currentRoot, dest).replace(/\\/g, '/'));
          }
          mirrorBankSubtree(src, dest);
        } else {
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
            mirrored.push(path.relative(currentRoot, dest).replace(/\\/g, '/'));
          }
        }
      }
    };

    const bankSrc = path.join(REGISTRY_ROOT_DIR, 'bank');
    if (fs.existsSync(bankSrc)) {
      if (!fs.existsSync(BANK_DIR)) fs.mkdirSync(BANK_DIR, { recursive: true });
      mirrorBankSubtree(bankSrc, BANK_DIR);
    }

    // Miroir squelette (comportement historique) : reflète l'arborescence du Registre
    // dans INDEX_CHROMA pour les autres répertoires (le dossier « bank » est déjà
    // traité par le miroir dédié ci-dessus afin d'éviter tout doublon).
    const mirror = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          if (item.name.toLowerCase() === 'bank') continue;
          const relPath = path.relative(REGISTRY_ROOT_DIR, path.join(dir, item.name)).replace(/\\/g, '/');
          const mirrorPath = path.join(INDEX_CHROMA_DIR, relPath);
          if (!fs.existsSync(mirrorPath)) {
            fs.mkdirSync(mirrorPath, { recursive: true });
            mirrored.push(`INDEX_CHROMA/${relPath}`);
            console.log(`📁 [LOCAL_DB] [MIRROR] Créé : INDEX_CHROMA/${relPath}`);
          }
          mirror(path.join(dir, item.name));
        }
      }
    };

    mirror(REGISTRY_ROOT_DIR);
    return { mirrored };
  }
};

