/**
 * @fileOverview Flux de chat VisioNode Core avec expansion de requête contextuelle.
 * Version 4.0 : Intègre le "Source Awareness" basé sur les noms de fichiers.
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections,
  getSystemContextSummary
} from '../../lib/chroma';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

type ChatInput = {
  history: ChatMessage[];
  message: string;
};

type ChatOutput = {
  text: string;
  provider: string;
};

/**
 * 2. EXPANSION DE REQUÊTE PAR IA
 * Analyse l'historique pour transformer une question vague en recherche précise.
 */
async function expandQueryWithContext(message: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0) return message;
  
  // Si le message est court, on demande à un mini-prompt de clarifier le sujet
  if (message.length < 25 || /il|elle|lui|eux|le|la|ce|c'est|son|sa/.test(message.toLowerCase())) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const recentHistory = history.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
      
      const expansion = await groq.chat.completions.create({
        messages: [
          { 
            role: 'system', 
            content: 'Vous êtes un expert en extraction d\'entités industrielles. Reformulez la question utilisateur en une recherche technique exhaustive incluant les noms propres et composants mentionnés précédemment. RÉPONDEZ UNIQUEMENT PAR LA REQUÊTE REFORMULÉE.' 
          },
          { role: 'user', content: `Historique:\n${recentHistory}\n\nQuestion à reformuler: ${message}` }
        ],
        model: 'llama-3.1-8b-instant', 
        temperature: 0.1,
        max_tokens: 50
      });

      const expanded = expansion.choices[0]?.message?.content?.trim();
      return expanded || `${history[history.length-1].content} ${message}`;
    } catch (e) {
      return `${history[history.length-1].content} ${message}`;
    }
  }
  return message;
}

/**
 * RÉCUPÉRATION RAG HYBRIDE
 */
async function retrieveRAGContext(message: string, history: ChatMessage[]): Promise<{ context: string; metadata: string }> {
  // 1. Expansion contextuelle
  const expandedQuery = await expandQueryWithContext(message, history);
  console.log(`🔍 [RAG_EXPANSION] Requête enrichie : "${expandedQuery}"`);

  // 🌐 MODE CLOUD : Weaviate Cloud
  if (IS_CLOUD) {
    try {
      const { searchKnowledge } = await import('../../lib/weaviate/weaviate-knowledge');
      const results = await searchKnowledge(expandedQuery, { nResults: 5, publicOnly: false });

      if (results.length > 0) {
        const context = results.map(r => {
          const typeLabel = r.type === 'qa' ? 'Q/R' : 'PROCÉDURE';
          return `[${typeLabel}] [TITRE: ${r.title}] : ${r.content}`;
        }).join('\n\n');
        return { context, metadata: `WEAVIATE_CLOUD (${results.length} DOCS)` };
      }
    } catch (err: any) {
      console.warn('[CHAT_FLOW] Weaviate fallback :', err.message);
    }
  }

  // 💻 MODE LOCAL : ChromaDB + Registre Physique Professionnel (V4.0 Source Awareness)
  try {
    const results = await searchAcrossCollections(expandedQuery, 4);
    if (results.length > 0) {
      const context = results.map(r => {
        const title = r.metadata?.title || 'DOCUMENT_TECHNIQUE';
        const fileName = r.metadata?.source_file || 'ID_INCONNU';
        const score = Math.round((r.score || 0) * 100);
        return `[FICHIER: ${fileName}] [TITRE: ${title}] [PERTINENCE: ${score}%] : ${r.document}`;
      }).join('\n\n');
      return { context, metadata: `PRO-SEARCH_V4 (${results.length} DOCS)` };
    }
  } catch (err: any) {
    console.warn('[CHAT_FLOW] Local search failure :', err.message);
  }

  return { context: '', metadata: 'AUCUN_CONTEXTE_TROUVE' };
}

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  // 🧠 CONTEXTE SYSTÈME & RAG
  const systemState = await getSystemContextSummary();
  const { context: retrievedContext, metadata: ragMetadata } = await retrieveRAGContext(input.message, input.history);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    let systemContent = `Vous êtes VisioNode Core, l'intelligence orchestratrice industrielle.

CONSIGNES :
1. CONCISION : Répondez en 1 ou 2 phrases. 
2. EXACTITUDE : Si l'info est dans le RAG, utilisez-la. Mentionnez le nom du fichier si pertinent (ex: "Selon ahmed_abbes.json...").
3. IDENTITÉ : Identifiez les personnes et leur rôle via les sources.

ÉTAT SYSTÈME :
- Mode : ${systemState.mode}
- Base RAG : ${systemState.ragDocuments} documents.`;

    if (retrievedContext) {
      systemContent += `\n\n--- CONTEXTE TECHNIQUE RÉCUPÉRÉ ---\n${retrievedContext}`;
    }

    const messages: any[] = [
      { role: 'system', content: systemContent },
      ...input.history.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: input.message }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 200,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      return { 
        text: text.trim(), 
        provider: `Groq LPU + Pro-Search (${ragMetadata})` 
      };
    }
  } catch (err: any) {
    throw new Error(`LIAISON_IA_ERREUR : ${err.message}`);
  }

  throw new Error("Réponse vide.");
}
