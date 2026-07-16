import { describe, it, expect } from 'vitest';
import { validateProcedurePayload } from './validator.service';

describe('validateProcedurePayload', () => {
  it('should validate a correct procedure payload', () => {
    const payload = {
      metadata: {
        title: 'Procédure de Test',
        code: 'PROC-TEST-01',
        category: 'OPERATION',
        department: 'PRODUCTION',
        criticality: 'HIGH',
        version: '1.0.0'
      },
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

  it('should return error if metadata is missing', () => {
    const payload = {
      steps: [],
      prerequisites: {}
    };

    expect(validateProcedurePayload(payload)).toContain('metadata');
  });

  it('should return error if steps is not an array', () => {
    const payload = {
      metadata: {
        title: 'Test',
        code: 'TEST',
        category: 'OP',
        department: 'DEP',
        criticality: 'MED',
        version: '1.0'
      },
      steps: 'not-an-array',
      prerequisites: {}
    };

    expect(validateProcedurePayload(payload)).toContain('steps');
  });

  it('should return error if steps are missing required fields', () => {
    const payload = {
      metadata: {
        title: 'Test',
        code: 'TEST',
        category: 'OP',
        department: 'DEP',
        criticality: 'MED',
        version: '1.0'
      },
      steps: [
        {
          id: 'step-1',
          // order is missing
          title: 'Step 1'
        }
      ],
      prerequisites: {}
    };

    expect(validateProcedurePayload(payload)).toContain('order');
  });
});
