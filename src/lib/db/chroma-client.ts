import { LocalVectorPoint } from './types';
import { upsertDocuments } from '../chroma';

// Local ChromaDB client wrapper with offline mock capability
export const chromaClient = {
  getPoints: async (collectionName: string): Promise<LocalVectorPoint[]> => {
    if (typeof window === 'undefined') return [];
    const storageKey = `visionode_chroma_mock_vectors_${collectionName}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  },

  upsertPoints: async (collectionName: string, points: LocalVectorPoint[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    const storageKey = `visionode_chroma_mock_vectors_${collectionName}`;
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

    // Try real ChromaDB upsert if running
    try {
      const docs = points.map(p => ({
        id: p.id,
        content: `Vecteur metadata: type=${p.metadata.type}, tags=${p.metadata.tags.join(',')}`,
        metadata: {
          cloudId: p.metadata.cloudId || '',
          type: p.metadata.type,
          syncStatus: p.metadata.syncStatus,
          timestamp: new Date(p.metadata.timestamp).toISOString()
        }
      }));
      await upsertDocuments(collectionName, docs);
    } catch (e) {
      console.warn('⚠️ Real ChromaDB not available. Fallback to localStorage vector mock.', e);
    }
  }
};
