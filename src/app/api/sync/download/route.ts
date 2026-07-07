export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';

/**
 * Route de download pour la synchronisation multi-environnement (Delta Sync).
 * Retourne les KnowledgeItems de TOUS les utilisateurs approuvés depuis la dernière sync.
 * Utilisé par le mode Desktop (Tauri) pour enrichir la BDD ChromaDB locale.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lastSync, scope = 'all' } = body as {
      userId?: string;
      projectId?: string;
      lastSync?: string;
      scope?: 'self' | 'all';
    };

    const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0);

    // Récupérer les KnowledgeItems créés/mis à jour depuis la dernière sync
    const where: Record<string, unknown> = {
      createdAt: { gt: lastSyncDate },
    };

    // scope='self' : uniquement l'utilisateur courant (inutilisé pour l'instant mais prévu)
    // scope='all' (défaut) : tous les items publics de tous les utilisateurs approuvés
    if (scope === 'all') {
      where.user = { approved: true };
    }

    const knowledgeItems = await prisma.knowledgeItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        question: true,
        answer: true,
        tags: true,
        category: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transformer en format CloudData compatible avec le sync-engine existant
    const items = knowledgeItems.map((ki) => ({
      id: ki.id,
      projectId: 'global',
      type: 'document' as const,
      content: JSON.stringify({
        knowledgeId: ki.id,
        type: ki.type,
        title: ki.title,
        question: ki.question,
        answer: ki.answer,
        tags: ki.tags,
        category: ki.category,
      }),
      tags: ki.tags,
      createdAt: ki.createdAt,
      // Métadonnées étendues pour la désérialisation locale
      _knowledgeType: ki.type,
      _title: ki.title,
    }));

    return NextResponse.json({
      success: true,
      items,
      syncedAt: new Date().toISOString(),
      count: items.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[SYNC/DOWNLOAD]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
