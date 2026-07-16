/**
 * @fileOverview Gestion de la collection KnowledgeItem dans Weaviate Cloud.
 * Utilisé par le flux RAG en mode Web (IS_CLOUD=true) pour indexer et rechercher
 * les Q/R et procédures saisies par les utilisateurs.
 */

import { vectorizer } from 'weaviate-client';
import { withWeaviateClient } from '@/lib/weaviate-client';

export interface WeaviateKnowledgeItem {
  knowledgeId: string;
  userId: string;
  type: 'qa' | 'procedure';
  title: string;
  content: string;
  tags: string[];
  category: string;
  difficulty: string;
  isPublic: boolean;
  createdAt: string;
}

export interface WeaviateSearchResult {
  knowledgeId: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  score: number;
  distance?: number;
}

/**
 * Pour une requête nearText (vectorielle), Weaviate ne renseigne que `distance`
 * et `certainty` (jamais `score`, réservé aux recherches hybrides/BM25). On
 * dérive donc un score normalisé [0,1] à partir de la distance (ou certainty),
 * sinon les résultats auraient un score de 0 et seraient filtrés par le RAG.
 */
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const deriveScore = (metadata: any): number => {
  if (!metadata) return 0;
  if (typeof metadata.distance === 'number') return clamp01(1 - metadata.distance);
  if (typeof metadata.certainty === 'number') return clamp01(metadata.certainty);
  if (typeof metadata.score === 'number') return clamp01(metadata.score);
  return 0;
};

const COLLECTION_NAME = 'KnowledgeItem';

interface KnowledgeCollectionConfig {
  name: string;
  description: string;
  vectorizer: any;
  properties: any[];
}

const buildCollectionConfig = (): KnowledgeCollectionConfig => ({
  name: COLLECTION_NAME,
  description: 'Connaissances CCP Sousse — Q/R et Procédures industrielles',
  vectorizer: vectorizer.text2VecOpenAI({ model: 'text-embedding-3-small' }),
  properties: [
    { name: 'knowledgeId', dataType: 'text' as any },
    { name: 'userId', dataType: 'text' as any },
    { name: 'type', dataType: 'text' as any },
    { name: 'title', dataType: 'text' as any },
    { name: 'content', dataType: 'text' as any },
    { name: 'tags', dataType: 'text[]' as any },
    { name: 'category', dataType: 'text' as any },
    { name: 'difficulty', dataType: 'text' as any },
    { name: 'isPublic', dataType: 'boolean' as any },
    { name: 'createdAt', dataType: 'text' as any },
  ],
});

const collectionHasUsableVectorizer = (cfg: any): boolean => {
  const vectorizers = cfg?.vectorizers || {};
  return Object.values(vectorizers).some(
    (v: any) => v && v.vectorizer && v.vectorizer !== 'none'
  );
};

let _ensureCache: { ok: boolean; ts: number } | null = null;
const ENSURE_CACHE_TTL_MS = 5 * 60_000;

export async function ensureWeaviateCollection(): Promise<void> {
  const now = Date.now();
  if (_ensureCache && now - _ensureCache.ts < ENSURE_CACHE_TTL_MS) {
    if (!_ensureCache.ok) throw new Error('WEAVIATE_COLLECTION_NO_VECTORIZER');
    return;
  }

  try {
    await withWeaviateClient(async client => {
      const collections = client.collections;
      const existing = await collections.listAll();
      const names = existing.map((c: any) => c.name);

      if (!names.includes(COLLECTION_NAME)) {
        await collections.create(buildCollectionConfig());
        console.log(`[WEAVIATE] ✅ Collection '${COLLECTION_NAME}' créée (vectorizer text2vec-openai).`);
        _ensureCache = { ok: true, ts: now };
        return;
      }

      try {
        const collection = collections.get(COLLECTION_NAME);
        const cfg = await collection.config.get();
        if (!collectionHasUsableVectorizer(cfg)) {
          const msg = `Collection '${COLLECTION_NAME}' sans vectorizer : nearText renverra des scores à 0. Reconfigurez manuellement.`;
          console.error(`[WEAVIATE] ❌ ${msg}`);
          _ensureCache = { ok: false, ts: now };
          throw new Error(`WEAVIATE_COLLECTION_NO_VECTORIZER: ${msg}`);
        }
        _ensureCache = { ok: true, ts: now };
      } catch (cfgErr: any) {
        if (cfgErr.message?.startsWith('WEAVIATE_COLLECTION_NO_VECTORIZER')) {
          _ensureCache = { ok: false, ts: now };
          throw cfgErr;
        }
        console.warn(`[WEAVIATE] Vérification vectorizer ignorée :`, cfgErr.message);
        _ensureCache = { ok: true, ts: now };
      }
    });
  } catch (e: any) {
    if (e.message?.startsWith('WEAVIATE_COLLECTION_NO_VECTORIZER')) throw e;
    console.warn('[WEAVIATE] ensureWeaviateCollection échec non fatal:', e.message);
    _ensureCache = { ok: true, ts: now };
  }
}

