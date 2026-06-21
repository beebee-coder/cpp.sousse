import { CloudData } from './types';

/**
 * Simule l'accès à la base de données PostgreSQL centrale.
 */
export const postgresClient = {
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<CloudData[]> => {
    if (typeof window === 'undefined') return [];
    
    const key = `visionode_cloud_mock_db_${projectId}`;
    const raw = localStorage.getItem(key);
    const allData: CloudData[] = raw ? JSON.parse(raw) : getInitialSeed(projectId);
    
    if (lastSyncDate) {
      const threshold = lastSyncDate.getTime();
      return allData.filter(d => new Date(d.createdAt).getTime() > threshold);
    }
    return allData;
  },

  upsertCloudData: async (items: CloudData[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    const grouped: Record<string, CloudData[]> = {};
    items.forEach(item => {
      if (!grouped[item.projectId]) grouped[item.projectId] = [];
      grouped[item.projectId].push(item);
    });

    for (const pid of Object.keys(grouped)) {
      const key = `visionode_cloud_mock_db_${pid}`;
      const existingRaw = localStorage.getItem(key);
      const existing: CloudData[] = existingRaw ? JSON.parse(existingRaw) : getInitialSeed(pid);
      
      grouped[pid].forEach(newItem => {
        const idx = existing.findIndex(d => d.id === newItem.id);
        if (idx !== -1) {
          existing[idx] = { ...newItem, createdAt: new Date() };
        } else {
          existing.push({ ...newItem, createdAt: new Date() });
        }
      });
      
      localStorage.setItem(key, JSON.stringify(existing));
    }
  }
};

function getInitialSeed(projectId: string): CloudData[] {
  return [
    {
      id: 'seed-001',
      projectId,
      type: 'document',
      content: '{"title": "Manuel Opérateur", "body": "Procédure de démarrage standard."}',
      tags: ['manual', 'system'],
      createdAt: new Date('2026-01-01')
    }
  ];
}
