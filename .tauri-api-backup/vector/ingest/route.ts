export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';

export interface IngestItem {
  question: string;
  answer: string;
}

export interface IngestPayload {
  items: IngestItem[];
  metadata: Record<string, any>;
}

/**
 * API Route d'ingestion hybride optimisée pour le poids du bundle.
 * Sépare physiquement les chemins Cloud (Weaviate) et Local (Chroma).
 */
export const POST = createHybridRoute<IngestPayload, any>({
  name: 'VECTOR_INGEST',
  webHandler: async (req, body) => {
    const { items, metadata } = body;
    const collectionName = String(metadata.collection || 'industrial_manuals');
    const timestamp = new Date().toLocaleTimeString();
    const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    // 📡 CHEMIN CLOUD : Utilise exclusivement weaviate-client (Plus léger)
    if (isCloud) {
      try {
        console.log(`📡 [${timestamp}] [CLOUD_TRAINING] Entraînement Weaviate Cloud...`);
        const { getWeaviateClient } = await import('@/lib/weaviate-client');
        const client = await getWeaviateClient();
        const className = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

        const batcher = client.batch.objectsBatcher();
        items.forEach(item => {
          batcher.withObject({
            class: className,
            properties: {
              question: item.question,
              answer: item.answer,
              ...metadata
            }
          });
        });

        await batcher.do();
        return { success: true, message: 'ENTRAINEMENT_CLOUD_REUSSI', provider: 'WEAVIATE' };
      } catch (e: any) {
        console.error(`❌ [CLOUD_TRAINING] Échec :`, e.message);
        return { success: false, error: 'CLOUD_INGEST_FAILED', details: e.message };
      }
    }

    // 🧠 CHEMIN LOCAL : Utilise ChromaDB et Transformers (Poids lourd)
    // On force l'import dynamique pour éviter que Vercel ne tente de l'analyser.
    try {
      const chromaModule = await import('@/lib/chroma');
      console.log(`🧠 [${timestamp}] [LOCAL_TRAINING] Entraînement ChromaDB Local...`);
      
      const docs = items.map((item, index) => ({
        id: `local-${Date.now()}-${index}`,
        content: `Question: ${item.question}\nRéponse: ${item.answer}`,
        metadata: { ...metadata, ingested_at: new Date().toISOString() }
      }));
      
      await chromaModule.upsertDocuments(collectionName, docs);
      return { success: true, message: 'ENTRAINEMENT_LOCAL_REUSSI', provider: 'CHROMA' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});
