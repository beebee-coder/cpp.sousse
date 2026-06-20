import { NextResponse } from 'next/server';
import { visualDocumentRetrieval } from '@/ai/flows/visual-document-retrieval';
import { config } from 'dotenv';

// Chargement des variables d'environnement à l'exécution
config();

/**
 * API Route pour la récupération de documents RAG (Visual Retrieval).
 * Audit : ⚡ [RAG_AUDIT] Recherche vectorielle indexée.
 */
export async function POST(req: Request) {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const body = await req.json();
    const { imageDataUri } = body;
    
    console.log(`🚀 [${timestamp}] [API_RAG] Interrogation du registre documentaire...`);

    if (!imageDataUri) {
      return NextResponse.json({ error: "IMAGE_RAG_MANQUANTE" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn(`⚠️ [${timestamp}] [API_RAG] Clé Google AI manquante pour le registre RAG.`);
    }

    console.log(`⚡ [${timestamp}] [NODE_RAG] Recherche de schémas techniques correspondants...`);
    const output = await visualDocumentRetrieval({ imageDataUri });

    console.log(`✅ [${timestamp}] [SUCCÈS] Documents récupérés du registre.`);
    return NextResponse.json(output);

  } catch (error: any) {
    console.error(`❌ [${timestamp}] [ERREUR_RAG] Échec du registre :`, error.message);
    return NextResponse.json({ 
      error: "ERREUR_REGISTRE_CRITIQUE",
      details: error.message 
    }, { status: 500 });
  }
}
