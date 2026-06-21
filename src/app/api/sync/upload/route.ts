import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

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
  }
});
