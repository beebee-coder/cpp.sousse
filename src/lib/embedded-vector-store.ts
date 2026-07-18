import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Stockage vectoriel embarqué (sans serveur, sans Python).
 *
 * Implémentation locale d'un index de similarité cosinus par bag-of-words hashé
 * (FNV-1a, 384 dims). Ce n'est PAS un modèle Transformer (ex: all-MiniLM-L6-v2) :
 * c'est un surrogate lexical déterministe, sans dépendance externe, qui réplique
 * exactement la fonction d'embedding de `chroma.ts` pour garder un scoring
 * cohérent entre les deux couches JS.
 *
 * - Aucun processus externe, aucune installation utilisateur, aucune dépendance native.
 * - Persistant sur disque (`.data/embedded-chroma.json`, déjà gitignoré).
 * - Expose une API minimale compatible Chroma utilisée par `chroma.ts` et
 *   `local-indexer.ts` (listCollections / getCollection / getOrCreateCollection /
 *   deleteCollection + upsert / get / query / delete).
 *
 * Côté Vercel (IS_CLOUD), `getChromaClient()` renvoie `null` et le RAG cloud
 * (Neon / knowledgeItems) est utilisé à la place : ce module n'est donc jamais
 * chargé en production Vercel, préservant le quota de poids du déploiement.
 */

const STORE_PATH = process.env.EMBEDDED_VEC_TEST_STORE
  ? process.env.EMBEDDED_VEC_TEST_STORE
  : path.join(process.cwd(), '.data', 'embedded-chroma.json');
const STORE_BACKUP_PATH = `${STORE_PATH}.bak`;
const MAX_DOCUMENTS = 50000;
const MAX_STORE_BYTES = 50 * 1024 * 1024;

const EMBED_DIM = 384;
const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'ce', 'ces', 'pour', 'sur', 'dans', 'avec', 'est', 'sont']);

/** Tokenisation identique à celle de chroma.ts (cohérence du scoring). */
function embTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Embedding bag-of-words hashé sur EMBED_DIM dimensions, L2-normalisé.
 * Réplique la LocalEmbeddingFunction de chroma.ts pour que le store embarqué
 * fasse une vraie recherche vectorielle (cosinus) au lieu d'un simple comptage
 * de tokens — alignant les deux couches JS sur un scoring cohérent.
 */
function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = embTokenize(text);
  if (tokens.length === 0) return vec;

  const counts = new Map<number, number>();
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h = (h ^ tok.charCodeAt(i)) >>> 0;
      h = (h * 16777619) >>> 0;
    }
    const bucket = h % EMBED_DIM;
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  let norm = 0;
  for (const [bucket, count] of counts) {
    vec[bucket] = count;
    norm += count * count;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIM; i++) vec[i] = vec[i] / norm;

  return vec;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // vecteurs déjà L2-normalisés
}

