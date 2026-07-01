import { createHybridRoute } from '@/lib/api-route-creator';
import { procedureManager } from '@/lib/procedures/services/procedure-manager.service';
import { prisma } from '@/lib/db/prisma-client';

export const dynamic = 'force-dynamic';

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
    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: "ID_REQUIS" }), { status: 400 });

    const updated = await prisma.procedure.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        steps: body.steps,
        prerequisites: body.prerequisites,
        criticality: body.criticality,
        status: body.status,
        updatedAt: new Date(),
      }
    });
    return { success: true, procedure: updated };
  }
});

/**
 * DELETE /api/procedures/[id]
 */
export const DELETE = createHybridRoute<any, any>({
  name: 'PROCEDURE_DELETE',
  webHandler: async (req, body, params) => {
    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: "ID_REQUIS" }), { status: 400 });

    await prisma.procedure.delete({ where: { id } });
    return { success: true, message: 'Procédure supprimée' };
  }
});
