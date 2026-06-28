import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/knowledge — Liste les connaissances (Q/R + Procédures)
// Paramètres query : type ("qa"|"procedure"), userId, page, limit
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
    }
    const token = session.user;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;       // 'qa' | 'procedure'
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;

    // Non-admin : accès limité aux items publics ou ses propres items
    if (token.role !== 'admin') {
      where.OR = [{ isPublic: true }, { userId: token.id }];
    }

    const [items, total] = await Promise.all([
      prisma.knowledgeItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
      }),
      prisma.knowledgeItem.count({ where }),
    ]);

    return NextResponse.json({ success: true, items, total, page, limit });
  } catch (err: any) {
    console.error('[API/KNOWLEDGE GET]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/knowledge — Crée un item Q/R ou Procédure dans Neon
// Body: { type, title, question?, answer?, steps?, tags?, category?, difficulty?, isPublic? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
    }
    const token = session.user;

    const body = await request.json();
    const {
      type,
      title,
      question,
      answer,
      steps,
      tags = [],
      category,
      difficulty = 'medium',
      isPublic = true,
    } = body;

    if (!type || !['qa', 'procedure'].includes(type)) {
      return NextResponse.json({ success: false, error: 'TYPE_INVALIDE (qa | procedure)' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ success: false, error: 'TITRE_REQUIS' }, { status: 400 });
    }
    if (type === 'qa' && (!question || !answer)) {
      return NextResponse.json({ success: false, error: 'QUESTION_ET_RÉPONSE_REQUIS' }, { status: 400 });
    }
    if (type === 'procedure' && (!steps || !Array.isArray(steps) || steps.length === 0)) {
      return NextResponse.json({ success: false, error: 'ÉTAPES_REQUISES' }, { status: 400 });
    }

    const userId = token.id;

    const item = await prisma.knowledgeItem.create({
      data: {
        userId,
        type,
        title: title.trim(),
        question: question?.trim() ?? null,
        answer: answer?.trim() ?? null,
        steps: steps ?? null,
        tags: Array.isArray(tags) ? tags : [],
        category: category?.trim() ?? null,
        difficulty,
        isPublic,
      },
    });

    // 🚀 Indexation vectorielle asynchrone dans Weaviate Cloud (non-bloquante)
    indexInWeaviate(item).catch((e: Error) =>
      console.warn('[KNOWLEDGE] Indexation Weaviate différée :', e.message)
    );

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err: any) {
    console.error('[API/KNOWLEDGE POST]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/knowledge — Met à jour un item existant
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
    }
    const token = session.user;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID_REQUIS' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est propriétaire ou admin
    const existing = await prisma.knowledgeItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'ITEM_INTROUVABLE' }, { status: 404 });
    }
    if (existing.userId !== token.id && token.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'ACCÈS_REFUSÉ' }, { status: 403 });
    }

    const item = await prisma.knowledgeItem.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    console.error('[API/KNOWLEDGE PATCH]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonction utilitaire : indexation Weaviate (ne bloque pas la réponse HTTP)
// ─────────────────────────────────────────────────────────────────────────────
async function indexInWeaviate(item: any) {
  try {
    const { getWeaviateClient } = await import('@/lib/weaviate/weaviate-cloud-client');
    const client = await getWeaviateClient();
    const collection = client.collections.get('KnowledgeItem');

    const textContent =
      item.type === 'qa'
        ? `${item.title}\nQ: ${item.question}\nR: ${item.answer}`
        : `${item.title}\n${(item.steps as any[])?.map((s: any, i: number) => `Étape ${i + 1}: ${s.instruction}`).join('\n')}`;

    await collection.data.insert({
      properties: {
        knowledgeId: item.id,
        userId: item.userId,
        type: item.type,
        title: item.title,
        content: textContent,
        tags: item.tags,
        category: item.category ?? '',
        difficulty: item.difficulty,
        isPublic: item.isPublic,
        createdAt: item.createdAt.toISOString(),
      },
    });

    // Enregistrer l'ID Weaviate dans Neon pour déduplication
    await prisma.knowledgeItem.update({
      where: { id: item.id },
      data: { vectorId: item.id }, // Weaviate génère son propre UUID, ici on stocke le nôtre comme référence
    });

    console.log(`[WEAVIATE] ✅ Indexé : ${item.id} (${item.type})`);
  } catch (err: any) {
    console.error('[WEAVIATE] ❌ Échec indexation :', err.message);
    throw err;
  }
}
