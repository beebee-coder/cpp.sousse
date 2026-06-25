
import { createHybridRoute } from '@/lib/api-route-creator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execPromise = promisify(exec);

/**
 * API Route pour piloter le pipeline industriel réel.
 * En mode desktop, elle déclenche la compilation réelle sur GitHub Actions.
 */
export const POST = createHybridRoute<{ mode: string }, any>({
  name: 'PIPELINE_REAL',
  webHandler: async (req, body) => {
    const { mode } = body;

    try {
      await execPromise('chmod +x sync.sh');
      
      // La commande réelle de synchronisation (Push vers GitHub)
      let command = `./sync.sh ${mode || 'web'}`;

      console.log(`🚀 [PIPELINE] Exécution réelle : ${command}`);
      
      const { stdout, stderr } = await execPromise(command, {
        env: { 
          ...process.env, 
          TAURI_ENV: 'true'
        }
      });

      return { 
        success: true, 
        message: 'Code transmis avec succès. Le pipeline de compilation réelle est activé sur GitHub.',
        logs: stdout, 
        errors: stderr 
      };
    } catch (error: any) {
      console.error(`❌ [PIPELINE] Échec de la commande :`, error.message);
      
      return { 
        success: false, 
        message: `Échec de la transmission vers le serveur de forge.`,
        logs: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }
});
