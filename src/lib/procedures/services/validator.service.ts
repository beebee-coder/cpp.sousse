import { CreateProcedureSchema } from '../validators/procedure.validator';

export function validateProcedurePayload(payload: unknown): string | null {
  const result = CreateProcedureSchema.safeParse(payload);
  if (!result.success) {
    const first = result.error.errors[0];
    return first ? `Validation failed: ${first.path.join('.')} — ${first.message}` : 'Validation failed';
  }
  return null;
}

export function validateProcedureStructure(procedure: any): string | null {
  if (!procedure) return 'Procedure manquante';
  if (!procedure.title || typeof procedure.title !== 'string') return 'Title requis';
  if (!procedure.code || typeof procedure.code !== 'string') return 'Code requis';
  if (!procedure.category || typeof procedure.category !== 'string') return 'Category requise';
  if (!Array.isArray(procedure.steps) || procedure.steps.length === 0) return 'Au moins une étape requise';

  for (const step of procedure.steps) {
    if (!step || typeof step !== 'object') return 'Chaque step doit être un objet';
    if (!step.id || typeof step.id !== 'string') return `Step missing id`;
    if (typeof step.order !== 'number') return `Step ${step.id}: order requis (number)`;
    if (!step.title || typeof step.title !== 'string') return `Step ${step.id}: title requis`;
    if (!step.action || typeof step.action !== 'object') return `Step ${step.id}: action requis (object)`;
    if (!step.validation || typeof step.validation !== 'object') return `Step ${step.id}: validation requis (object)`;
  }

  return null;
}
