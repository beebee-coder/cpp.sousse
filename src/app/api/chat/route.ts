export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { dynamicChat } from '@/ai/flows/dynamic-chat-flow';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Fonction pour charger les variables d'environnement depuis .env à l'exécution
function loadEnvAtRuntime() {
  try {
    if (process.env.NODE_ENV === 'development') return process.env;
    
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) return process.env;

    const content = readFileSync(envPath, 'utf-8');
    const envVars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length) {
          envVars[key.trim()] = values.join('=').trim();
        }
      }
    });
    return { ...process.env, ...envVars };
  } catch (error) {
    return process.env;
  }
}

/**
 * API Route pour le chat hybride Groq/Local.
 * Audit : 🚀 [API_CHAT] Flux Groq Only Hybride.
 */
export const POST = createHybridRoute<{ message: string; history: any[] }, any>({
  name: 'CHAT',
  webHandler: async (req, body) => {
    const env = loadEnvAtRuntime();
    const { message, history } = body;

    const groqKey = env.GROQ_API_KEY || env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!groqKey) {
      throw new Error("Clé Groq non configurée dans le fichier .env local.");
    }

    // On force l'usage de la clé dans le process pour le flow
    process.env.GROQ_API_KEY = groqKey;

    return await dynamicChat({ message, history });
  },
  desktopFallback: async (body) => {
    return {
      response: `🤖 [VisioNode Offline] Mode bureau/local actif. Message traité : "${body.message}"`,
      history: body.history || [],
      offline: true,
      provider: 'local-mock'
    };
  }
});