/** Tokenisation lexique (sans mots vides) pour la sur-pondération path-aware. */
function tokenizeLocal(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9àâäéèêëïîôöùûüÿç\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

interface StoredDoc {
  document: string;
  metadata?: Record<string, any>;
  /** Embedding L2-normalisé (EMBED_DIM). Absent pour les anciens stores. */
  vector?: number[];
  /** Horodatage du dernier accès (LRU). */
  lastAccess?: number;
  /** Horodatage de la dernière écriture (last-write-wins en multi-tab). */
  updatedAt?: number;
}
type CollectionMap = Record<string, StoredDoc>;
interface StoreShape {
  version: string;
  collections: Record<string, CollectionMap>;
}

let _store: StoreShape | null = null;
let _client: any = null;

const now = () => Date.now();

const countDocuments = (store: StoreShape): number => {
  let count = 0;
  for (const col of Object.values(store.collections)) {
    count += Object.keys(col).length;
  }
  return count;
};

const storeSizeBytes = (store: StoreShape): number => {
  return Buffer.byteLength(JSON.stringify(store), 'utf8');
};

/** Nombre de documents évincés lors de la dernière application des limites. */
let _lastEvicted = 0;
export const getLastEvictionCount = (): number => _lastEvicted;

/** Abonnés notifiés à chaque éviction LRU (pour l'UI / télémétrie). */
type EvictionListener = (count: number) => void;
const _evictionListeners = new Set<EvictionListener>();

/** Enregistre un callback déclenché après chaque éviction LRU. Retourne une
 * fonction de désabonnement. Permet à l'UI d'afficher un toast quand des
 * vecteurs sont silencieusement supprimés. */
export const onEviction = (listener: EvictionListener): (() => void) => {
  _evictionListeners.add(listener);
  return () => {
    _evictionListeners.delete(listener);
  };
};

const evictLRU = (store: StoreShape, targetCount: number): void => {
  const entries: { col: string; id: string; lastAccess: number }[] = [];
  for (const [colName, col] of Object.entries(store.collections)) {
    for (const [id, doc] of Object.entries(col)) {
      entries.push({ col: colName, id, lastAccess: doc.lastAccess || 0 });
    }
  }
  entries.sort((a, b) => a.lastAccess - b.lastAccess);
  const toEvict = entries.slice(0, entries.length - targetCount);
  for (const e of toEvict) {
    delete store.collections[e.col]?.[e.id];
    if (store.collections[e.col] && Object.keys(store.collections[e.col]).length === 0) {
      delete store.collections[e.col];
    }
  }
  _lastEvicted = toEvict.length;
  if (toEvict.length > 0) {
    console.warn(`[EMBEDDED_VEC] LRU: ${toEvict.length} document(s) évincé(s).`);
    for (const l of _evictionListeners) {
      try { l(toEvict.length); } catch { /* listener ignoré */ }
    }
  }
};

const enforceStoreLimits = (store: StoreShape): void => {
  _lastEvicted = 0;
  const docCount = countDocuments(store);
  if (docCount > MAX_DOCUMENTS) {
    evictLRU(store, Math.floor(MAX_DOCUMENTS * 0.9));
  }
  const size = storeSizeBytes(store);
  if (size > MAX_STORE_BYTES) {
    evictLRU(store, Math.floor(docCount * 0.7));
  }
};

const validateStore = (store: StoreShape): boolean => {
  if (!store || typeof store !== 'object') return false;
  if (!store.collections || typeof store.collections !== 'object') return false;
  return true;
};

const load = (): StoreShape => {
  if (_store) return _store;
  let store: StoreShape;

  try {
    if (fs.existsSync(STORE_PATH)) {
      store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (!validateStore(store)) {
        throw new Error('Store invalide');
      }
    } else {
      store = { version: '1.0.0', collections: {} };
    }
  } catch {
    // Fichier corrompu : on tente le backup.
    try {
      if (fs.existsSync(STORE_BACKUP_PATH)) {
        store = JSON.parse(fs.readFileSync(STORE_BACKUP_PATH, 'utf8'));
        if (!validateStore(store)) {
          throw new Error('Backup invalide');
        }
        console.warn('[EMBEDDED_VEC] Backup restauré après corruption du store principal.');
      } else {
        store = { version: '1.0.0', collections: {} };
      }
    } catch {
      store = { version: '1.0.0', collections: {} };
    }
  }
  if (!store.collections) store.collections = {};
  _store = store;
  return _store;
};

/**
 * Recharge le store depuis le disque et fusionne les collections/absent(e)s
 * dans l'état mémoire _store, sans écraser les documents déjà présents en
 * mémoire (mutations en attente de flush). Évite qu'une écriture concurrente
 * n'écrase silencieusement les documents indexés par ailleurs.
 */
const mergeFromDisk = (): void => {
  if (!_store) return;
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const onDisk: StoreShape = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!validateStore(onDisk)) return;
    for (const [colName, col] of Object.entries(onDisk.collections)) {
      if (!_store.collections[colName]) {
        // Collection entière absente en mémoire : on la prend telle quelle.
        _store.collections[colName] = col;
      } else {
        for (const [id, doc] of Object.entries(col)) {
          const mem = _store.collections[colName][id];
          if (!mem) {
            // Document absent en mémoire : on le fusionne.
            _store.collections[colName][id] = doc;
          } else {
            // Document présent des deux côtés : last-write-wins sur updatedAt
            // (fallback sur lastAccess, puis sur la présence d'un embedding).
            const diskTs = doc.updatedAt ?? doc.lastAccess ?? 0;
            const memTs = mem.updatedAt ?? mem.lastAccess ?? 0;
            if (diskTs > memTs) {
              _store.collections[colName][id] = doc;
            }
          }
        }
      }
    }
  } catch {
    // Disque illisible/corrompu : on conserve l'état mémoire tel quel.
  }
};

