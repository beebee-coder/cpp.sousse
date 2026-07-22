/**
 * @fileOverview Connexion RAG procedures - fonctionnalite procedures industrielles.
 *
 * Factorise :
 *   - l'indexation vectorielle (ex-ProcedureRAGService.indexProcedure),
 *   - le scan lexical FS .registry/procedures/ (ex-searchProceduresInRegistry).
 *
 * Enregistree une seule fois dans ai/index.ts. Le RAGHub fan-out vers elle
 * sans connaitre sa source.
 */

import fs from 'fs';
import path from 'path';
import { ragConnections, type RAGConnection, type RAGDoc } from '../connections';
import { scoreItemAgainstQuery, tokenizeQuery, type LexicalScorable } from '../scorer';
import type { RAGResult, RAGOptions } from '../../rag-orchestrator';
import { upsertDocuments as upsertChroma, getCollectionIds, deleteDocuments } from '@/lib/chroma';
import { IS_CLOUD } from '@/lib/config/env';
import { getLocalDBRoot } from '@/lib/db/local-db';

const COLLECTION = 'industrial_procedures';

function registryRoot(): string {
  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  if (override) return override;
  const localRoot = getLocalDBRoot();
  const candidate = path.join(path.dirname(localRoot), '.registry');
  if (fs.existsSync(candidate)) return candidate;
  return path.join(process.cwd(), '.registry');
}

function walkProcedureFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkProcedureFiles(abs));
    else if (ent.name.toLowerCase() === 'procedure.json') out.push(abs);
  }
  return out;
}

function buildProcedureDoc(parsed: any): { id: string; title: string; content: string; tags: string[]; category: string } | null {
  const meta = parsed?.metadata || {};
  const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
  const prereq = parsed?.prerequisites?.items || [];
  const alarms = steps.flatMap((s: any) => (Array.isArray(s?.alarms) ? s.alarms : []));
  const code = meta.code || '';
  if (!code && !meta.title) return null;

  const docParts: string[] = [
    `PROCEDURE ${code} - ${meta.title || ''}`,
    `Categorie: ${meta.category || 'procedure'}`,
    ...prereq.map((p: any) => `PREREQUIS: ${p.description || p.id}`),
    ...steps.map(
      (s: any, i: number) =>
        `ETAPE ${i + 1}: ${s.title || ''} - ${s.description || ''} ${s.action?.instruction || ''}`,
    ),
    ...alarms.map((a: any) => `ALARME ${a.code || ''}: ${a.description || ''} -> remede: ${a.remedy?.title || ''}`),
  ];

  return {
    id: `proc:${code || meta.title}`,
    title: meta.title || code,
    content: docParts.join('\n'),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    category: meta.category || 'procedure',
  };
}

const procedureConnection: RAGConnection = {
  id: 'procedures',
  label: 'Procedures industrielles',
  mode: 'vector',

  async index(doc: RAGDoc): Promise<void> {
    try {
      if (IS_CLOUD) {
        if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
          const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
          await upsertKnowledgeItem({
            knowledgeId: doc.metadata?.procedureId || doc.id,
            userId: doc.metadata?.authorId || 'system',
            type: 'procedure',
            title: doc.metadata?.title || doc.id,
            content: doc.content,
            tags: doc.metadata?.tags || [],
            category: doc.metadata?.category || 'OPERATION',
            difficulty: doc.metadata?.criticality || 'MEDIUM',
            isPublic: true,
            createdAt: doc.metadata?.indexedAt || new Date().toISOString(),
          });
        }
      } else {
        await upsertChroma(COLLECTION, [doc]);
      }
    } catch (e: any) {
      console.warn(`[RAG_CONN:procedures] index echec:`, e.message);
    }
  },

  async remove(id: string): Promise<void> {
    try {
      if (!IS_CLOUD) {
        const ids = (await getCollectionIds(COLLECTION)).filter(
          (cid) => cid === `proc-meta-${id}` || cid.startsWith(`proc-step-${id}-`),
        );
        await deleteDocuments(COLLECTION, ids);
      }
    } catch (e: any) {
      console.warn(`[RAG_CONN:procedures] remove echec:`, e.message);
    }
  },

  async search(query: string, options: RAGOptions): Promise<RAGResult[]> {
    const history = (options.history as any[]) || [];
    const queryTokens = tokenizeQuery(query, history);
    if (queryTokens.length === 0) return [];

    const PROC_DIR = path.join(registryRoot(), 'procedures');
    const items: LexicalScorable[] = [];
    try {
      for (const file of walkProcedureFiles(PROC_DIR)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
          const doc = buildProcedureDoc(parsed);
          if (doc) items.push({ ...doc, origin: 'REGISTRY_PROCEDURE', question: null, answer: null });
        } catch {
          continue;
        }
      }
    } catch {
      // FS indisponible (serverless Vercel) - le hub stage cloud compense.
    }
    if (items.length === 0) return [];

    const scored: RAGResult[] = [];
    for (const item of items) {
      const hit = scoreItemAgainstQuery(item, queryTokens);
      if (!hit) continue;
      scored.push({
        id: item.id,
        document: hit.document,
        metadata: {
          origin: item.origin,
          title: item.title,
          category: item.category ?? undefined,
          tags: item.tags,
          knowledgeType: 'procedure',
        },
        score: hit.score,
      });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, (options.maxResults as number) || 4);
  },
};

ragConnections.register(procedureConnection);

export { procedureConnection };
