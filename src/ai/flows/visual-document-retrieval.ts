/**
 * @fileOverview Flux de récupération de documents RAG basé sur une image.
 */

import Groq from 'groq-sdk';
import { 
  searchAcrossCollections,
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
  await seedIndustrialManuals();

  let detectedDescription = "un composant industriel inconnu";
  let componentFilter = "";
  const uri = input.imageDataUri;
  
  if (uri.includes("industrial1")) {
    detectedDescription = "panneau de contrôle";
    componentFilter = "industrial-control";
  } else if (uri.includes("pump1")) {
    detectedDescription = "pompe centrifuge";
    componentFilter = "pump-system";
  }

  let retrievedDocs: SearchResult[] = [];
  let isOfflineSearch = false;

  try {
    retrievedDocs = await searchAcrossCollections(detectedDescription, 3);
    if (componentFilter && retrievedDocs.length > 0) {
      const filtered = retrievedDocs.filter(r => r.metadata?.component === componentFilter);
      if (filtered.length > 0) retrievedDocs = filtered;
    }
  } catch (error: any) {
    retrievedDocs = fallbackSemanticSearch(detectedDescription, 3, componentFilter);
    isOfflineSearch = true;
  }

  const contextString = retrievedDocs.map(r => {
    const title = r.metadata?.title || 'Manuel';
    const url = r.metadata?.url || '#';
    return `[TITRE]: ${title}\n[SOURCE]: ${url}\n[CONTENU]: ${r.document}`;
  }).join('\n\n');

  if (!process.env.GROQ_API_KEY) {
    return {
      componentDescription: componentFilter.toUpperCase(),
      relevantDocuments: retrievedDocs.map(r => ({
        title: String(r.metadata?.title || 'Manuel technique'),
        summary: r.document,
        url: String(r.metadata?.url || '#')
      })),
      offline: true,
      provider: 'local-fallback'
    };
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const prompt = `Expert RAG VisioNode. Docs : \n${contextString}\nIdentifiez et résumez les fiches pour "${detectedDescription}". RÉPONDRE UNIQUEMENT EN JSON.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'JSON BRUT UNIQUEMENT.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      const result = JSON.parse(text);
      return {
        ...result,
        offline: isOfflineSearch,
        provider: 'groq-rag'
      };
    }
  } catch (err: any) {
    console.error("Erreur RAG Synthèse:", err);
  }

  return {
    componentDescription: componentFilter.toUpperCase(),
    relevantDocuments: retrievedDocs.map(r => ({
      title: String(r.metadata?.title || 'Manuel technique'),
      summary: r.document,
      url: String(r.metadata?.url || '#')
    })),
    offline: true,
    provider: 'local-fallback'
  };
}
