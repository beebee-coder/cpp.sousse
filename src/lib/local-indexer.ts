import path from 'path';
import fs from 'fs';
import { localDB, getLocalDBRoot } from './db/local-db';
import { upsertDocuments, getChromaClient, listCollections, deleteCollection, SearchResult, fallbackSemanticSearch } from './chroma';
import { getLastEvictionCount } from './embedded-vector-store';
import { IS_CLOUD } from './config/env';

/**
 * @fileOverview Indexation et vectorisation des fichiers de la BDD Locale.
 * Chaque fichier texte/JSON est découpé en chunks, vectorisé et envoyé vers
 * ChromaDB dans une collection nommée d'après son chemin d'arborescence dans
 * la BDD Locale — reproduisant ainsi la même structure que la BDD Locale.
 */

// "Cloud" = Vercel serverless uniquement. Le build desktop (EXE) est en
// NODE_ENV=production mais reste local et doit vectoriser via Chroma.

const getMirrorFile = () => path.join(getLocalDBRoot(), 'chroma-index.json');

const TEXT_EXT = ['.json', '.txt', '.md', '.csv', '.xml', '.log', '.text', '.yaml', '.yml'];

export interface MirrorNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: MirrorNode[];
  metadata?: {
    collection?: string;
    relPath?: string;
    origin?: string;
    indexed?: boolean;
    [key: string]: any;
  };
}

interface MirrorEntry {
  relPath: string;
  name: string;
  parentDir: string;
  collection: string;
  ids: string[];
  indexedAt: string;
}

interface MirrorData {
  version: string;
  entries: MirrorEntry[];
}

const loadMirror = (): MirrorData => {
  try {
    if (fs.existsSync(getMirrorFile())) {
      return JSON.parse(fs.readFileSync(getMirrorFile(), 'utf8'));
    }
  } catch (e) {}
  return { version: '1.0.0', entries: [] };
};

