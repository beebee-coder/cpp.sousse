import { FullProcedure, ExecutionStatus, ProcedureStep, StepAction, StepValidation } from '../types';

/**
 * @fileOverview Moteur d'exécution des procédures industrielles.
 * Gère les transitions d'états et le cycle de vie d'une exécution.
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

export class ExecutionEngine {
  private procedure: FullProcedure;
  private state: ExecutionState;

  constructor(procedure: FullProcedure) {
    this.procedure = procedure;
    this.state = {
      currentStepIndex: -1, // -1 means prerequisites check
      status: 'IDLE',
      startTime: null,
      endTime: null,
      stepStartTime: null,
      elapsedTime: 0,
      completedSteps: [],
      activeAlarms: [],
    };
  }

  /**
   * Démarre la procédure (Phase de vérification des prérequis)
   */
  start(): ExecutionState {
    this.state.status = 'PREREQUISITES_CHECK';
    this.state.startTime = Date.now();
    return { ...this.state };
  }

  /**
   * Valide les prérequis et passe à la première étape
   */
  confirmPrerequisites(): ExecutionState {
    if (this.state.status !== 'PREREQUISITES_CHECK') return this.state;
    this.state.currentStepIndex = 0;
    this.state.status = 'RUNNING';
    this.state.stepStartTime = Date.now();
    return { ...this.state };
  }

  /**
   * Passe à l'étape suivante après validation
   */
  nextStep(): ExecutionState {
    const currentStep = this.procedure.steps[this.state.currentStepIndex];
    if (!currentStep) return this.state;

    this.state.completedSteps.push(currentStep.id);
    
    if (this.state.currentStepIndex < this.procedure.steps.length - 1) {
      this.state.currentStepIndex++;
      this.state.stepStartTime = Date.now();
      this.state.status = 'RUNNING';
    } else {
      this.state.status = 'COMPLETED';
      this.state.endTime = Date.now();
    }

    return { ...this.state };
  }

  /**
   * Déclenche une alarme
   */
  triggerAlarm(alarmCode: string): ExecutionState {
    this.state.status = 'ALARM';
    if (!this.state.activeAlarms.includes(alarmCode)) {
      this.state.activeAlarms.push(alarmCode);
    }
    return { ...this.state };
  }

  /**
   * Résout une alarme et reprend l'exécution
   */
  resolveAlarm(alarmCode: string): ExecutionState {
    this.state.activeAlarms = this.state.activeAlarms.filter(a => a !== alarmCode);
    if (this.state.activeAlarms.length === 0) {
      this.state.status = 'RUNNING';
    }
    return { ...this.state };
  }

  getState(): ExecutionState {
    return { ...this.state };
  }
}
