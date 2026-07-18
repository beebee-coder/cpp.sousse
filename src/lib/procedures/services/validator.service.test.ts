import { describe, it, expect } from 'vitest';
import { validateProcedurePayload, validateProcedureStructure } from './validator.service';

describe('validateProcedurePayload', () => {
  it('should validate a correct procedure payload', () => {
    const payload = {
      title: 'Procédure de Test',
      code: 'PROC-TEST-01',
      category: 'OPERATION',
      criticality: 'HIGH',
      status: 'DRAFT',
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Initialisation',
          action: {
            type: 'confirmation',
            instruction: 'Confirmer le démarrage.'
          },
          validation: {
            conditions: [],
            successExpression: 'true'
          }
        }
      ],
      prerequisites: {
        description: 'Conditions standard',
        items: []
      }
    };

    expect(validateProcedurePayload(payload)).toBeNull();
  });

  it('should return error if title is missing', () => {
    const payload = {
      code: 'TEST',
      category: 'OP',
      steps: [],
      prerequisites: { description: 'x', items: [] }
    };

    expect(validateProcedurePayload(payload)).toContain('title');
  });

  it('should return error if steps is not an array', () => {
    const payload = {
      title: 'Test',
      code: 'TEST',
      category: 'OP',
      steps: 'not-an-array',
      prerequisites: { description: 'x', items: [] }
    };

    expect(validateProcedurePayload(payload)).toContain('steps');
  });

  it('should return error if steps are missing required fields', () => {
    const payload = {
      title: 'Test',
      code: 'TEST',
      category: 'OP',
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Step 1'
        }
      ],
      prerequisites: { description: 'x', items: [] }
    };

    expect(validateProcedurePayload(payload)).toContain('action');
  });
});

describe('validateProcedureStructure', () => {
  it('should validate a correct procedure object', () => {
    const procedure = {
      title: 'Proc Test',
      code: 'PROC-01',
      category: 'OP',
      steps: [{ id: 's1', order: 1, title: 'A', action: {}, validation: {} }]
    };
    expect(validateProcedureStructure(procedure)).toBeNull();
  });

  it('should return error if procedure is null', () => {
    expect(validateProcedureStructure(null)).toContain('manquante');
  });

  it('should return error if no steps', () => {
    const procedure = { title: 'T', code: 'C', category: 'OP', steps: [] };
    expect(validateProcedureStructure(procedure)).toContain('Au moins une étape');
  });
});
