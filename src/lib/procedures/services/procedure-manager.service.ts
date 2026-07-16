import { prisma } from '@/lib/db/prisma-client';
import { CreateProcedureInput, UpdateProcedureInput } from '../validators/procedure.validator';
import { procedureRAG } from './rag.service';
import fs from 'fs';
import path from 'path';

const REGISTRY_ROOT = path.join(process.cwd(), '.registry', 'procedures');

export class ProcedureManagerService {
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

  async create(input: CreateProcedureInput, authorId: string) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const data = {
        title: input.title,
        code: input.code.toUpperCase(),
        description: input.description,
        category: input.category.toUpperCase(),
        criticality: input.criticality,
        status: input.status,
        steps: input.steps as any,
        prerequisites: (input.prerequisites || { description: 'Audit standard', items: [] }) as any,
        parameters: (input as any).parameters as any,
        mediaLibrary: (input as any).mediaLibrary as any,
        postExecution: (input as any).postExecution as any,
        authorId,
      };

      const procedure = await prisma.procedure.create({ data });

      this.writeToRegistry(procedure.code, {
        _id: procedure.id,
        _version: '1.0.0',
        _type: 'industrial_procedure',
        metadata: {
          title: procedure.title,
          code: procedure.code,
          category: procedure.category,
          criticality: procedure.criticality,
          version: '1.0.0',
          createdAt: procedure.createdAt.toISOString(),
          lastUpdated: procedure.updatedAt.toISOString(),
        },
        prerequisites: data.prerequisites,
        steps: data.steps,
        parameters: data.parameters,
        mediaLibrary: data.mediaLibrary,
        postExecution: data.postExecution,
      }, traceId);

      procedureRAG.indexProcedure(procedure).catch((e: any) => {
        console.warn(`⚠️ [RAG_INDEX] [${traceId}] Échec indexation procédure:`, e.message);
      });

      return procedure;
    } catch (e: any) {
      console.error(`❌ [PROC_MANAGER] [${traceId}] Échec création:`, e.message);
      throw e;
    }
  }

  async update(id: string, input: UpdateProcedureInput) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const existing = await prisma.procedure.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('PROCEDURE_NOT_FOUND');
      }

      const data: any = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.category !== undefined) data.category = input.category.toUpperCase();
      if (input.criticality !== undefined) data.criticality = input.criticality;
      if (input.status !== undefined) data.status = input.status;
      if (input.steps !== undefined) data.steps = input.steps as any;
      if (input.prerequisites !== undefined) data.prerequisites = input.prerequisites as any;
      if ((input as any).parameters !== undefined) data.parameters = (input as any).parameters as any;
      if ((input as any).mediaLibrary !== undefined) data.mediaLibrary = (input as any).mediaLibrary as any;
      if ((input as any).postExecution !== undefined) data.postExecution = (input as any).postExecution as any;

      const updated = await prisma.procedure.update({ where: { id }, data });

      if (input.steps !== undefined || input.prerequisites !== undefined || input.title !== undefined) {
        this.writeToRegistry(updated.code, {
          _id: updated.id,
          _version: '1.0.0',
          _type: 'industrial_procedure',
          metadata: {
            title: updated.title,
            code: updated.code,
            category: updated.category,
            criticality: updated.criticality,
            version: '1.0.0',
            createdAt: existing.createdAt.toISOString(),
            lastUpdated: updated.updatedAt.toISOString(),
          },
          prerequisites: data.prerequisites ?? existing.prerequisites,
          steps: data.steps ?? existing.steps,
          parameters: data.parameters ?? existing.parameters,
          mediaLibrary: data.mediaLibrary ?? existing.mediaLibrary,
          postExecution: data.postExecution ?? existing.postExecution,
        }, traceId);
      }

      procedureRAG.indexProcedure(updated).catch((e: any) => {
        console.warn(`⚠️ [RAG_INDEX] [${traceId}] Échec indexation procédure:`, e.message);
      });

      return updated;
    } catch (e: any) {
      console.error(`❌ [PROC_MANAGER] [${traceId}] Échec mise à jour ${id}:`, e.message);
      throw e;
    }
  }

  async delete(id: string) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const existing = await prisma.procedure.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('PROCEDURE_NOT_FOUND');
      }

      await prisma.procedure.delete({ where: { id } });

      const regPath = path.join(REGISTRY_ROOT, existing.code.toLowerCase(), 'procedure.json');
      if (fs.existsSync(regPath)) {
        fs.unlinkSync(regPath);
        console.log(`🗑️ [REGISTRY] [${traceId}] Fichier registre supprimé : ${regPath}`);
      }

      procedureRAG.removeProcedure(existing.id).catch((e: any) => {
        console.warn(`⚠️ [RAG_DELETE] [${traceId}] Échec désindexation procédure:`, e.message);
      });

      return { success: true };
    } catch (e: any) {
      console.error(`❌ [PROC_MANAGER] [${traceId}] Échec suppression ${id}:`, e.message);
      throw e;
    }
  }

  async updateStatus(id: string, status: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status }
    });
  }

  private writeToRegistry(code: string, payload: any, traceId: string) {
    try {
      const dir = path.join(REGISTRY_ROOT, code.toLowerCase());
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const file = path.join(dir, 'procedure.json');
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`📂 [REGISTRY] [SUCCESS] [${traceId}] Fichier écrit : ${file}`);
    } catch (e: any) {
      console.warn(`⚠️ [REGISTRY] [ERROR] [${traceId}] Échec écriture registre :`, e.message);
    }
  }
}

export const procedureManager = new ProcedureManagerService();

