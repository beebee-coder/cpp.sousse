import { CloudData } from './types';

/**
 * Infrastructure Simulant Neon Postgres (Prête pour l'implantation réelle).
 * Gère les données de manière isolée pour éviter la corruption de mémoire.
 */
export const postgresClient = {
  /**
   * Récupère les données delta depuis le dernier sync.
   */
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<CloudData[]> => {
    if (typeof window === 'undefined') return [];
    
    const key = `visionode_neon_db_${projectId}`;
    const raw = localStorage.getItem(key);
    let allData: CloudData[] = raw ? JSON.parse(raw) : getInitialSeed(projectId);
    
    if (lastSyncDate) {
      const threshold = lastSyncDate.getTime();
      return allData.filter(d => new Date(d.createdAt).getTime() > threshold);
    }
    return allData;
  },

  /**
   * Insère ou met à jour des items de manière atomique.
   * En production, cela correspond à une transaction SQL sur Neon.
   */
  upsertCloudData: async (items: CloudData[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // Groupement par projet pour isolation
    const grouped: Record<string, CloudData[]> = {};
    items.forEach(item => {
      if (!grouped[item.projectId]) grouped[item.projectId] = [];
      grouped[item.projectId].push(item);
    });

    for (const pid of Object.keys(grouped)) {
      const key = `visionode_neon_db_${pid}`;
      const existingRaw = localStorage.getItem(key);
      let existing: CloudData[] = existingRaw ? JSON.parse(existingRaw) : getInitialSeed(pid);
      
      grouped[pid].forEach(newItem => {
        const idx = existing.findIndex(d => d.id === newItem.id);
        if (idx !== -1) {
          existing[idx] = { ...newItem, createdAt: new Date() };
        } else {
          existing.push({ ...newItem, createdAt: new Date() });
        }
      });
      
      // Sécurisation de l'écriture (Limite de quota simulée)
      try {
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {
        console.error("❌ [NEON_INFRA] Quota de stockage WebBuffer dépassé. Synchroniser vers Desktop.");
        throw new Error("QUOTA_EXCEEDED");
      }
    }
  },

  /**
   * Purge les données après transfert vers ChromaDB.
   */
  deleteItems: async (projectId: string, ids: string[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    const key = `visionode_neon_db_${projectId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const data: CloudData[] = JSON.parse(raw);
      const filtered = data.filter(d => !ids.includes(d.id));
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  }
};

function getInitialSeed(projectId: string): CloudData[] {
  return [
    {
      id: 'neon-seed-001',
      projectId,
      type: 'document',
      content: '{"title": "Manuel Central Neon", "body": "Système de stockage persistant actif."}',
      tags: ['system', 'config'],
      createdAt: new Date('2026-01-01')
    }
  ];
}
