import { createHybridRoute } from '@/lib/api-route-creator';
import { visualDocumentRetrieval } from '@/ai/flows/visual-document-retrieval';

/**
 * API Route pour la récupération de documents RAG hybride.
 */
export const POST = createHybridRoute<{ imageDataUri: string }, any>({
  name: 'VISION_RETRIEVAL',
  webHandler: async (req, body) => {
    const { imageDataUri } = body;

    if (!imageDataUri) {
      return new Response(JSON.stringify({ error: "IMAGE_RAG_MANQUANTE" }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return await visualDocumentRetrieval({ imageDataUri });
  }
});
