import { NextResponse } from 'next/server';
import { visionAssistantDescription } from '@/ai/flows/vision-assistant-description';
import { config } from 'dotenv';

// Chargement des variables d'environnement à l'exécution
config();

/**
 * API Route pour l'analyse visuelle industrielle.
 * Audit : ⚡ [VISION_AUDIT] Traitement par Gemini 1.5 Flash.
 */
export async function POST(req: Request) {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const body = await req.json();
    const { photoDataUri } = body;
    
    console.log(`🚀 [${timestamp}] [API_VISION] Réception d'une trame pour analyse...`);

    if (!photoDataUri) {
      return NextResponse.json({ error: "DONNEE_VISUELLE_MANQUANTE" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn(`⚠️ [${timestamp}] [API_VISION] Clé Google AI manquante dans le .env.`);
    }

    console.log(`⚡ [${timestamp}] [NODE_VISION] Engagement du moteur Gemini 1.5...`);
    const output = await visionAssistantDescription({ photoDataUri });

    console.log(`✅ [${timestamp}] [SUCCÈS] Analyse visuelle terminée.`);
    return NextResponse.json(output);

  } catch (error: any) {
    console.error(`❌ [${timestamp}] [ERREUR_VISION] Échec de la liaison :`, error.message);
    return NextResponse.json({ 
      error: "ERREUR_LIAISON_VISION",
      details: error.message 
    }, { status: 500 });
  }
}
