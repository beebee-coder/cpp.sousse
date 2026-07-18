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
  stepOutcomes?: any[];
}

export class ReportingService {
  /**
   * Génère un rapport d'audit complet à la fin d'une exécution.
   */
  generateReport(procedure: FullProcedure, state: ExecutionState, operatorId = 'admin_station'): ExecutionReport {
    const startTime = state.startTime || Date.now();
    const endTime = state.endTime || Date.now();
    return {
      id: `report-${Date.now()}`,
      procedureCode: procedure.code,
      operatorId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration: Math.floor((endTime - startTime) / 1000),
      stepsCompleted: state.completedSteps.length,
      totalSteps: procedure.steps.length,
      alarmsTriggered: state.activeAlarms,
      status: state.status,
      stepOutcomes: state.stepOutcomes,
    };
  }

  /**
   * Formate le rapport en Markdown pour l'affichage ou l'export.
   */
  toMarkdown(report: ExecutionReport, procedure?: FullProcedure): string {
    const procedureTitle = procedure?.title || report.procedureCode;
    const stepDetails = report.stepOutcomes?.map((outcome: any) => {
      const statusIcon = outcome.status === 'completed' ? '✅' : outcome.status === 'timeout' ? '⏱️' : '⏭️';
      return `${statusIcon} **${outcome.title}** — ${outcome.duration}s`;
    }).join('\n') || 'Aucun détail d\'étape.';

    return `
# RAPPORT D'AUDIT INDUSTRIEL
## PROCÉDURE : ${procedureTitle} (${report.procedureCode})

- **ID SESSION** : ${report.id}
- **STATUT FINAL** : ${report.status}
- **DURÉE TOTALE** : ${report.duration} secondes
- **PROGRESSION** : ${report.stepsCompleted}/${report.totalSteps} étapes validées

### DÉTAIL DES ÉTAPES
${stepDetails}

### RÉSUMÉ DES INCIDENTS
${report.alarmsTriggered.length > 0 
  ? report.alarmsTriggered.map(a => `- ALERTE : ${a}`).join('\n')
  : "Aucun incident détecté."}

---
*Généré par VisioNode Precision Engine*
    `.trim();
  }

  /**
   * Formate le rapport en JSON structuré.
   */
  toJSON(report: ExecutionReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Formate le rapport en PDF-ready HTML.
   */
  toPDFHTML(report: ExecutionReport, procedure?: FullProcedure): string {
    const procedureTitle = procedure?.title || report.procedureCode;
    const stepRows = (report.stepOutcomes || []).map((outcome: any) => {
      const statusLabel = outcome.status === 'completed' ? 'Complétée' : outcome.status === 'timeout' ? 'Timeout' : 'Ignorée';
      return `<tr><td>${outcome.title}</td><td>${statusLabel}</td><td>${outcome.duration}s</td><td>${new Date(outcome.finishedAt).toLocaleTimeString()}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rapport ${procedureTitle}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
  h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  .status-ok { color: #2e7d32; font-weight: bold; }
  .status-failed { color: #c62828; font-weight: bold; }
  .meta { margin: 12px 0; }
  .meta span { display: inline-block; margin-right: 24px; }
</style></head>
<body>
  <h1>Rapport d'audit industriel</h1>
  <div class="meta">
    <span><strong>Procédure :</strong> ${procedureTitle}</span>
    <span><strong>Code :</strong> ${report.procedureCode}</span>
    <span><strong>Statut :</strong> <span class="status-${report.status === 'COMPLETED' ? 'ok' : 'failed'}">${report.status}</span></span>
  </div>
  <div class="meta">
    <span><strong>Durée :</strong> ${report.duration}s</span>
    <span><strong>Progression :</strong> ${report.stepsCompleted}/${report.totalSteps}</span>
    <span><strong>Opérateur :</strong> ${report.operatorId}</span>
  </div>
  <h2>Détail des étapes</h2>
  <table>
    <tr><th>Étape</th><th>Statut</th><th>Durée</th><th>Fin</th></tr>
    ${stepRows || '<tr><td colspan="4">Aucune étape enregistrée.</td></tr>'}
  </table>
  ${report.alarmsTriggered.length > 0 ? `<h2>Incidents</h2><ul>${report.alarmsTriggered.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
  <p style="margin-top:40px;color:#888;font-size:12px;">Généré par VisioNode Precision Engine — ${new Date().toISOString()}</p>
</body></html>`;
  }
}

export const reportingService = new ReportingService();
