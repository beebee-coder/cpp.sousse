/**
 * @fileOverview Flux de chat exclusif Groq pour VisioNode avec intégration RAG multi-collection.
 * Performance : Llama 3.3 (Vitesse LPU) enrichi par ChromaDB (toutes collections).
 * Audit : Logs iconographiés structurés en français industriel.
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

/**
 * Action de chat avec priorité exclusive Groq et audit complet RAG multi-collection.
 * Cherche dans TOUTES les collections ChromaDB disponibles (industrial_manuals + datasets utilisateur).
 */
export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  const timestamp = new Date().toLocaleTimeString();
  
  if (!process.env.GROQ_API_KEY) {
    console.error(`❌ [${timestamp}] [ERREUR_CRITIQUE] Clé GROQ_API_KEY manquante.`);
    throw new Error("ERREUR_LIAISON_GROQ : Clé API non configurée.");
  }

  // 1. Récupération sémantique RAG — Multi-collection (ChromaDB ou Fallback disque + mémoire)
  let retrievedContext = "";
  let ragProvider = "MOTEUR_DEGRADE";

  try {
    // Recherche dans TOUTES les collections disponibles (industrial_manuals + datasets utilisateur)
    const results = await searchAcrossCollections(input.message, 3);
    
    if (results.length > 0) {
      retrievedContext = results.map(r => {
        const title = r.metadata?.title || r.metadata?.source || 'Manuel';
        const collection = r.metadata?._collection || 'industrial_manuals';
        return `[MANUEL: ${title}] [Collection: ${collection}] : ${r.document}`;
      }).join('\n\n');
      ragProvider = "CHROMADB_MULTI_COLLECTION";
      console.log(`⚡ [${timestamp}] [RAG] ${results.length} documents récupérés depuis ChromaDB (multi-collection)`);
    } else {
      console.warn(`⚠️ [${timestamp}] [RAG] Aucun résultat ChromaDB.`);
    }
  } catch (e: any) {
    console.warn(`⚠️ [${timestamp}] [RAG] ChromaDB indisponible, chargement des fallbacks...`);
    
    // Fallback 1 : Datasets utilisateur sur disque (data/chromadb/datasets/)
    try {
      const diskDocs = await loadUserDatasetsFromDisk();
      if (diskDocs.length > 0) {
        // Recherche sémantique légère sur les datasets disque
        const queryTokens = input.message.toLowerCase().split(/\W+/).filter(t => t.length > 2);
        const scored = diskDocs
          .map(doc => {
            const text = doc.content.toLowerCase();
            const score = queryTokens.reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0);
            return { doc, score };
          })
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        
        if (scored.length > 0) {
          retrievedContext = scored.map(s => 
            `[DATASET UTILISATEUR: ${s.doc.metadata?.title || s.doc.metadata?.source}] : ${s.doc.content}`
          ).join('\n\n');
          ragProvider = "REPLI_DISQUE_DATASETS";
          console.log(`💾 [${timestamp}] [RAG] ${scored.length} docs depuis datasets disque (fallback)`);
        }
      }
    } catch { /* ignore */ }

    // Fallback 2 : Manuels en mémoire (si rien d'autre)
    if (!retrievedContext) {
      const results = fallbackSemanticSearch(input.message, 3);
      if (results.length > 0) {
        retrievedContext = results.map(r => 
          `[MANUEL: ${r.metadata?.title || r.metadata?.source || 'Manuel'}] : ${r.document}`
        ).join('\n\n');
        ragProvider = "REPLI_MEMOIRE_LOCAL";
        console.log(`🎯 [${timestamp}] [RAG] ${results.length} docs depuis mémoire locale (fallback)`);
      }
    }
  }

  console.log(`⚡ [${timestamp}] [NODE_GROQ] RAG activé via : ${ragProvider}. Envoi à Llama 3.3...`);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    let systemContent = `Vous êtes VisioNode Core, l'assistant IA avancé de la plateforme de contrôle industriel CCP.
Règles de comportement strictes :
1. TON PROFESSIONNEL : Soyez courtois, direct et expert. Évitez absolument les répétitions inutiles (ne répétez pas les formules de politesse).
2. INTERACTIVITÉ : Soyez proactif. Si la demande est vague, posez des questions de clarification ou proposez des actions concrètes liées à la vision industrielle, la maintenance ou l'analyse de données.
3. CONCISION : Allez à l'essentiel sans phrases de remplissage.
4. UTILISATION DU CONTEXTE : Ne mentionnez JAMAIS vos sources ou les manuels lors de simples salutations ou conversations générales. Ne les citez que si vous répondez à une question technique précise..
5. UTILISATION DU NOM : montionner le nom ou le prenom de l'utilisateur.`

    if (retrievedContext) {
      systemContent += `\n\nContexte technique RAG disponible (${ragProvider}) :\n${retrievedContext}\n\nRAPPEL IMPORTANT : Utilisez ce contexte UNIQUEMENT s'il répond directement à la demande de l'utilisateur. Si c'est le cas, référencez la source avec élégance (ex: "D'après le manuel [Nom]..."). Sinon, ignorez totalement ce contexte.`;
    }

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...input.history.map((m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: input.message }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      console.log(`✅ [${timestamp}] [SUCCÈS] Flux généré par le nœud Groq avec RAG (${ragProvider}).`);
      return { text, provider: `GROQ/LLAMA-3.3 + RAG (${ragProvider})` };
    }
  } catch (err: any) {
    console.error(`❌ [${timestamp}] [ERREUR_LIAISON] Échec du nœud Groq :`, err.message);
    throw new Error(`ERREUR_LIAISON_GROQ : ${err.message}`);
  }

  throw new Error("ERREUR_FLUX : Réponse vide.");
}
