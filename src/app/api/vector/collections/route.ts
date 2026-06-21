export const dynamic = 'force-dynamic';

import { createHybridRoute } from '@/lib/api-route-creator';
import { listCollections, deleteCollection, getOrCreateCollection } from '@/lib/chroma';
import { getWeaviateClient } from '@/lib/weaviate-client';

/**
 * Route hybride pour lister les collections (ou classes Cloud).
 */
export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_COLLECTIONS_GET',
  webHandler: async () => {
    const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    if (isCloud) {
      try {
        const client = await getWeaviateClient();
        // Dans le SDK Weaviate v3, on récupère le schéma complet
        const schema = await client.collections.listAll();
        
        // On mappe les classes Weaviate vers le format attendu par l'UI "Collections"
        const collections = schema.map(c => ({
          name: c.name,
          metadata: { provider: 'weaviate-cloud' }
        }));

        return { 
          success: true, 
          count: collections.length, 
          collections, 
          provider: 'WEAVIATE_CLOUD' 
        };
      } catch (e: any) {
        console.error("❌ [WEAVIATE] Échec de récupération du schéma :", e.message);
        return { success: false, error: 'CLOUD_DB_UNREACHABLE', details: e.message, collections: [] };
      }
    }

    // Mode Local : ChromaDB
    try {
      const collections = await listCollections();
      return { success: true, count: collections.length, collections, provider: 'CHROMA_LOCAL' };
    } catch (e: any) {
      return { success: false, error: 'LOCAL_DB_UNREACHABLE', details: e.message, collections: [] };
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