let _saveChain: Promise<void> = Promise.resolve();
const STORE_LOCK_PATH = `${STORE_PATH}.lock`;

/**
 * Verrou inter-processus (advisory lock sur fichier) pour sérialiser les
 * écritures entre workers Next.js distincts qui partagent le même fichier
 * `.data/embedded-chroma.json` mais pas le même `_store` en mémoire. Sans
 * cela, deux process écrivent tour à tour et s'écrasent mutuellement.
 * Le verrou utilise `fs.openSync` exclusif (WX) avec attente bornée.
 */
const withFileLock = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      const fd = fs.openSync(STORE_LOCK_PATH, 'wx');
      fs.closeSync(fd);
      try {
        return await fn();
      } finally {
        try { fs.unlinkSync(STORE_LOCK_PATH); } catch { /* ignore */ }
      }
    } catch (e: any) {
      if (e?.code === 'EEXIST' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }
      // Pas de verrou disponible : on tente quand même (dégradé) plutôt que
      // de perdre la mutation.
      return await fn();
    }
  }
};

/**
 * Fenêtre de coalescence (ms) : pendant une indexation de dossier, N appels
 * `save()` successifs arrivent en rafale. Au lieu de réécrire le JSON complet
 * (jusqu'à 50 Mo) à chaque appel, on regroupe les écritures disque sur une
 * courte fenêtre — les mutations sont appliquées immédiatement en mémoire
 * (`_store`), seule la persistance est différée et coalescée.
 */
const SAVE_COALESCE_MS = 150;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _saveFlushing = false;

const persistNow = async (): Promise<void> => {
  if (_saveFlushing) return;
  _saveFlushing = true;
  try {
    await withFileLock(async () => {
      // Recharge les docs absents du disque juste avant l'écriture, afin de
      // ne pas écraser les documents indexés par un autre process entre-temps.
      mergeFromDisk();
      if (!fs.existsSync(path.dirname(STORE_PATH))) {
        fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      }
      enforceStoreLimits(_store!);
      const json = JSON.stringify(_store);
      const tmpPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, json, 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
      try {
        fs.writeFileSync(STORE_BACKUP_PATH, json, 'utf8');
      } catch {
        // backup non critique
      }
    });
  } catch (e) {
    console.error('[EMBEDDED_VEC] Échec de persistance :', (e as Error).message);
  } finally {
    _saveFlushing = false;
  }
};

const save = (): void => {
  // File d'attente : sérialise la planification des persistance pour ne jamais
  // écrire un état partiellement écrasé par une écriture concurrente.
  _saveChain = _saveChain.then(async () => {
    if (!_store) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    await new Promise<void>((resolve) => {
      _saveTimer = setTimeout(async () => {
        _saveTimer = null;
        await persistNow();
        resolve();
      }, SAVE_COALESCE_MS);
    });
  });
};

/** Attend la fin de toutes les écritures en file d'attente. */
const flush = (): Promise<void> => {
  // Annule le timer en attente et force une écriture immédiate, puis attend la
  // fin de la file pour garantir la durabilité (utilisé par les tests et les
  // appels `getOrCreateCollection`/`deleteCollection`).
  _saveChain = _saveChain.then(async () => {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    await persistNow();
  });
  return _saveChain;
};

