import { LocalVectorPoint } from './types';
import { apiClient } from '../api-client';

export const chromaClient = {
  getPoints: async (collectionName: string): Promise<LocalVectorPoint[]> => {
    if (typeof window === 'undefined') return [];
    const storageKey = `visionode_chroma_vectors_${collectionName}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  },

  upsertPoints: async (collectionName: string, points: LocalVectorPoint[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    const storageKey = `visionode_chroma_vectors_${collectionName}`;

    const docs = points.map(p => ({
      id: p.id,
      content: p.metadata.type === 'metadata' ? p.id : `Asset industriel: ${p.metadata.tags.join(', ')}`,
      metadata: {
        ...p.metadata,
        timestamp: new Date(p.metadata.timestamp).toISOString()
      }
    }));

    try {
      await apiClient.post('/api/vector/documents', {
        collection: collectionName,
        documents: docs,
        upsert: true
      });

      const raw = localStorage.getItem(storageKey);
      const existing: LocalVectorPoint[] = raw ? JSON.parse(raw) : [];
      points.forEach(newPoint => {
        const idx = existing.findIndex(p => p.id === newPoint.id);
        if (idx !== -1) {
          existing[idx] = newPoint;
        } else {
          existing.push(newPoint);
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(existing));
      console.log(`✅ [CHROMA_CLIENT] ${points.length} points vectorisés avec succès.`);
    } catch (e: any) {
      const existingRaw = localStorage.getItem(storageKey);
      const existing: LocalVectorPoint[] = existingRaw ? JSON.parse(existingRaw) : [];
      const failedIds = new Set(points.map(p => p.id));
      const cleaned = existing.filter(p => !failedIds.has(p.id));
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      console.warn(`⚠️ [CHROMA_CLIENT] Vectorisation échouée: ${e.message} — prévisualisation révoquée.`);
    }
  }
};