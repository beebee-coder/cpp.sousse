
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * API Route pour purger les fichiers JSON une fois synchronisés localement.
 */
export const POST = createHybridRoute<{ ids: string[]; projectId: string }, any>({
  name: 'SYNC_CLEANUP',
  webHandler: async (req, body) => {
    const { ids, projectId } = body;
    
    if (!ids || !Array.isArray(ids)) {
      return { success: false, error: 'INVALID_IDS' };
    }

    try {
      await postgresClient.deleteItems(projectId, ids);
      return { success: true, purgedCount: ids.length };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});
