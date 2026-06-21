
import { createHybridRoute } from '@/lib/api-route-creator';
import { semanticSearch } from '@/lib/chroma';
import { getWeaviateClient } from '@/lib/weaviate-client';

/**
 * API Route de recherche sémantique hybride.
 * Vercel (Cloud) -> Weaviate | Dev (Local) -> ChromaDB
 */
export const POST = createHybridRoute<{ collection: string; query: string; nResults?: number }, any>({
  name: 'VECTOR_SEARCH',
  webHandler: async (req, body) => {
    const { collection, query, nResults = 5 } = body;
    const timestamp = new Date().toLocaleTimeString();
    const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    // 📡 MODE CLOUD : Weaviate
    if (isCloud) {
      try {
        console.log(`📡 [${timestamp}] [WEAVIATE_CLOUD] Recherche sémantique...`);
        const client = await getWeaviateClient();
        const className = collection.charAt(0).toUpperCase() + collection.slice(1);
        
        const result = await client.graphql
          .get()
          .withClassName(className)
          .withFields('question answer _additional { distance }')
          .withNearText({ concepts: [query] })
          .withLimit(nResults)
          .do();

        const data = (result.data.Get as any)[className] || [];
        const formatted = data.map((item: any) => ({
          id: item.id || 'cloud-id',
          document: `Question: ${item.question}\nRéponse: ${item.answer}`,
          metadata: { provider: 'weaviate-cloud' },
          score: 1 - (item._additional?.distance || 0)
        }));

        return { success: true, results: formatted, provider: 'WEAVIATE_CLOUD' };
      } catch (e: any) {
        console.error(`⚠️ [WEAVIATE] Échec :`, e.message);
      }
    }

    // 🧠 MODE LOCAL : ChromaDB
    try {
      console.log(`🧠 [${timestamp}] [CHROMA_LOCAL] Recherche sémantique...`);
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
