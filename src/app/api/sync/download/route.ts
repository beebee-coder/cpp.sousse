import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

export const POST = createHybridRoute<{ userId: string; projectId: string; lastSync: string }, any>({
  name: 'SYNC_DOWNLOAD',
  webHandler: async (req, body) => {
    const { projectId, lastSync } = body;
    const lastSyncDate = lastSync ? new Date(lastSync) : undefined;
    const items = await postgresClient.getCloudData(projectId, lastSyncDate);
    return { items };
  }
});
