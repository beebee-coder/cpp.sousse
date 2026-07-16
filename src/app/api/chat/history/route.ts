import { prisma } from '@/lib/db/prisma-client';
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

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      const conversations = await prisma.chatMessage.findMany({
        where: { userId: session.user.id },
        select: { conversationId: true },
        distinct: ['conversationId'],
        orderBy: { timestamp: 'desc' },
      });

      return new Response(JSON.stringify({ conversations }), {
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

    await prisma.chatMessage.deleteMany({ where: { conversationId, userId: session.user.id } });

    const data = messages.map((m) => ({
      conversationId,
      userId: session.user.id,
      role: m.role,
      content: m.content,
      provider: m.provider || null,
      timestamp: new Date(m.timestamp || Date.now()),
      media: m.media || null,
      procedureId: m.procedureId || null,
      source: m.source || null,
    }));

    await prisma.chatMessage.createMany({ data });

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
