import { createHybridRoute } from '@/lib/api-route-creator';
import { dynamicChat } from '@/ai/flows/dynamic-chat-flow';

export const dynamic = 'force-dynamic';

/**
 * API Route pour le chat hybride Groq.
 */
export const POST = createHybridRoute<{ message: string; history: any[] }, any>({
  name: 'CHAT',
  webHandler: async (req, body) => {
    const { message, history } = body;
    return await dynamicChat({ message, history });
  }
});