const saveMirror = (data: MirrorData) => {
  try {
    if (!fs.existsSync(getLocalDBRoot())) fs.mkdirSync(getLocalDBRoot(), { recursive: true });
    const tmpPath = `${getMirrorFile()}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, getMirrorFile());
  } catch (e) {
    console.warn('[LOCAL_INDEXER] Échec écriture miroir:', (e as Error).message);
  }
};

/**
 * Nom de collection ChromaDB dérivé du chemin d'un dossier de la BDD Locale.
 * Les caractères non alphanumériques sont normalisés en tirets afin de
 * respecter les contraintes de nommage ChromaDB tout en restant stable.
 */
export const sanitizeCollectionName = (dirPath: string): string => {
  const base = dirPath === '.' || dirPath === '' ? 'racine' : dirPath;
  const slug = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const hash = fnv1aHash(base);
  const name = `locdb-${slug}-${hash}`;
  if (name.length <= 63) return name;
  const maxSlug = Math.max(0, 63 - 1 - 6 - 1);
  const truncatedSlug = slug.slice(0, maxSlug);
  return `locdb-${truncatedSlug}-${hash}`;
};

function fnv1aHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 6);
}

import { tokenizeWithStems } from '@/lib/ai/tokenizer';

/** Normalise et découpe un texte en tokens pertinents (sans mots vides).
 * Délégue au tokeniseur FR canonique partagé (C1 — unication JS/Rust). */
export const tokenizeText = (text: string): string[] => tokenizeWithStems(text);

const chunkText = (text: string, maxChunk = 1200): string[] => {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (buffer && buffer.length + para.length + 2 > maxChunk) {
      chunks.push(buffer);
      buffer = '';
    }
    buffer = buffer ? `${buffer}\n\n${para}` : para;
    while (buffer.length > maxChunk) {
      chunks.push(buffer.slice(0, maxChunk));
      buffer = buffer.slice(maxChunk);
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  if (chunks.length === 0) chunks.push(clean.slice(0, maxChunk));
  return chunks;
};

/**
 * Indexe et vectorise un fichier de la BDD Locale vers ChromaDB.
 * La collection cible reproduit l'arborescence du fichier dans la BDD Locale.
 */
export const indexLocalDBFile = async (relPath: string): Promise<{ success: boolean; collection?: string; chunkCount?: number; evicted?: number; error?: string; message?: string }> => {
  const chromaClient = await getChromaClient();
  if (!chromaClient) return { success: false, error: 'CHROMA_UNAVAILABLE' };

  const fullPath = path.join(getLocalDBRoot(), relPath);
  const ext = path.extname(relPath).toLowerCase();

  if (!TEXT_EXT.includes(ext)) {
    return {
      success: false,
      error: 'TYPE_NON_VECTORISABLE',
      message: 'Seuls les fichiers texte/JSON (json, txt, md, csv, xml, log, yaml) peuvent être vectorisés.'
    };
  }
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: 'FICHIER_INTROUVABLE' };
  }

  let raw: string;
  try {
    raw = await localDB.getFile(relPath);
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  let textToIndex = raw;
  if (ext === '.json') {
    try {
      textToIndex = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      textToIndex = raw;
    }
  }

  const chunks = chunkText(textToIndex);
  const parentDir = path.posix.dirname(relPath).replace(/\\/g, '/');
  const pathSegments = relPath.split('/').filter(Boolean).slice(0, -1);
  const collection = sanitizeCollectionName(parentDir);
  const name = path.basename(relPath);
  const ids = chunks.map((_, i) => `${relPath}#${i}`);

  // Le nom des répertoires et du fichier reflète le contenu : on l'intègre
  // au texte vectorisé pour que la recherche par arborescence soit pertinente.
  const pathHeader = `[ARBORESCENCE] ${pathSegments.join(' > ') || 'racine'} | FICHIER: ${name}`;

  try {
    await upsertDocuments(collection, chunks.map((c, i) => ({
      id: ids[i],
      content: `${pathHeader}\n[CONTENU]\n${c}`,
      metadata: {
        relPath,
        name,
        fileName: name,
        parentDir,
        pathSegments,
        chunkIndex: i,
        totalChunks: chunks.length,
        origin: 'VECTEURS_CHROMA',
        indexedAt: new Date().toISOString()
      }
    })));
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const mirror = loadMirror();
  mirror.entries = mirror.entries.filter(e => e.relPath !== relPath);
  mirror.entries.push({
    relPath,
    name,
    parentDir,
    collection,
    ids,
    indexedAt: new Date().toISOString()
  });
  saveMirror(mirror);

  const evicted = getLastEvictionCount();
  return { success: true, collection, chunkCount: chunks.length, evicted };
};

/**
 * Indexe et vectorise récursivement tous les fichiers texte d'un dossier
 * de la BDD Locale.
 */
export const indexLocalDBFolder = async (dirRelPath: string): Promise<{ success: boolean; indexed?: number; errors?: string[]; error?: string }> => {
  const chromaClient = await getChromaClient();
  if (!chromaClient) return { success: false, error: 'CHROMA_UNAVAILABLE' };

  const fullDir = path.join(getLocalDBRoot(), dirRelPath);
  if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) {
    return { success: false, error: 'DOSSIER_INTROUVABLE' };
  }

  let indexed = 0;
  const errors: string[] = [];

  const walk = async (dir: string, rel: string) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const abs = path.join(dir, item.name);
      const r = path.posix.join(rel, item.name).replace(/\\/g, '/');
      if (item.isDirectory()) {
        await walk(abs, r);
      } else if (TEXT_EXT.includes(path.extname(item.name).toLowerCase())) {
        const res = await indexLocalDBFile(r);
        if (res.success) indexed++;
        else errors.push(`${r}: ${res.error || 'ERREUR'}`);
      }
    }
  };

  await walk(fullDir, dirRelPath);
  return { success: true, indexed, errors };
};

export interface FolderIndexProgress {
  done: number;
  total: number;
}

/**
 * Variante d'`indexLocalDBFolder` avec suivi de progression.
 * `onProgress(done, total)` est appelé après chaque fichier traité,
 * permettant à l'UI d'afficher une barre/ligne de progression.
 */
