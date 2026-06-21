import { createHybridRoute } from '@/lib/api-route-creator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execPromise = promisify(exec);

/**
 * API Route pour piloter le pipeline industriel.
 */
export const POST = createHybridRoute<{ mode: string }, any>({
  name: 'PIPELINE',
  webHandler: async (req, body) => {
    const { mode } = body;

    if (process.env.VERCEL) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Liaison script désactivée sur Vercel Cloud.',
        logs: 'ERREUR : Environnement CLOUD détecté.'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!process.env.GITHUB_TOKEN && (mode === 'web' || mode === 'pull')) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'GITHUB_TOKEN manquant.',
        logs: 'ERREUR_LIAISON_REGISTRE'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await execPromise('chmod +x sync.sh');
    
    let command = `./sync.sh ${mode || 'web'}`;
    if (mode === 'desktop') {
      command = existsSync(join(process.cwd(), 'forge-desktop.sh')) ? 'sh forge-desktop.sh' : './sync.sh desktop';
    }

    const { stdout, stderr } = await execPromise(command);
    return { success: true, logs: stdout, errors: stderr };
  }
});
