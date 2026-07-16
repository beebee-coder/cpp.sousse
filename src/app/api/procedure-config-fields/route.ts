export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';

const ALLOWED_TYPES = ['text', 'number', 'boolean', 'select'];

export async function GET(req: NextRequest) {
  try {
    const templates = await prisma.procedureFieldTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, items: templates });
  } catch (error) {
    console.error('Error fetching procedure config fields:', error);
    return NextResponse.json({ error: 'Failed to fetch fields' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, type, description, options, required } = data;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `Type invalide. Attendu: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }

    if (type === 'select' && options !== undefined && !Array.isArray(options)) {
      return NextResponse.json({ error: 'Le champ options doit être un tableau pour le type select' }, { status: 400 });
    }

    const template = await prisma.procedureFieldTemplate.create({
      data: {
        name,
        type,
        description: description ?? null,
        options: options ?? null,
        required: Boolean(required) || false,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating procedure config field:', error);
    return NextResponse.json({ error: 'Failed to create field' }, { status: 500 });
  }
}
