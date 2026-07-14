export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function GET() {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ status: 'error', message: 'GROQ_API_KEY manquante' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 10000 });

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'ping' }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 1,
    });

    return new Response(JSON.stringify({
      status: 'ok',
      model: completion.model,
      provider: 'Groq',
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message || 'Groq unreachable',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
