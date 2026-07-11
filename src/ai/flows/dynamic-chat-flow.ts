
/**
 * @fileOverview Flux de chat VisioNode Core V5.6.
 * Logs structurés [CHAT_LLM] et [CHAT_RAG].
 */

import Groq from 'groq-sdk';
import { searchAcrossCollections, getSystemContextSummary } from '../../lib/chroma';
import { searchChromaLocalDB, tokenizeText } from '../../lib/local-indexer';
import { postgresClient } from '../../lib/db/postgres-client';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
  procedureId?: string;
};

type ChatInput = {
  history: ChatMessage[];
  message: string;
};

export async function dynamicChat(input: ChatInput) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🤖 [CHAT_LLM] [INIT] [${ts}] Traitement message utilisateur.`);

  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  const systemState = await getSystemContextSummary();
  
  // 1. Recherche RAG path-aware dans Vecteurs ChromaDB
  //    (question + interaction IA, pondérée par l'arborescence BDD Locale)
  console.log(`🔍 [CHAT_RAG] [SEARCH] [${ts}] Recherche sémantique (Vecteurs ChromaDB)...`);
  const historyText = input.history.slice(-4).map(m => m.content).filter(Boolean);
  const ragResults = await searchChromaLocalDB(input.message, historyText, 6);
  if (ragResults.length === 0) {
    ragResults.push(...await searchAcrossCollections(input.message, 4));
  }

  // 1b. Complément web : si la BDD web n'est pas encore purgée, on exploite
  //     les KnowledgeItem pour renforcer le contexte via les noms de fichiers,
  //     l'arborescence et le contenu Q/R.
  if (ragResults.length < 3) {
    ragResults.push(...(await searchKnowledgeItemsWeb(input.message, historyText)));
  }

  console.log(`✅ [CHAT_RAG] [SUCCESS] [${ts}] ${ragResults.length} fragment(s) récupéré(s).`);

  const context = ragResults.map(r => {
    const m = r.metadata || {};
    const path = [m.parentDir, m.fileName || m.name].filter(Boolean).join(' / ');
    const source = path ? `${r.metadata?.origin} | ${path}` : (r.metadata?.origin || 'INCONNU');
    return `[SOURCE: ${source}] : ${r.document}`;
  }).join('\n\n');

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const systemContent = `Vous êtes VisioNode Core. Soyez concis (2 phrases). 
    CONTEXTE RÉCUPÉRÉ:
    ${context}
    
    ÉTAT SYSTÈME: ${systemState.mode}.`;

    console.log(`📡 [CHAT_LLM] [STEP] [${ts}] Appel au moteur Groq LPU...`);
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemContent },
        ...input.history.map(m => ({ role: m.role === 'model' ? 'assistant' as const : 'user' as const, content: m.content })),
        { role: 'user', content: input.message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      console.log(`✅ [CHAT_LLM] [SUCCESS] [${ts}] Réponse générée.`);
      return { 
        text: text.trim(), 
        provider: `Groq LPU + Pro-Search`,
      };
    }
  } catch (err: any) {
    console.error(`❌ [CHAT_LLM] [ERROR] [${ts}] Échec moteur :`, err.message);
    throw new Error(`LIAISON_IA_ERREUR : ${err.message}`);
  }

  throw new Error("Réponse vide.");
}

/**
 * Recherche contextuelle dans la BDD web (REGISTRE / KnowledgeItems).
 * Utilisée quand le RAG local ne trouve pas assez de résultats.
 */
const searchKnowledgeItemsWeb = async (query: string, history: string[] = []): Promise<any[]> => {
  const effectiveQuery = [...history.slice(-4), query].filter(Boolean).join(' ');
  const queryTokens = tokenizeText(effectiveQuery);
  if (queryTokens.length === 0) return [];

  try {
    const { prisma } = await import('@/lib/db/prisma-client');

    // Limiter le scan pour rester réactive.
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

    const scored: any[] = [];
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
            type: item.type,
            category: item.category,
            tags: item.tags || [],
            fileName,
            parentDir,
            pathSegments: pathParts.slice(0, -1)
          },
          distance: 0,
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
