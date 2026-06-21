import { CloudUser, CloudProject, CloudData } from './types';

// Simulated central PostgreSQL database client
export const postgresClient = {
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<CloudData[]> => {
    if (typeof window === 'undefined') return [];
    
    const mockCloudDataKey = `visionode_cloud_postgres_data_${projectId}`;
    const raw = localStorage.getItem(mockCloudDataKey);
    const allData: CloudData[] = raw ? JSON.parse(raw) : getInitialMockCloudData(projectId);
    
    if (lastSyncDate) {
      const syncTime = new Date(lastSyncDate).getTime();
      return allData.filter(d => new Date(d.createdAt).getTime() > syncTime);
    }
    return allData;
  },

  upsertCloudData: async (dataItems: CloudData[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    const grouped: Record<string, CloudData[]> = {};
    dataItems.forEach(item => {
      if (!grouped[item.projectId]) {
        grouped[item.projectId] = [];
      }
      grouped[item.projectId].push(item);
    });

    for (const projectId of Object.keys(grouped)) {
      const mockCloudDataKey = `visionode_cloud_postgres_data_${projectId}`;
      const raw = localStorage.getItem(mockCloudDataKey);
      const existing: CloudData[] = raw ? JSON.parse(raw) : getInitialMockCloudData(projectId);
      
      grouped[projectId].forEach(newItem => {
        const idx = existing.findIndex(d => d.id === newItem.id);
        if (idx !== -1) {
          existing[idx] = newItem;
        } else {
          existing.push(newItem);
        }
      });
      
      localStorage.setItem(mockCloudDataKey, JSON.stringify(existing));
    }
  }
};

function getInitialMockCloudData(projectId: string): CloudData[] {
  return [
    {
      id: 'cloud-data-001',
      projectId,
      type: 'document',
      content: '{"title":"Spécification Optique","content":"Détails techniques du capteur USB"}',
      tags: ['optic', 'manual'],
      createdAt: new Date('2026-06-20T10:00:00Z')
    },
    {
      id: 'cloud-data-002',
      projectId,
      type: 'metadata',
      content: '{"resolution":"1080p","fps":60}',
      tags: ['hardware', 'settings'],
      createdAt: new Date('2026-06-20T11:00:00Z')
    }
  ];
}
