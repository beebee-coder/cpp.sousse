/**
 * @fileOverview Flux de chat VisioNode Core V5.5.
 * Passage automatique vers les procédures dynamiques avec logs [CHAT].
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections,
  getSystemContextSummary
} from '../../lib/chroma';
import { postgresClient } from '../../lib/db/postgres-client';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
  media?: {
    url: string;
    type: 'image' | 'video';
  };
  procedureId?: string;
};

type ChatInput = {
  history: ChatMessage[];
  message: string;
};

type ChatOutput = {
  text: string;
  provider: string;
  media?: {
    url: string;
    type: 'image' | 'video';
  };
  procedureId?: string;
};

async function expandQueryWithContext(message: string, history: ChatMessage[]): Promise<string> {
  console.log(`🔍 [CHAT_RAG] [EXPAND] Tentative d'expansion de la requête : "${message.slice(0, 30)}..."`);
  if (history.length === 0 && message.length > 15) return message;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const recentHistory = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const expansion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Expert industriel. Reformulez en recherche technique précise (noms, composants, actifs visuels/photos). RÉPONDEZ UNIQUEMENT PAR LES TERMES DE RECHERCHE.' },
        { role: 'user', content: `Historique:\n${recentHistory}\n\nQuestion: ${message}` }
      ],
      model: 'llama-3.1-8b-instant', 
      temperature: 0.1,
      max_tokens: 60
    });
    const result = expansion.choices[0]?.message?.content?.trim() || message;
    console.log(`✅ [CHAT_RAG] [EXPAND] Requête reformulée : "${result}"`);
    return result;
  } catch (e) { 
    console.warn(`⚠️ [CHAT_RAG] [EXPAND] Échec de l'expansion, utilisation de la requête originale.`);
    return message; 
  }
}

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`🤖 [CHAT_LLM] [INIT] Traitement message utilisateur à ${timestamp}`);

  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  const systemState = await getSystemContextSummary();
  const expandedQuery = await expandQueryWithContext(input.message, input.history);
  
  // Récupération RAG
  console.log(`🔍 [CHAT_RAG] [SEARCH] Recherche dans les collections hybrides...`);
  const ragResults = await searchAcrossCollections(expandedQuery, 10);
  console.log(`✅ [CHAT_RAG] [SEARCH] ${ragResults.length} résultats trouvés.`);
  
  let detectedMedia: { url: string; type: 'image' | 'video' } | undefined = undefined;
  let detectedProcedureId: string | undefined = undefined;
  
  if (ragResults.length > 0) {
    const procDoc = ragResults.find(r => r.metadata?.procedureId || r.metadata?.knowledgeId || r.id.startsWith('proc-'));
    if (procDoc) {
      detectedProcedureId = procDoc.metadata?.procedureId || procDoc.metadata?.knowledgeId || procDoc.id.replace('.json', '');
      console.log(`🚀 [CHAT_NAV] [DETECT] Procédure identifiée : ${detectedProcedureId}`);
    }

    const mediaDoc = ragResults.find(r => r.metadata?.isMedia === true);
    if (mediaDoc && mediaDoc.metadata?.relPath) {
      try {
        console.log(`🖼️ [CHAT_RAG] [MEDIA] Chargement de l'actif média : ${mediaDoc.metadata.relPath}`);
        const dataUri = await postgresClient.getFile(mediaDoc.metadata.relPath);
        detectedMedia = {
          url: dataUri,
          type: mediaDoc.metadata.mediaType || 'image'
        };
      } catch (e) {
        console.warn("⚠️ [CHAT_RAG] [MEDIA] Échec chargement média:", mediaDoc.metadata.relPath);
      }
    }
  }

  const context = ragResults.map(r => {
    const source = r.metadata?.origin || 'BASE';
    const path = r.metadata?.relPath || 'inconnu';
    const isProc = r.metadata?.procedureId || r.metadata?.knowledgeId || r.id.startsWith('proc-');
    const type = isProc ? '[PROCÉDURE_GUIDÉ]' : (r.metadata?.isMedia ? '[MÉDIA_DISPONIBLE]' : '[DOCUMENT_TEXTE]');
    return `${type} [SOURCE: ${source}] [FICHIER: ${path}] : ${r.document}`;
  }).join('\n\n');

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    let systemContent = `Vous êtes VisioNode Core, l'intelligence industrielle.

CONSIGNES STRICTES :
1. CONCISION : 2 phrases maximum.
2. DISCRÉTION DES SOURCES : Ne mentionnez JAMAIS les noms techniques des fichiers, les extensions ou les répertoires.
3. MULTIMÉDIA : Si un document [MÉDIA_DISPONIBLE] est présent, confirmez son affichage.
4. TRANSITION PROCÉDURE : Si vous identifiez une [PROCÉDURE_GUIDÉ] pertinente dans le contexte, confirmez que vous initialisez immédiatement le transfert vers le cockpit interactif. Utilisez des termes comme "J'initialise le transfert" ou "Je lance la procédure".

ÉTAT SYSTÈME :
- Mode : ${systemState.mode}
- Registre : ${systemState.ragDocuments} docs / ${systemState.bankAssets} assets.`;

    if (context) {
      systemContent += `\n\n--- CONTEXTE RÉCUPÉRÉ (TEXTE ET MÉDIAS) ---\n${context}`;
    }

    console.log(`📡 [CHAT_LLM] [STEP] Envoi au moteur Groq LPU (llama-3.3-70b)...`);
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemContent },
        ...input.history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: input.message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      console.log(`✅ [CHAT_LLM] [SUCCESS] Réponse générée.`);
      return { 
        text: text.trim(), 
        provider: `Groq LPU + Pro-Search V5.5`,
        media: detectedMedia,
        procedureId: detectedProcedureId
      };
    }
  } catch (err: any) {
    console.error(`❌ [CHAT_LLM] [ERROR] Échec moteur Groq:`, err.message);
    throw new Error(`LIAISON_IA_ERREUR : ${err.message}`);
  }

  throw new Error("Réponse vide.");
}
