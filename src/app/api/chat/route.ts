import { registerAppTools } from '@/lib/ai';

registerAppTools();

export const dynamic = 'force-dynamic';
export const revalidate = false;
import { chatOrchestrator } from '@/lib/ai/chat-router';
import { vercelAdapter } from '@/lib/ai/vercel-adapter';
import { getSessionFromCookie } from '@/lib/session';
import { prisma } from '@/lib/db/prisma-client';

export interface ChatRequestBody {
  message: string;
  history: any[];
  mode?: 'web' | 'hybride' | 'locale';
  stream?: boolean;
  userId?: string;
  conversationId?: string;
  online?: boolean;
}

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

async function persistConversation(userId: string | undefined, conversationId: string | undefined, history: any[], userMessage: string, aiResult: { text: string; provider?: string }) {
  if (!userId || !conversationId) return;
  try {
    // C4 — persistance idempotente : on upsert chaque message sur sa clé
    // (conversationId, userId, clientId) au lieu de deleteMany+createMany.
    // Le clientId stable évite les doublons et les races conditionnelles,
    // et l'on ne supprime plus toute la conversation à chaque appel.
    const allMessages: any[] = [];
    for (const m of history) {
      allMessages.push({
        clientId: m.id || null,
        conversationId,
        userId,
        role: m.role,
        content: m.content,
        provider: m.provider || null,
        timestamp: new Date(m.timestamp || Date.now()),
        media: m.media || null,
        procedureId: m.procedureId || null,
        source: m.source || null,
      });
    }
    allMessages.push({
      clientId: `user-${conversationId}-${Date.now()}`,
      conversationId,
      userId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });
    allMessages.push({
      clientId: `model-${conversationId}-${Date.now()}`,
      conversationId,
      userId,
      role: 'model',
      content: aiResult.text,
      provider: aiResult.provider || null,
      timestamp: new Date(),
    });

    for (const msg of allMessages) {
      await prisma.chatMessage.upsert({
        where: { conversationId_userId_clientId: { conversationId, userId, clientId: msg.clientId } },
        create: msg,
        update: {
          role: msg.role,
          content: msg.content,
          provider: msg.provider,
          timestamp: msg.timestamp,
          media: msg.media,
          procedureId: msg.procedureId,
          source: msg.source,
        },
      });
    }
  } catch (e) {
    console.warn('[CHAT_API] Persistence failed:', e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ChatRequestBody;
    const validation = vercelAdapter.validatePayload(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: getSecurityHeaders(),
      });
    }

    const headerMode = req.headers.get('X-App-Mode') as 'web' | 'hybride' | 'locale' | null;
    const mode = body.mode || headerMode || 'web';

    // C5 — état réseau réel transmis par le client (useAppMode.online) au lieu
    // de forcer `online: true`. Le header X-Network-Online sert de repli.
    const headerOnline = req.headers.get('X-Network-Online');
    const online =
      typeof body.online === 'boolean'
        ? body.online
        : headerOnline === '0'
          ? false
          : headerOnline === '1'
            ? true
            : true;

    const session = await getSessionFromCookie();
    const userName = session?.user ? `${session.user.firstName} ${session.user.lastName}` : undefined;

    const chatInput = {
      message: body.message,
      history: body.history || [],
      mode,
      online,
      userId: session?.user?.id,
      userName,
      onStreamChunk: undefined as ((chunk: string) => void) | undefined,
    };

    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            const result = await chatOrchestrator.process({
              ...chatInput,
              onStreamChunk: (chunk: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              },
            });

            await persistConversation(session?.user?.id, body.conversationId, body.history || [], body.message, result);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result })}\n\n`));
            controller.close();
          } catch (err: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...getSecurityHeaders(),
        },
      });
    }

    const result = await chatOrchestrator.process(chatInput);

    await persistConversation(session?.user?.id, body.conversationId, body.history || [], body.message, result);

    return new Response(JSON.stringify(result), {
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
