import { registerAppTools } from '@/lib/ai/tools';

registerAppTools();

export const dynamic = 'force-dynamic';
export const revalidate = false;
import { chatOrchestrator } from '@/lib/ai/chat-router';
import { vercelAdapter } from '@/lib/ai/vercel-adapter';

export interface ChatRequestBody {
  message: string;
  history: any[];
  mode?: 'web' | 'hybride' | 'locale';
  stream?: boolean;
}

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
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

    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            const result = await chatOrchestrator.process({
              message: body.message,
              history: body.history || [],
              mode,
              online: true,
              onStreamChunk: (chunk: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              },
            });

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

    const result = await chatOrchestrator.process({
      message: body.message,
      history: body.history || [],
      mode,
      online: true,
    });

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
