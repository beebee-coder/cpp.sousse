export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { addDocuments, upsertDocuments } from '@/lib/chroma';

export const POST = createHybridRoute<{ collection: string; documents: any[]; upsert?: boolean }, any>({
  name: 'VECTOR_DOCUMENTS_POST',
  webHandler: async (req, body) => {
    const { collection, documents, upsert = false } = body;
    if (!collection || typeof collection !== 'string') {
      return new Response(JSON.stringify({ error: 'Le champ "collection" est requis.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: 'Le champ "documents" doit être un tableau non vide.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    for (const doc of documents) {
      if (!doc.id || !doc.content) {
        return new Response(JSON.stringify({ error: 'Chaque document doit avoir un "id" et un "content".' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    if (upsert) {
      await upsertDocuments(collection, documents);
    } else {
      await addDocuments(collection, documents);
    }
    return {
      success: true,
      message: `${documents.length} document(s) ${upsert ? 'mis à jour' : 'ajouté(s)'} dans la collection "${collection}".`,
      count: documents.length,
    };
  },
  desktopFallback: async (body) => {
    return { success: true, message: `${body.documents?.length || 0} document(s) simulés en local.` };
  }
});
