
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';
import { NextResponse } from 'next/server';

/**
 * API de gestion physique du Registre (FS).
 * Cette route gère les opérations CRUD sur les fichiers de configuration.
 */
export const GET = createHybridRoute<any, any>({
  name: 'REGISTRY_EXPLORER',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    
    if (targetPath) {
      try {
        const content = await postgresClient.getFile(targetPath);
        return { success: true, content };
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 404 });
      }
    }
    
    const tree = await postgresClient.getRegistryTree();
    return { success: true, tree };
  }
});

export const POST = createHybridRoute<{ path: string; type: 'file' | 'folder'; content?: string }, any>({
  name: 'REGISTRY_CREATE',
  webHandler: async (req, body) => {
    if (body.type === 'folder') {
      await postgresClient.createFolder(body.path);
    } else {
      await postgresClient.saveFile(body.path, body.content || '{}');
    }
    return { success: true };
  }
});

export const PUT = createHybridRoute<{ path: string; content: string }, any>({
  name: 'REGISTRY_UPDATE',
  webHandler: async (req, body) => {
    await postgresClient.saveFile(body.path, body.content);
    return { success: true };
  }
});

export const PATCH = createHybridRoute<{ path: string; newName: string }, any>({
  name: 'REGISTRY_RENAME',
  webHandler: async (req, body) => {
    const { path: oldPath, newName } = body;
    if (!oldPath || !newName) return { success: false, error: "PARAM_MISSING" };
    
    await postgresClient.renameItem(oldPath, newName);
    return { success: true };
  }
});

/**
 * Endpoint de suppression physique
 */
export const DELETE = createHybridRoute<any, any>({
  name: 'REGISTRY_DELETE',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    
    if (!targetPath) {
      return NextResponse.json({ success: false, error: "PATH_REQUIRED" }, { status: 400 });
    }
    
    try {
      console.log(`📡 [API_REGISTRY] Demande de suppression physique : ${targetPath}`);
      await postgresClient.deleteItem(targetPath);
      return { success: true, message: "ELEMENT_SUPPRIME" };
    } catch (error: any) {
      console.error(`❌ [API_REGISTRY] Échec suppression :`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }
});
