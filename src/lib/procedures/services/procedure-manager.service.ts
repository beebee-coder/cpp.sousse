import { prisma } from '@/lib/db/prisma-client';
import { FullProcedure, ProcedureStatus } from '../types';

/**
 * @fileOverview Service de gestion des procédures (CRUD) - Nomenclature Reformée.
 */
export class ProcedureManagerService {
  /**
   * Récupère une procédure par son ID avec les détails de l'auteur.
   */
  async get(id: string) {
    try {
      const procedure = await prisma.procedure.findUnique({
        where: { id },
        include: {
          author: {
            select: { firstName: true, lastName: true, role: true }
          }
        }
      });
      return procedure;
    } catch (e) {
      console.error(`❌ [PROC_MANAGER] Échec lecture ${id}:`, e);
      return null;
    }
  }

  /**
   * Liste les procédures avec filtres industriels.
   */
  async list(filters: any = {}) {
    try {
      return await prisma.procedure.findMany({
        where: filters,
        orderBy: { updatedAt: 'desc' },
        include: {
          author: { select: { firstName: true, lastName: true } }
        }
      });
    } catch (e) {
      console.error(`❌ [PROC_MANAGER] Échec listage:`, e);
      return [];
    }
  }

  /**
   * Met à jour le statut d'une procédure.
   */
  async updateStatus(id: string, status: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status }
    });
  }
}

export const procedureManager = new ProcedureManagerService();
