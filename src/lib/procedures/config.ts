/**
 * @fileOptions Valeurs dynamiques extraites de procedure-demarrage-CRF.json
 * pour les menus déroulants du formuaire de configuration.
 */

export const PROCEDURE_CATEGORIES = [
  'STARTUP',
  'SHUTDOWN',
  'MAINTENANCE',
  'EMERGENCY',
  'OPERATION',
] as const;

export const PROCEDURE_SUBCATEGORIES = [
  'pump_startup',
  'valve_operation',
  'motor_startup',
  'safety_check',
  'system_test',
  'refrigeration',
  'critical',
] as const;

export const PROCEDURE_DEPARTMENTS = [
  'Production',
  'Maintenance',
  'Electrical',
  'Safety',
  'Quality',
  'Operations',
  'IT',
] as const;

export const PROCEDURE_CRITICALITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const PROCEDURE_LANGUAGES = [
  'fr-FR',
  'en-US',
  'ar-SA',
] as const;

export const ACTION_TYPES = [
  'confirmation',
  'valve_operation',
  'command',
  'wait',
  'verification',
] as const;

export const VALIDATION_TYPES = [
  'pressure',
  'status',
  'voltage',
  'position',
  'temperature',
  'time',
  'manual',
] as const;

export const ALARM_TYPES = [
  'warning',
  'critical',
  'info',
] as const;

export const ALARM_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const TIMEOUT_ACTIONS = [
  'abort',
  'warn',
  'retry',
] as const;

export const VALVE_OPERATIONS = [
  'open',
  'close',
  'adjust',
] as const;

export const SPEED_MODES = [
  'rapid',
  'progressive',
  'slow',
] as const;

export const VERIFICATION_TYPES = [
  'manual',
  'automatic',
] as const;

export type ProcedureCategory = typeof PROCEDURE_CATEGORIES[number];
export type ProcedureSubcategory = typeof PROCEDURE_SUBCATEGORIES[number];
export type ProcedureDepartment = typeof PROCEDURE_DEPARTMENTS[number];
export type ProcedureCriticality = typeof PROCEDURE_CRITICALITIES[number];
export type ActionType = typeof ACTION_TYPES[number];
export type ValidationType = typeof VALIDATION_TYPES[number];
export type AlarmType = typeof ALARM_TYPES[number];
export type AlarmSeverity = typeof ALARM_SEVERITIES[number];
export type TimeoutAction = typeof TIMEOUT_ACTIONS[number];
export type ValveOperation = typeof VALVE_OPERATIONS[number];
export type SpeedMode = typeof SPEED_MODES[number];

export interface ProcedureDefaults {
  category: string;
  subcategory: string;
  department: string;
  criticality: string;
  language: string;
  defaultActionType: string;
  defaultValidationType: string;
  defaultAlarmType: string;
  defaultAlarmSeverity: string;
  defaultTimeoutAction: string;
  defaultValveOperation: string;
  defaultSpeedMode: string;
  defaultDuration: number;
  defaultUiLabel: string;
  defaultSuccessExpression: string;
  /** Option : activer la capture/upload de médias (image/vidéo) dans la séquence */
  enableMedia: boolean;
}

export const DEFAULT_PROCEDURE_DEFAULTS: ProcedureDefaults = {
  category: 'STARTUP',
  subcategory: 'pump_startup',
  department: 'Production',
  criticality: 'MEDIUM',
  language: 'fr-FR',
  defaultActionType: 'confirmation',
  defaultValidationType: 'status',
  defaultAlarmType: 'warning',
  defaultAlarmSeverity: 'medium',
  defaultTimeoutAction: 'abort',
  defaultValveOperation: 'open',
  defaultSpeedMode: 'progressive',
  defaultDuration: 60,
  defaultUiLabel: 'Confirmer',
  defaultSuccessExpression: 'status == OK',
  enableMedia: false,
};
