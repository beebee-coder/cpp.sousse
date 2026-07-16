/**
 * @fileOverview Indexation et recherche des actifs de la Banque d'Images/Vidéos
 * dans Weaviate Cloud. Permet au pipeline RAG (mode Web / Vercel serverless, FS
 * read-only) de retrouver les actifs Bank, comme pour les Q/R et procédures.
 *
 * En station locale (NODE_ENV prod / EXE), la vectorisation est gérée par le
 * store Chroma embarqué (cf. local-indexer.ts) ; ce module n'est sollicité
 * qu'en mode cloud où Weaviate est configuré.
 */

import { withWeaviateClient } from '@/lib/weaviate-client';

export interface BankAssetItem {
  assetId: string;
  name: string;
  type: 'image' | 'video';
  description: string;
  tags: string[];
  mime: string;
  url?: string;
  createdAt: string;
}

export interface BankSearchResult extends BankAssetItem {
  score: number;
}

const COLLECTION_NAME = 'BankAsset';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const deriveScore = (metadata: any): number => {
  if (!metadata) return 0;
  if (typeof metadata.distance === 'number') return clamp01(1 - metadata.distance);
  if (typeof metadata.certainty === 'number') return clamp01(metadata.certainty);
  if (typeof metadata.score === 'number') return clamp01(metadata.score);
  return 0;
};

export async function ensureBankCollection(): Promise<void> {
  return withWeaviateClient(async client => {
    const collections = client.collections;
    const existing = await collections.listAll();
    const names = existing.map((c: any) => c.name);

    if (!names.includes(COLLECTION_NAME)) {
      await collections.create({
        name: COLLECTION_NAME,
        description: 'Banque d’images/vidéos CCP Sousse — actifs industriels',
        properties: [
          { name: 'assetId', dataType: 'text' as any },
          { name: 'name', dataType: 'text' as any },
          { name: 'type', dataType: 'text' as any },
          { name: 'description', dataType: 'text' as any },
          { name: 'tags', dataType: 'text[]' as any },
          { name: 'mime', dataType: 'text' as any },
          { name: 'url', dataType: 'text' as any },
          { name: 'createdAt', dataType: 'text' as any },
        ],
      });
      console.log(`[WEAVIATE] ✅ Collection '${COLLECTION_NAME}' créée.`);
    }
  });
}

export async function upsertBankAsset(item: BankAssetItem): Promise<string> {
  await ensureBankCollection();
  return withWeaviateClient(async client => {
    const collection = client.collections.get(COLLECTION_NAME);

    const existing = await collection.query.fetchObjects({
      filters: collection.filter.byProperty('assetId').equal(item.assetId),
      limit: 1,
    });

    if (existing.objects.length > 0) {
      const uuid = existing.objects[0].uuid;
      await collection.data.update({ id: uuid, properties: item as any });
      console.log(`[WEAVIATE_BANK] ♻️ Mis à jour : ${item.assetId}`);
      return uuid as string;
    }

    const uuid = await collection.data.insert({ properties: item as any });
    console.log(`[WEAVIATE_BANK] ➕ Inséré : ${item.assetId} (${item.type})`);
    return uuid as string;
  });
}

export async function deleteBankAsset(assetId: string): Promise<void> {
  return withWeaviateClient(async client => {
    const collection = client.collections.get(COLLECTION_NAME);
    const existing = await collection.query.fetchObjects({
      filters: collection.filter.byProperty('assetId').equal(assetId),
      limit: 1,
    });
    if (existing.objects.length > 0) {
      await collection.data.deleteById(existing.objects[0].uuid);
      console.log(`[WEAVIATE_BANK] 🗑️ Supprimé : ${assetId}`);
    }
  });
}

export async function deleteAllBankAssets(): Promise<number> {
  return withWeaviateClient(async client => {
    const collection = client.collections.get(COLLECTION_NAME);
    const all = await collection.query.fetchObjects({ limit: 1000 });
    let deleted = 0;
    for (const obj of all.objects) {
      await collection.data.deleteById(obj.uuid);
      deleted++;
    }
    console.log(`[WEAVIATE_BANK] 🗑️ ${deleted} actif(s) supprimé(s).`);
    return deleted;
  });
}

export async function searchBankAssets(
  query: string,
  options: { type?: 'image' | 'video'; nResults?: number } = {}
): Promise<BankSearchResult[]> {
  const { type, nResults = 5 } = options;

  try {
    await ensureBankCollection();
    return withWeaviateClient(async client => {
      const collection = client.collections.get(COLLECTION_NAME);

      const queryBuilder: any = {
        query,
        limit: nResults,
        returnMetadata: ['score', 'distance', 'certainty'],
      };

      if (type) {
        queryBuilder.filters = collection.filter.byProperty('type').equal(type);
      }

      const results = await collection.query.nearText(queryBuilder);

      return results.objects.map((obj: any) => ({
        assetId: obj.properties.assetId ?? '',
        name: obj.properties.name ?? '',
        type: obj.properties.type ?? '',
        description: obj.properties.description ?? '',
        tags: obj.properties.tags ?? [],
        mime: obj.properties.mime ?? '',
        url: obj.properties.url ?? '',
        createdAt: obj.properties.createdAt ?? '',
        score: deriveScore(obj.metadata),
      }));
    });
  } catch (err: any) {
    console.error('[WEAVIATE_BANK] ❌ Erreur recherche :', err.message);
    return [];
  }
}
