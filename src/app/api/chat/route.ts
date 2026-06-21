
import { createHybridRoute } from '@/lib/api-hybrid';
import { dynamicChat } from '@/ai/flows/dynamic-chat-flow';

/**
 * API Route pour le chat hybride Groq.
 * S'exécute uniquement sur le serveur (Vercel ou Dev local).
 */
export const POST = createHybridRoute<{ message: string; history: any[] }, any>({
  name: 'CHAT',
  webHandler: async (req, body) => {
    const { message, history } = body;

    if (!process.env.GROQ_API_KEY) {
      console.warn("⚠️ Clé GROQ_API_KEY manquante dans l'environnement serveur.");
    }

    return await dynamicChat({ message, history });
  },
  desktopFallback: async (body) => {
    return {
      text: `🤖 [VisioNode Offline] Mode bureau actif. Message : "${body.message}"`,
      provider: 'local-mock'
    };
  }
});
