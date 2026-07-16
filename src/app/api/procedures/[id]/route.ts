export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { procedureManager } from '@/lib/procedures/services/procedure-manager.service';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';
import { UpdateProcedureSchema } from '@/lib/procedures/validators/procedure.validator';

/**
 * GET /api/procedures/[id]
 * Récupère le détail complet d'une procédure.
 */
export const GET = createHybridRoute<any, any>({
  name: 'PROCEDURE_GET_BY_ID',
  webHandler: async (req, body, params) => {
    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: "ID_REQUIS" }), { status: 400 });

    const procedure = await procedureManager.get(id);
    if (!procedure) {
      return new Response(JSON.stringify({ success: false, message: 'Procédure introuvable' }), { status: 404 });
    }
    return { success: true, procedure };
  }
});

/**
 * PUT /api/procedures/[id]
 */
export const PUT = createHybridRoute<any, any>({
  name: 'PROCEDURE_UPDATE',
  webHandler: async (req, body, params) => {
    const session = await getSessionFromCookie();
    if (!session || session.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 });
    }

    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: "ID_REQUIS" }), { status: 400 });

    const parsed = UpdateProcedureSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }), { status: 400 });
    }

    const updated = await procedureManager.update(id, parsed.data);
    return { success: true, procedure: updated };
  }
});

/**
 * DELETE /api/procedures/[id]
 */
export const DELETE = createHybridRoute<any, any>({
  name: 'PROCEDURE_DELETE',
  webHandler: async (req, body, params) => {
    const session = await getSessionFromCookie();
    if (!session || session.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 });
    }

    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: "ID_REQUIS" }), { status: 400 });

    await procedureManager.delete(id);
    return { success: true, message: 'Procédure supprimée' };
  }
});
