/**
 * @fileOverview Types et interfaces pour le système de procédures industrielles.
 * Basé sur le format procedure-v2.json (référence CRF).
 */

export type ProcedureCategory = 
  | 'STARTUP' | 'SHUTDOWN' | 'MAINTENANCE' | 'EMERGENCY' 
  | 'INSPECTION' | 'CLEANING' | 'CALIBRATION' | 'REPAIR' 
  | 'OPERATION' | 'SAFETY';

export type Department = 'PRODUCTION' | 'MAINTENANCE' | 'QUALITY' | 'SAFETY' | 'LOGISTICS';
export type Criticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProcedureStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' | 'OBSOLETE';
export type ExecutionStatus = 'IDLE' | 'PREREQUISITES_CHECK' | 'RUNNING' | 'PAUSED' | 'WAITING_CONFIRMATION' | 'ALARM' | 'COMPLETED' | 'FAILED' | 'ABORTED';
export type AlarmType = 'WARNING' | 'CRITICAL' | 'INFO';
export type AlarmSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlarmStatus = 'ACTIVE' | 'RESOLVED' | 'IGNORED' | 'ESCALATED';
export type DocumentType = 'IMAGE' | 'VIDEO' | 'DIAGRAM' | 'PDF' | 'MODEL';

export interface ProcedureMetadata {
  title: string;
  code: string;
  category: string;
  subcategory?: string;
  department: Department;
  criticality: Criticality;
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
  createdAt: string;
  lastUpdated: string;
  reviewDate?: string;
  tags: string[];
  language: string;
}

export interface Prerequisite {
  id: string;
  description: string;
  condition?: string;
  expectedState: string;
  verificationType: 'automatic' | 'manual';
  sensorRef?: string;
  displayName: string;
  unit?: string;
  threshold?: number;
  operator?: string;
  manualCheckInstruction?: string;
}

export interface StepAction {
  type: 'confirmation' | 'command' | 'valve_operation' | 'wait' | 'input';
  instruction: string;
  command?: string;
  parameters?: Record<string, any>;
  valveId?: string;
  operation?: string;
  target?: number;
  speed?: string;
  ui: {
    component: string;
    label: string;
    icon?: string;
    color?: string;
    showProgress?: boolean;
    progressDuration?: number;
  };
}

export interface StepValidation {
  conditions: Array<{
    id: string;
    description: string;
    type: string;
    operator: string;
    value: any;
    unit?: string;
    displayName: string;
    monitoring?: boolean;
    tolerance?: number;
    critical?: boolean;
  }>;
  successExpression: string;
  timeout: {
    value: number;
    unit: 'seconds' | 'minutes';
    action: 'abort' | 'warn' | 'retry';
  };
}

export interface StepAlarm {
  id: string;
  code: string;
  type: AlarmType;
  severity: AlarmSeverity;
  description: string;
  condition: string;
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
}

export interface StepFallback {
  id: string;
  title: string;
  description: string;
  condition: string;
  action: string;
  estimatedTime: number;
}

export interface StepMedia {
  image?: { url: string; caption?: string; alt?: string };
  diagram?: { url: string; caption?: string };
  video?: { url: string; caption?: string; duration?: number };
}

export interface ProcedureStep {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  description: string;
  duration: {
    value: number;
    unit: string;
    display: string;
    type: 'fixed' | 'estimated';
    countdown?: boolean;
    animation?: boolean;
  };
  action: StepAction;
  validation: StepValidation;
  alarms?: StepAlarm[];
  fallbacks?: StepFallback[];
  dependencies: {
    prerequisites: string[];
    dependsOn: string[];
    requiresConfirmation: boolean;
  };
  media?: StepMedia;
  notes?: string[];
}

export interface PostExecutionCheck {
  id: string;
  description: string;
  condition: string;
  interval?: number;
  monitoring: boolean;
  manualCheck?: boolean;
}

export interface ProcedureVariable {
  id: string;
  name: string;
  value: any;
  unit: string;
  type: 'float' | 'integer' | 'boolean' | 'string';
  min?: number;
  max?: number;
  description: string;
}

export interface FullProcedure {
  id: string;
  code: string;
  title: string;
  metadata: ProcedureMetadata;
  prerequisites: {
    description: string;
    items: Prerequisite[];
  };
  steps: ProcedureStep[];
  postExecution: {
    checks: PostExecutionCheck[];
    reporting: {
      generateReport: boolean;
      reportFields: string[];
    };
  };
  parameters: {
    variables: ProcedureVariable[];
  };
}
