
/**
 * @fileOverview Flux de chat Groq optimisé avec Orchestration de Contexte Holistique.
 * Mode Cloud  : Weaviate Cloud (recherche sémantique) + Groq
 * Mode Local  : ChromaDB local + Registre physique + Groq
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

// ─────────────────────────────────────────────────────────────────────────────
// Récupère le contexte RAG selon le mode d'exécution
// ─────────────────────────────────────────────────────────────────────────────
async function retrieveRAGContext(message: string, history: ChatMessage[]): Promise<{ context: string; metadata: string }> {
  // 🧠 ENRICHISSEMENT DE LA REQUÊTE : Si le message est court ou contient des pronoms, on ajoute le sujet précédent
  let searchQuery = message;
  if (history.length > 0 && (message.length < 20 || /il|lui|elle|eux|ce|c'est|son|sa/.test(message.toLowerCase()))) {
    const lastUserMsg = [...history].reverse().find(m => m.role === 'user');
    if (lastUserMsg) searchQuery = `${lastUserMsg.content} ${message}`;
  }

  // 🌐 MODE CLOUD : Weaviate Cloud
  if (IS_CLOUD) {
    try {
      const { searchKnowledge } = await import('../../lib/weaviate/weaviate-knowledge');
      const results = await searchKnowledge(searchQuery, { nResults: 5, publicOnly: false });

      if (results.length > 0) {
        const context = results.map(r => {
          const typeLabel = r.type === 'qa' ? 'Q/R' : 'PROCÉDURE';
          return `[${typeLabel}] [${r.title}] : ${r.content}`;
        }).join('\n\n');
        return { context, metadata: `RAG_WEAVIATE_CLOUD (${results.length} DOCS)` };
      }
      return { context: '', metadata: 'WEAVIATE_VIDE' };
    } catch (err: any) {
      console.warn('[CHAT_FLOW] Weaviate indisponible, fallback registre :', err.message);
    }
  }

  // 💻 MODE LOCAL : ChromaDB + Registre physique
  try {
    const results = await searchAcrossCollections(searchQuery, 4);
    if (results.length > 0) {
      const context = results.map(r => {
        const title = r.metadata?.title || 'DOCUMENT_TECHNIQUE';
        const origin = r.metadata?.origin || 'UNSET';
        return `[SOURCE: ${title}] [ORIGINE: ${origin}] : ${r.document}`;
      }).join('\n\n');
      return { context, metadata: `RAG_FUSIONNE_LOCAL (${results.length} DOCS)` };
    }
  } catch (err: any) {
    console.warn('[CHAT_FLOW] ChromaDB indisponible :', err.message);
  }

  return { context: '', metadata: 'ÉCHEC_RECUPERATION_RAG' };
}

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  if (!input.message.trim()) {
    throw new Error("Message vide");
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error("ERREUR_LIAISON_GROQ : Clé API non configurée.");
  }

  // 🧠 RÉCUPÉRATION DU CONTEXTE SYSTÈME
  const systemState = await getSystemContextSummary();
  
  // 🔍 RÉCUPÉRATION RAG HYBRIDE AVEC CONTEXTE
  const { context: retrievedContext, metadata: ragMetadata } = await retrieveRAGContext(input.message, input.history);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // 🎭 PROMPT SYSTÈME ORCHESTRATEUR - Optimisé pour la concision et l'identité
    let systemContent = `Vous êtes VisioNode Core, l'intelligence orchestratrice de la plateforme industrielle CCP.

CONSIGNES DE CONVIVIALITÉ ET EFFICACITÉ :
1. CONCISION ABSOLUE : Répondez en 1 ou 2 phrases maximum.
2. DIRECT : Allez droit au but. Pas de salutations répétitives.
3. IDENTITÉ : Le nom propre apparaissant dans le RAG (ex: Ahmed) est l'identité réelle du compte "User admin" ou du créateur de la fiche. Liez-les systématiquement.
4. TON : Technique et précis.

VOTRE ÉTAT ACTUEL :
- Mode : ${systemState.mode}
- Base RAG : ${systemState.ragDocuments} procédures indexées.

RÈGLES D'INTERACTION :
- Si l'information est dans le contexte RAG ci-dessous, utilisez-la.
- Sinon, dites simplement : "Information non disponible dans la base technique actuelle."`;

    if (retrievedContext) {
      systemContent += `\n\n--- CONTEXTE TECHNIQUE RÉCUPÉRÉ (RAG) ---\n${retrievedContext}\n--- FIN DU CONTEXTE ---`;
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
      max_tokens: 256,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      return { 
        text: text.trim(), 
        provider: `Groq/Llama-3.3 + Orchestrateur (${ragMetadata})` 
      };
    }
  } catch (err: any) {
    throw new Error(`ERREUR_LIAISON_GROQ : ${err.message}`);
  }

  throw new Error("ERREUR_FLUX : Réponse IA vide.");
}
