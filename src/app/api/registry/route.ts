export const dynamic = 'force-dynamic';
export const revalidate = false;
import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';
import { getLocalDBRoot } from '@/lib/db/local-db';
import path from 'path';

const REGISTRY_ROOT = path.join(path.dirname(getLocalDBRoot()), '.registry');

const sanitizeRegistryPath = (inputPath: string): string => {
  const cleaned = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter(s => s !== '.' && s !== '');
  const safe = segments.join('/');
  const full = path.join(REGISTRY_ROOT, safe);
  if (!full.startsWith(REGISTRY_ROOT)) {
    throw new Error('PATH_TRAVERSAL_DETECTED');
  }
  return safe;
};

/**
 * API de gestion du Registre.
 * - Mode local (EXE desktop) : arborescence physique sur disque (.registry).
 * - Mode Cloud (Vercel, serverless FS read-only) : l'arborescence est servie
 *   depuis la base de données (Neon/PostgreSQL) via la table `knowledgeItem`,
 *   regroupée par type. Le vrai Registre physique n'existe que dans l'EXE.
 */
const isCloudServerless = !!process.env.VERCEL;

// Construit l'arborescence du Registre à partir des KnowledgeItems (Cloud).
// Reconstruit la hiérarchie de dossiers à partir du tag `regpath:` (ex: regpath:Alarmes/sous-dossier/fichier.json)
// afin de restituer EXACTEMENT l'arborescence du .registry même côté Vercel (FS non déployé).
//
// Pour que l'arbre cloud soit STRUCTURELLEMENT IDENTIQUE à l'arbre local (scan physique de .registry,
// voir postgresClient.getRegistryTree / ensureRegistry), on injecte d'abord le squelette canonique
// (dossiers even vides : Alarmes, bank, items, procedures, ressources humaines/equipes/equipe A..D).
// On renvoie ensuite le tableau de premier niveau directement (SANS wrapper 'REGISTRE') afin d'épouser
// exactement la forme renvoyée par getRegistryTree côté local.
const CANONICAL_SKELETON: Record<string, string[]> = {
  '': ['Alarmes', 'bank', 'items', 'procedures', 'ressources humaines'],
  'ressources humaines': ['equipes'],
  'ressources humaines/equipes': ['equipe A', 'equipe B', 'equipe C', 'equipe D'],
};

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
        folder = { id: `dir::${acc}`, name: seg, type: 'folder', isOpen: false, children: [] };
        folderMap.set(acc, folder);
        parentList.push(folder);
      }
      parentList = folder.children;
    }
    return parentList;
  };

  // 1. Injecter le squelette canonique (garantit l'affichage des dossiers vides côté cloud).
  for (const [parent, names] of Object.entries(CANONICAL_SKELETON)) {
    const parentSegs = parent ? parent.split('/').filter(Boolean) : [];
    const parentList = parentSegs.length > 0 ? ensureFolder(parentSegs) : rootChildren;
    for (const name of names) {
      const acc = parent ? `${parent}/${name}` : name;
      if (!folderMap.has(acc)) {
        const folder = { id: `dir::${acc}`, name, type: 'folder', isOpen: false, children: [] };
        folderMap.set(acc, folder);
        parentList.push(folder);
      }
    }
  }

  // 2. Fusionner les items DB (reconstruits via le tag regpath: incluant l'extension de fichier).
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

  // 3. Retourner l'arborescence de premier niveau (même forme que getRegistryTree local).
  return rootChildren;
};

