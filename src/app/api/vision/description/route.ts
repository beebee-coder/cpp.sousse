export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { visionAssistantDescription } from '@/ai/flows/vision-assistant-description';
import { config } from 'dotenv';

// Chargement des variables d'environnement à l'exécution
config();

/**
 * API Route pour l'analyse visuelle industrielle hybride.
 * Audit : ⚡ [VISION_AUDIT] Traitement par Gemini 1.5 Flash Hybride.
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

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn(`⚠️ Clé Google AI manquante dans le .env.`);
    }

    return await visionAssistantDescription({ photoDataUri });
  },
  desktopFallback: async (body) => {
    return {
      description: "🤖 [VisioNode Offline] Analyse visuelle simulée en mode local. Statut : Composants industriels OK.",
      tags: ["offline", "simulated", "industrial-board"],
      offline: true,
      provider: 'local-mock'
    };
  }
});