const makeCollection = (name: string) => ({
  name,
  count(): number {
    const col = load().collections[name] || {};
    return Object.keys(col).length;
  },
  upsert({ ids, documents, metadatas }: { ids: string[]; documents: string[]; metadatas?: any[] }) {
    const col = load().collections;
    if (!col[name]) col[name] = {};
    ids.forEach((id, i) => {
      const entry: StoredDoc = {
        document: documents[i],
        metadata: metadatas?.[i] ?? {},
        vector: embed(documents[i] || ''),
        lastAccess: now(),
        updatedAt: now(),
      };
      col[name][id] = entry;
    });
    save();
  },
  get({ ids }: { ids?: string[] } = {}) {
    const col = load().collections[name] || {};
    const entries = Object.entries(col).filter(([id]) => !ids || ids.includes(id));
    // Pas de touch LRU en lecture : évite une réécriture intégrale du store
    // (50 Mo) à chaque appel de recherche. Le LRU est recalculé à l'écriture.
    return {
      ids: entries.map(([id]) => id),
      documents: entries.map(([, d]) => d.document),
      metadatas: entries.map(([, d]) => d.metadata ?? {}),
    };
  },
  query(opts: { queryTexts?: string[]; nResults?: number; where?: any } = {}) {
    const col = load().collections[name] || {};
    const entries = Object.entries(col);
    const queryVec = embed(opts.queryTexts?.[0] || '');

    // Sur-pondération « path-aware » : le where transporte les segments de
    // l'arborescence BDD Locale + le nom de fichier. Le moteur cosinus reste la
    // source de vérité mais on bonifie les documents dont le chemin contient
    // les tokens de la requête, alignant le scoring avec local-indexer.
    const pathBoost = (() => {
      const w = opts.where;
      if (!w || typeof w !== 'object') return null;
      const segs: string[] = [];
      if (Array.isArray(w.pathSegments)) segs.push(...w.pathSegments);
      if (typeof w.parentDir === 'string') segs.push(...w.parentDir.split('/').filter(Boolean));
      if (typeof w.fileName === 'string') segs.push(w.fileName);
      return segs
        .join(' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    })();

    const queryTokens = tokenizeLocal(opts.queryTexts?.[0] || '');

    const scored = entries.map(([id, doc]) => {
      const vec = doc.vector && doc.vector.length ? doc.vector : embed(doc.document || '');
      let score = cosine(queryVec, vec);
      if ((pathBoost || queryTokens.length) && score > 0) {
        const docPath = [
          ...(Array.isArray(doc.metadata?.pathSegments) ? doc.metadata.pathSegments : []),
          String(doc.metadata?.parentDir || ''),
          String(doc.metadata?.fileName || doc.metadata?.name || ''),
        ]
          .join(' ')
          .toLowerCase();
        let boost = 0;
        const tokens = pathBoost || queryTokens;
        for (const t of tokens) {
          if (docPath.includes(t)) boost += 0.15;
        }
        score = Math.min(1, score + boost);
      }
      return { id, doc, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const sliced = opts.nResults ? scored.slice(0, opts.nResults) : scored;
    // Pas de touch LRU en lecture (cf. get) : la recherche ne déclenche pas de
    // réécriture disque. Le LRU est recalculé lors du prochain upsert/delete.
    return {
      ids: [sliced.map((s) => s.id)],
      documents: [sliced.map((s) => s.doc.document)],
      metadatas: [sliced.map((s) => s.doc.metadata ?? {})],
      distances: [sliced.map((s) => 1 - Math.max(0, Math.min(1, s.score)))],
    };
  },
  delete({ ids }: { ids: string[] }) {
    const col = load().collections[name];
    if (!col) return;
    for (const id of ids) {
      delete col[id];
    }
    save();
  },
});

export async function getEmbeddedChromaClient(): Promise<any> {
  if (_client) return _client;
  _client = {
    listCollections: async () =>
      Object.keys(load().collections).map((name) => ({ name })),
    getCollection: async ({ name }: { name: string }) => {
      if (!load().collections[name]) throw new Error(`Collection introuvable : ${name}`);
      return makeCollection(name);
    },
    getOrCreateCollection: async ({ name }: { name: string }) => {
      const store = load();
      if (!store.collections[name]) {
        store.collections[name] = {};
        await flush();
      }
      return makeCollection(name);
    },
    deleteCollection: async ({ name }: { name: string }) => {
      delete load().collections[name];
      await flush();
    },
    flush,
  };
  return _client;
}
