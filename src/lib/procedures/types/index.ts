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
    type: string;
    instruction: string;
    target?: number;
    ui: {
      component: string;
      label: string;
      icon?: string;
    };
  };
  validation: {
    conditions: any[];
    successExpression: string;
    timeout: {
      value: number;
      unit: string;
      action: string;
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
