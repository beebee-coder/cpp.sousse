export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { visualDocumentRetrieval } from '@/ai/flows/visual-document-retrieval';
import { config } from 'dotenv';

// Chargement des variables d'environnement à l'exécution
config();

/**
 * API Route pour la récupération de documents RAG hybride.
 * Audit : ⚡ [RAG_AUDIT] Recherche vectorielle indexée.
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

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn(`⚠️ Clé Google AI manquante pour le registre RAG.`);
    }

    return await visualDocumentRetrieval({ imageDataUri });
  },
  desktopFallback: async (body) => {
    const { imageDataUri } = body;
    return await visualDocumentRetrieval({ imageDataUri: imageDataUri || '' });
  }
});

