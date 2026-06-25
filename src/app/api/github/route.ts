import { createHybridRoute } from '@/lib/api-route-creator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execPromise = promisify(exec);

/**
 * API Route pour piloter le pipeline industriel.
 * Supporte le mode FORGE_SIMULATION pour le prototypage en environnement restreint.
 */
export const POST = createHybridRoute<{ mode: string; simulate?: boolean }, any>({
  name: 'PIPELINE',
  webHandler: async (req, body) => {
    const { mode, simulate = false } = body;

    // Protection Cloud (hors mode simulation)
    if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && !simulate) {
      return { 
        success: false, 
        message: 'Liaison script désactivée en environnement de production.',
        logs: 'ERREUR : Environnement RESTREINT détecté.'
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

      console.log(`🚀 [PIPELINE] Exécution : ${command} (Simulate: ${simulate})`);
      
      const { stdout, stderr } = await execPromise(command, {
        env: { 
          ...process.env, 
          TAURI_ENV: 'true',
          FORGE_SIMULATION: simulate ? 'true' : 'false'
        }
      });

      return { 
        success: true, 
        message: simulate ? 'Simulation de forge réussie.' : 'Opération réussie.',
        logs: stdout, 
        errors: stderr 
      };
    } catch (error: any) {
      console.error(`❌ [PIPELINE] Échec de la commande :`, error.message);
      
      return { 
        success: false, 
        message: `Échec de la phase ${mode.toUpperCase()}`,
        logs: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }
});