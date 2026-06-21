/**
 * @fileOverview Flux de chat exclusif Groq pour VisioNode avec intégration RAG multi-collection.
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections, 
  fallbackSemanticSearch, 
  loadUserDatasetsFromDisk 
} from '@/lib/chroma';

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

export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  const timestamp = new Date().toLocaleTimeString();
  
  if (!process.env.GROQ_API_KEY) {
    throw new Error("ERREUR_LIAISON_GROQ : Clé API non configurée.");
  }

  let retrievedContext = "";
  let ragProvider = "MOTEUR_DEGRADE";

  try {
    const results = await searchAcrossCollections(input.message, 3);
    
    if (results.length > 0) {
      retrievedContext = results.map(r => {
        const title = r.metadata?.title || r.metadata?.source || 'Manuel';
        const collection = r.metadata?._collection || 'industrial_manuals';
        return `[MANUEL: ${title}] [Collection: ${collection}] : ${r.document}`;
      }).join('\n\n');
      ragProvider = "CHROMADB_MULTI_COLLECTION";
    }
  } catch (e: any) {
    const results = fallbackSemanticSearch(input.message, 3);
    if (results.length > 0) {
      retrievedContext = results.map(r => 
        `[MANUEL: ${r.metadata?.title || 'Manuel'}] : ${r.document}`
      ).join('\n\n');
      ragProvider = "REPLI_MEMOIRE_LOCAL";
    }
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    let systemContent = `Vous êtes VisioNode Core, l'assistant IA de la plateforme de contrôle industriel CCP.
RÈGLES :
1. TON : Professionnel, expert.
2. CONTEXTE : Utilisez les manuels si cités.
3. NOM : Mentionnez le nom de l'utilisateur.`;

    if (retrievedContext) {
      systemContent += `\n\nContexte technique RAG (${ragProvider}) :\n${retrievedContext}`;
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
      temperature: 0.4,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      return { text, provider: `GROQ/LLAMA-3.3 + RAG (${ragProvider})` };
    }
  } catch (err: any) {
    throw new Error(`ERREUR_LIAISON_GROQ : ${err.message}`);
  }

  throw new Error("ERREUR_FLUX : Réponse vide.");
}
