import { FullProcedure, ExecutionStatus, ProcedureStep } from '../types';

export interface StepOutcome {
  stepId: string;
  title: string;
  status: 'completed' | 'skipped' | 'timeout';
  duration: number;
  startedAt: string;
  finishedAt: string;
  alarms?: string[];
}

export interface ExecutionState {
  currentStepIndex: number;
  status: ExecutionStatus;
  startTime: number | null;
  endTime: number | null;
  stepStartTime: number | null;
  elapsedTime: number;
  completedSteps: string[];
  skippedSteps: string[];
  timedOutSteps: string[];
  activeAlarms: string[];
  currentPrerequisiteIndex: number;
  confirmedPrerequisites: string[];
  stepOutcomes: StepOutcome[];
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
      skippedSteps: [],
      timedOutSteps: [],
      activeAlarms: [],
      currentPrerequisiteIndex: 0,
      confirmedPrerequisites: [],
      stepOutcomes: [],
    };
    console.log(`[EXEC_ENGINE] [INIT] Moteur chargé pour : ${procedure.code}`);
  }

  start(): ExecutionState {
    this.state.status = 'PREREQUISITES_CHECK' as ExecutionStatus;
    this.state.startTime = Date.now();
    console.log(`[EXEC_ENGINE] [STEP] Séquence démarrée. Phase : PREREQUISITES_CHECK`);
    return { ...this.state };
  }

  confirmPrerequisites(): ExecutionState {
    if (this.state.status !== ('PREREQUISITES_CHECK' as ExecutionStatus)) return this.state;
    
    const prerequisites = this.procedure.prerequisites.items;
    const remaining = prerequisites.filter(p => !this.state.confirmedPrerequisites.includes(p.id));
    
    if (remaining.length === 0) {
      this.state.currentStepIndex = 0;
      this.state.status = 'RUNNING' as ExecutionStatus;
      this.state.stepStartTime = Date.now();
      console.log(`[EXEC_ENGINE] [STEP] Prérequis validés. Entrée Étape 1`);
    }
    
    return { ...this.state };
  }

  confirmNextPrerequisite(prerequisiteId: string): ExecutionState {
    if (this.state.status !== ('PREREQUISITES_CHECK' as ExecutionStatus)) return this.state;
    
    if (!this.state.confirmedPrerequisites.includes(prerequisiteId)) {
      this.state.confirmedPrerequisites.push(prerequisiteId);
      console.log(`[EXEC_PREREQ] [CONFIRMED] ${prerequisiteId}`);
    }
    
    const prerequisites = this.procedure.prerequisites.items;
    const remaining = prerequisites.filter(p => !this.state.confirmedPrerequisites.includes(p.id));
    
    if (remaining.length === 0) {
      this.state.currentStepIndex = 0;
      this.state.status = 'RUNNING' as ExecutionStatus;
      this.state.stepStartTime = Date.now();
      console.log(`[EXEC_ENGINE] [STEP] Prérequis validés. Entrée Étape 1`);
    } else {
      this.state.currentPrerequisiteIndex = prerequisites.indexOf(remaining[0]);
    }
    
    return { ...this.state };
  }

  nextStep(elapsed: number = 0, hasAlarm: boolean = false): ExecutionState {
    const steps = this.procedure.steps;
    const currentStep = steps[this.state.currentStepIndex];
    if (!currentStep) return this.state;

    const isTimeout = elapsed > currentStep.duration.value;
    const stepStatus: 'completed' | 'timeout' = isTimeout ? 'timeout' : 'completed';
    this.recordStepOutcome(currentStep, stepStatus, elapsed, hasAlarm);

    if (isTimeout) {
      const timeoutAction = currentStep.validation.timeout?.action || 'warn';
      if (timeoutAction === 'abort') {
        this.state.status = 'FAILED' as ExecutionStatus;
        this.state.endTime = Date.now();
        this.state.timedOutSteps.push(currentStep.id);
        console.error(`[EXEC_ENGINE] [FAILED] Timeout sur "${currentStep.title}". Procédure interrompue.`);
        return { ...this.state };
      } else if (timeoutAction === 'warn') {
        this.state.timedOutSteps.push(currentStep.id);
        console.warn(`[EXEC_ENGINE] [TIMEOUT_WARN] "${currentStep.title}" dépasse la durée prévue.`);
      }
    }

    this.state.completedSteps.push(currentStep.id);
    console.log(`[EXEC_STEP] [DONE] Étape validée : ${currentStep.title}`);
    
    if (this.state.currentStepIndex < steps.length - 1) {
      this.state.currentStepIndex++;
      this.state.stepStartTime = Date.now();
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`[EXEC_STEP] [NEXT] Entrée Étape ${this.state.currentStepIndex + 1}`);
    } else {
      this.state.status = 'COMPLETED' as ExecutionStatus;
      this.state.endTime = Date.now();
      console.log(`[EXEC_ENGINE] [SUCCESS] Procédure terminée.`);
    }

    return { ...this.state };
  }

  skipStep(elapsed: number = 0): ExecutionState {
    const steps = this.procedure.steps;
    const currentStep = steps[this.state.currentStepIndex];
    if (!currentStep) return this.state;

    this.recordStepOutcome(currentStep, 'skipped', elapsed, false);
    this.state.skippedSteps.push(currentStep.id);

    if (this.state.currentStepIndex < steps.length - 1) {
      this.state.currentStepIndex++;
      this.state.stepStartTime = Date.now();
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`[EXEC_STEP] [SKIP] Étape ignorée : ${currentStep.title}`);
    } else {
      this.state.status = 'COMPLETED' as ExecutionStatus;
      this.state.endTime = Date.now();
    }

    return { ...this.state };
  }

  previousStep(): ExecutionState {
    if (this.state.currentStepIndex > 0) {
      this.state.currentStepIndex--;
      this.state.stepStartTime = Date.now();
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`[EXEC_STEP] [PREV] Retour à l'étape ${this.state.currentStepIndex + 1}`);
    }
    return { ...this.state };
  }

  repeatStep(): ExecutionState {
    this.state.stepStartTime = Date.now();
    this.state.status = 'RUNNING' as ExecutionStatus;
    console.log(`[EXEC_STEP] [REPEAT] Rappel étape ${this.state.currentStepIndex + 1}`);
    return { ...this.state };
  }

  pause(): ExecutionState {
    if (this.state.status === 'RUNNING' as ExecutionStatus) {
      this.state.status = 'PAUSED' as ExecutionStatus;
      console.log(`[EXEC_ENGINE] [PAUSE] Procédure en pause`);
    }
    return { ...this.state };
  }

  resume(): ExecutionState {
    if (this.state.status === 'PAUSED' as ExecutionStatus) {
      this.state.status = 'RUNNING' as ExecutionStatus;
      this.state.stepStartTime = Date.now() - (this.state.elapsedTime * 1000);
      console.log(`[EXEC_ENGINE] [RESUME] Reprise de la procédure`);
    }
    return { ...this.state };
  }

  triggerAlarm(alarmCode: string): ExecutionState {
    this.state.status = 'ALARM' as ExecutionStatus;
    if (!this.state.activeAlarms.includes(alarmCode)) {
      this.state.activeAlarms.push(alarmCode);
    }
    console.error(`[EXEC_ALARM] [TRIGGER] Alerte détectée : ${alarmCode}`);
    return { ...this.state };
  }

  resolveAlarm(alarmCode: string): ExecutionState {
    this.state.activeAlarms = this.state.activeAlarms.filter(a => a !== alarmCode);
    if (this.state.activeAlarms.length === 0) {
      this.state.status = 'RUNNING' as ExecutionStatus;
      console.log(`[EXEC_ALARM] [RESOLVED] Alerte résolue : ${alarmCode}. Reprise du flux.`);
    }
    return { ...this.state };
  }

  abort(): ExecutionState {
    this.state.status = 'ABORTED' as ExecutionStatus;
    this.state.endTime = Date.now();
    console.error(`[EXEC_ENGINE] [ABORT] Procédure interrompue.`);
    return { ...this.state };
  }

  fail(reason: string): ExecutionState {
    this.state.status = 'FAILED' as ExecutionStatus;
    this.state.endTime = Date.now();
    console.error(`[EXEC_ENGINE] [FAIL] Échec système: ${reason}`);
    return { ...this.state };
  }

  getState(): ExecutionState {
    return { ...this.state };
  }

  private recordStepOutcome(step: ProcedureStep, status: 'completed' | 'skipped' | 'timeout', duration: number, hasAlarm: boolean) {
    this.state.stepOutcomes.push({
      stepId: step.id,
      title: step.title,
      status,
      duration,
      startedAt: new Date(this.state.stepStartTime || Date.now()).toISOString(),
      finishedAt: new Date().toISOString(),
      alarms: hasAlarm ? [...this.state.activeAlarms] : undefined,
    });
  }
}
