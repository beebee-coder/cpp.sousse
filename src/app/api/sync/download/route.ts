export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * Route API pour le téléchargement de données de synchronisation.
 */
export const POST = createHybridRoute<{ userId: string; projectId: string; lastSync: string }, any>({
  name: 'SYNC_DOWNLOAD',
  webHandler: async (req, body) => {
    const { projectId, lastSync } = body;
    const lastSyncDate = lastSync ? new Date(lastSync) : undefined;
    
    const items = await postgresClient.getCloudData(projectId, lastSyncDate);
    return { items };
  },
  desktopFallback: async () => {
    return { items: [], message: 'Sync download simulated offline' };
  }
});
