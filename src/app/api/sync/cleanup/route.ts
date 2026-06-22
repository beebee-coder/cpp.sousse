import { createHybridRoute } from '@/lib/api-route-creator';

/**
 * API Route pour purger les assets provisoires une fois synchronisés localement.
 * Essentiel pour maintenir le poids de la BDD Web au minimum.
 */
export const POST = createHybridRoute<{ ids: string[]; projectId: string }, any>({
  name: 'SYNC_CLEANUP',
  webHandler: async (req, body) => {
    const { ids, projectId } = body;
    
    if (!ids || !Array.isArray(ids)) {
      return { success: false, error: 'INVALID_IDS' };
    }

    // Simulation de suppression dans le stockage cloud (Postgres/Neon)
    const storageKey = `visionode_cloud_mock_db_${projectId}`;
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        let currentData = JSON.parse(raw);
        const filtered = currentData.filter((item: any) => !ids.includes(item.id));
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    }

    return { success: true, purgedCount: ids.length };
  }
});
