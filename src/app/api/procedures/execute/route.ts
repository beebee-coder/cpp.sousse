import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';

export const dynamic = 'force-dynamic';

/**
 * API Route : Gestion des sessions d'exécution.
 * Permet de sauvegarder le log d'exécution pour l'audit industriel.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { procedureId, operatorId, stepsStatus, status, totalDuration } = body;

    if (!procedureId || !operatorId) {
      return NextResponse.json({ success: false, message: 'Paramètres manquants' }, { status: 400 });
    }

    const execution = await prisma.procedureExecution.create({
      data: {
        procedureId,
        operatorId,
        status: status || 'COMPLETED',
        stepsStatus: stepsStatus || {},
        totalDuration: totalDuration || 0,
        endTime: new Date(),
      }
    });

    // Mettre à jour les statistiques de la procédure
    await prisma.procedure.update({
      where: { id: procedureId },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 }
      }
    });

    return NextResponse.json({ 
      success: true, 
      executionId: execution.id,
      message: 'Log d\'exécution enregistré dans la base d\'audit.' 
    });

  } catch (error: any) {
    console.error('[EXECUTION_API] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
