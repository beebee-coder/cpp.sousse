export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { upsertDocuments } from '@/lib/chroma';
import { getIndexedDocumentContent } from '@/lib/local-indexer';

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_DOCUMENTS_GET',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const relPath = searchParams.get('relPath');
    if (!relPath) return { success: false, error: 'PARAM_MISSING' };
    try {
      const content = await getIndexedDocumentContent(relPath);
      if (content === null) return { success: false, error: 'NON_INDEXE' };
      return { success: true, content };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const relPath = searchParams.get('relPath');
  if (!relPath) {
    return new Response(JSON.stringify({ success: false, error: 'PARAM_MISSING' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { deleteChromaItem } = await import('@/lib/local-indexer');
    const res = await deleteChromaItem(relPath);
    return new Response(JSON.stringify(res), {
      status: res.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
    
    try {
      await upsertDocuments(collection, documents);
      return {
        success: true,
        message: `${documents.length} document(s) ajouté(s) dans la collection "${collection}".`,
        count: documents.length,
      };
    } catch (e: any) {
      return { success: false, error: 'DOC_INDEX_FAILED', details: e.message };
    }
  }
});
