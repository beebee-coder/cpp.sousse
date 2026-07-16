export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';


/**
 * @fileOverview API de Gestion des Connaissances Sémantiques [KNOWLEDGE_API].
 * Gère les paires Q/R et les briques de savoir sémantique.
 */

export async function GET(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🔍 [KNOWLEDGE_API] [INIT] Demande de lecture du registre sémantique à ${ts}`);
  
  try {
    const session = await getSessionFromCookie();
    if (!session) return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;

    const items = await prisma.knowledgeItem.findMany({
      where: type ? { type } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } }
    });

    return NextResponse.json({ success: true, items });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ [KNOWLEDGE_API] [ERROR] Échec lecture :`, err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🚀 [KNOWLEDGE_API] [INIT] Injection d'un nouvel item à ${ts}`);

  try {
    const session = await getSessionFromCookie();
    if (!session) return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });

    const body = await request.json();
    const { type, title, question, answer, tags, category } = body;

    if (!title || !type) {
      return NextResponse.json({ success: false, error: 'TITRE_ET_TYPE_REQUIS' }, { status: 400 });
    }

    if (type === 'qa') {
      const q = typeof question === 'string' ? question.trim() : '';
      const a = typeof answer === 'string' ? answer.trim() : '';
      if (!q || !a) {
        return NextResponse.json({ success: false, error: 'QUESTION_ET_REPONSE_REQUISES' }, { status: 400 });
      }
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        userId: session.user.id,
        type: type || 'qa',
        title: title.trim(),
        question: question?.trim() || null,
        answer: answer?.trim() || null,
        tags: Array.isArray(tags) ? tags : [],
        category: category || 'General',
      }
    });

    console.log(`✅ [KNOWLEDGE_API] [SUCCESS] Item indexé avec succès : ${item.id}`);

    // Vectorisation Weaviate (non bloquante) : rend la recherche sémantique
    // disponible pour cet item. Ignorée si Weaviate n'est pas configuré.
    if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
      try {
        const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
        await upsertKnowledgeItem({
          knowledgeId: item.id,
          userId: session.user.id,
          type: (type || 'qa') as 'qa' | 'procedure',
          title: item.title,
          content: question && answer ? `Q: ${question}\nR: ${answer}` : (item.content || item.title),
          tags: item.tags,
          category: item.category || 'General',
          difficulty: 'MEDIUM',
          isPublic: false,
          createdAt: new Date().toISOString(),
        });
      } catch (vecErr: any) {
        console.warn('[KNOWLEDGE_API] Vectorisation Weaviate ignorée :', vecErr.message);
      }
    }

    return NextResponse.json({ success: true, item });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ [KNOWLEDGE_API] [ERROR] Échec injection :`, err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

