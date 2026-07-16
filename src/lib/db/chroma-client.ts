import { LocalVectorPoint } from './types';
import { apiClient } from '../api-client';

/**
 * Client d'interface pour ChromaDB (Moteur Vectoriel Local).
 * Assure la transition entre les données brutes et l'index de recherche sémantique.
 */
export const chromaClient = {
  /**
   * Récupère l'état de l'index local (Simulation UI).
   */
  getPoints: async (collectionName: string): Promise<LocalVectorPoint[]> => {
    if (typeof window === 'undefined') return [];
    const storageKey = `visionode_chroma_vectors_${collectionName}`;
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  },

  /**
   * Injecte et vectorise des points dans la collection locale.
   */
  upsertPoints: async (collectionName: string, points: LocalVectorPoint[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // 1. Mise à jour du registre de prévisualisation local
    const storageKey = `visionode_chroma_vectors_${collectionName}`;
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

    // 2. Déclenchement de la vectorisation réelle via l'API hybride
    // Cette étape transforme le texte en vecteurs (embeddings) via Transformers.js
    try {
      const docs = points.map(p => ({
        id: p.id,
        content: p.metadata.type === 'metadata' ? p.id : `Asset industriel: ${p.metadata.tags.join(', ')}`,
        metadata: {
          ...p.metadata,
          timestamp: new Date(p.metadata.timestamp).toISOString()
        }
      }));

      await apiClient.post('/api/vector/documents', {
        collection: collectionName,
        documents: docs,
        upsert: true
      });
      
      console.log(`✅ [CHROMA_CLIENT] ${points.length} points vectorisés avec succès.`);
    } catch (e: any) {
      console.warn(`⚠️ [CHROMA_CLIENT] Vectorisation différée ou échec API: ${e.message}`);
    }
  }
};