export const GET = createHybridRoute<any, any>({
  name: 'REGISTRY_EXPLORER',
  webHandler: async (req) => {
    if (isCloudServerless) {
      try {
        const { getPrismaClient } = await import('@/lib/db/prisma-client');
        const prisma = await getPrismaClient();
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
        const safePath = sanitizeRegistryPath(targetPath);
        return { success: true, content: await postgresClient.getFile(safePath) };
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
        const { getPrismaClient } = await import('@/lib/db/prisma-client');
        const prisma = await getPrismaClient();
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

        // Validation du schéma pour les collections de type 'qa'.
        if (knowledgeType === 'qa' && Array.isArray(parsedContent?.pairs)) {
          if (parsedContent.pairs.length === 0) {
            return { success: false, error: 'PAIRS_VIDES', details: 'Une collection Q/R doit contenir au moins une paire.' };
          }
          for (let i = 0; i < parsedContent.pairs.length; i++) {
            const pair = parsedContent.pairs[i];
            if (!pair || typeof pair.question !== 'string' || !pair.question.trim()
              || typeof pair.answer !== 'string' || !pair.answer.trim()) {
              return { success: false, error: `PAIR_INVALIDE_${i}`, details: `La paire ${i} nécessite question et answer non vides.` };
            }
          }
        }

        const question = Array.isArray(parsedContent?.pairs) && parsedContent.pairs[0]?.question ? parsedContent.pairs[0].question : null;
        const answer = Array.isArray(parsedContent?.pairs)
          ? parsedContent.pairs.map((pair: any) => pair.answer).filter(Boolean).join('\n\n') || null
          : null;

        const regPathTag = `regpath:${normalizedPath.replace(/\.json$/i, '')}`;

        const itemData = {
          userId: session.user.id,
          title: title.trim(),
          type: knowledgeType,
          content: contentText,
          question,
          answer,
          tags: Array.isArray(parsedContent?.tags) ? [...parsedContent.tags, regPathTag] : ['Q/R', 'entrainement', regPathTag],
          category: parsedContent?.category || 'General',
        };

        // R3 — Déduplication par CHEMIN COMPLET (tag regpath:) et non plus par
        // titre+type. Deux fichiers de même nom dans des dossiers différents
        // (ex: items/alarme.json vs sous-dossier/alarme.json) conservent ainsi
        // leur hiérarchie propre côté cloud au lieu de s'écraser mutuellement.
        const existing = await prisma.knowledgeItem.findFirst({
          where: { tags: { has: regPathTag } },
          orderBy: { createdAt: 'desc' },
        });
        const item = existing
          ? await prisma.knowledgeItem.update({ where: { id: existing.id }, data: itemData })
          : await prisma.knowledgeItem.create({ data: itemData });

        return { success: true, itemId: item.id, updated: !!existing, path: registryPath, provider: 'cloud-db' };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    try {
      const session = await getSessionFromCookie();
      if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };
      const safePath = sanitizeRegistryPath(body.path || '');
      if (body.type === 'folder') {
        await postgresClient.createFolder(safePath);
      } else {
        await postgresClient.saveFile(safePath, body.content || '{}');
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const PATCH = createHybridRoute<{ path: string; newName: string }, any>({
  name: 'REGISTRY_RENAME',
  webHandler: async (req, body) => {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };
    if (isCloudServerless) return { success: false, error: 'REGISTRY_WRITE_CLOUD_UNSUPPORTED' };
    try {
      const { path: oldPath, newName } = body;
      if (!oldPath || !newName) return { success: false, error: 'PARAM_MISSING' };
      const safePath = sanitizeRegistryPath(oldPath);
      await postgresClient.renameItem(safePath, newName);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});

export const DELETE = createHybridRoute<any, any>({
  name: 'REGISTRY_DELETE',
  webHandler: async (req) => {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'NON_AUTHENTIFIÉ' };

    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    if (!targetPath) return { success: false, error: 'PATH_REQUIRED' };

    if (isCloudServerless) {
      try {
        const { getPrismaClient } = await import('@/lib/db/prisma-client');
        const prisma = await getPrismaClient();
        const item = await prisma.knowledgeItem.findUnique({ where: { id: targetPath } });
        if (!item) return { success: false, error: 'INTROUVABLE' };
        if (item.userId !== session.user.id && session.user.role !== 'admin') {
          return { success: false, error: 'NON_AUTORISÉ' };
        }

        try {
          const { deleteKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
          const { deleteBankAsset } = await import('@/lib/weaviate/weaviate-bank');
          await deleteKnowledgeItem(targetPath);
          await deleteBankAsset(targetPath);
        } catch (e: any) {
          console.warn(`[REGISTRY_DELETE] Weaviate cleanup failed: ${e.message}`);
        }

        await prisma.knowledgeItem.delete({ where: { id: targetPath } });
        return { success: true, message: 'ELEMENT_SUPPRIME' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    try {
      const safePath = sanitizeRegistryPath(targetPath);
      await postgresClient.deleteItem(safePath);
      return { success: true, message: 'ELEMENT_SUPPRIME' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
});
