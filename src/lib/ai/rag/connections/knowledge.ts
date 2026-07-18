/**
 * @fileOverview Connexion RAG "knowledge" — base de connaissances (Q/R, documents).
 *
 * Factorise :
 *   - la recherche vectorielle Chroma (searchAcrossCollections),
 *   - le fallback lexical FS .registry/items (ex-collectRegistryFallbackItems),
 *   - la recherche cloud Prisma knowledgeItem (ex-searchKnowledgeItemsWeb).
 *
 * Enregistrée une seule fois dans ai/index.ts.
 */

import fs from 'fs';
import path from 'path';
import { ragConnections, type RAGConnection } from '../connections';
import { scoreItemAgainstQuery, tokenizeQuery, type LexicalScorable } from '../scorer';
import type { RAGResult, RAGOptions } from '../../rag-orchestrator';
import { searchAcrossCollections } from '@/lib/chroma';

function registryRoot(): string {
  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  return override ? override : path.join(process.cwd(), '.registry');
}

function readRegistryItems(existingTitles: Set<string>): LexicalScorable[] {
  const items: LexicalScorable[] = [];
  const REGISTRY_ITEMS = path.join(registryRoot(), 'items');
  let files: string[];
  try {
    files = fs.existsSync(REGISTRY_ITEMS)
      ? fs.readdirSync(REGISTRY_ITEMS).filter((f) => f.toLowerCase().endsWith('.json'))
      : [];
  } catch {
    return items;
  }
  if (files.length === 0) {
    const mode = process.env.VERCEL === '1' ? 'CLOUD' : 'LOCAL/HYBRIDE';
    console.warn(`[RAG_CONN:knowledge] ${mode} : .registry/items vide — RAG lexical local sans résultats.`);
    return items;
  }
  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(REGISTRY_ITEMS, file), 'utf8'));
      const title = parsed?.title || file.replace(/\.json$/i, '');
      if (existingTitles.has(title.trim()) || !parsed?.pairs) continue;
      const question = parsed.pairs[0]?.question || null;
      const answer = parsed.pairs.map((p: any) => p.answer).filter(Boolean).join('\n\n') || null;
      items.push({
        id: `registry:${file}`,
        title,
        type: parsed?.type || 'qa',
        question,
        answer,
        tags: parsed?.tags || [],
        category: parsed?.category || 'General',
        content: JSON.stringify(parsed),
        origin: 'REGISTRY_FS',
      });
    } catch {
      continue;
    }
  }
  return items;
}

async function searchCloudKnowledge(query: string, history: string[]): Promise<LexicalScorable[]> {
  if (process.env.VERCEL !== '1') return [];
  const queryTokens = tokenizeQuery(query, history);
  if (queryTokens.length === 0) return [];

  const dbItems: LexicalScorable[] = [];
  try {
    const { getPrismaClient } = await import('@/lib/db/prisma-client');
    const prisma = await getPrismaClient();
    const rows = await prisma.knowledgeItem.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, question: true, answer: true, tags: true, category: true, content: true },
    });
    for (const row of rows) {
      dbItems.push({
        id: row.id,
        title: row.title || '',
        type: row.type || 'document',
        question: row.question,
        answer: row.answer,
        tags: row.tags || [],
        category: row.category,
        content: row.content || '',
        origin: 'WEB_REGISTRY',
      });
    }
  } catch (e: any) {
    console.error('[RAG_CONN:knowledge] cloud Prisma échec:', e.message);
  }

  const existingTitles = new Set(dbItems.map((i) => (i.title || '').trim()));
  if (dbItems.length === 0 && readRegistryItems(existingTitles).length === 0) {
    console.warn('[RAG_CONN:knowledge] Aucun élément RAG (DB vide + fallback FS vide) — vérifiez le seed.');
  }
  return [...dbItems, ...readRegistryItems(existingTitles)];
}

const knowledgeConnection: RAGConnection = {
  id: 'knowledge',
  label: 'Base de connaissances',
  mode: 'vector',

  async search(query: string, options: RAGOptions): Promise<RAGResult[]> {
    const history = (options.history as any[]) || [];
    const scored: RAGResult[] = [];

    // 1. Recherche vectorielle Chroma (stations locales / hybrides).
    try {
      const chromaHits = await searchAcrossCollections(query, (options.maxResults as number) || 5);
      for (const h of chromaHits) {
        scored.push({
          id: h.id,
          document: h.document,
          metadata: { ...(h.metadata || {}), origin: h.metadata?.origin || 'VEC_CHROMA' },
          score: h.score,
          distance: h.distance,
        });
      }
    } catch (e: any) {
      console.error('[RAG_CONN:knowledge] Chroma échec:', e.message);
    }

    // 2. Fallback lexical (FS local + cloud Prisma) pour garantir un RAG non vide.
    const queryTokens = tokenizeQuery(query, history);
    if (queryTokens.length > 0) {
      const lexicalItems = await searchCloudKnowledge(query, history);
      for (const item of lexicalItems) {
        const hit = scoreItemAgainstQuery(item, queryTokens);
        if (!hit) continue;
        scored.push({
          id: item.id,
          document: hit.document,
          metadata: {
            origin: item.origin,
            cloudId: (item as any).cloudId,
            title: item.title,
            category: item.category ?? undefined,
            tags: item.tags || [],
            knowledgeType: hit.knowledgeType,
          },
          score: item.origin === 'REGISTRY_FS' ? hit.score * 0.9 : hit.score,
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, (options.maxResults as number) || 5);
  },
};

ragConnections.register(knowledgeConnection);

export { knowledgeConnection };
