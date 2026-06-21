import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * Route de download pour la synchronisation multi-environnement (Delta Sync).
 */
export const POST = createHybridRoute<{ userId: string; projectId: string; lastSync: string }, any>({
  name: 'SYNC_DOWNLOAD',
  webHandler: async (req, body) => {
    const { projectId, lastSync } = body;
    const lastSyncDate = lastSync ? new Date(lastSync) : undefined;

    try {
      const items = await postgresClient.getCloudData(projectId, lastSyncDate);
      return { success: true, items };
    } catch (e: any) {
      throw new Error(`DB_QUERY_FAILED: ${e.message}`);
    }
  }
});
