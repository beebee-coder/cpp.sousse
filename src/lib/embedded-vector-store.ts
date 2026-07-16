import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Stockage vectoriel embarqué (sans serveur, sans Python).
 *
 * Remplace le serveur Chroma (Python) en station locale / EXE desktop / hybride.
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

const STORE_PATH = path.join(process.cwd(), '.data', 'embedded-chroma.json');

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

interface StoredDoc {
  document: string;
  metadata?: Record<string, any>;
  /** Embedding L2-normalisé (EMBED_DIM). Absent pour les anciens stores. */
  vector?: number[];
}
type CollectionMap = Record<string, StoredDoc>;
interface StoreShape {
  version: string;
  collections: Record<string, CollectionMap>;
}

let _store: StoreShape | null = null;
let _client: any = null;

const load = (): StoreShape => {
  if (_store) return _store;
  let store: StoreShape;
  try {
    if (fs.existsSync(STORE_PATH)) {
      store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    } else {
      store = { version: '1.0.0', collections: {} };
    }
  } catch {
    // Fichier corrompu : on repart propre.
    store = { version: '1.0.0', collections: {} };
  }
  if (!store.collections) store.collections = {};
  _store = store;
  return _store;
};

const save = () => {
  if (!_store) return;
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    }
    // Écriture atomique : on écrit dans un fichier temporaire puis on renomme.
    // `fs.renameSync` est atomique sur un même volume, ce qui évite qu'un crash
    // pendant l'écriture ne laisse un `embedded-chroma.json` tronqué/corrompu
    // (qui serait alors rechargé vide, perdant silencieusement tout l'index).
    const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(_store), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (e) {
    console.warn('[EMBEDDED_VEC] Échec de persistance :', (e as Error).message);
  }
};

const makeCollection = (name: string) => ({
  name,
  upsert({ ids, documents, metadatas }: { ids: string[]; documents: string[]; metadatas?: any[] }) {
    const col = load().collections;
    if (!col[name]) col[name] = {};
    ids.forEach((id, i) => {
      col[name][id] = {
        document: documents[i],
        metadata: metadatas?.[i] ?? {},
        vector: embed(documents[i] || ''),
      };
    });
    save();
  },
  get({ ids }: { ids?: string[] } = {}) {
    const col = load().collections[name] || {};
    const entries = Object.entries(col).filter(([id]) => !ids || ids.includes(id));
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

    const scored = entries.map(([id, doc]) => {
      // Rétro-compat : documents indexés avant l'ajout du champ `vector`.
      const vec = doc.vector && doc.vector.length ? doc.vector : embed(doc.document || '');
      const score = cosine(queryVec, vec); // dans [0, 1] (vecteurs positifs normalisés)
      return { id, doc, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const sliced = opts.nResults ? scored.slice(0, opts.nResults) : scored;
    return {
      ids: [sliced.map((s) => s.id)],
      documents: [sliced.map((s) => s.doc.document)],
      metadatas: [sliced.map((s) => s.doc.metadata ?? {})],
      // distance = 1 - similarité cosinus (cohérent avec chroma.ts).
      distances: [sliced.map((s) => 1 - Math.max(0, Math.min(1, s.score)))],
    };
  },
  delete({ ids }: { ids: string[] }) {
    const col = load().collections[name];
    if (!col) return;
    ids.forEach((id) => delete col[id]);
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
        save();
      }
      return makeCollection(name);
    },
    deleteCollection: async ({ name }: { name: string }) => {
      delete load().collections[name];
      save();
    },
  };
  return _client;
}
