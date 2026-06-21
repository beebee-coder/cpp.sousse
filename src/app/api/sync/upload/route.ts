export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * Route API pour l'upload de données de synchronisation.
 */
export const POST = createHybridRoute<{ userId: string; projectId: string; items: any[] }, any>({
  name: 'SYNC_UPLOAD',
  webHandler: async (req, body) => {
    const { items } = body;
    if (!items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await postgresClient.upsertCloudData(items);
    return { success: true };
  },
  desktopFallback: async () => {
    return { success: true, message: 'Sync upload simulated offline' };
  }
});
