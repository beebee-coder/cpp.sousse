
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execPromise = promisify(exec);

// Fonction pour charger .env à l'exécution pour API Routes
function loadEnvAtRuntime() {
  try {
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
 * API Route pour piloter le pipeline industriel.
 * Audit : 🛠️ [API_PIPELINE] Modes: web | desktop | pull
 */
export async function POST(req: Request) {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const env = loadEnvAtRuntime();
    const body = await req.json();
    const { mode } = body;
    
    console.log(`🛠️ [${timestamp}] [API_PIPELINE] Initiation : ${mode?.toUpperCase()}...`);

    // Sécurité : child_process désactivé sur Vercel Cloud
    if (process.env.VERCEL) {
      return NextResponse.json({ 
        success: false, 
        message: 'Liaison script désactivée sur Vercel Cloud.',
        logs: 'ERREUR : Environnement CLOUD détecté.'
      }, { status: 403 });
    }

    if (!env.GITHUB_TOKEN && (mode === 'web' || mode === 'pull')) {
      return NextResponse.json({ 
        success: false, 
        message: 'GITHUB_TOKEN manquant pour cette opération.',
        logs: 'ERREUR_LIAISON_REGISTRE'
      }, { status: 400 });
    }

    await execPromise('chmod +x sync.sh');
    
    let command = `./sync.sh ${mode || 'web'}`;
    if (mode === 'desktop') {
      // Pour Forge, on utilise le script dédié si présent, sinon sync.sh desktop
      command = existsSync(join(process.cwd(), 'forge-desktop.sh')) ? 'sh forge-desktop.sh' : './sync.sh desktop';
    }

    const { stdout, stderr } = await execPromise(command, {
      env: { ...env }
    });
    
    console.log(`✅ [${timestamp}] [API_PIPELINE] Succès.`);
    return NextResponse.json({ success: true, logs: stdout, errors: stderr });

  } catch (error: any) {
    console.error(`❌ [${timestamp}] [API_PIPELINE] Échec :`, error.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Échec critique du pipeline.',
      logs: error.stdout || '',
      errors: error.stderr || error.message 
    }, { status: 500 });
  }
}
