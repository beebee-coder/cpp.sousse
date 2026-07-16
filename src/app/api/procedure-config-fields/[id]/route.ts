//src/app/api/procedure-config-fields/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';

const ALLOWED_TYPES = ['text', 'number', 'boolean', 'select'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await req.json();
    const { name, type, description, options, required } = data;
    const resolvedParams = await params;

    if (type !== undefined && !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `Type invalide. Attendu: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }

    const updated = await prisma.procedureFieldTemplate.update({
      where: { id: resolvedParams.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(options !== undefined ? { options: options ?? null } : {}),
        ...(required !== undefined ? { required: Boolean(required) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating procedure config field:', error);
    return NextResponse.json({ error: 'Failed to update field' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Nettoyage des champs orphelins dans les procédures (step.fields[].templateId)
    const procedures = await prisma.procedure.findMany({
      select: { id: true, steps: true },
    });

    for (const proc of procedures) {
      const steps: any[] = Array.isArray(proc.steps) ? proc.steps : [];
      let changed = false;
      const cleanedSteps = steps.map((step: any) => {
        if (!step || !Array.isArray(step.fields)) return step;
        const filtered = step.fields.filter((f: any) => f?.templateId !== id);
        if (filtered.length !== step.fields.length) {
          changed = true;
          return { ...step, fields: filtered };
        }
        return step;
      });

      if (changed) {
        await prisma.procedure.update({
          where: { id: proc.id },
          data: { steps: cleanedSteps as any },
        });
      }
    }

    await prisma.procedureFieldTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting procedure config field:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
}
