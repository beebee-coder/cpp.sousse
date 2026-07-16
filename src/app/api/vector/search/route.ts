export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { searchKnowledge } from '@/lib/weaviate/weaviate-knowledge';

export interface VectorSearchBody {
  collection: string;
  query: string;
  nResults?: number;
}

export const POST = createHybridRoute<VectorSearchBody, any>({
  name: 'VECTOR_SEARCH',
  webHandler: async (req, body) => {
    const { collection, query, nResults = 5 } = body;
    const timestamp = new Date().toLocaleTimeString();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { success: false, error: 'Requête de recherche vide', results: [] };
    }

    // Recherche sémantique unifiée dans la collection Weaviate `KnowledgeItem`
    // (procédures + Q/R). Le filtre `type` reste optionnel pour restreindre aux Q/R.
    const typeFilter = collection && /qa|question/i.test(collection) ? ('qa' as const) : undefined;

    try {
      console.log(`📡 [${timestamp}] [WEAVIATE_CLOUD] Recherche sémantique...`);
      const items = await searchKnowledge(query, { nResults, type: typeFilter, publicOnly: false });

      const results = items.map(item => ({
        id: item.knowledgeId || 'cloud-id',
        document: item.content || `Question: ${item.title}`,
        metadata: { provider: 'weaviate-cloud', type: item.type, title: item.title, tags: item.tags },
        score: item.score,
      }));

      return { success: true, results, provider: 'WEAVIATE_CLOUD' };
    } catch (e: any) {
      console.error(`⚠️ [WEAVIATE] Échec :`, e.message);
      return { success: false, error: 'CLOUD_SEARCH_FAILED', results: [] };
    }
  },
});
