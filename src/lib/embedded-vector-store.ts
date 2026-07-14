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

interface StoredDoc {
  document: string;
  metadata?: Record<string, any>;
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
    fs.writeFileSync(STORE_PATH, JSON.stringify(_store), 'utf8');
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
      col[name][id] = { document: documents[i], metadata: metadatas?.[i] ?? {} };
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
  // Parité avec l'ancien Chroma local (embedding dummy à zéro) : renvoie tous
  // les documents ; le scoring sémantique réel est recalculé par local-indexer.
  query({ nResults }: { queryTexts?: string[]; nResults?: number; where?: any } = {}) {
    const col = load().collections[name] || {};
    const entries = Object.entries(col);
    const sliced = nResults ? entries.slice(0, nResults) : entries;
    return {
      ids: [sliced.map(([id]) => id)],
      documents: [sliced.map(([, d]) => d.document)],
      metadatas: [sliced.map(([, d]) => d.metadata ?? {})],
      distances: [sliced.map(() => 0)],
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