export async function upsertKnowledgeItem(item: WeaviateKnowledgeItem): Promise<string> {
  await ensureWeaviateCollection();
  return withWeaviateClient(async client => {
    const collection = client.collections.get(COLLECTION_NAME);

    const existing = await collection.query.fetchObjects({
      filters: collection.filter.byProperty('knowledgeId').equal(item.knowledgeId),
      limit: 1,
    });

    if (existing.objects.length > 0) {
      const uuid = existing.objects[0].uuid;
      await collection.data.update({
        id: uuid,
        properties: item as any,
      });
      console.log(`[WEAVIATE] ♻️ Mis à jour : ${item.knowledgeId}`);
      return uuid;
    }

    const uuid = await collection.data.insert({
      properties: item as any,
    });
    console.log(`[WEAVIATE] ➕ Inséré : ${item.knowledgeId} (${item.type})`);
    return uuid as string;
  });
}

export async function deleteKnowledgeItem(knowledgeId: string): Promise<void> {
  await withWeaviateClient(async client => {
    const collection = client.collections.get(COLLECTION_NAME);
    const existing = await collection.query.fetchObjects({
      filters: collection.filter.byProperty('knowledgeId').equal(knowledgeId),
      limit: 1,
    });
      if (existing.objects.length > 0) {
        await collection.data.deleteById(existing.objects[0].uuid);
        console.log(`[WEAVIATE] 🗑️ Supprimé : ${knowledgeId}`);
      }
  });
}

export async function searchKnowledge(
  query: string,
  options: {
    nResults?: number;
    type?: 'qa' | 'procedure';
    publicOnly?: boolean;
  } = {}
): Promise<WeaviateSearchResult[]> {
  const { nResults = 5, type, publicOnly = false } = options;

  try {
    await ensureWeaviateCollection();
    return withWeaviateClient(async client => {
      const collection = client.collections.get(COLLECTION_NAME);

      const queryBuilder: any = {
        query,
        limit: nResults,
        returnMetadata: ['score', 'distance', 'certainty'],
      };

      if (type || publicOnly) {
        const filters: any[] = [];
        if (type) filters.push(collection.filter.byProperty('type').equal(type));
        if (publicOnly) filters.push(collection.filter.byProperty('isPublic').equal(true));
        queryBuilder.filters = filters.length === 1 ? filters[0] : (collection.filter as any).and(...filters);
      }

      const results = await collection.query.nearText(queryBuilder);

      return results.objects.map((obj: any) => ({
        knowledgeId: obj.properties.knowledgeId ?? '',
        type: obj.properties.type ?? '',
        title: obj.properties.title ?? '',
        content: obj.properties.content ?? '',
        tags: obj.properties.tags ?? [],
        score: deriveScore(obj.metadata),
        distance: typeof obj.metadata?.distance === 'number' ? obj.metadata.distance : undefined,
      }));
    });
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Erreur recherche :', err.message);
    return [];
  }
}

export async function getUnsyncedItems(since?: string): Promise<WeaviateSearchResult[]> {
  try {
    return withWeaviateClient(async client => {
      const collection = client.collections.get(COLLECTION_NAME);

      const queryBuilder: any = { limit: 200 };

      if (since) {
        queryBuilder.filters = collection.filter
          .byProperty('createdAt')
          .greaterThan(new Date(since) as any);
      }

      const results = await collection.query.fetchObjects(queryBuilder);

      return results.objects.map((obj: any) => ({
        knowledgeId: obj.properties.knowledgeId ?? '',
        type: obj.properties.type ?? '',
        title: obj.properties.title ?? '',
        content: obj.properties.content ?? '',
        tags: obj.properties.tags ?? [],
        score: 1,
      }));
    });
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Erreur récupération non-synchro :', err.message);
    return [];
  }
}
