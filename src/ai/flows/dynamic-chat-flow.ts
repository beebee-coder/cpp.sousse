
/**
 * @fileOverview Flux de chat VisioNode Core V5.6.
 * Logs structurés [CHAT_LLM] et [CHAT_RAG].
 */

import Groq from 'groq-sdk';
import { searchAcrossCollections, getSystemContextSummary } from '../../lib/chroma';
import { searchChromaLocalDB } from '../../lib/local-indexer';
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
