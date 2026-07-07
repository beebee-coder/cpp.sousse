export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { listCollections, deleteCollection, getOrCreateCollection, getChromaClient } from '@/lib/chroma';

/**
 * Route hybride pour lister les collections (ou classes Cloud).
 */
export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_COLLECTIONS_GET',
  webHandler: async () => {
    const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    if (isCloud) {
      try {
        // Import statique via le client déjà configuré pour éviter les erreurs de chunks Webpack
        const { getWeaviateClient } = await import('@/lib/weaviate-client');
        const client = await getWeaviateClient();
        const schema = await client.collections.listAll();
        
        const collections = schema.map((c: any) => ({
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
        console.error("❌ [WEAVIATE] Échec :", e.message);
        return { success: false, error: 'CLOUD_DB_UNREACHABLE', details: e.message, collections: [] };
      }
    }

    // Mode Local : ChromaDB Physique
    try {
      const collections = await listCollections();
      
      // Enrichir avec le nombre de documents
      const enrichedCollections = await Promise.all(collections.map(async (c: any) => {
        try {
          const client = await getChromaClient();
          if (!client) return { ...c, count: 0 };
          const collection = await client.getCollection({ name: c.name });
          const count = await collection.count();
          return { ...c, count };
        } catch {
          return { ...c, count: 0 };
        }
      }));

      return { 
        success: true, 
        count: collections.length, 
        collections: enrichedCollections, 
        provider: 'CHROMA_PERSISTENT_LOCAL' 
      };
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

    const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    if (isCloud) {
      return { success: false, error: 'WRITE_RESTRICTED_ON_CLOUD' };
    }

    try {
      const collection = await getOrCreateCollection(name);
      const count = await collection.count();
      return { 
        success: true, 
        message: `Collection "${name}" créée avec succès.`, 
        collection: { name, documentCount: count } 
      };
    } catch (e: any) {
      return { success: false, error: 'DB_WRITE_FAILED', details: e.message };
    }
  }
});

export async function DELETE(req: Request) {
  const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  if (isCloud) {
    return new Response(JSON.stringify({ error: 'DELETE_RESTRICTED_ON_CLOUD' }), { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    if (!name) {
      return new Response(JSON.stringify({ error: 'Le paramètre "name" est requis.' }), { status: 400 });
    }
    await deleteCollection(name);
    return new Response(JSON.stringify({ success: true, message: `Collection "${name}" supprimée.` }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
