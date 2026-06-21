import { createHybridRoute } from '@/lib/api-route-creator';
import { visionAssistantDescription } from '@/ai/flows/vision-assistant-description';

/**
 * API Route pour l'analyse visuelle industrielle hybride.
 */
export const POST = createHybridRoute<{ photoDataUri: string }, any>({
  name: 'VISION_DESCRIPTION',
  webHandler: async (req, body) => {
    const { photoDataUri } = body;

    if (!photoDataUri) {
      return new Response(JSON.stringify({ error: "DONNEE_VISUELLE_MANQUANTE" }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return await visionAssistantDescription({ photoDataUri });
  }
});
