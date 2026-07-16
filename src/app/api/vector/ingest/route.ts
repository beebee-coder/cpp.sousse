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

export const POST = createHybridRoute<IngestPayload, any>({
  name: 'VECTOR_INGEST',
  webHandler: async (req, body) => {
    const { items, metadata } = body;
    const timestamp = new Date().toLocaleTimeString();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Payload invalide: items requis et non vide', details: 'items must be a non-empty array' };
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.question || !item.answer) {
        return { success: false, error: `Item ${i} invalide: question et answer requis`, details: `Missing question or answer at index ${i}` };
      }
      if (typeof item.question !== 'string' || typeof item.answer !== 'string') {
        return { success: false, error: `Item ${i} invalide: question et answer doivent être des chaînes`, details: `Invalid types at index ${i}` };
      }
    }

    try {
      console.log(`📡 [${timestamp}] [WEAVIATE_CLOUD] Entraînement des Q/R (collection unifiée KnowledgeItem)...`);

      // Indexation unifiée vers la collection Weaviate `KnowledgeItem`
      // (même collection que les procédures) afin que le RAG sémantique
      // retrouve aussi bien les procédures que les paires Q/R.
      const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');

      const baseTags = Array.isArray(metadata?.tags) ? metadata.tags : ['Q/R', 'entrainement'];
      const title = typeof metadata?.title === 'string' && metadata.title.trim() ? metadata.title.trim() : items[0].question.slice(0, 80);

      const baseId = typeof metadata?.id === 'string' && metadata.id.trim()
        ? metadata.id
        : `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await upsertKnowledgeItem({
          // Id unique par paire : sinon toutes les paires d'une session partagent
          // le même knowledgeId et neaviate écrase → seule la dernière Q/R survivait.
          knowledgeId: `${baseId}#${i}`,
          userId: typeof metadata?.userId === 'string' ? metadata.userId : 'dataset-import',
          type: 'qa',
          title,
          content: `Q: ${item.question}\nR: ${item.answer}`,
          tags: baseTags,
          category: typeof metadata?.category === 'string' ? metadata.category : 'General',
          difficulty: 'MEDIUM',
          isPublic: true,
          createdAt: new Date().toISOString(),
        });
      }

      return { success: true, message: 'ENTRAINEMENT_WEAVIATE_REUSSI', provider: 'WEAVIATE' };
    } catch (e: any) {
      console.error(`❌ [WEAVIATE] Échec entraînement Q/R :`, e.message);
      return { success: false, error: 'CLOUD_INGEST_FAILED', details: e.message };
    }
  },
});