export const indexLocalDBFolderWithProgress = async (
  dirRelPath: string,
  onProgress?: (p: FolderIndexProgress) => void
): Promise<{ success: boolean; indexed?: number; errors?: string[]; error?: string }> => {
  const chromaClient = await getChromaClient();
  if (!chromaClient) return { success: false, error: 'CHROMA_UNAVAILABLE' };

  const fullDir = path.join(getLocalDBRoot(), dirRelPath);
  if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) {
    return { success: false, error: 'DOSSIER_INTROUVABLE' };
  }

  // Comptage préalable des fichiers texte indexables pour le total.
  let total = 0;
  const count = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) count(abs);
      else if (TEXT_EXT.includes(path.extname(item.name).toLowerCase())) total++;
    }
  };
  count(fullDir);

  let done = 0;
  let indexed = 0;
  const errors: string[] = [];

  const walk = async (dir: string, rel: string) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const abs = path.join(dir, item.name);
      const r = path.posix.join(rel, item.name).replace(/\\/g, '/');
      if (item.isDirectory()) {
        await walk(abs, r);
      } else if (TEXT_EXT.includes(path.extname(item.name).toLowerCase())) {
        const res = await indexLocalDBFile(r);
        if (res.success) indexed++;
        else errors.push(`${r}: ${res.error || 'ERREUR'}`);
        done++;
        onProgress?.({ done, total });
      }
    }
  };

  await walk(fullDir, dirRelPath);
  return { success: true, indexed, errors };
};

/**
 * Reconstruit l'arborescence miroir (BDD Locale → ChromaDB) en reproduisant
 * EXACTEMENT la structure complète de la BDD Locale (tous les dossiers et
 * fichiers), en marquant les fichiers déjà indexés/vectorisés vers ChromaDB.
 * Chaque fichier est ainsi assigné à son emplacement d'origine dans Vecteurs ChromaDB.
 */
export const getLocalDBChromaTree = async (): Promise<MirrorNode[]> => {
  let tree: any[] = [];
  try {
    tree = await localDB.getTree();
  } catch (e) {
    tree = [];
  }

  const mirror = loadMirror();
  const indexedMap = new Map<string, MirrorEntry>();
  mirror.entries.forEach(e => indexedMap.set(e.relPath, e));

  const annotate = (nodes: any[]): MirrorNode[] => nodes.map((n: any) => {
    if (n.type === 'folder') {
      return {
        id: n.id,
        name: n.name,
        type: 'folder',
        isOpen: n.isOpen,
        metadata: n.metadata,
        children: annotate(n.children || [])
      };
    }
    const entry = indexedMap.get(n.id);
    return {
      id: n.id,
      name: n.name,
      type: 'file',
      size: n.size,
      metadata: {
        relPath: n.id,
        origin: 'LOCAL_DB',
        indexed: !!entry,
        collection: entry?.collection
      }
    };
  });

  return annotate(tree);
};

/**
 * Récupère le contenu vectorisé (concaténé) d'un fichier indexé dans ChromaDB.
 */
export const getIndexedDocumentContent = async (relPath: string): Promise<string | null> => {
  const mirror = loadMirror();
  const entry = mirror.entries.find(e => e.relPath === relPath);
  if (!entry) return null;

  try {
    const { getChromaClient } = await import('./chroma');
    const client = await getChromaClient();
    if (!client) {
      console.warn(`[LOCAL_INDEXER] Contenu vectorisé indisponible (moteur null) pour ${relPath}.`);
      return null;
    }
    const collection = await client.getCollection({ name: entry.collection });
    const result = await collection.get({ ids: entry.ids });
    const docs: string[] = (result.documents || []).filter(Boolean) as string[];
    return docs.join('\n\n');
  } catch (e: any) {
    console.warn('[LOCAL_INDEXER] Lecture Chroma échouée:', e.message);
    return null;
  }
};

/**
 * Supprime un fichier ou un répertoire (et tout son contenu) de Vecteurs ChromaDB.
 * Pour un répertoire, tous les fichiers indexés dont le chemin commence par
 * `relPath/` sont supprimés de leurs collections respectives. Les collections
 * vidées sont ensuite purgées.
 */
