
export const dynamic = 'force-dynamic';

import { createHybridRoute } from '@/lib/api-route-creator';
import { listCollections, deleteCollection, getOrCreateCollection } from '@/lib/chroma';

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_COLLECTIONS_GET',
  webHandler: async () => {
    try {
      const collections = await listCollections();
      return { success: true, count: collections.length, collections };
    } catch (e: any) {
      return { success: false, error: 'DB_UNREACHABLE', details: e.message, collections: [] };
    }
  }
});

export const POST = createHybridRoute<{ name: string }, any>({
  name: 'VECTOR_COLLECTIONS_POST',
  webHandler: async (req, body) => {
    const { name } = body;
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Le champ "name" est requis.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const collection = await getOrCreateCollection(name);
      const count = await collection.count();
      return { 
        success: true, 
        message: `Collection "${name}" créée ou récupérée avec succès.`, 
        collection: { name, documentCount: count } 
      };
    } catch (e: any) {
      return { success: false, error: 'DB_WRITE_FAILED', details: e.message };
    }
  }
});

export async function DELETE(req: Request) {
  const isDesktopBuild = process.env.TAURI_ENV === 'true';
  if (isDesktopBuild) {
    return new Response(JSON.stringify({ success: true, message: 'Supprimé en local' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    if (!name) {
      return new Response(JSON.stringify({ error: 'Le paramètre "name" est requis.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    await deleteCollection(name);
    return new Response(JSON.stringify({ success: true, message: `Collection "${name}" supprimée avec succès.` }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
