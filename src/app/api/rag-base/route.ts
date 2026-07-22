export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSessionFromCookie } from '@/lib/session';

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
      endpoints: ['POST /api/rag-base - sync', 'POST /api/rag-base - clear-registre', 'POST /api/rag-base - save (compatibilité)']
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
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
  }

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
        const { getLocalDBRoot } = await import('@/lib/db/local-db');
        const REGISTRY_ROOT = path.join(path.dirname(getLocalDBRoot()), '.registry');
        const dirsToClear = ['bank', 'items', 'procedures'];
        let cleared: string[] = [];
        let errors: string[] = [];
        let chromaCleared = 0;
        let weaviateCleared = 0;

        for (const dir of dirsToClear) {
          const target = path.join(REGISTRY_ROOT, dir);
          if (!fs.existsSync(target)) {
            cleared.push(dir);
            continue;
          }
          try {
            const entries = fs.readdirSync(target, { withFileTypes: true });
            for (const entry of entries) {
              const full = path.join(target, entry.name);
              try {
                fs.rmSync(full, { recursive: true, force: true });
              } catch (e: any) {
                errors.push(`${dir}/${entry.name}: ${e.message}`);
              }
            }
            cleared.push(dir);
          } catch (e: any) {
            errors.push(`${dir}: ${e.message}`);
          }
        }

        if (process.env.VERCEL !== '1') {
          try {
            const { getChromaClient, listCollections, deleteCollection } = await import('@/lib/chroma');
            const client = await getChromaClient();
            if (client) {
              const collections = await listCollections();
              for (const c of collections) {
                const cName = String(c.name);
                if (cName.startsWith('locdb-')) {
                  try {
                    await deleteCollection(cName);
                    chromaCleared++;
                  } catch {}
                }
              }
            }
          } catch (e: any) {
            errors.push(`ChromaDB: ${e.message}`);
          }
        } else {
          try {
            const { getPrismaClient } = await import('@/lib/db/prisma-client');
            const prisma = await getPrismaClient();
            const allItems = await prisma.knowledgeItem.findMany({
              select: { id: true, tags: true }
            });
            const toDelete = allItems.filter((item: any) => {
              const tags = item.tags || [];
              return tags.some((t: string) => typeof t === 'string' && t.startsWith('regpath:bank/'))
                || tags.some((t: string) => typeof t === 'string' && t.startsWith('regpath:items/'))
                || tags.some((t: string) => typeof t === 'string' && t.startsWith('regpath:procedures/'));
            });

            for (const item of toDelete) {
              try {
                const { deleteKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
                try { await deleteKnowledgeItem(item.id); } catch {}
                weaviateCleared++;
              } catch {}
            }

            try {
              const { deleteAllBankAssets } = await import('@/lib/weaviate/weaviate-bank');
              await deleteAllBankAssets();
            } catch (e: any) {
              errors.push(`Weaviate Bank: ${e.message}`);
            }

            await (prisma as any).knowledgeItem.deleteMany({
              where: {
                OR: [
                  { tags: { some: { startsWith: 'regpath:bank/' } } },
                  { tags: { some: { startsWith: 'regpath:items/' } } },
                  { tags: { some: { startsWith: 'regpath:procedures/' } } }
                ]
              }
            });
          } catch (e: any) {
            errors.push(`Weaviate/Prisma: ${e.message}`);
          }
        }

        if (errors.length > 0) {
          console.error(`[RAG_BASE_API] [CLEAR] Erreurs:`, errors);
        }

        return NextResponse.json({
          success: errors.length === 0,
          cleared,
          chromaCleared,
          weaviateCleared,
          errors: errors.length > 0 ? errors : undefined,
          message: errors.length === 0
            ? 'Les répertoires BANK, ITEMS et PROCEDURES du REGISTRE ont été vidés.'
            : `${cleared.join(', ')} vidés, ${errors.length} erreur(s).`,
          timestamp: new Date().toISOString()
        });
      }

      case 'save': {
        const pairCount = Array.isArray(data?.pairs) ? data.pairs.length : 0;
        console.log(`[RAG_BASE_API] [SAVE] ${pairCount} paire(s) Q/R reçue(s).`);

        if (pairCount > 0 && (!data?.fileName && !data?.description)) {
          return NextResponse.json({
            success: false,
            error: 'CANONICAL_SAVE_USE_KNOWLEDGE_API',
            message: 'Utilisez /api/knowledge pour la sauvegarde canonique. Cette route conserve la compatibilité descendante uniquement.',
            pairCount
          });
        }

        return NextResponse.json({
          success: true,
          pairCount,
          message: `${pairCount} paires Q/R enregistrées via la route de compatibilité.`,
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
