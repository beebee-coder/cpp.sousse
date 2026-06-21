export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { semanticSearch } from '@/lib/chroma';

export const POST = createHybridRoute<{ collection: string; query: string; nResults?: number; whereFilter?: any }, any>({
  name: 'VECTOR_SEARCH_POST',
  webHandler: async (req, body) => {
    const { collection, query, nResults = 5, whereFilter } = body;
    if (!collection || typeof collection !== 'string') {
      return new Response(JSON.stringify({ error: 'Le champ "collection" est requis.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Le champ "query" est requis.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const results = await semanticSearch({
      collectionName: collection,
      query,
      nResults: Math.min(nResults, 20),
      whereFilter,
    });
    return { success: true, query, collection, count: results.length, results };
  },
  desktopFallback: async (body) => {
    return { success: true, query: body.query || '', collection: body.collection || '', count: 0, results: [] };
  }
});

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_SEARCH_GET',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const query = searchParams.get('query');
    const nResults = parseInt(searchParams.get('n') || '5', 10);
    if (!collection || !query) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const results = await semanticSearch({
      collectionName: collection,
      query,
      nResults: Math.min(nResults, 20),
    });
    return { success: true, query, collection, count: results.length, results };
  },
  desktopFallback: async () => {
    return { success: true, count: 0, results: [] };
  }
});
