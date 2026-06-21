/**
 * @fileOverview Flux de récupération de documents RAG basé sur une image.
 * Version : RAG connecté à ChromaDB avec fallbacks optimisés.
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections,
  semanticSearch, 
  fallbackSemanticSearch, 
  seedIndustrialManuals, 
  type SearchResult 
} from '@/lib/chroma';


export interface DocumentInfo {
  title: string;
  summary: string;
  url: string;
}

export interface VisualDocumentRetrievalInput {
  imageDataUri: string;
}

export interface VisualDocumentRetrievalOutput {
  componentDescription: string;
  relevantDocuments: DocumentInfo[];
  offline?: boolean;
  provider?: string;
}

export async function visualDocumentRetrieval(
  input: VisualDocumentRetrievalInput
): Promise<VisualDocumentRetrievalOutput> {
  const timestamp = new Date().toLocaleTimeString();
  
  // 1. Essayer d'initialiser et seed la collection de manuels industriels
  await seedIndustrialManuals();

  // 2. Détecter le composant industriel de base pour affiner la recherche
  let detectedDescription = "un composant industriel inconnu";
  let componentFilter = "";
  const uri = input.imageDataUri;
  if (uri.includes("industrial1") || uri.includes("industrial-control")) {
    detectedDescription = "un panneau de contrôle industriel avec des vannes, des boutons d'arrêt d'urgence et des manomètres";
    componentFilter = "industrial-control";
  } else if (uri.includes("pump1") || uri.includes("pump-system")) {
    detectedDescription = "un système de pompe centrifuge industrielle";
    componentFilter = "pump-system";
  } else if (uri.includes("factory1") || uri.includes("factory-floor")) {
    detectedDescription = "une ligne de production automatisée d'usine";
    componentFilter = "factory-floor";
  }

  console.log(`⚡ [${timestamp}] [RAG_RETRIEVAL] Recherche de documents pour le composant: ${componentFilter || 'global'}`);

  // 3. Récupérer les documents pertinents via ChromaDB (ou fallback)
  let retrievedDocs: SearchResult[] = [];
  let isOfflineSearch = false;

  try {
    // Recherche multi-collection : industrial_manuals + datasets utilisateur
    retrievedDocs = await searchAcrossCollections(detectedDescription, 3);
    // Filtrer par composant si un filtre est actif
    if (componentFilter && retrievedDocs.length > 0) {
      const filtered = retrievedDocs.filter(r => r.metadata?.component === componentFilter);
      if (filtered.length > 0) retrievedDocs = filtered;
    }
    console.log(`📡 [${timestamp}] [ChromaDB] Recherche multi-collection : ${retrievedDocs.length} document(s) trouvés.`);
  } catch (error: any) {
    console.warn(`⚠️ [ChromaDB] Non disponible, exécution de la recherche sémantique locale en mémoire...`);
    retrievedDocs = fallbackSemanticSearch(detectedDescription, 3, componentFilter);
    isOfflineSearch = true;
    console.log(`🎯 [RAG_FALLBACK] Recherche locale en mémoire : ${retrievedDocs.length} document(s) correspondants.`);
  }

  // 4. Injecter les documents récupérés dans le Prompt pour Groq
  const contextString = retrievedDocs.map(r => {
    const title = r.metadata?.title || 'Manuel';
    const url = r.metadata?.url || '#';
    return `[TITRE]: ${title}\n[SOURCE]: ${url}\n[CONTENU]: ${r.document}`;
  }).join('\n\n');

  if (!process.env.GROQ_API_KEY) {
    console.warn(`⚠️ Clé GROQ_API_KEY manquante. RAG direct sans synthèse de modèle.`);
    return {
      componentDescription: componentFilter ? componentFilter.toUpperCase().replace('-', ' ') : "COMPOSANT INDUSTRIEL",
      relevantDocuments: retrievedDocs.map(r => ({
        title: String(r.metadata?.title || 'Manuel technique'),
        summary: r.document,
        url: String(r.metadata?.url || '#')
      })),
      offline: true,
      provider: isOfflineSearch ? 'local-fallback' : 'chromadb-local'
    };
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const prompt = `Vous êtes un expert en documentation technique industrielle pour VisioNode.
Nous analysons une image contenant : "${detectedDescription}".
Voici les extraits des documents techniques les plus pertinents récupérés dans notre base de connaissances vectorielle :

${contextString}

Votre tâche consiste à identifier le système et à générer une liste de fiches ou guides documentaires pertinents issus des documents ci-dessus, adaptés à cette observation en direct (en français).
Pour chaque document pertinent, résumez l'extrait de manière claire et concise par rapport à l'équipement observé.

Votre réponse doit être STRICTEMENT au format JSON avec la structure suivante :
{
  "componentDescription": "IDENTIFICATION DU COMPOSANT EN MAJUSCULES (ex: PANNEAU DE CONTROLE)",
  "relevantDocuments": [
    {
      "title": "Titre exact du manuel technique issu du contexte ci-dessus",
      "summary": "Résumé de 1 à 2 phrases de l'extrait pertinent par rapport à l'équipement observé",
      "url": "URL exacte du manuel technique issu de la [SOURCE] ci-dessus"
    }
  ]
}
Ne renvoyez rien d'autre que du JSON valide, sans balise markdown ni introduction.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Vous répondez uniquement sous forme de JSON valide et brut.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      console.log(`✅ [${timestamp}] [SUCCÈS] RAG connecté et optimisé exécuté via Groq.`);
      const result = JSON.parse(text) as VisualDocumentRetrievalOutput;
      return {
        ...result,
        offline: isOfflineSearch,
        provider: isOfflineSearch ? 'local-fallback-groq' : 'chromadb-groq'
      };
    }
  } catch (err: any) {
    console.error(`❌ [${timestamp}] [ERREUR] Échec de la synthèse RAG Groq :`, err.message);
  }

  // Ultime Fallback propre en cas d'erreur de modèle ou d'API
  return {
    componentDescription: componentFilter ? componentFilter.toUpperCase().replace('-', ' ') : "COMPOSANT INDUSTRIEL",
    relevantDocuments: retrievedDocs.map(r => ({
      title: String(r.metadata?.title || 'Manuel technique'),
      summary: r.document,
      url: String(r.metadata?.url || '#')
    })),
    offline: true,
    provider: 'local-fallback'
  };
}

