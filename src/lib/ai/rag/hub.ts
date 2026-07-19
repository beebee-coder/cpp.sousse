/**
 * @fileOverview RAGHub — point d'entrée factorisé du RAG multi-connexions.
 *
 * Remplace le pipeline à étages codés en dur de rag-orchestrator.ts
 * (stage1 à stageR a stageP a stage4 a stageBank). Le hub fait un fan-out sur
 * toutes les RAGConnection enregistrées, déduplique et rank centralement.
 *
 * Chaque connexion gère SA propre source (Chroma / Weaviate / FS lexical) : le
 * hub ne connaît que le contrat RAGResult. Ajouter une fonctionnalité ne
 * modifie PAS ce fichier.
 */

import type { RAGResult, RAGOptions } from '../rag-orchestrator';
import { ragConnections } from './connections';
import type { RagTrace } from './trace';

export interface RAGHubOptions extends RAGOptions {
  /** Limite le fan-out à certaines connexions (sinon : toutes). */
  connectionIds?: string[];
  /** Active le re-rank lexical de secours si aucun résultat vectoriel. */
  enableLexicalFallback?: boolean;
  /** Traceur RAG consolidé (optionnel) — reçoit un stage par connexion. */
  trace?: RagTrace;
}

export class RAGHub {
  private maxResults: number;
  private minScore: number;

  constructor(options: RAGHubOptions = {}) {
    this.maxResults = options.maxResults || 6;
    this.minScore = options.minScore || 0.2;
  }

  async search(query: string, history: any[] = [], options: RAGHubOptions = {}): Promise<RAGResult[]> {
    const maxResults = options.maxResults || this.maxResults;
    const minScore = options.minScore || this.minScore;

    const ids =
      options.connectionIds && options.connectionIds.length
        ? options.connectionIds
        : ragConnections.all().map((c) => c.id);

    const conns = ids
      .map((id) => ragConnections.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const results: RAGResult[] = [];
    const seen = new Set<string>();
    const addResult = (r: RAGResult) => {
      const docNorm = (r.document || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!docNorm) return;
      const key = `${r.metadata?.origin || 'UNK'}|${docNorm.slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      if ((r.score || 0) >= minScore || (r.distance ?? 1) < 0.5) {
        results.push(r);
      }
    };

    const ragOptions: RAGOptions = {
      maxResults,
      minScore,
      history: Array.isArray(history) ? history : [],
    };

    await Promise.all(
      conns.map(async (conn) => {
        const t0 = Date.now();
        try {
          const hits = await conn.search(query, ragOptions);
          const top = hits.length ? Math.max(...hits.map((h) => h.score || 0)) : null;
          for (const h of hits) addResult(h);
          options.trace?.stage(`conn:${conn.id}`, `Connexion ${conn.label} (${conn.mode})`, {
            count: hits.length,
            topScore: top,
            ms: Date.now() - t0,
            reason: hits.length === 0 ? 'aucun résultat (score < min ou index vide)' : undefined,
          });
        } catch (e: any) {
          options.trace?.stage(`conn:${conn.id}`, `Connexion ${conn.label} (${conn.mode})`, {
            count: 0,
            topScore: null,
            ms: Date.now() - t0,
            error: e?.message || String(e),
          });
        }
      }),
    );

    const sorted = results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, maxResults);

    return sorted;
  }

  /** Liste les connexions actives (diagnostic). */
  listConnections(): { id: string; label: string; mode: string }[] {
    return ragConnections.all().map((c) => ({ id: c.id, label: c.label, mode: c.mode }));
  }
}

export const ragHub = new RAGHub();
