export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';


/**
 * API de gestion physique du Registre (FS).
 */
// Sur Vercel (serverless, FS read-only), le Registre physique (arborescence
// fichiers sur disque) n'a pas de backend : on répond proprement (pas de 500).
// Le vrai Registre local n'existe que dans l'EXE desktop.
const isCloudServerless = !!process.env.VERCEL;

export const GET = createHybridRoute<any, any>({
  name: 'REGISTRY_EXPLORER',
  webHandler: async (req) => {
    if (isCloudServerless) {
      return { success: true, tree: [], provider: 'cloud', message: 'REGISTRY_EXPLORER_DESKTOP_ONLY' };
    }
    try {
      const { searchParams } = new URL(req.url);
      const targetPath = searchParams.get('path');
      const action = searchParams.get('action');

      if (action === 'diagnostic') {
        return { success: true, logs: await postgresClient.runDiagnostic() };
      }

      if (targetPath) {
        return { success: true, content: await postgresClient.getFile(targetPath) };
      }

      return { success: true, tree: await postgresClient.getRegistryTree() };
    } catch (e: any) {
      return { success: false, error: e.message, provider: 'local' };
    }
  }
});

export const POST = createHybridRoute<{ path: string; type: 'file' | 'folder'; content?: string }, any>({
  name: 'REGISTRY_CREATE',
  webHandler: async (req, body) => {
    if (isCloudServerless) return { success: false, error: 'REGISTRY_WRITE_CLOUD_UNSUPPORTED' };
    try {
      if (body.type === 'folder') {
        await postgresClient.createFolder(body.path);
      } else {
        await postgresClient.saveFile(body.path, body.content || '{}');
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const PUT = createHybridRoute<{ path: string; content: string }, any>({
  name: 'REGISTRY_UPDATE',
  webHandler: async (req, body) => {
    if (isCloudServerless) return { success: false, error: 'REGISTRY_WRITE_CLOUD_UNSUPPORTED' };
    try {
      await postgresClient.saveFile(body.path, body.content);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const PATCH = createHybridRoute<{ path: string; newName: string }, any>({
  name: 'REGISTRY_RENAME',
  webHandler: async (req, body) => {
    if (isCloudServerless) return { success: false, error: 'REGISTRY_WRITE_CLOUD_UNSUPPORTED' };
    try {
      const { path: oldPath, newName } = body;
      if (!oldPath || !newName) return { success: false, error: 'PARAM_MISSING' };
      await postgresClient.renameItem(oldPath, newName);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const DELETE = createHybridRoute<any, any>({
  name: 'REGISTRY_DELETE',
  webHandler: async (req) => {
    if (isCloudServerless) return { success: false, error: 'REGISTRY_WRITE_CLOUD_UNSUPPORTED' };
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    if (!targetPath) return { success: false, error: 'PATH_REQUIRED' };
    try {
      await postgresClient.deleteItem(targetPath);
      return { success: true, message: 'ELEMENT_SUPPRIME' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
});

