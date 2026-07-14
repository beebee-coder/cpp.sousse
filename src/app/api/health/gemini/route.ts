export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function GET() {
  return new Response(JSON.stringify({ status: 'ok', service: 'GEMINI', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
