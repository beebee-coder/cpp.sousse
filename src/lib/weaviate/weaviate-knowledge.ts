/**
 * @fileOverview Gestion de la collection KnowledgeItem dans Weaviate Cloud.
 * Utilisé par le flux RAG en mode Web (IS_CLOUD=true) pour indexer et rechercher
 * les Q/R et procédures saisies par les utilisateurs.
 */

import { getWeaviateClient } from './weaviate-cloud-client';

export interface WeaviateKnowledgeItem {
  knowledgeId: string;
  userId: string;
  type: 'qa' | 'procedure';
  title: string;
  content: string; // Texte complet pour embedding
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
}

const COLLECTION_NAME = 'KnowledgeItem';

// ─────────────────────────────────────────────────────────────────────────────
// Assure que la collection Weaviate existe avec le bon schéma
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureWeaviateCollection(): Promise<void> {
  try {
    const client = await getWeaviateClient();
    const collections = client.collections;

    const existing = await collections.listAll();
    const names = existing.map((c: any) => c.name);

    if (!names.includes(COLLECTION_NAME)) {
      await collections.create({
        name: COLLECTION_NAME,
        description: 'Connaissances CCP Sousse — Q/R et Procédures industrielles',
        properties: [
          { name: 'knowledgeId', dataType: 'text' as any },
          { name: 'userId',      dataType: 'text' as any },
          { name: 'type',        dataType: 'text' as any },
          { name: 'title',       dataType: 'text' as any },
          { name: 'content',     dataType: 'text' as any },
          { name: 'tags',        dataType: 'text[]' as any },
          { name: 'category',    dataType: 'text' as any },
          { name: 'difficulty',  dataType: 'text' as any },
          { name: 'isPublic',    dataType: 'boolean' as any },
          { name: 'createdAt',   dataType: 'text' as any },
        ],
      });
      console.log(`[WEAVIATE] ✅ Collection '${COLLECTION_NAME}' créée.`);
    }
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Erreur création collection :', err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexe (ou met à jour) un KnowledgeItem dans Weaviate
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertKnowledgeItem(item: WeaviateKnowledgeItem): Promise<string> {
  await ensureWeaviateCollection();
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);

  // Rechercher si un objet avec le même knowledgeId existe déjà
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Recherche sémantique dans Weaviate Cloud
// ─────────────────────────────────────────────────────────────────────────────
export async function searchKnowledge(
  query: string,
  options: {
    nResults?: number;
    type?: 'qa' | 'procedure';
    publicOnly?: boolean;
  } = {}
): Promise<WeaviateSearchResult[]> {
  const { nResults = 5, type, publicOnly = true } = options;

  try {
    await ensureWeaviateCollection();
    const client = await getWeaviateClient();
    const collection = client.collections.get(COLLECTION_NAME);

    const queryBuilder: any = {
      query,
      limit: nResults,
      returnMetadata: ['score', 'distance'],
    };

    // Filtres optionnels
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
      score: obj.metadata?.score ?? 0,
    }));
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Erreur recherche :', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Récupère tous les items NON encore synchronisés vers ChromaDB local
// Utilisé par /api/sync/download pour le delta sync
// ─────────────────────────────────────────────────────────────────────────────
export async function getUnsyncedItems(since?: string): Promise<WeaviateSearchResult[]> {
  try {
    const client = await getWeaviateClient();
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
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Erreur récupération non-synchro :', err.message);
    return [];
  }
}
