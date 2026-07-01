/**
 * @fileOverview Types et interfaces reformés pour le système VisioNode Precision.
 * Version : Nomenclature V6.0 (Prisma JSON compliant).
 */

export interface ProcedureMetadata {
  title: string;
  code: string;
  category: string;
  department: string;
  criticality: string;
  version: string;
  author: {
    id: string;
    name: string;
    role: string;
    department: string;
  };
  tags: string[];
  language: string;
  forged_at?: string;
  traceId?: string;
  description?: string;
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
  };
  action: {
    type: 'confirmation' | 'command' | 'valve_operation' | 'wait' | 'verification';
    instruction: string;
    target?: number;
    command?: string;
    ui: {
      component: string;
      label: string;
      icon?: string;
      color?: string;
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
  department: string;
  criticality: string;
  version: string;
  status: string;
  prerequisites: {
    description: string;
    items: any[];
  };
  steps: ProcedureStep[];
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
