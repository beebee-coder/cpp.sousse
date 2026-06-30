/**
 * @fileOverview Flux de chat VisioNode Core V5.0.
 * Intègre l'orchestration des 20 options de recherche pro.
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
 * 3. EXPANSION DE REQUÊTE & 7. SYNONYMES
 * Transforme "Ahmed" en une recherche riche incluant l'historique.
 */
async function expandQueryWithContext(message: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0 && message.length > 15) return message;
  
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const recentHistory = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    
    const expansion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'Expert en extraction d\'intentions industrielles. Reformulez la question utilisateur en une recherche technique précise incluant noms propres, composants et synonymes techniques. RÉPONDEZ UNIQUEMENT PAR LA RECHERCHE.' 
        },
        { role: 'user', content: `Historique:\n${recentHistory}\n\nQuestion: ${message}` }
      ],
      model: 'llama-3.1-8b-instant', 
      temperature: 0.1,
      max_tokens: 60
    });

    const expanded = expansion.choices[0]?.message?.content?.trim();
    return expanded || message;
  } catch (e) {
    return message;
  }
}

/**
 * RÉCUPÉRATION RAG HYBRIDE (Options 1 à 17)
 */
async function retrieveRAGContext(message: string, history: ChatMessage[]): Promise<{ context: string; metadata: string }> {
  // 3. Expansion contextuelle
  const expandedQuery = await expandQueryWithContext(message, history);
  console.log(`🔍 [PRO-SEARCH] Requête enrichie : "${expandedQuery}"`);

  // 🌐 MODE CLOUD (Weaviate)
  if (IS_CLOUD) {
    try {
      const { searchKnowledge } = await import('../../lib/weaviate/weaviate-knowledge');
      const results = await searchKnowledge(expandedQuery, { nResults: 5, publicOnly: false });

      if (results.length > 0) {
        const context = results.map(r => `[TITRE: ${r.title}] : ${r.content}`).join('\n\n');
        return { context, metadata: `WEAVIATE_CLOUD (${results.length} DOCS)` };
      }
    } catch (err: any) {
      console.warn('[CHAT_FLOW] Fallback Cloud :', err.message);
    }
  }

  // 💻 MODE LOCAL / PHYSIQUE (Options 8, 9, 10, 12, 13, 15, 16)
  try {
    const results = await searchAcrossCollections(expandedQuery, 4);
    if (results.length > 0) {
      const context = results.map(r => {
        const fileName = r.metadata?.source_file || 'INCONNU';
        const score = Math.round((r.score || 0) * 100);
        return `[SOURCE: ${fileName}] [PERTINENCE: ${score}%] : ${r.document}`;
      }).join('\n\n');
      return { context, metadata: `PRO-SEARCH_V5 (${results.length} DOCS)` };
    }
  } catch (err: any) {
    console.warn('[CHAT_FLOW] Local search failure :', err.message);
  }

  return { context: '', metadata: 'AUCUN_CONTEXTE_TROUVE' };
}

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  // 18. SOMMAIRE SYSTÈME & RAG
  const systemState = await getSystemContextSummary();
  const { context: retrievedContext, metadata: ragMetadata } = await retrieveRAGContext(input.message, input.history);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // 20. AUTO-CORRECTION & SOURCE CITATION
    let systemContent = `Vous êtes VisioNode Core, l'intelligence orchestratrice industrielle.

CONSIGNES STRICTES :
1. CONCISION : Répondez en 1 ou 2 phrases précises.
2. CITATION : Mentionnez toujours le nom de la source si l'info vient du RAG (ex: "Selon ahmed_abbes.json...").
3. ÉVALUATION : Si le contexte semble non pertinent, signalez-le brièvement.

ÉTAT SYSTÈME :
- Mode : ${systemState.mode}
- Registre : ${systemState.ragDocuments} docs / ${systemState.bankAssets} assets.`;

    if (retrievedContext) {
      systemContent += `\n\n--- CONTEXTE TECHNIQUE RÉCUPÉRÉ (20 OPTIONS) ---\n${retrievedContext}`;
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
      temperature: 0.1, // Basse pour la précision
      max_tokens: 150,
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
