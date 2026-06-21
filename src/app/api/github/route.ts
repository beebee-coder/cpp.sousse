export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
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
export const POST = createHybridRoute<{ mode: string }, any>({
  name: 'PIPELINE',
  webHandler: async (req, body) => {
    const env = loadEnvAtRuntime();
    const { mode } = body;

    // Sécurité : child_process désactivé sur Vercel Cloud
    if (process.env.VERCEL) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Liaison script désactivée sur Vercel Cloud.',
        logs: 'ERREUR : Environnement CLOUD détecté.'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!env.GITHUB_TOKEN && (mode === 'web' || mode === 'pull')) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'GITHUB_TOKEN manquant pour cette opération.',
        logs: 'ERREUR_LIAISON_REGISTRE'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await execPromise('chmod +x sync.sh');
    
    let command = `./sync.sh ${mode || 'web'}`;
    if (mode === 'desktop') {
      command = existsSync(join(process.cwd(), 'forge-desktop.sh')) ? 'sh forge-desktop.sh' : './sync.sh desktop';
    }

    const { stdout, stderr } = await execPromise(command, {
      env: { ...env }
    });
    
    return { success: true, logs: stdout, errors: stderr };
  },
  desktopFallback: async (body) => {
    return {
      success: true,
      message: `Mode bureau/local actif. Opération de synchronisation "${body.mode}" simulée avec succès.`,
      logs: 'SUCCÈS : Mode local exécuté avec succès.',
      offline: true
    };
  }
});
