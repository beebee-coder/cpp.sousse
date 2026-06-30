/**
 * @fileOverview Assistant intelligent pour le guidage en cours de procédure réelle.
 * Analyse les étapes du fichier CRF pour fournir une assistance contextuelle.
 */

import { FullProcedure } from '../types';
import { ExecutionState } from '../services/execution-engine.service';
import { procedureRAG } from '../services/rag.service';

export interface AssistantAdvice {
  text: string;
  type: 'info' | 'warning' | 'tip';
  relatedDocs?: any[];
}

export class ProcedureAssistant {
  /**
   * Analyse le contexte actuel de l'exécution pour fournir un conseil basé sur le RAG.
   */
  async getStepAdvice(procedure: FullProcedure, state: ExecutionState): Promise<AssistantAdvice> {
    const currentStep = procedure.steps[state.currentStepIndex];
    if (!currentStep) return { text: "Audit du système en cours...", type: 'info' };

    // Recherche RAG dynamique basée sur le contenu de l'étape réelle
    const searchTerms = `${procedure.code} ${currentStep.title} ${currentStep.description} securité opérationnelle`;
    const docs = await procedureRAG.findHelp(searchTerms, procedure.id);

    let adviceText = `Analyse de l'étape ${currentStep.order} : Pour "${currentStep.title}", vérifiez scrupuleusement les conditions de validation ${currentStep.validation.conditions.map(c => c.displayName).join(', ')}.`;
    
    if (docs.length > 0) {
      adviceText = `Information extraite du registre industriel : ${docs[0].document.slice(0, 150)}...`;
    }

    return {
      text: adviceText,
      type: 'tip',
      relatedDocs: docs.slice(0, 2)
    };
  }

  /**
   * Réponse aux requêtes de l'opérateur.
   */
  async answerOperator(query: string, procedure: FullProcedure): Promise<string> {
    const docs = await procedureRAG.findHelp(query, procedure.id);
    if (docs.length > 0) {
      return `D'après la documentation technique : ${docs[0].document}`;
    }
    return "Aucune consigne spécifique trouvée dans le registre pour cette demande.";
  }
}

export const procedureAssistant = new ProcedureAssistant();
