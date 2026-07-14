"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { FullProcedure, ProcedureStep } from '../types';
import { ExecutionEngine, ExecutionState, StepOutcome } from '../services/execution-engine.service';

const WARNING_THRESHOLD = 0.8;

interface UseProcedureExecutionOptions {
  procedure: FullProcedure;
  onComplete?: (report: any) => void;
}

interface UseProcedureExecutionReturn {
  status: ExecutionState['status'];
  currentStepIndex: number;
  currentStep: ProcedureStep | null;
  totalSteps: number;
  elapsed: number;
  isPaused: boolean;
  stepReport: StepOutcome[];
  alarm: string[] | null;
  confirmedPrerequisites: string[];
  progress: number;
  isRunning: boolean;
  isCompleted: boolean;
  isAborted: boolean;
  isAlarm: boolean;
  start: () => void;
  nextStep: (elapsed?: number, hasAlarm?: boolean) => void;
  previousStep: () => void;
  skipStep: (elapsed?: number) => void;
  repeatStep: () => void;
  togglePause: () => void;
  triggerAlarm: (code: string) => void;
  resolveAlarm: (code: string) => void;
    confirmPrerequisite: (id: string) => string[];
    confirmAllPrerequisites: () => string[];
  abort: () => void;
  restart: () => void;
  exportJson: () => void;
}

export function useProcedureExecution({ procedure, onComplete }: UseProcedureExecutionOptions): UseProcedureExecutionReturn {
  const [engine] = useState(() => new ExecutionEngine(procedure));
  const [state, setState] = useState<ExecutionState>(() => engine.getState());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartRef = useRef<number>(Date.now());

  const currentStep = state.currentStepIndex >= 0 ? procedure.steps[state.currentStepIndex] : null;
  const totalSteps = procedure.steps.length;

  const syncState = useCallback(() => {
    setState(engine.getState());
  }, [engine]);

  useEffect(() => {
    engine.getState();
  }, [procedure, engine]);

  // Timer
  useEffect(() => {
    if (state.status !== 'RUNNING') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    stepStartRef.current = Date.now() - (elapsed * 1000);
    timerRef.current = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - stepStartRef.current) / 1000);
      setElapsed(currentElapsed);
      
      const step = procedure.steps[state.currentStepIndex];
      if (step?.duration.value) {
        const pct = currentElapsed / step.duration.value;
        if (pct >= WARNING_THRESHOLD && pct < WARNING_THRESHOLD + 0.05) {
          const remaining = step.duration.value - currentElapsed;
          console.log(`[EXEC_TIMER] [WARNING] Attention, il reste ${remaining} secondes pour cette étape.`);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status, state.currentStepIndex, procedure.steps]);

  const start = useCallback(() => {
    const newState = engine.start();
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();
  }, [engine]);

  const nextStep = useCallback((stepElapsed: number = 0, hasAlarm: boolean = false) => {
    const newState = engine.nextStep(stepElapsed, hasAlarm);
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();

    if (newState.status === 'COMPLETED' && onComplete) {
      onComplete(newState);
    }
  }, [engine, onComplete]);

  const previousStep = useCallback(() => {
    const newState = engine.previousStep();
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();
  }, [engine]);

  const skipStep = useCallback((stepElapsed: number = 0) => {
    const newState = engine.skipStep(stepElapsed);
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();
  }, [engine]);

  const repeatStep = useCallback(() => {
    const newState = engine.repeatStep();
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();
  }, [engine]);

  const togglePause = useCallback(() => {
    const newState = state.status === 'PAUSED' ? engine.resume() : engine.pause();
    setState(newState);
  }, [engine, state.status]);

  const triggerAlarm = useCallback((code: string) => {
    const newState = engine.triggerAlarm(code);
    setState(newState);
  }, [engine]);

  const resolveAlarm = useCallback((code: string) => {
    const newState = engine.resolveAlarm(code);
    setState(newState);
  }, [engine]);

  const confirmPrerequisite = useCallback((id: string): string[] => {
    const newState = engine.confirmNextPrerequisite(id);
    setState(newState);
    return newState.confirmedPrerequisites;
  }, [engine]);

  const confirmAllPrerequisites = useCallback((): string[] => {
    const newState = engine.confirmPrerequisites();
    setState(newState);
    return newState.confirmedPrerequisites;
  }, [engine]);

  const abort = useCallback(() => {
    const newState = engine.abort();
    setState(newState);
  }, [engine]);

  const restart = useCallback(() => {
    const newState = engine.start();
    setState(newState);
    setElapsed(0);
    stepStartRef.current = Date.now();
  }, [engine]);

  const exportJson = useCallback(() => {
    const report = {
      procedure: procedure.metadata.title,
      code: procedure.metadata.code,
      completedAt: new Date().toISOString(),
      totalDuration: state.stepOutcomes.reduce((sum: number, r: StepOutcome) => sum + r.duration, 0),
      steps: state.stepOutcomes,
      postExecution: procedure.postExecution,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${procedure.metadata.code}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [engine, procedure, state.stepOutcomes]);

  const progress = totalSteps > 0 ? ((state.currentStepIndex) / totalSteps) * 100 : 0;

  return {
    status: state.status,
    currentStepIndex: state.currentStepIndex,
    currentStep,
    totalSteps,
    elapsed,
    isPaused: state.status === 'PAUSED',
    stepReport: state.stepOutcomes,
    alarm: state.activeAlarms.length > 0 ? state.activeAlarms : null,
    confirmedPrerequisites: state.confirmedPrerequisites,
    progress,
    isRunning: state.status === 'RUNNING',
    isCompleted: state.status === 'COMPLETED',
    isAborted: state.status === 'ABORTED',
    isAlarm: state.status === 'ALARM',
    start,
    nextStep,
    previousStep,
    skipStep,
    repeatStep,
    togglePause,
    triggerAlarm,
    resolveAlarm,
    confirmPrerequisite,
    confirmAllPrerequisites,
    abort,
    restart,
    exportJson,
  };
}
