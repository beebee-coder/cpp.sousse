
import { createHybridRoute } from '@/lib/api-route-creator';
import { semanticSearch } from '@/lib/chroma';
import { getWeaviateClient } from '@/lib/weaviate-client';

/**
 * API Route de recherche sémantique hybride.
 * Web : Weaviate Cloud | Dev/Local : ChromaDB
 */
export const POST = createHybridRoute<{ collection: string; query: string; nResults?: number }, any>({
  name: 'VECTOR_SEARCH',
  webHandler: async (req, body) => {
    const { collection, query, nResults = 5 } = body;
    const timestamp = new Date().toLocaleTimeString();

    // Mode Web (Vercel) -> Weaviate Cloud
    if (process.env.VERCEL || process.env.USE_CLOUD_VECTOR) {
      try {
        console.log(`📡 [${timestamp}] [WEAVIATE] Recherche Cloud sémantique...`);
        const client = await getWeaviateClient();
        const result = await client.graphql
          .get()
          .withClassName(collection.charAt(0).toUpperCase() + collection.slice(1)) // Convention Weaviate
          .withFields('question answer _additional { distance }')
          .withNearText({ concepts: [query] })
          .withLimit(nResults)
          .do();

        const formatted = (result.data.Get as any)[Object.keys(result.data.Get)[0]].map((item: any) => ({
          id: item.id || 'cloud-id',
          document: `Question: ${item.question}\nRéponse: ${item.answer}`,
          metadata: { provider: 'weaviate-cloud' },
          score: 1 - (item._additional?.distance || 0)
        }));

        return { success: true, results: formatted, provider: 'WEAVIATE_CLOUD' };
      } catch (e: any) {
        console.error(`⚠️ [${timestamp}] [WEAVIATE] Erreur Cloud :`, e.message);
        // Fallback Chroma Local si configuré en dev
      }
    }

    // Mode Local (Dev) -> ChromaDB
    try {
      console.log(`🧠 [${timestamp}] [CHROMA] Recherche locale sémantique...`);
      const results = await semanticSearch({
        collectionName: collection || 'industrial_manuals',
        query,
        nResults,
      });
      return { success: true, results, provider: 'CHROMADB_LOCAL' };
    } catch (error: any) {
      return { success: false, error: error.message, results: [] };
    }
  }
});
