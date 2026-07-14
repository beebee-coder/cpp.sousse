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
  };
  score: number;
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
    this.maxResults = options.maxResults || 8;
    this.minScore = options.minScore || 0.1;
  }

  async search(query: string, history: ChatMessage[] = []): Promise<RAGResult[]> {
    const results: RAGResult[] = [];
    const seen = new Set<string>();

    const addResult = (result: any) => {
      const key = `${result.metadata?.origin}-${result.metadata?.fileName || result.id}-${result.document?.slice(0, 50)}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (result.score >= this.minScore || result.distance < 0.5) {
        results.push(result);
      }
    };

    const historyTexts = history.slice(-4).map(m => m.content).filter(Boolean);

    const stage1 = await searchChromaLocalDB(query, historyTexts, 6);
    for (const r of stage1) addResult(r);

    if (results.length < 3) {
      const stage2 = await searchAcrossCollections(query, 4);
      for (const r of stage2) addResult(r);
    }

    if (results.length < 3) {
      const stage3 = await searchKnowledgeItemsWeb(query, history.slice(-4).map(m => m.content));
      for (const r of stage3) addResult(r);
    }

    return results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, this.maxResults);
  }

  formatContext(results: RAGResult[]): string {
    if (results.length === 0) {
      return 'Aucun contexte disponible dans les référentiels.';
    }

    return results.map(r => {
      const m = r.metadata || {};
      const source = m.origin || 'INCONNU';
      const document = r.document.replace(/\[SOURCE:[^\]]*\]\s*/g, '').trim();
      return `[SOURCE: ${source}] : ${document}`;
    }).join('\n\n');
  }

  getSources(results: RAGResult[]): string[] {
    return results.map(r => {
      const m = r.metadata || {};
      return m.origin || 'INCONNU';
    });
  }
}

export const ragOrchestrator = new RAGOrchestrator();

const searchKnowledgeItemsWeb = async (query: string, history: string[] = []): Promise<RAGResult[]> => {
  const effectiveQuery = [...history.slice(-4), query].filter(Boolean).join(' ');
  const queryTokens = tokenizeText(effectiveQuery);
  if (queryTokens.length === 0) return [];

  try {
    const { prisma } = await import('@/lib/db/prisma-client');

    const items = await prisma.knowledgeItem.findMany({
      take: 200,
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
        createdAt: true
      }
    });

    const scored: RAGResult[] = [];
    for (const item of items) {
      const title = (item.title || '').toLowerCase();
      const question = (item.question || '').toLowerCase();
      const answer = (item.answer || '').toLowerCase();
      const tags = (item.tags || []).join(' ').toLowerCase();
      const content = (item.content || '').toLowerCase();
      const searchSpace = `${title} ${question} ${answer} ${tags} ${content}`;

      let score = 0;
      for (const token of queryTokens) {
        if (title.includes(token)) score += 20;
        if (tags.includes(token)) score += 15;
        if (question.includes(token)) score += 10;
        if (answer.includes(token)) score += 8;
        if (searchSpace.includes(token)) score += 5;
      }

      if (score > 0) {
        const document = item.question && item.answer
          ? `Q: ${item.question}\nR: ${item.answer}`
          : (item.content || item.title || '');

        const fileName = item.title || 'unknown';
        const pathParts = fileName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
        const parentDir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

        scored.push({
          id: item.id,
          document,
          metadata: {
            origin: 'WEB_REGISTRY',
            cloudId: item.id,
            title: item.title,
            category: item.category ?? undefined,
            tags: item.tags || [],
            fileName,
            parentDir,
          },
          score: Math.min(score / 100, 0.98)
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  } catch (e: any) {
    console.error('[CHAT_RAG] [WEB_SEARCH] Error:', e.message);
    return [];
  }
};

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}
