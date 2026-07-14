export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';

/**
 * API de gestion du Registre.
 * - Mode local (EXE desktop) : arborescence physique sur disque (.registry).
 * - Mode Cloud (Vercel, serverless FS read-only) : l'arborescence est servie
 *   depuis la base de données (Neon/PostgreSQL) via la table `knowledgeItem`,
 *   regroupée par type. Le vrai Registre physique n'existe que dans l'EXE.
 */
const isCloudServerless = !!process.env.VERCEL;

// Construit l'arborescence du Registre à partir des KnowledgeItems (Cloud).
// Reconstruit la hiérarchie de dossiers à partir du tag `regpath:` (ex: regpath:Alarmes/sous-dossier/fichier)
// afin de restituer EXACTEMENT l'arborescence du .registry même côté Vercel (FS non déployé).
const buildCloudTree = (items: any[]): any[] => {
  const rootChildren: any[] = [];
  const folderMap = new Map<string, any>();

  const ensureFolder = (segments: string[]): any[] => {
    let parentList = rootChildren;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let folder = folderMap.get(acc);
      if (!folder) {
        folder = { id: `dir::${acc}`, name: seg, type: 'folder', isOpen: true, children: [] };
        folderMap.set(acc, folder);
        parentList.push(folder);
      }
      parentList = folder.children;
    }
    return parentList;
  };

  const loose: any[] = [];

  for (const it of items) {
    const regPathTag = (it.tags || []).find(
      (t: any) => typeof t === 'string' && t.startsWith('regpath:')
    ) as string | undefined;

    if (regPathTag) {
      const rel = regPathTag.slice('regpath:'.length);
      const segments = rel.split('/').filter(Boolean);
      const fileName = segments.pop();
      const target = segments.length > 0 ? ensureFolder(segments) : rootChildren;
      target.push({
        id: it.id,
        name: fileName || it.title || it.question || it.id,
        type: 'file',
        metadata: { cloudId: it.id, type: it.type, category: it.category }
      });
    } else {
      loose.push({
        id: it.id,
        name: it.title || it.question || it.id,
        type: 'file',
        metadata: { cloudId: it.id, type: it.type, category: it.category }
      });
    }
  }

  if (loose.length > 0) {
    rootChildren.push({
      id: 'cloud-loose',
      name: 'COLLECTIONS Q/R (CLOUD)',
      type: 'folder',
      isOpen: true,
      children: loose
    });
  }

  return [{
    id: 'Registre',
    name: 'REGISTRE',
    type: 'folder',
    isOpen: true,
    children: rootChildren
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
    if (isCloudServerless) {
      try {
        const session = await getSessionFromCookie();
        if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };

        const rawPath = body.path?.toString().trim() || 'items/qr-collection.json';
        const normalizedPath = rawPath.replace(/^\/+|\\/g, '').replace(/\\/g, '/');
        const safeFileName = normalizedPath.split('/').filter(Boolean).pop() || 'qr-collection.json';
        const baseName = safeFileName.replace(/\.json$/i, '');
        const contentText = typeof body.content === 'string' ? body.content : JSON.stringify(body.content || {}, null, 2);
        const parsedContent = (() => {
          try {
            return JSON.parse(contentText);
          } catch {
            return null;
          }
        })();

        const title = parsedContent?.title || baseName || 'Collection Q/R';
        const knowledgeType = parsedContent?.type || 'qa';
        const registryPath = parsedContent?.registryPath || normalizedPath;
        const question = Array.isArray(parsedContent?.pairs) && parsedContent.pairs[0]?.question ? parsedContent.pairs[0].question : null;
        const answer = Array.isArray(parsedContent?.pairs)
          ? parsedContent.pairs.map((pair: any) => pair.answer).filter(Boolean).join('\n\n') || null
          : null;

        const item = await prisma.knowledgeItem.create({
          data: {
            userId: session.user.id,
            title: title.trim(),
            type: knowledgeType,
            content: contentText,
            question,
            answer,
            tags: Array.isArray(parsedContent?.tags) ? parsedContent.tags : ['Q/R', 'entrainement'],
            category: parsedContent?.category || 'General',
          }
        });

        return { success: true, itemId: item.id, path: registryPath, provider: 'cloud-db' };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

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
