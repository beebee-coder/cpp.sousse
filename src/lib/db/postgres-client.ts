import { CloudData } from './types';

/**
 * Infrastructure de liaison Neon Postgres (Prête pour Neon Serverless).
 * Cette classe assure la persistance cloud sécurisée pour le transfert multi-stations.
 */
export const postgresClient = {
  /**
   * Récupère les données delta (nouvelles modifications) depuis le registre Neon.
   */
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<CloudData[]> => {
    // Note: Dans une version finale, ce code effectuera un appel SQL réel via la DATABASE_URL.
    // Actuellement simulé via LocalStorage pour le mode Browser de Firebase Studio.
    if (typeof window === 'undefined') return [];
    
    const key = `visionode_neon_db_${projectId}`;
    const raw = localStorage.getItem(key);
    let allData: CloudData[] = raw ? JSON.parse(raw) : [];
    
    if (lastSyncDate) {
      const threshold = lastSyncDate.getTime();
      return allData.filter(d => new Date(d.createdAt).getTime() > threshold);
    }
    return allData;
  },

  /**
   * Insère ou met à jour des données de manière atomique dans le registre cloud.
   */
  upsertCloudData: async (items: CloudData[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // Groupement par projet pour assurer l'isolation des données industrielles
    const grouped: Record<string, CloudData[]> = {};
    items.forEach(item => {
      if (!grouped[item.projectId]) grouped[item.projectId] = [];
      grouped[item.projectId].push(item);
    });

    for (const pid of Object.keys(grouped)) {
      const key = `visionode_neon_db_${pid}`;
      const existingRaw = localStorage.getItem(key);
      let existing: CloudData[] = existingRaw ? JSON.parse(existingRaw) : [];
      
      grouped[pid].forEach(newItem => {
        const idx = existing.findIndex(d => d.id === newItem.id);
        if (idx !== -1) {
          existing[idx] = { ...newItem, createdAt: new Date() };
        } else {
          existing.push({ ...newItem, createdAt: new Date() });
        }
      });
      
      try {
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {
        console.error("❌ [NEON_INFRA] Quota de registre cloud saturé.");
        throw new Error("REGISTRY_SATURATED");
      }
    }
  },

  /**
   * Purge les assets provisoires une fois qu'ils ont été sécurisés sur la station locale.
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