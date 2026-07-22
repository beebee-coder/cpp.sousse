export const dynamic = 'force-dynamic';
export const revalidate = false;
import fs from 'fs';
import path from 'path';
import { createHybridRoute } from '@/lib/api-route-creator';
import { localDB, getLocalDBRoot } from '@/lib/db/local-db';
import { getSessionFromCookie } from '@/lib/session';

const sanitizeLocalDBPath = (inputPath: string): string => {
  const cleaned = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter(s => s !== '.' && s !== '');
  const safe = segments.join('/');
  const full = path.join(getLocalDBRoot(), safe);
  if (!full.startsWith(getLocalDBRoot())) {
    throw new Error('PATH_TRAVERSAL_DETECTED');
  }
  return safe;
};


/**
 * API de gestion de la Base de Données Locale [LOCAL_DB].
 * Arborescence physique : INDEX_CHROMA + Centrale.
 */
export const GET = createHybridRoute<any, any>({
  name: 'LOCAL_DB_GET',
  webHandler: async (req) => {
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
  name: 'LOCAL_DB_POST',
  webHandler: async (req, body) => {
    const { fileName, content, metadata, path: targetPath, type, action, targetDir } = body;

    if (action === 'index-folder' && targetPath) {
      const { indexLocalDBFolder } = await import('@/lib/local-indexer');
      const safeTarget = sanitizeLocalDBPath(targetPath);
      return await indexLocalDBFolder(safeTarget);
    }

    if (action === 'index' && targetPath) {
      const { indexLocalDBFile } = await import('@/lib/local-indexer');
      const safeTarget = sanitizeLocalDBPath(targetPath);
      return await indexLocalDBFile(safeTarget);
    }

    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };

    if (targetPath && type) {
      const safeTarget = sanitizeLocalDBPath(targetPath);
      const fullPath = path.join(getLocalDBRoot(), safeTarget);
      if (type === 'folder') {
        fs.mkdirSync(fullPath, { recursive: true });
        return { success: true, path: targetPath };
      }
      if (type === 'file' && content !== undefined) {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return { success: true, path: targetPath };
      }
      return { success: false, error: 'PARAM_INVALID' };
    }

    if (!fileName || content === undefined) {
      return { success: false, error: 'PARAM_MISSING: fileName et content requis' };
    }

    try {
      const safeName = sanitizeLocalDBPath(fileName);
      const safeTargetDir = targetDir ? sanitizeLocalDBPath(targetDir) : undefined;
      const result = await localDB.injectFile(safeName, content, metadata, safeTargetDir);
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const PUT = createHybridRoute<any, any>({
  name: 'LOCAL_DB_PUT',
  webHandler: async (req, body) => {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };
    const { path: filePath, content } = body;
    if (!filePath || content === undefined) {
      return { success: false, error: 'PARAM_MISSING: path et content requis' };
    }
    try {
      const safePath = sanitizeLocalDBPath(filePath);
      const result = await localDB.writeFile(safePath, content);
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const DELETE = createHybridRoute<any, any>({
  name: 'LOCAL_DB_DELETE',
  webHandler: async (req) => {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return { success: false, error: 'PATH_REQUIRED' };
    }

    try {
      const safePath = sanitizeLocalDBPath(filePath);
      const deleted = await localDB.deleteItem(safePath);
      if (!deleted) {
        return { success: false, error: 'ELEMENT_INTROUVABLE' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const PATCH = createHybridRoute<{ path: string; newName: string }, any>({
  name: 'LOCAL_DB_RENAME',
  webHandler: async (req, body) => {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };
    const { path: oldPath, newName } = body;
    if (!oldPath || !newName) {
      return { success: false, error: 'PARAM_MISSING' };
    }
    try {
      const safePath = sanitizeLocalDBPath(oldPath);
      await localDB.renameItem(safePath, newName);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

