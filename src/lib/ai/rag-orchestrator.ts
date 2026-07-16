import { searchChromaLocalDB } from '@/lib/local-indexer';
import { searchAcrossCollections } from '@/lib/chroma';
import type { ChatMessage } from '@/lib/chat-storage/types';

export interface RAGResult {
  id: string;
  document: string;
  metadata: {
    origin: string;
    fileName?: string;
    parentDir?: string;
    cloudId?: string;
    title?: string;
    category?: string;
    tags?: string[];
    knowledgeType?: 'qa' | 'procedure' | 'document' | 'bank';
  };
  score: number;
  distance?: number;
}

export interface RAGOptions {
  maxResults?: number;
  minScore?: number;
  history?: ChatMessage[];
}

export class RAGOrchestrator {
  private maxResults: number;
  private minScore: number;

  constructor(options: RAGOptions = {}) {
    this.maxResults = options.maxResults || 6;
    this.minScore = options.minScore || 0.25;
  }

  async search(query: string, history: ChatMessage[] = []): Promise<RAGResult[]> {
    const results: RAGResult[] = [];
    const seen = new Set<string>();

    const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

    const addResult = (result: any) => {
      const docNorm = normalize(result.document || '');
      if (!docNorm) return;
      const key = `${result.metadata?.origin || 'UNK'}|${docNorm.slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      if ((result.score || 0) >= this.minScore || (result.distance ?? 1) < 0.5) {
        results.push(result);
      }
    };

    const historyTexts = history.slice(-4).map(m => m.content).filter(Boolean);

    const stage1 = await searchChromaLocalDB(query, historyTexts, 6);
    for (const r of stage1) addResult(r);

    const stage2 = await searchAcrossCollections(query, 4);
    for (const r of stage2) addResult(r);

    const stage3 = await searchKnowledgeItemsWeb(query, history.slice(-4).map(m => m.content));
    for (const r of stage3) addResult(r);

    const isCloud = process.env.VERCEL === '1';
    const weaviateConfigured = process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY;
    if (isCloud && !weaviateConfigured) {
      console.warn('[CHAT_RAG] [WEAVIATE_MISSING] WEAVIATE_URL/WEAVIATE_API_KEY absents en mode cloud — étages 4 et 4b désactivés, RAG dégradé.');
    }
    if (results.length < this.maxResults && weaviateConfigured) {
      try {
        const stage4 = await searchWeaviateKnowledge(query, history.slice(-4).map(m => m.content));
        for (const r of stage4) addResult(r);
      } catch (e: any) {
        console.error('[CHAT_RAG] [WEAVIATE_SEARCH] Error:', e.message);
      }

      try {
        const stageBank = await searchBankRag(query);
        for (const r of stageBank) addResult(r);
      } catch (e: any) {
        console.error('[CHAT_RAG] [WEAVIATE_BANK] Error:', e.message);
      }
    }

    const sorted = results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, this.maxResults);

    return sorted;
  }

  formatContext(results: RAGResult[]): string {
    if (results.length === 0) {
      return 'AUCUN_CONTEXTE';
    }

    const filtered = results.filter(r => (r.score || 0) >= 0.2);
    if (filtered.length === 0) {
      return 'AUCUN_CONTEXTE';
    }

    const qaResults = filtered.filter(r => r.metadata?.knowledgeType === 'qa');
    const otherResults = filtered.filter(r => r.metadata?.knowledgeType !== 'qa');

    const sections: string[] = [];

    if (qaResults.length > 0) {
      sections.push(`RÉPONSES DIRECTES (${qaResults.length}):`);
      sections.push(qaResults.map(r => {
        const cleaned = r.document.replace(/\[SOURCE:[^\]]*\]\s*/g, '').trim();
        return `[Q/R ${r.metadata?.origin}] ${cleaned}`;
      }).join('\n\n'));
    }

    if (otherResults.length > 0) {
      sections.push(`CONNAISSANCES COMPLÉMENTAIRES (${otherResults.length}):`);
      sections.push(otherResults.map(r => {
        const cleaned = r.document.replace(/\[SOURCE:[^\]]*\]\s*/g, '').trim();
        return `[${r.metadata?.origin}] ${cleaned}`;
      }).join('\n\n'));
    }

    return sections.join('\n\n');
  }

  getConfidence(results: RAGResult[]): 'high' | 'medium' | 'low' | 'none' {
    const filtered = results.filter(r => (r.score || 0) >= 0.2);
    if (filtered.length === 0) return 'none';
    const topScore = filtered[0]?.score || 0;
    const qaCount = filtered.filter(r => r.metadata?.knowledgeType === 'qa').length;
    if (topScore >= 0.45 && qaCount > 0) return 'high';
    if (topScore >= 0.25 && qaCount > 0) return 'medium';
    if (topScore > 0.2) return 'low';
    return 'none';
  }

  getSources(results: RAGResult[]): string[] {
    return results.map(r => r.metadata?.origin || 'INCONNU');
  }
}

export const ragOrchestrator = new RAGOrchestrator();

const searchWeaviateKnowledge = async (query: string, history: string[] = []): Promise<RAGResult[]> => {
  const effectiveQuery = [...history.slice(-4), query].filter(Boolean).join(' ');
  if (!effectiveQuery.trim()) return [];

  try {
    const { searchKnowledge } = await import('@/lib/weaviate/weaviate-knowledge');
    const items = await searchKnowledge(effectiveQuery, { nResults: 5, publicOnly: false });

    return items
      .filter(item => item.score > 0)
      .map((item) => ({
        id: item.knowledgeId || 'weaviate',
        document: item.content || item.title,
        metadata: {
          origin: 'WEAVIATE_CLOUD',
          title: item.title,
          category: item.type,
          tags: item.tags || [],
          knowledgeType: item.type === 'qa' ? 'qa' : 'procedure',
        },
        score: Math.min(item.score ?? 0, 0.98),
        distance: typeof item.distance === 'number' ? item.distance : 0,
      }));
  } catch (e: any) {
    console.error('[CHAT_RAG] [WEAVIATE_SEARCH] Error:', e.message);
    return [];
  }
};

const searchBankRag = async (query: string): Promise<RAGResult[]> => {
  try {
    const { searchBankAssets } = await import('@/lib/weaviate/weaviate-bank');
    const hits = await searchBankAssets(query, { nResults: 5 });

    return hits
      .filter(h => h.score > 0)
      .map((h) => ({
        id: h.assetId || 'bank',
        document: `[BANQUE] ${h.name} (${h.type})\n${h.description}`.trim(),
        metadata: {
          origin: 'WEAVIATE_BANK',
          title: h.name,
          category: h.type,
          tags: h.tags || [],
          url: h.url,
          knowledgeType: 'bank',
        },
        score: Math.min(h.score ?? 0, 0.98),
        distance: 0,
      }));
  } catch (e: any) {
    console.error('[CHAT_RAG] [WEAVIATE_BANK] Error:', e.message);
    return [];
  }
};

type ScoredItem = {
  id: string;
  title: string;
  type: string;
  question: string | null;
  answer: string | null;
  tags: string[];
  category: string | null;
  content: string;
  cloudId?: string;
  origin: string;
};

const scoreItemAgainstQuery = (
  item: ScoredItem,
  queryTokens: string[]
): { score: number; document: string; knowledgeType: string } | null => {
  const title = (item.title || '').toLowerCase();
  const question = (item.question || '').toLowerCase();
  const answer = (item.answer || '').toLowerCase();
  const tags = (item.tags || []).join(' ').toLowerCase();
  const content = (item.content || '').toLowerCase();

  let score = 0;
  let matchCount = 0;
  const requiredTokenCount = Math.max(1, Math.ceil(queryTokens.length * 0.4));

  for (const token of queryTokens) {
    const tokenRegex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const titleHits = (title.match(tokenRegex) || []).length;
    const tagsHits = (tags.match(tokenRegex) || []).length;
    const questionHits = (question.match(tokenRegex) || []).length;
    const answerHits = (answer.match(tokenRegex) || []).length;
    const contentHits = (content.match(tokenRegex) || []).length;

    if (titleHits > 0) { score += 35 * titleHits; matchCount++; }
    if (tagsHits > 0) { score += 22 * tagsHits; matchCount++; }
    if (questionHits > 0) { score += 18 * questionHits; matchCount++; }
    if (answerHits > 0) { score += 10 * answerHits; }
    if (contentHits > 0) { score += 4 * contentHits; }
  }

  if (matchCount < requiredTokenCount || score <= 0) return null;

  const knowledgeType = item.type === 'qa' ? 'qa' : (item.type === 'procedure' ? 'procedure' : 'document');
  const document = item.question && item.answer
    ? `Q: ${item.question}\nR: ${item.answer}`
    : (item.content || item.title || '');

  return { score: Math.min(score / 100, 0.98), document, knowledgeType };
};

const collectRegistryFallbackItems = (existingTitles: Set<string>): ScoredItem[] => {
  const items: ScoredItem[] = [];
  try {
    const REGISTRY_ITEMS = require('path').join(process.cwd(), '.registry', 'items');
    if (!require('fs').existsSync(REGISTRY_ITEMS)) return items;
    const files = require('fs').readdirSync(REGISTRY_ITEMS).filter((f: string) => f.toLowerCase().endsWith('.json'));
    for (const file of files) {
      try {
        const parsed = JSON.parse(require('fs').readFileSync(require('path').join(REGISTRY_ITEMS, file), 'utf8'));
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
  } catch {
    // FS indisponible (serverless) — fallback ignoré
  }
  return items;
};

const searchKnowledgeItemsWeb = async (query: string, history: string[] = []): Promise<RAGResult[]> => {
  const effectiveQuery = [...history.slice(-4), query].filter(Boolean).join(' ');
  const queryTokens = tokenizeText(effectiveQuery);
  if (queryTokens.length === 0) return [];

  const dbItems: ScoredItem[] = [];
  let existingTitles = new Set<string>();

  try {
    const { getPrismaClient } = await import('@/lib/db/prisma-client');
    const prisma = await getPrismaClient();

    const rows = await prisma.knowledgeItem.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        question: true,
        answer: true,
        tags: true,
        category: true,
        content: true,
        createdAt: true,
      },
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
        cloudId: row.id,
        origin: 'WEB_REGISTRY',
      });
    }
    existingTitles = new Set(dbItems.map(i => (i.title || '').trim()));
  } catch (e: any) {
    console.error('[CHAT_RAG] [WEB_SEARCH] Stage 3 (Prisma) échec:', e.message);
  }

  const fallbackItems = collectRegistryFallbackItems(existingTitles);
  const allItems = [...dbItems, ...fallbackItems];

  const scored: RAGResult[] = [];
  for (const item of allItems) {
    const result = scoreItemAgainstQuery(item, queryTokens);
    if (!result) continue;
    scored.push({
      id: item.id,
      document: result.document,
      metadata: {
        origin: item.origin,
        cloudId: item.cloudId,
        title: item.title,
        category: item.category ?? undefined,
        tags: item.tags || [],
        knowledgeType: result.knowledgeType as any,
      },
      score: result.score,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
};

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}
