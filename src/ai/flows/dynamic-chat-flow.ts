/**
 * @fileOverview Flux de chat VisioNode Core V5.0.
 * Intègre le support multimédia pour le retour d'images/vidéos depuis le RAG.
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections,
  getSystemContextSummary
} from '../../lib/chroma';
import { postgresClient } from '../../lib/db/postgres-client';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
  media?: {
    url: string;
    type: 'image' | 'video';
  };
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
};

async function expandQueryWithContext(message: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0 && message.length > 15) return message;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const recentHistory = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const expansion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Expert industriel. Reformulez en recherche technique précise (noms, composants, actifs visuels). RÉPONDEZ UNIQUEMENT PAR LA RECHERCHE.' },
        { role: 'user', content: `Historique:\n${recentHistory}\n\nQuestion: ${message}` }
      ],
      model: 'llama-3.1-8b-instant', 
      temperature: 0.1,
      max_tokens: 60
    });
    return expansion.choices[0]?.message?.content?.trim() || message;
  } catch (e) { return message; }
}

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  const systemState = await getSystemContextSummary();
  const expandedQuery = await expandQueryWithContext(input.message, input.history);
  
  // Récupération RAG
  const ragResults = await searchAcrossCollections(expandedQuery, 5);
  
  // Extraction d'un média potentiel si pertinent
  let detectedMedia: { url: string; type: 'image' | 'video' } | undefined = undefined;
  
  if (ragResults.length > 0) {
    const mediaDoc = ragResults.find(r => r.metadata?.isMedia === true);
    if (mediaDoc && mediaDoc.metadata?.relPath) {
      try {
        const dataUri = await postgresClient.getFile(mediaDoc.metadata.relPath);
        detectedMedia = {
          url: dataUri,
          type: mediaDoc.metadata.mediaType || 'image'
        };
      } catch (e) {
        console.warn("Échec chargement média RAG:", mediaDoc.metadata.relPath);
      }
    }
  }

  const context = ragResults.map(r => {
    const source = r.metadata?.origin || 'BASE';
    const type = r.metadata?.isMedia ? '[MÉDIA]' : '[TEXTE]';
    return `${type} [SOURCE: ${source}] : ${r.document}`;
  }).join('\n\n');

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    let systemContent = `Vous êtes VisioNode Core, l'intelligence orchestratrice industrielle.

CONSIGNES :
1. CONCISION : 2 phrases maximum.
2. CITATION : Mentionnez la source (ex: "Selon la banque d'images...").
3. MÉDIA : Si un média est détecté, confirmez que vous l'affichez.

ÉTAT SYSTÈME :
- Mode : ${systemState.mode}
- Registre : ${systemState.ragDocuments} docs / ${systemState.bankAssets} assets.`;

    if (context) {
      systemContent += `\n\n--- CONTEXTE TECHNIQUE RÉCUPÉRÉ ---\n${context}`;
    }

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
      return { 
        text: text.trim(), 
        provider: `Groq LPU + Pro-Search`,
        media: detectedMedia
      };
    }
  } catch (err: any) {
    throw new Error(`LIAISON_IA_ERREUR : ${err.message}`);
  }

  throw new Error("Réponse vide.");
}
