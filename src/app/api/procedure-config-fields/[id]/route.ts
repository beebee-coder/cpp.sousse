//src/app/api/procedure-config-fields/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await req.json();
    const { name, type, description, options, required } = data;
    const resolvedParams = await params;

    const updated = await prisma.procedureFieldTemplate.update({
      where: { id: resolvedParams.id },
      data: {
        name,
        type,
        description,
        options: options || null,
        required,
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
    await prisma.procedureFieldTemplate.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting procedure config field:', error);
    return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 });
  }
}
