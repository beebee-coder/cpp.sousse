
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
async function retrieveRAGContext(message: string): Promise<{ context: string; metadata: string }> {
  // 🌐 MODE CLOUD : Weaviate Cloud
  if (IS_CLOUD) {
    try {
      const { searchKnowledge } = await import('../../lib/weaviate/weaviate-knowledge');
      const results = await searchKnowledge(message, { nResults: 5, publicOnly: false });

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
    const results = await searchAcrossCollections(message, 4);
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
  if (!process.env.GROQ_API_KEY) {
    throw new Error("ERREUR_LIAISON_GROQ : Clé API non configurée.");
  }

  // 🧠 RÉCUPÉRATION DU CONTEXTE SYSTÈME
  const systemState = await getSystemContextSummary();
  
  // 🔍 RÉCUPÉRATION RAG HYBRIDE (Weaviate Cloud OU ChromaDB Local)
  const { context: retrievedContext, metadata: ragMetadata } = await retrieveRAGContext(input.message);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // 🎭 PROMPT SYSTÈME ORCHESTRATEUR
    let systemContent = `Vous êtes VisioNode Core, l'intelligence orchestratrice de la plateforme industrielle CCP.
VOTRE ÉTAT ACTUEL :
- Mode : ${systemState.mode} ${IS_CLOUD ? '| CLOUD WEAVIATE ACTIF' : '| CHROMADB LOCAL ACTIF'}
- Base RAG : ${systemState.ragDocuments} procédures indexées.
- Banque Images : ${systemState.bankAssets} actifs stockés.

RÈGLES D'INTERACTION :
1. ANALYSE : Si l'utilisateur mentionne un symptôme, cherchez la procédure dans le contexte RAG fourni ci-dessous.
2. EXPERTISE : Utilisez un ton technique, précis et proactif.
3. ORIENTATION : N'hésitez pas à suggérer de consulter la "Banque d'images" ou le "Flux Vidéo" si une inspection visuelle semble nécessaire.
4. ABSENCE DE DONNÉES : Si le RAG est vide ou non pertinent, proposez à l'utilisateur de dicter une nouvelle procédure dans la "Base RAG" pour enrichir le système.`;

    if (retrievedContext) {
      systemContent += `\n\n--- CONTEXTE TECHNIQUE RÉCUPÉRÉ (RAG) ---\n${retrievedContext}\n--- FIN DU CONTEXTE ---`;
    } else {
      systemContent += `\n\n(Avertissement : Aucune documentation technique spécifique n'a été trouvée dans la base RAG pour cette requête.)`;
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
      temperature: 0.3,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      return { 
        text, 
        provider: `Groq/Llama-3.3 + Orchestrateur (${ragMetadata})` 
      };
    }
  } catch (err: any) {
    throw new Error(`ERREUR_LIAISON_GROQ : ${err.message}`);
  }

  throw new Error("ERREUR_FLUX : Réponse IA vide.");
}
