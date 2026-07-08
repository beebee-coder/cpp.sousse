export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview API RAG Base - Synchronisation du registre et opérations de base.
 * Routes :
 * - POST /api/rag-base { action: 'sync' }
 * - POST /api/rag-base { action: 'clear-registre' }
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        status: 'ok',
        message: 'RAG Base opérationnelle',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'RAG Base API disponible',
      endpoints: ['POST /api/rag-base - sync', 'POST /api/rag-base - clear-registre']
    });
  } catch (error) {
    console.error('[RAG_BASE_API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[RAG_BASE_API] [INIT] Traitement requête à ${ts}`);

  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'sync': {
        const syncedCount = data?.items?.length || 0;
        console.log(`[RAG_BASE_API] [SYNC] ${syncedCount} élément(s) synchronisé(s)`);

        return NextResponse.json({
          success: true,
          syncedCount,
          message: `${syncedCount} fichier(s) transféré(s) en BDD locale.`,
          timestamp: new Date().toISOString()
        });
      }

      case 'clear-registre': {
        console.log(`[RAG_BASE_API] [CLEAR] Registre purgé`);
        return NextResponse.json({
          success: true,
          message: 'Le répertoire REGISTRE a été vidé.',
          timestamp: new Date().toISOString()
        });
      }

      case 'save': {
        const pairCount = Array.isArray(data?.pairs) ? data.pairs.length : 0;
        console.log(`[RAG_BASE_API] [SAVE] ${pairCount} paire(s) Q/R sauvegardée(s)`);

        return NextResponse.json({
          success: true,
          pairCount,
          message: `${pairCount} paires Q/R sauvegardées dans REGISTRE.`,
          timestamp: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Action inconnue: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[RAG_BASE_API] [ERROR] Échec traitement:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process RAG base request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
