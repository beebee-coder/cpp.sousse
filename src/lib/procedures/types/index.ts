/**
 * @fileOverview Types et interfaces alignés sur le standard industriel CRF.
 * Version : Nomenclature V6.5 (Concordance Template JSON).
 */

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
    parameters?: Record<string, any>;
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
    timeout: {
      value: number;
      unit: string;
      action: 'abort' | 'warn' | 'retry';
    };
  };
  alarms: StepAlarm[];
  fallbacks: any[];
  media: {
    image?: { url: string; caption?: string; alt?: string };
    diagram?: { url: string; caption?: string };
    video?: { url: string; caption?: string; duration?: number };
  };
  notes: string[];
  dependencies: {
    prerequisites: string[];
    dependsOn: string[];
    requiresConfirmation: boolean;
  };
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
      value: any;
      unit?: string;
      type: string;
      min?: number;
      max?: number;
      description?: string;
    }>;
  };
  postExecution?: {
    checks: any[];
    reporting: any;
  };
  metadata: ProcedureMetadata;
  authorId?: string;
  createdAt: Date;
  updatedAt: Date;
  author?: {
    firstName: string;
    lastName: string;
    role?: string;
  };
}
