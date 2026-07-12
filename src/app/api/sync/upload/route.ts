export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * Route d'upload pour la synchronisation multi-environnement.
 */
export const POST = createHybridRoute<{ userId: string; projectId: string; items: any[] }, any>({
  name: 'SYNC_UPLOAD',
  webHandler: async (req, body) => {
    const { items } = body;
    if (!items || !Array.isArray(items)) {
      return { success: false, error: 'INVALID_PAYLOAD' };
    }

    try {
      await postgresClient.upsertCloudData(items);
      return { success: true, timestamp: new Date().toISOString() };
    } catch (e: any) {
      throw new Error(`DB_UPSERT_FAILED: ${e.message}`);
    }
  }
});
