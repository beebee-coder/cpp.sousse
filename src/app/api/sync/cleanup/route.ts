import { createHybridRoute } from '@/lib/api-route-creator';
import { prisma } from '@/lib/db/prisma-client';

/**
 * API Route de Purge Cloud après Injection.
 * Supprime définitivement les données du Web une fois qu'elles sont sécurisées localement.
 */
export const POST = createHybridRoute<{ ids: string[]; projectId: string }, any>({
  name: 'SYNC_CLEANUP_PURGE',
  webHandler: async (req, body) => {
    const { ids } = body;
    const ts = new Date().toLocaleTimeString();
    
    if (!ids || !Array.isArray(ids)) {
      return { success: false, error: 'IDS_MANQUANTS' };
    }

    console.log(`🗑️ [SYNC_PURGE_API] [INIT] [${ts}] Purge de ${ids.length} items demandée.`);

    try {
      // Suppression des items de connaissances
      const knowledgePurge = await prisma.knowledgeItem.deleteMany({
        where: { id: { in: ids } }
      });

      // Suppression des procédures correspondantes si nécessaire
      const procedurePurge = await prisma.procedure.deleteMany({
        where: { id: { in: ids } }
      });

      console.log(`✅ [SYNC_PURGE_API] [SUCCESS] Items supprimés : ${knowledgePurge.count + procedurePurge.count}`);

      return { 
        success: true, 
        purgedCount: knowledgePurge.count + procedurePurge.count,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error(`❌ [SYNC_PURGE_API] [ERROR] :`, error.message);
      return { success: false, error: error.message };
    }
  }
});
