/**
 * @fileOverview Service de reporting pour l'audit des procédures.
 */

import { ExecutionState } from './execution-engine.service';
import { FullProcedure } from '../types';

export interface ExecutionReport {
  id: string;
  procedureCode: string;
  operatorId: string;
  startTime: string;
  endTime: string;
  duration: number;
  stepsCompleted: number;
  totalSteps: number;
  alarmsTriggered: string[];
  status: string;
}

export class ReportingService {
  /**
   * Génère un rapport d'audit complet à la fin d'une exécution.
   */
  generateReport(procedure: FullProcedure, state: ExecutionState): ExecutionReport {
    return {
      id: `report-${Date.now()}`,
      procedureCode: procedure.code,
      operatorId: 'admin_station',
      startTime: new Date(state.startTime || 0).toISOString(),
      endTime: new Date(state.endTime || 0).toISOString(),
      duration: Math.floor(((state.endTime || 0) - (state.startTime || 0)) / 1000),
      stepsCompleted: state.completedSteps.length,
      totalSteps: procedure.steps.length,
      alarmsTriggered: state.activeAlarms,
      status: state.status
    };
  }

  /**
   * Formate le rapport en Markdown pour l'affichage ou l'export.
   */
  toMarkdown(report: ExecutionReport): string {
    return `
# RAPPORT D'AUDIT INDUSTRIEL
## PROCÉDURE : ${report.procedureCode}

- **ID SESSION** : ${report.id}
- **STATUT FINAL** : ${report.status}
- **DURÉE TOTALE** : ${report.duration} secondes
- **PROGRESSION** : ${report.stepsCompleted}/${report.totalSteps} étapes validées

### RÉSUMÉ DES INCIDENTS
${report.alarmsTriggered.length > 0 
  ? report.alarmsTriggered.map(a => `- ALERTE : ${a}`).join('\n')
  : "Aucun incident détecté."}

---
*Généré par VisioNode Precision Engine*
    `.trim();
  }
}

export const reportingService = new ReportingService();
