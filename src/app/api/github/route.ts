import { createHybridRoute } from '@/lib/api-route-creator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execPromise = promisify(exec);

/**
 * API Route pour piloter le pipeline industriel.
 * Version : Audité pour la remontée d'erreurs critiques.
 */
export const POST = createHybridRoute<{ mode: string }, any>({
  name: 'PIPELINE',
  webHandler: async (req, body) => {
    const { mode } = body;

    // Protection Cloud
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return { 
        success: false, 
        message: 'Liaison script désactivée en environnement de production.',
        logs: 'ERREUR : Environnement RESTREINT détecté.'
      };
    }

    // Protection Token (sauf pour desktop qui peut être local pur)
    if (!process.env.GITHUB_TOKEN && (mode === 'web' || mode === 'pull')) {
      return { 
        success: false, 
        message: 'GITHUB_TOKEN manquant pour la synchronisation du registre.',
        logs: 'ERREUR_LIAISON_REGISTRE'
      };
    }

    try {
      await execPromise('chmod +x sync.sh');
      if (existsSync(join(process.cwd(), 'forge-desktop.sh'))) {
        await execPromise('chmod +x forge-desktop.sh');
      }
      
      let command = `./sync.sh ${mode || 'web'}`;
      if (mode === 'desktop') {
        command = existsSync(join(process.cwd(), 'forge-desktop.sh')) ? './forge-desktop.sh' : './sync.sh desktop';
      }

      console.log(`🚀 [PIPELINE] Exécution : ${command}`);
      
      const { stdout, stderr } = await execPromise(command, {
        env: { ...process.env, TAURI_ENV: 'true' }
      });

      return { 
        success: true, 
        message: 'Opération réussie.',
        logs: stdout, 
        errors: stderr 
      };
    } catch (error: any) {
      console.error(`❌ [PIPELINE] Échec de la commande :`, error.message);
      
      // On renvoie les logs partiels pour le diagnostic
      return { 
        success: false, 
        message: `Échec de la phase ${mode.toUpperCase()}`,
        logs: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }
});
