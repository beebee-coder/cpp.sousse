/**
 * @fileOverview Service RAG spécialisé pour les procédures industrielles.
 * Version : Automatique et Obligatoire (Support Hybride Weaviate/Chroma).
 */

import { FullProcedure } from '../types';
import { upsertDocuments as upsertChroma, searchAcrossCollections, SearchResult } from '@/lib/chroma';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

export class ProcedureRAGService {
  /**
   * Indexe une procédure de manière obligatoire.
   * Isole les erreurs pour ne pas bloquer le flux de forge principal.
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`🧠 [RAG_SERVICE] Préparation indexation pour: ${procedure.code}`);
    
    // Construction du bloc de connaissances sémantiques
    const chunks = [
      {
        id: `proc-meta-${procedure.id}`,
        content: `DOCUMENTATION TECHNIQUE: ${procedure.title} [CODE: ${procedure.code}]. Catégorie: ${procedure.category}. Département: ${procedure.department}. Criticité: ${procedure.criticality}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'metadata', 
          code: procedure.code,
          indexedAt: timestamp 
        }
      },
      ...((Array.isArray(procedure.steps) ? procedure.steps : []) as any[]).map((step: any, index: number) => ({
        id: `proc-step-${procedure.id}-${index}`,
        content: `INSTRUCTION ÉTAPE ${step.order || index + 1} (${procedure.code}): ${step.title}. Action requise: ${step.description}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'step', 
          order: step.order || index + 1, 
          stepId: step.id,
          indexedAt: timestamp
        }
      }))
    ];

    console.log(`🧱 [RAG_SERVICE] ${chunks.length} chunks générés pour vectorisation.`);

    try {
      if (IS_CLOUD) {
        console.log("📡 [RAG_SERVICE] Mode Cloud: Tentative Weaviate...");
        if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
          try {
            const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
            await upsertKnowledgeItem({
              knowledgeId: procedure.id,
              userId: procedure.authorId || 'system',
              type: 'procedure',
              title: procedure.title,
              content: chunks.map(c => c.content).join('\n'),
              tags: (procedure.metadata as any)?.tags || [],
              category: procedure.category || 'OPERATION',
              difficulty: procedure.criticality || 'MEDIUM',
              isPublic: true,
              createdAt: timestamp
            });
            console.log(`✅ [RAG_SERVICE] Vectorisé dans Weaviate Cloud.`);
          } catch (e) {
             console.warn("[RAG_SERVICE] Échec Weaviate (non-bloquant):", (e as Error).message);
          }
        } else {
          console.log("ℹ️ [RAG_SERVICE] Weaviate non configuré. Vectorisation cloud ignorée.");
        }
      } else {
        // Mode Natif : Indexation ChromaDB Local (obligatoire pour le mode desktop)
        console.log("🧠 [RAG_SERVICE] Mode Natif: Indexation ChromaDB local...");
        await upsertChroma('industrial_procedures', chunks);
        console.log(`✅ [RAG_SERVICE] Vectorisé dans ChromaDB.`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [RAG_SERVICE] Vectorisation échouée pour ${procedure.code}: ${e.message}`);
    }
  }

  /**
   * Recherche d'assistance contextuelle pour l'IA.
   */
  async findHelp(query: string, procedureId?: string): Promise<SearchResult[]> {
    try {
      console.log(`🔍 [RAG_SERVICE] Recherche aide pour: "${query}"`);
      const results = await searchAcrossCollections(query, 5);
      if (procedureId) {
        const filtered = results.filter(r => r.metadata?.procedureId === procedureId || !r.metadata?.procedureId);
        console.log(`✅ [RAG_SERVICE] ${filtered.length} aides trouvées.`);
        return filtered;
      }
      return results;
    } catch (e) {
      console.error("❌ [RAG_SERVICE] Erreur recherche:", (e as Error).message);
      return [];
    }
  }
}

export const procedureRAG = new ProcedureRAGService();
