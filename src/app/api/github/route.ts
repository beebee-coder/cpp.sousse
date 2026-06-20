import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';

// Chargement des variables d'environnement à l'exécution
config();

const execPromise = promisify(exec);

/**
 * API Route pour la synchronisation GitHub.
 * Audit : 🛠️ [API_SYNC] Lancement du pipeline.
 */
export async function POST(req: Request) {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const body = await req.json();
    const { mode } = body;
    
    console.log(`🛠️ [${timestamp}] [API_SYNC] Tentative de lancement : ${mode?.toUpperCase() || 'WEB'}...`);

    // Sécurité : child_process n'est pas disponible sur Vercel Cloud
    if (process.env.VERCEL) {
      console.warn(`⚠️ [${timestamp}] [API_SYNC] Commande exec ignorée en environnement Vercel Cloud.`);
      return NextResponse.json({ 
        success: false, 
        message: 'La synchronisation locale par script n\'est pas disponible sur Vercel Cloud. Utilisez GitHub Actions.',
        logs: 'Environnement CLOUD détecté.'
      }, { status: 403 });
    }

    if (!process.env.GITHUB_TOKEN) {
      console.error(`❌ [${timestamp}] [API_SYNC] GITHUB_TOKEN manquant dans le .env.`);
      return NextResponse.json({ success: false, message: 'GITHUB_TOKEN manquant.' }, { status: 400 });
    }

    await execPromise('chmod +x sync.sh');
    const { stdout, stderr } = await execPromise(`./sync.sh ${mode || 'web'}`, {
      env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    });
    
    console.log(`✅ [${timestamp}] [API_SYNC] Succès du pipeline local.`);
    return NextResponse.json({ success: true, logs: stdout, errors: stderr });

  } catch (error: any) {
    console.error(`❌ [${timestamp}] [API_SYNC] Échec critique :`, error.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Échec de synchronisation industrielle.',
      logs: error.stdout || '',
      errors: error.stderr || error.message 
    }, { status: 500 });
  }
}
