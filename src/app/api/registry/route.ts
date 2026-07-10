export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * API de gestion du Registre.
 * - Mode local (EXE desktop) : arborescence physique sur disque (.registry).
 * - Mode Cloud (Vercel, serverless FS read-only) : l'arborescence est servie
 *   depuis la base de données (Neon/PostgreSQL) via la table `knowledgeItem`,
 *   regroupée par type. Le vrai Registre physique n'existe que dans l'EXE.
 */
const isCloudServerless = !!process.env.VERCEL;

// Construit l'arborescence du Registre à partir des KnowledgeItems (Cloud).
const buildCloudTree = (items: any[]): any[] => {
  const byType: Record<string, any[]> = {};
  for (const it of items) {
    const t = (it.type || 'document').toString();
    if (!byType[t]) byType[t] = [];
    byType[t].push(it);
  }

  const typeFolders = Object.entries(byType).map(([type, its]) => ({
    id: `type-${type}`,
    name: type.toUpperCase(),
    type: 'folder',
    isOpen: true,
    children: its.map((it: any) => ({
      id: it.id,
      name: it.title || it.question || it.id,
      type: 'file',
      metadata: { cloudId: it.id, type: it.type, category: it.category }
    }))
  }));

  return [{
    id: 'Registre',
    name: 'REGISTRE',
    type: 'folder',
    isOpen: true,
    children: typeFolders
  }];
};

export const GET = createHybridRoute<any, any>({
  name: 'REGISTRY_EXPLORER',
  webHandler: async (req) => {
    if (isCloudServerless) {
      try {
        const { prisma } = await import('@/lib/db/prisma-client');
        const { searchParams } = new URL(req.url);
        const targetPath = searchParams.get('path');
        const action = searchParams.get('action');

        if (action === 'diagnostic') {
          return { success: true, logs: ['CLOUD_MODE', 'Registre servi depuis la base de données (Neon).'] };
        }

        if (targetPath) {
          const item = await prisma.knowledgeItem.findUnique({ where: { id: targetPath } });
          if (!item) return { success: false, error: 'INTROUVABLE' };
          const content = JSON.stringify({
            title: item.title,
            type: item.type,
            category: item.category,
            question: item.question,
            answer: item.answer,
            content: item.content,
            tags: item.tags || []
          }, null, 2);
          return { success: true, content };
        }

        const items = await prisma.knowledgeItem.findMany({ orderBy: { createdAt: 'desc' } });
        return { success: true, tree: buildCloudTree(items), provider: 'cloud-db' };
      } catch (e: any) {
        return { success: false, error: e.message, tree: [] };
      }
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
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    if (!targetPath) return { success: false, error: 'PATH_REQUIRED' };

    // Mode Cloud : suppression de la KnowledgeItem correspondante.
    if (isCloudServerless) {
      try {
        const { prisma } = await import('@/lib/db/prisma-client');
        await prisma.knowledgeItem.delete({ where: { id: targetPath } });
        return { success: true, message: 'ELEMENT_SUPPRIME' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    try {
      await postgresClient.deleteItem(targetPath);
      return { success: true, message: 'ELEMENT_SUPPRIME' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
});
