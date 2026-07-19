import { getPrismaClient } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: getSecurityHeaders(),
      });
    }

    const prisma = await getPrismaClient();
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      // R1 — Pas de groupBy Prisma (incompatible avec la clé unique
      // nullable clientId → 500 systématique). On récupère les messages
      // et on regroupe en JS : une entrée par conversationId avec le
      // compte et le timestamp max.
      const rows = await prisma.chatMessage.findMany({
        where: { userId: session.user.id },
        select: { conversationId: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
      });

      const map = new Map<string, { messages: number; updatedAt: Date | null }>();
      for (const row of rows) {
        const cur = map.get(row.conversationId);
        if (!cur) {
          map.set(row.conversationId, { messages: 1, updatedAt: row.timestamp });
        } else {
          cur.messages += 1;
          if (row.timestamp && (!cur.updatedAt || row.timestamp > cur.updatedAt)) {
            cur.updatedAt = row.timestamp;
          }
        }
      }

      const formatted = Array.from(map.entries())
        .map(([id, v]) => ({
          conversationId: id,
          _count: { messages: v.messages },
          updatedAt: v.updatedAt,
        }))
        .sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tb - ta;
        });

      return new Response(JSON.stringify({ conversations: formatted }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(),
        },
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { userId: session.user.id, conversationId },
      orderBy: { timestamp: 'asc' },
    });

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  } catch (err: any) {
    console.error('[CHAT_HISTORY_API] Erreur GET:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erreur serveur' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: getSecurityHeaders(),
      });
    }

    const prisma = await getPrismaClient();
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId requis' }), {
        status: 400,
        headers: getSecurityHeaders(),
      });
    }

    await prisma.chatMessage.deleteMany({
      where: { userId: session.user.id, conversationId },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erreur serveur' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: getSecurityHeaders(),
      });
    }

    const prisma = await getPrismaClient();
    const body = await req.json();
    const { conversationId, messages } = body as {
      conversationId: string;
      messages: any[];
    };

    if (!conversationId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Payload invalide' }), {
        status: 400,
        headers: getSecurityHeaders(),
      });
    }

    // C4 — persistance idempotente : upsert sur (conversationId, userId, clientId)
    // au lieu de deleteMany+createMany, pour éviter doublons et races.
    for (const m of messages) {
      const clientId = m.id || `hist-${conversationId}-${m.timestamp || Date.now()}`;
      await prisma.chatMessage.upsert({
        where: { conversationId_userId_clientId: { conversationId, userId: session.user.id, clientId } },
        create: {
          clientId,
          conversationId,
          userId: session.user.id,
          role: m.role,
          content: m.content,
          provider: m.provider || null,
          timestamp: new Date(m.timestamp || Date.now()),
          media: m.media || null,
          procedureId: m.procedureId || null,
          source: m.source || null,
        },
        update: {
          role: m.role,
          content: m.content,
          provider: m.provider || null,
          timestamp: new Date(m.timestamp || Date.now()),
          media: m.media || null,
          procedureId: m.procedureId || null,
          source: m.source || null,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erreur serveur' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    });
  }
}
