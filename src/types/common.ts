export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AppError = Error & { code?: string; status?: number };

export interface ProcedureFallback {
  id: string;
  actionType: 'retry' | 'abort' | 'skip' | 'manual_override' | 'alternative_step';
  description: string;
  parameters?: Record<string, JsonValue>;
}

export interface PostExecutionCheck {
  id: string;
  type: 'visual' | 'sensor' | 'manual';
  description: string;
  expectedResult: string;
}

export interface PostExecutionReporting {
  required: boolean;
  format: 'pdf' | 'json' | 'system';
  recipients?: string[];
}
