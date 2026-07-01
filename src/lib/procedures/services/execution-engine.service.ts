import { FullProcedure, ExecutionStatus, ProcedureStep } from '../types';

/**
 * @fileOverview Moteur d'exécution des procédures industrielles [EXEC_ENGINE].
 * Gère les transitions d'états et le cycle de vie d'une exécution réelle.
 */

export interface ExecutionState {
  currentStepIndex: number;
  status: ExecutionStatus;
  startTime: number | null;
  endTime: number | null;
  stepStartTime: number | null;
  elapsedTime: number;
  completedSteps: string[];
  activeAlarms: string[];
}

export type InternalExecutionStatus = 
  | 'IDLE' 
  | 'PREREQUISITES_CHECK' 
  | 'RUNNING' 
  | 'PAUSED' 
  | 'WAITING_CONFIRMATION' 
  | 'ALARM' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'ABORTED';

export class ExecutionEngine {
  private procedure: FullProcedure;
  private state: ExecutionState;

  constructor(procedure: FullProcedure) {
    this.procedure = procedure;
    this.state = {
      currentStepIndex: -1, 
      status: 'IDLE' as ExecutionStatus,
      startTime: null,
      endTime: null,
      stepStartTime: null,
      elapsedTime: 0,
      completedSteps: [],
      activeAlarms: [],
    };
    console.log(`⚙️ [EXEC_ENGINE] [INIT] Moteur chargé pour : ${procedure.code}`);
  }

  start(): ExecutionState {
    this.state.status = 'PREREQUISITES_CHECK' as ExecutionStatus;
    this.state.startTime = Date.now();
    console.log(`⚙️ [EXEC_ENGINE] [STEP] Séquence démarrée. Phase : PREREQUISITES_CHECK`);
    return { ...this.state };
  }

  confirmPrerequisites(): ExecutionState {
    if (this.state.status !== ('PREREQUISITES_CHECK' as ExecutionStatus)) return this.state;
    this.state.currentStepIndex = 0;
    this.state.status = 'RUNNING' as ExecutionStatus;
    this.state.stepStartTime = Date.now();
    console.log(`⚙️ [EXEC_ENGINE] [STEP] Prérequis validés. Entrée Étape 1`);
    return { ...this.state };
  }

  nextStep(): ExecutionState {
    const steps = this.procedure.steps;
    const currentStep = steps[this.state.currentStepIndex];
    if (!currentStep) return this.state;

    this.state.completedSteps.push(currentStep.id);
    console.log(`✅ [EXEC_STEP] [DONE] Étape validée : ${currentStep.title}`);
    
    if (this.state.currentStepIndex < steps.length - 1) {
      this.state.currentStepIndex++;
      this.state.stepStartTime = Date.now();
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`⚙️ [EXEC_STEP] [NEXT] Entrée Étape ${this.state.currentStepIndex + 1}`);
    } else {
      this.state.status = 'COMPLETED' as ExecutionStatus;
      this.state.endTime = Date.now();
      console.log(`🏁 [EXEC_ENGINE] [SUCCESS] Procédure terminée.`);
    }

    return { ...this.state };
  }

  triggerAlarm(alarmCode: string): ExecutionState {
    this.state.status = 'ALARM' as ExecutionStatus;
    if (!this.state.activeAlarms.includes(alarmCode)) {
      this.state.activeAlarms.push(alarmCode);
    }
    console.error(`🚨 [EXEC_ALARM] [TRIGGER] Alerte détectée : ${alarmCode}`);
    return { ...this.state };
  }

  resolveAlarm(alarmCode: string): ExecutionState {
    this.state.activeAlarms = this.state.activeAlarms.filter(a => a !== alarmCode);
    if (this.state.activeAlarms.length === 0) {
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`🛡️ [EXEC_ALARM] [RESOLVED] Alerte résolue : ${alarmCode}. Reprise du flux.`);
    }
    return { ...this.state };
  }

  getState(): ExecutionState {
    return { ...this.state };
  }
}
