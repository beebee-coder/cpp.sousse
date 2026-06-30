import { prisma } from '@/lib/db/prisma-client';
import { FullProcedure, ProcedureStatus, ProcedureCategory, Department, Criticality } from '../types';

/**
 * @fileOverview Service de gestion des procédures industrielles (CRUD).
 */
export class ProcedureManagerService {
  /**
   * Crée une nouvelle procédure à partir d'un objet structuré.
   */
  async create(data: any) {
    return await prisma.procedure.create({
      data: {
        code: data.metadata.code,
        title: data.metadata.title,
        description: data.metadata.description || '',
        category: (data.metadata.category || 'OPERATION').toUpperCase() as any,
        subcategory: data.metadata.subcategory || '',
        department: (data.metadata.department || 'PRODUCTION').toUpperCase() as any,
        criticality: (data.metadata.criticality || 'MEDIUM').toUpperCase() as any,
        version: data.metadata.version || '1.0.0',
        status: 'DRAFT',
        prerequisites: data.prerequisites || {},
        steps: data.steps || [],
        parameters: data.parameters || {},
        postExecution: data.postExecution || {},
        metadata: data.metadata,
        authorId: data.metadata.author.id,
        approvers: data.metadata.approvers || [],
      },
    });
  }

  /**
   * Récupère une procédure par son ID avec les détails de l'auteur.
   */
  async get(id: string) {
    return await prisma.procedure.findUnique({
      where: { id },
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true }
        }
      }
    });
  }

  /**
   * Liste les procédures avec filtres optionnels.
   */
  async list(filters: any = {}) {
    return await prisma.procedure.findMany({
      where: filters,
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Met à jour le statut d'une procédure (ex: DRAFT -> APPROVED).
   */
  async updateStatus(id: string, status: ProcedureStatus) {
    return await prisma.procedure.update({
      where: { id },
      data: { status }
    });
  }
}

export const procedureManager = new ProcedureManagerService();
