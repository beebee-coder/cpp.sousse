import { NextResponse } from 'next/server';
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
 * API Route pour le chat exclusif Groq.
 * Audit : 🚀 [API_CHAT] Flux Groq Only.
 */
export async function POST(req: Request) {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const env = loadEnvAtRuntime();
    const body = await req.json();
    const { message, history } = body;
    
    console.log(`📡 [${timestamp}] [API_CHAT] Réception commande.`);

    const groqKey = env.GROQ_API_KEY || env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!groqKey) {
      console.warn(`⚠️ [${timestamp}] [API_CHAT] GROQ_API_KEY manquante.`);
      return NextResponse.json({ 
        error: "ERREUR_LIAISON_CRITIQUE", 
        details: "Clé Groq non configurée dans le fichier .env local."
      }, { status: 500 });
    }

    // On force l'usage de la clé dans le process pour le flow
    process.env.GROQ_API_KEY = groqKey;

    const output = await dynamicChat({ message, history });
    
    console.log(`✅ [${timestamp}] [API_CHAT] Succès.`);
    return NextResponse.json(output);

  } catch (error: any) {
    console.error(`❌ [${timestamp}] [API_CHAT] Échec :`, error.message);
    return NextResponse.json({ 
      error: "ERREUR_LIAISON_CRITIQUE", 
      details: error.message 
    }, { status: 500 });
  }
}
