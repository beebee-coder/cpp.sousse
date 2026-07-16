import { z } from 'zod';

export const ProcedureStepSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  action: z.object({
    type: z.string(),
    instruction: z.string().min(1),
  }),
  validation: z.object({
    conditions: z.array(z.object({
      id: z.string(),
      displayName: z.string(),
    })),
    successExpression: z.string().min(1),
  }),
});

export const ProcedurePrerequisitesSchema = z.object({
  description: z.string().min(1),
  items: z.array(z.object({
    id: z.string(),
    description: z.string().min(1),
    condition: z.string().min(1),
    expectedState: z.string().min(1),
    verificationType: z.enum(['automatic', 'manual']),
    displayName: z.string().min(1),
  })).optional(),
});

export const CreateProcedureSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  code: z.string().min(1, 'Code requis').regex(/^[A-Z0-9\-]+$/i, 'Code invalide'),
  description: z.string().optional(),
  category: z.string().min(1, 'Catégorie requise'),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']).default('DRAFT'),
  steps: z.array(ProcedureStepSchema).min(1, 'Au moins une étape requise'),
  prerequisites: ProcedurePrerequisitesSchema.optional(),
  parameters: z.any().optional(),
  mediaLibrary: z.any().optional(),
  postExecution: z.any().optional(),
  authorId: z.string().uuid().optional(),
  metadata: z.object({
    title: z.string().optional(),
    code: z.string().optional(),
    category: z.string().optional(),
    department: z.string().optional(),
    criticality: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

export const UpdateProcedureSchema = CreateProcedureSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type CreateProcedureInput = z.infer<typeof CreateProcedureSchema>;
export type UpdateProcedureInput = z.infer<typeof UpdateProcedureSchema>;
