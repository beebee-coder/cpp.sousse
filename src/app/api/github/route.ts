
import { createHybridRoute } from '@/lib/api-route-creator';
import { runGitSync } from '@/lib/git-sync';

/**
 * API Route pour piloter le pipeline industriel réel.
 * En mode desktop, elle déclenche la compilation réelle sur GitHub Actions.
 */
export const POST = createHybridRoute<{ mode: string }, any>({
  name: 'PIPELINE_REAL',
  webHandler: async (req, body) => {
    const { mode } = body;
    const selectedMode = mode || 'web';

    console.log(`🚀 [PIPELINE] Initiation du sync Git natif JS pour le mode : ${selectedMode}`);

    const result = await runGitSync(selectedMode);

    if (result.success) {
      return {
        success: true,
        message: 'Code transmis avec succès. Le pipeline de compilation réelle est activé sur GitHub.',
        logs: result.logs,
        errors: result.errors,
        command: `runGitSync(${selectedMode})`,
      };
    } else {
      return {
        success: false,
        message: 'Échec de la transmission vers le serveur de forge.',
        logs: result.logs,
        errors: result.errors,
        command: `runGitSync(${selectedMode})`,
      };
    }
  }
});

