
import { createHybridRoute } from '@/lib/api-route-creator';
import { upsertDocuments } from '@/lib/chroma';
import { getWeaviateClient } from '@/lib/weaviate-client';

export interface IngestItem {
  question: string;
  answer: string;
}

export interface IngestPayload {
  filename: string;
  items: IngestItem[];
  metadata: Record<string, any>;
}

/**
 * API Route d'ingestion hybride.
 * Web : Indexation Weaviate | Dev : Vectorisation ChromaDB
 */
export const POST = createHybridRoute<IngestPayload, any>({
  name: 'VECTOR_INGEST',
  webHandler: async (req, body) => {
    const { items, metadata } = body;
    const collectionName = String(metadata.collection || 'industrial_manuals');
    const timestamp = new Date().toLocaleTimeString();

    // Mode Web -> Ingestion Weaviate Cloud
    if (process.env.VERCEL || process.env.USE_CLOUD_VECTOR) {
      try {
        console.log(`📡 [${timestamp}] [WEAVIATE] Ingestion de ${items.length} éléments vers le Cloud...`);
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
        return { success: true, message: 'INDEXATION_CLOUD_SUCCES', provider: 'WEAVIATE' };
      } catch (e: any) {
        console.error(`❌ [WEAVIATE] Échec ingestion :`, e.message);
      }
    }

    // Mode Local -> ChromaDB
    try {
      console.log(`🧠 [${timestamp}] [CHROMA] Vectorisation locale de ${items.length} éléments...`);
      const docs = items.map((item, index) => ({
        id: `local-${Date.now()}-${index}`,
        content: `Question: ${item.question}\nRéponse: ${item.answer}`,
        metadata: { ...metadata, ingested_at: new Date().toISOString() }
      }));
      await upsertDocuments(collectionName, docs);
      return { success: true, message: 'VECTORISATION_LOCALE_SUCCES', provider: 'CHROMA' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});
