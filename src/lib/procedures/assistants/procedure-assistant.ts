/**
 * @fileOverview Assistant intelligent pour le guidage en cours de procédure.
 */

import { FullProcedure, ProcedureStep } from '../types';
import { ExecutionState } from '../services/execution-engine.service';
import { procedureRAG } from '../services/rag.service';

export interface AssistantAdvice {
  text: string;
  type: 'info' | 'warning' | 'tip';
  relatedDocs?: any[];
}

export class ProcedureAssistant {
  /**
   * Analyse le contexte actuel de l'exécution pour fournir un conseil proactif.
   */
  async getStepAdvice(procedure: FullProcedure, state: ExecutionState): Promise<AssistantAdvice> {
    const currentStep = procedure.steps[state.currentStepIndex];
    if (!currentStep) return { text: "Initialisation du système...", type: 'info' };

    // Recherche RAG sur les alarmes potentielles de cette étape
    const searchTerms = `${currentStep.title} ${currentStep.description} risques erreurs`;
    const docs = await procedureRAG.findHelp(searchTerms, procedure.id);

    return {
      text: `Expertise VisioNode : Pour l'action "${currentStep.title}", assurez-vous de respecter les consignes de sécurité environnementales.`,
      type: 'tip',
      relatedDocs: docs.slice(0, 2)
    };
  }

  /**
   * Traite une question naturelle de l'opérateur pendant l'exécution.
   */
  async answerOperator(query: string, procedure: FullProcedure, stepIndex: number): Promise<string> {
    const docs = await procedureRAG.findHelp(query, procedure.id);
    if (docs.length > 0) {
      return `D'après le registre : ${docs[0].document}`;
    }
    return "Je n'ai pas trouvé d'information spécifique dans le manuel pour cette question.";
  }
}

export const procedureAssistant = new ProcedureAssistant();