export const deleteChromaItem = async (relPath: string): Promise<{ success: boolean; deleted?: number; error?: string }> => {
  const chromaClient = await getChromaClient();
  if (!chromaClient) return { success: false, error: 'CHROMA_UNAVAILABLE' };

  const mirror = loadMirror();
  const matching = mirror.entries.filter(e => e.relPath === relPath || e.relPath.startsWith(`${relPath}/`));
  if (matching.length === 0) return { success: true, deleted: 0 };

  const affectedCollections = new Set<string>(matching.map(e => e.collection));

  try {
    const { getChromaClient } = await import('./chroma');
    const client = await getChromaClient();
    if (client) {
      for (const e of matching) {
        try {
          const col = await client.getCollection({ name: e.collection });
          await col.delete({ ids: e.ids });
        } catch {
          // Collection/Document déjà absent : on continue.
        }
      }
      // Purge les collections devenues vides
      for (const cName of affectedCollections) {
        const stillUsed = mirror.entries.some(e => e.collection === cName && !matching.includes(e));
        if (!stillUsed) {
          try { await client.deleteCollection({ name: cName }); } catch {}
        }
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const removed = new Set(matching.map(e => e.relPath));
  mirror.entries = mirror.entries.filter(e => !removed.has(e.relPath));
  saveMirror(mirror);

  return { success: true, deleted: matching.length };
};

/**
 * Recherche RAG « path-aware » dans Vecteurs ChromaDB.
 *
 * Interroge les vecteurs de la BDD Locale (collections `locdb-*`) en prenant en
 * compte :
 *  - le contenu de la QUESTION de l'utilisateur,
 *  - l'INTERACTION IA (historique de conversation fourni),
 *  - l'ARBORESCENCE : les noms de répertoires et de fichiers reflètent le
 *    contenu, ils sont donc fortement pondérés dans le score de pertinence.
 *
 * @param query    Question courante de l'utilisateur.
 * @param history  Fragments de l'interaction IA (historique) à considérer.
 * @param nResults Nombre de résultats à retourner.
 */
export const searchChromaLocalDB = async (
  query: string,
  history: string[] = [],
  nResults = 5
): Promise<SearchResult[]> => {
  const client = await getChromaClient();
  if (!client) return [];
  if (!query.trim() && history.length === 0) return [];

  const effectiveQuery = [...history.slice(-4), query].filter(Boolean).join(' ');
  const queryTokens = tokenizeText(effectiveQuery);
  if (queryTokens.length === 0) return [];

  let collections: any[] = [];
  try {
    collections = (await listCollections()).filter((c: any) => String(c.name).startsWith('locdb-'));
  } catch {
    return [];
  }

  const scored: SearchResult[] = [];

  for (const c of collections) {
    try {
      const collection = await client.getCollection({ name: c.name });
      // Requête via l'index cosinus du moteur (embedded ou Tauri) : pas de
      // re-scan O(N) de toute la collection. La sur-pondération path-aware est
      // déléguée au moteur via `where` (segments + nom de fichier).
      const results = await collection.query({
        queryTexts: [effectiveQuery],
        nResults: nResults * 2,
        where: {
          parentDir: undefined,
          pathSegments: queryTokens,
          fileName: undefined,
        },
      });

      const ids: string[] = results.ids?.[0] || [];
      const docs: string[] = results.documents?.[0] || [];
      const metas: any[] = results.metadatas?.[0] || [];
      const distances: number[] = results.distances?.[0] || [];

      ids.forEach((id, i) => {
        const meta = metas[i] || {};
        const dist = Number(distances[i] || 0);
        const score = 1 - Math.max(0, Math.min(1, dist));
        if (score > 0) {
          scored.push({
            id,
            document: String(docs[i] || ''),
            metadata: { ...meta, origin: 'VECTEURS_CHROMA' },
            distance: dist,
            score: Math.min(score, 0.98),
          });
        }
      });
    } catch {
      // Collection ignorée en cas d'erreur de lecture.
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, nResults);
};
