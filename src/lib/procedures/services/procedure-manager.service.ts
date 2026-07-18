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

      try {
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
      } catch (regErr: any) {
        // R4 — Non silencieux : la DB reste source de vérité, mais on trace la
        // divergence DB/Registre Physique au lieu de l'ignorer.
        console.error(`⚠️ [REGISTRY] [DIVERGENCE] [${traceId}] Écriture Registre échouée (DB ok):`, regErr.message);
      }

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
        try {
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
        } catch (regErr: any) {
          console.error(`⚠️ [REGISTRY] [DIVERGENCE] [${traceId}] Écriture Registre échouée (DB ok):`, regErr.message);
        }
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

      const regPath = path.join(REGISTRY_ROOT, existing.code.toUpperCase(), 'procedure.json');
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

  async createVersion(id: string, changes: string, createdBy: string) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const existing = await prisma.procedure.findUnique({ where: { id } });
      if (!existing) throw new Error('PROCEDURE_NOT_FOUND');

      const snapshot = {
        title: existing.title,
        code: existing.code,
        description: existing.description,
        category: existing.category,
        criticality: existing.criticality,
        status: existing.status,
        steps: existing.steps,
        prerequisites: existing.prerequisites,
        parameters: existing.parameters,
        mediaLibrary: existing.mediaLibrary,
        postExecution: existing.postExecution,
        metadata: existing.metadata,
      };

      const version = await prisma.procedureVersion.create({
        data: {
          procedureId: id,
          version: existing.version || '1.0.0',
          changes,
          snapshot,
          createdBy,
        }
      });

      console.log(`📌 [VERSION] [${traceId}] Version créée pour ${existing.code}: ${version.version}`);
      return version;
    } catch (e: any) {
      console.error(`❌ [VERSION] [${traceId}] Échec création version:`, e.message);
      throw e;
    }
  }

  async getHistory(id: string) {
    try {
      return await prisma.procedureVersion.findMany({
        where: { procedureId: id },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      console.error(`❌ [VERSION] Échec historique ${id}:`, e);
      return [];
    }
  }

  async rollback(id: string, versionId: string) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const version = await prisma.procedureVersion.findUnique({ where: { id: versionId } });
      if (!version || version.procedureId !== id) {
        throw new Error('VERSION_NOT_FOUND');
      }

      const updated = await prisma.procedure.update({
        where: { id },
        data: {
          title: (version.snapshot as any).title,
          description: (version.snapshot as any).description,
          category: (version.snapshot as any).category,
          criticality: (version.snapshot as any).criticality,
          status: (version.snapshot as any).status,
          steps: (version.snapshot as any).steps,
          prerequisites: (version.snapshot as any).prerequisites,
          parameters: (version.snapshot as any).parameters,
          mediaLibrary: (version.snapshot as any).mediaLibrary,
          postExecution: (version.snapshot as any).postExecution,
          metadata: (version.snapshot as any).metadata,
        }
      });

      console.log(`↩️ [ROLLBACK] [${traceId}] Procédure ${updated.code} restaurée vers ${version.version}`);
      return updated;
    } catch (e: any) {
      console.error(`❌ [ROLLBACK] [${traceId}] Échec rollback:`, e.message);
      throw e;
    }
  }

  async publish(id: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status: 'PUBLISHED' }
    });
  }

  async archive(id: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });
  }

  async review(id: string, approverId: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status: 'REVIEW' }
    });
  }

  async approve(id: string, approverId: string) {
    return await prisma.procedure.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
  }

  async checkIntegrity(id: string) {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const procedure = await prisma.procedure.findUnique({ where: { id } });
      if (!procedure) return { ok: false, errors: ['Procedure not found'] };

      const errors: string[] = [];
      const steps = (procedure.steps as any[]) || [];

      if (!procedure.title) errors.push('Title missing');
      if (!procedure.code) errors.push('Code missing');
      if (steps.length === 0) errors.push('No steps defined');

      for (const step of steps) {
        if (!step.id) errors.push(`Step missing id`);
        if (!step.title) errors.push(`Step ${step.id || '?'} missing title`);
        if (!step.action) errors.push(`Step ${step.id || '?'} missing action`);
        if (!step.validation) errors.push(`Step ${step.id || '?'} missing validation`);
      }

      const integrity = { ok: errors.length === 0, errors, checkedAt: new Date().toISOString() };
      console.log(`🔍 [INTEGRITY] [${traceId}] ${id}: ${integrity.ok ? 'OK' : errors.length + ' erreur(s)'}`);
      return integrity;
    } catch (e: any) {
      console.error(`❌ [INTEGRITY] [${traceId}] Échec:`, e.message);
      return { ok: false, errors: [e.message] };
    }
  }

  private writeToRegistry(code: string, payload: any, traceId: string) {
    const dir = path.join(REGISTRY_ROOT, code.toUpperCase());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = path.join(dir, 'procedure.json');
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    // Écriture atomique (tmp + rename) pour éviter toute corruption JSON
    // concurrente entre l'écriture web et la lecture native Rust.
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    console.log(`📂 [REGISTRY] [SUCCESS] [${traceId}] Fichier écrit : ${file}`);
  }
}

export const procedureManager = new ProcedureManagerService();

