
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';
import { NextResponse } from 'next/server';

/**
 * API de gestion physique du Registre (FS).
 */
export const GET = createHybridRoute<any, any>({
  name: 'REGISTRY_EXPLORER',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    
    if (path) {
      const content = await postgresClient.getFile(path);
      return { success: true, content };
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
    const { path, newName } = body;
    if (!path || !newName) return { success: false, error: "PARAM_MISSING" };
    
    await postgresClient.renameItem(path, newName);
    return { success: true };
  }
});

export const DELETE = createHybridRoute<any, any>({
  name: 'REGISTRY_DELETE',
  webHandler: async (req) => {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ success: false, error: "PATH_REQUIRED" }, { status: 400 });
    }
    
    try {
      await postgresClient.deleteItem(path);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [REGISTRY_DELETE] Échec :`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }
});
