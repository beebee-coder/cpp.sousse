import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureManager } from '@/lib/procedures/services/procedure-manager.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures/[id]
 * Récupère le détail complet d'une procédure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const procedure = await procedureManager.get(params.id);
    if (!procedure) {
      return NextResponse.json({ success: false, message: 'Procédure introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, procedure });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/procedures/[id]
 * Met à jour une procédure existante.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const updated = await prisma.procedure.update({
      where: { id: params.id },
      data: {
        title: data.title,
        description: data.description,
        steps: data.steps,
        prerequisites: data.prerequisites,
        criticality: data.criticality,
        status: data.status,
        updatedAt: new Date(),
      }
    });
    return NextResponse.json({ success: true, procedure: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/procedures/[id]
 * Supprime une procédure.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.procedure.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true, message: 'Procédure supprimée' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
