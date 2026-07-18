/**
 * @fileOverview Connexion RAG "bank" — banque d'images/vidéos industrielles.
 *
 * Factorise :
 *   - la recherche vectorielle Weaviate (searchBankAssets),
 *   - le fallback lexical FS sur les métadonnées (fallbackSemanticSearch PHY_BANK).
 *
 * Enregistrée une seule fois dans ai/index.ts.
 */

import { ragConnections, type RAGConnection } from '../connections';
import type { RAGResult, RAGOptions } from '../../rag-orchestrator';
import { fallbackSemanticSearch } from '@/lib/chroma';

const bankConnection: RAGConnection = {
  id: 'bank',
  label: 'Banque médias',
  mode: 'cloud',

  async search(query: string, options: RAGOptions): Promise<RAGResult[]> {
    const maxResults = (options.maxResults as number) || 5;

    // 1. Mode cloud (Weaviate configuré) : recherche vectorielle sémantique.
    if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
      try {
        const { searchBankAssets } = await import('@/lib/weaviate/weaviate-bank');
        const hits = await searchBankAssets(query, { nResults: maxResults });
        return hits
          .filter((h) => h.score > 0)
          .map((h) => ({
            id: h.assetId || 'bank',
            document: `[BANQUE] ${h.name} (${h.type})\n${h.description}`.trim(),
            metadata: {
              origin: 'WEAVIATE_BANK',
              title: h.name,
              category: h.type,
              tags: h.tags || [],
              url: h.url,
              knowledgeType: 'bank' as const,
            },
            score: Math.min(h.score ?? 0, 0.98),
            distance: 0,
          }));
      } catch (e: any) {
        console.error('[RAG_CONN:bank] Weaviate échec:', e.message);
      }
    }

    // 2. Navigateur (web) : la recherche FS lexicale (`fs`) n'existe pas côté
    // client. On interroge l'API /api/bank qui lit les métadonnées (Blob ou FS
    // serveur) et on score lexicalement les actifs pour retrouver ex.
    // « image de test 11 ».
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/bank?limit=200', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const assets: any[] = data?.items || [];
          const q = query.toLowerCase();
          const qTokens = q.split(/\s+/).filter(Boolean);
          const scored = assets
            .map((a) => {
              const hay = `${a.name || ''} ${a.description || ''} ${(a.tags || []).join(' ')}`.toLowerCase();
              let score = 0;
              if (hay.includes(q)) score += 60;
              qTokens.forEach((t) => { if (hay.includes(t)) score += 10; });
              return { a, score: Math.min(score, 95) };
            })
            .filter((x) => x.score > 0)
            .sort((x, y) => y.score - x.score)
            .slice(0, maxResults);
          if (scored.length > 0) {
            return scored.map(({ a, score }) => ({
              id: a.path || a.name || 'bank',
              document: `[BANQUE] ${a.name} (${a.type})\n${a.description || ''}`.trim(),
              metadata: {
                origin: 'WEB_BANK_API',
                knowledgeType: 'bank' as const,
                path: a.path,
                type: a.type || a.mediaType,
                title: a.name || a.title,
                url: a.url,
                name: a.name,
              },
              score: Math.min(score / 100, 0.95),
              distance: 0,
            }));
          }
        }
      } catch (e: any) {
        console.error('[RAG_CONN:bank] API web échec:', e?.message || e);
      }
    }

    // 3. Station locale / hybride : recherche lexicale sur les métadonnées (FS).
    try {
      const results = fallbackSemanticSearch(query, maxResults);
      const bankResults = results.filter((r) => r.metadata?.origin === 'PHY_BANK');
      return bankResults.map((r) => {
        const m = (r.metadata || {}) as any;
        return {
          id: r.id,
          document: r.document,
          metadata: {
            origin: 'PHY_BANK',
            knowledgeType: 'bank' as const,
            // `relPath` (chroma.ts) = chemin binaire ; `mediaType` = image|video.
            path: m.path || m.relPath || m.assetPath,
            type: m.type || m.mediaType,
            title: m.title || m.name,
          },
          score: r.score,
          distance: r.distance,
        };
      });
    } catch (e: any) {
      console.error('[RAG_CONN:bank] fallback lexical échec:', e.message);
      return [];
    }
  },
};

ragConnections.register(bankConnection);

export { bankConnection };
