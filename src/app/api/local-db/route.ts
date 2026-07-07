export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { localDB } from '@/lib/db/local-db';


/**
 * API de gestion de la Base de Données Locale [LOCAL_DB].
 * Arborescence physique : INDEX_CHROMA + Centrale.
 */
export const GET = createHybridRoute<any, any>({
  name: 'LOCAL_DB_GET',
  webHandler: async (req) => {
    await localDB.initialize();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const filePath = searchParams.get('path');
    const query = searchParams.get('query');

    if (action === 'manifest') {
      const manifest = await localDB.getManifest();
      return { success: true, manifest };
    }

    if (action === 'search' && query) {
      const results = await localDB.searchByQuery(query);
      return { success: true, results };
    }

    if (filePath) {
      try {
        const content = await localDB.getFile(filePath);
        return { success: true, content };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    const tree = await localDB.getTree();
    return { success: true, tree };
  }
});

export const POST = createHybridRoute<any, any>({
  name: 'LOCAL_DB_INJECT',
  webHandler: async (req, body) => {
    const { fileName, content, metadata } = body;

    if (!fileName || content === undefined) {
      return { success: false, error: 'PARAM_MISSING: fileName et content requis' };
    }

    try {
      const result = await localDB.injectFile(fileName, content, metadata);
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const DELETE = createHybridRoute<any, any>({
  name: 'LOCAL_DB_DELETE',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return { success: false, error: 'PATH_REQUIRED' };
    }

    try {
      const deleted = await localDB.deleteItem(filePath);
      if (!deleted) {
        return { success: false, error: 'ELEMENT_INTROUVABLE' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

