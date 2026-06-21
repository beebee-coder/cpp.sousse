export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { listCollections, deleteCollection, getOrCreateCollection } from '@/lib/chroma';

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_COLLECTIONS_GET',
  webHandler: async () => {
    const collections = await listCollections();
    return { success: true, count: collections.length, collections };
  },
  desktopFallback: async () => {
    return { success: true, count: 0, collections: [] };
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
    const collection = await getOrCreateCollection(name);
    const count = await collection.count();
    return { 
      success: true, 
      message: `Collection "${name}" créée ou récupérée avec succès.`, 
      collection: { name, documentCount: count } 
    };
  },
  desktopFallback: async () => {
    return { success: true, message: 'Collection créée en local.' };
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
