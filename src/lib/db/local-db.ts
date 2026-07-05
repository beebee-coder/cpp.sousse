import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Base de données locale physique [LOCAL_DB].
 * Structure arborescente pour l'Explorateur BDD et l'exploitation IA.
 *
 * Deux répertoires principaux :
 * 1. INDEX_CHROMA  - Résultat accumulatif des fichiers injectés lors de la sync.
 *                    Gestion des doublons par nom de fichier via dossiers indexés.
 * 2. Centrale      - Répertoire central pour l'arborescence future.
 */

const LOCAL_DB_ROOT = path.join(process.cwd(), '.local-db');
const INDEX_CHROMA_DIR = path.join(LOCAL_DB_ROOT, 'INDEX_CHROMA');
const CENTRALE_DIR = path.join(LOCAL_DB_ROOT, 'Centrale');
const MANIFEST_FILE = path.join(LOCAL_DB_ROOT, 'local-db-manifest.json');

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
  };
}

const ensureLocalDB = () => {
  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    fs.mkdirSync(LOCAL_DB_ROOT, { recursive: true });
  }
  [INDEX_CHROMA_DIR, CENTRALE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  if (!fs.existsSync(MANIFEST_FILE)) {
    const initial: LocalDBManifest = {
      files: [],
      lastSync: new Date(0).toISOString(),
      version: '1.0.0'
    };
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(initial, null, 2), 'utf8');
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

/**
 * Résout le chemin cible pour un fichier injecté dans INDEX_CHROMA.
 *
 * Règles de duplication :
 * - 1er fichier nommé "X.ext"       → INDEX_CHROMA/X.ext
 * - 2e fichier nommé "X.ext"        → dossier INDEX_CHROMA/X.ext/ créé,
 *                                      déplacement du 1er en 1_X.ext,
 *                                      sauvegarde du 2e en 2_X.ext
 * - Nième fichier nommé "X.ext"     → INDEX_CHROMA/X.ext/N_X.ext
 */
const resolveTargetPath = (fileName: string): string => {
  const basePath = path.join(INDEX_CHROMA_DIR, fileName);

  if (!fs.existsSync(basePath)) {
    return path.posix.join('INDEX_CHROMA', fileName).replace(/\\/g, '/');
  }

  const stats = fs.statSync(basePath);
  if (stats.isFile()) {
    const folderPath = path.join(INDEX_CHROMA_DIR, fileName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const firstIndexed = path.join(folderPath, `1_${fileName}`);
    fs.renameSync(basePath, firstIndexed);
  }

  const folderPath = path.join(INDEX_CHROMA_DIR, fileName);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const existingFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(path.extname(fileName)));
  const nextIndex = existingFiles.length + 1;
  return path.posix.join('INDEX_CHROMA', fileName, `${nextIndex}_${fileName}`).replace(/\\/g, '/');
};

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

    return rootNodes;
  },

  /**
   * Injecte un fichier dans INDEX_CHROMA avec gestion des doublons.
   */
  async injectFile(fileName: string, content: string, metadata?: {
    knowledgeType?: string;
    cloudId?: string;
    tags?: string[];
  }): Promise<{ success: boolean; path: string; isDuplicate: boolean }> {
    ensureLocalDB();

    const targetPath = resolveTargetPath(fileName);
    const fullPath = path.join(LOCAL_DB_ROOT, targetPath);
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

    const isDuplicate = targetPath.includes(path.join(fileName, '/'));

    console.log(`✅ [LOCAL_DB] [INJECT] ${fileName} → ${targetPath}${isDuplicate ? ' (doublon géré)' : ''}`);

    return { success: true, path: targetPath, isDuplicate };
  },

  /**
   * Lit le contenu d'un fichier dans la BDD locale.
   */
  async getFile(relativePath: string): Promise<string> {
    const fullPath = path.join(LOCAL_DB_ROOT, relativePath);
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
    const fullPath = path.join(LOCAL_DB_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) return false;

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    const manifest = loadManifest();
    manifest.files = manifest.files.filter(f => f.resolvedPath !== relativePath);
    saveManifest(manifest);

    console.log(`🗑️ [LOCAL_DB] [DELETE] ${relativePath}`);
    return true;
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
   */
  async initialize(): Promise<void> {
    ensureLocalDB();
    console.log('✅ [LOCAL_DB] Structure initialisée.');
  }
};
