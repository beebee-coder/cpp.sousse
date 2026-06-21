import { createHybridRoute } from '@/lib/api-route-creator';
import { dynamicChat } from '@/ai/flows/dynamic-chat-flow';

/**
 * API Route pour le chat hybride Groq.
 * S'exécute uniquement sur le serveur (Vercel ou Dev local).
 */
export const POST = createHybridRoute<{ message: string; history: any[] }, any>({
  name: 'CHAT',
  webHandler: async (req, body) => {
    const { message, history } = body;
    return await dynamicChat({ message, history });
  }
});
