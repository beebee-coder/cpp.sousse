/**
 * @fileOverview Types et interfaces alignés sur le standard industriel CRF.
 * Version : Nomenclature V6.5 (Concordance Template JSON).
 */

import { JsonValue, ProcedureFallback, PostExecutionCheck, PostExecutionReporting } from '@/types/common';

export interface ProcedureMetadata {
  title: string;
  code: string;
  category: string;
  subcategory?: string;
  department: string;
  criticality: string;
  version: string;
  author: {
    id: string;
    name: string;
    role: string;
    department: string;
  };
  approvers?: Array<{
    id: string;
    name: string;
    role: string;
    approvalDate: string;
  }>;
  tags: string[];
  language: string;
  createdAt: string;
  lastUpdated: string;
  description?: string;
}

export interface PrerequisiteItem {
  id: string;
  description: string;
  condition: string;
  expectedState: string;
  verificationType: 'automatic' | 'manual';
  sensorRef?: string;
  displayName: string;
  unit?: string;
  threshold?: number;
  operator?: string;
  manualCheckInstruction?: string;
  expectedPosition?: string;
}

export interface StepValidationCondition {
  id: string;
  description: string;
  type: string;
  operator: string;
  value: number | string;
  unit?: string;
  displayName: string;
  monitoring?: boolean;
  tolerance?: number;
  critical?: boolean;
}

export interface StepAlarm {
  id: string;
  code: string;
  type: 'warning' | 'critical' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  condition?: string;
  remedy: {
    title: string;
    description: string;
    steps: string[];
    estimatedTime: number;
    tools?: string[];
    safety?: string[];
  };
  escalation?: {
    ifPersistsAfter: number;
    contact: string;
    message: string;
  };
  triggerBeforeEnd?: number;
}

export interface ConfigField {
  id: string;
  name: string;
  type: string; // 'text', 'number', 'boolean', 'select'
  description?: string;
  options?: any;
  required: boolean;
}

export interface StepCustomField {
  templateId: string;
  name: string;
  type: string;
  value: any;
  required: boolean;
}

export interface ProcedureStep {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  description: string;
  fields?: StepCustomField[];
  duration: {
    value: number;
    unit: string;
    display: string;
    type: 'fixed' | 'estimated' | 'ramp';
    animation?: boolean;
    countdown?: boolean;
  };
  action: {
    type: 'confirmation' | 'command' | 'valve_operation' | 'wait' | 'verification';
    instruction: string;
    expectedConfirmation?: string;
    command?: string;
    valveId?: string;
    operation?: 'open' | 'close' | 'adjust';
    target?: number;
    speed?: 'rapid' | 'progressive' | 'slow';
    parameters?: Record<string, JsonValue>;
    ui: {
      component: string;
      label: string;
      icon?: string;
      color?: string;
      showProgress?: boolean;
      progressDuration?: number;
      showMessage?: boolean;
    };
  };
  validation: {
    conditions: StepValidationCondition[];
    successExpression: string;
    timeout?: {
      value: number;
      unit: string;
      action: 'abort' | 'warn' | 'retry';
    };
  };
  alarms: StepAlarm[];
  fallbacks: ProcedureFallback[];
  media: {
    image?: { url: string; caption?: string; alt?: string };
    diagram?: { url: string; caption?: string };
    video?: { url: string; caption?: string; duration?: number };
  };
  /** 📸 Références vers mediaLibrary (réutilisation du média dans la séquence) */
  mediaRefs?: string[];
  notes: string[];
  dependencies: {
    prerequisites: string[];
    dependsOn: string[];
    requiresConfirmation: boolean;
  };
}

/**
 * @fileOverview Médias capturés/uploadés à la configuration de la forge,
 * réutilisables (par référence id) dans n'importe quelle étape de la séquence.
 */
export type MediaKind = 'image' | 'video';
export type MediaSource = 'capture' | 'upload';

export interface ProcedureMedia {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  title: string;
  description?: string;
  url: string;            // blob: / object URL (aperçu dans la session)
  thumbnailUrl?: string;  // miniature (image = url, vidéo = frame capturé)
  mimeType: string;
  fileSize?: number;
  duration?: number;      // Durée vidéo (s)
  createdAt: string;
  file?: File;            // Référence binaire conservée en mémoire (upload ultérieur)
}

export interface FullProcedure {
  id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  department: string;
  criticality: string;
  version: string;
  status: string;
  prerequisites: {
    description: string;
    items: PrerequisiteItem[];
  };
  steps: ProcedureStep[];
  parameters?: {
    variables: Array<{
      id: string;
      name: string;
      value: string | number | boolean;
      unit?: string;
      type: string;
      min?: number;
      max?: number;
      description?: string;
    }>;
  };
  postExecution?: {
    checks: PostExecutionCheck[];
    reporting: PostExecutionReporting;
  };
  metadata: ProcedureMetadata;
  /** 📸 Bibliothèque de médias capturés/uploadés à la configuration */
  mediaLibrary?: ProcedureMedia[];
  authorId?: string;
  createdAt: Date;
  updatedAt: Date;
  author?: {
    firstName: string;
    lastName: string;
    role?: string;
  };
}

export type ExecutionStatus = 
  | 'IDLE' 
  | 'PREREQUISITES_CHECK' 
  | 'RUNNING' 
  | 'PAUSED' 
  | 'WAITING_CONFIRMATION' 
  | 'ALARM' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'ABORTED';
