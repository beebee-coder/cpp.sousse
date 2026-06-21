import { LocalVectorPoint } from './types';
import { apiClient } from '../api-client';

/**
 * Client ChromaDB optimisé pour l'environnement hybride.
 * Utilise localStorage pour le mock offline et appelle l'API standard pour la vectorisation réelle.
 * Ne contient aucun import serveur direct pour éviter les erreurs de bundle.
 */
export const chromaClient = {
  getPoints: async (collectionName: string): Promise<LocalVectorPoint[]> => {
    if (typeof window === 'undefined') return [];
    const storageKey = `visionode_chroma_mock_vectors_${collectionName}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  },

  upsertPoints: async (collectionName: string, points: LocalVectorPoint[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // 1. Mise à jour du mock local (LocalStorage)
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

    // 2. Synchronisation avec le vrai ChromaDB via l'API Route (si disponible)
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

      await apiClient.post('/api/vector/documents', {
        collection: collectionName,
        documents: docs,
        upsert: true
      });
    } catch (e) {
      console.warn('⚠️ Synchronisation vectorielle réelle ignorée ou échouée (Mode Offline).');
    }
  }
};
