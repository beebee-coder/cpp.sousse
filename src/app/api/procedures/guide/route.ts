import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/prisma-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REGISTRY = path.join(process.cwd(), '.registry', 'procedures');

function readRegistryProcedures(): any[] {
  const out: any[] = [];
  if (!fs.existsSync(REGISTRY)) return out;
  for (const d of fs.readdirSync(REGISTRY, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const file = path.join(REGISTRY, d.name, 'procedure.json');
    if (!fs.existsSync(file)) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      /* ignore fichier corrompu */
    }
  }
  return out;
}

function toSummary(p: any, source: 'file' | 'db') {
  const meta = p.metadata || {};
  const steps = Array.isArray(p.steps) ? p.steps : [];
  return {
    id: p._id || p.id,
    code: String(meta.code || p.code || '').toUpperCase(),
    title: meta.title || p.title || 'Sans titre',
    category: String(meta.category || p.category || '—').toUpperCase(),
    criticality: String(meta.criticality || p.criticality || 'normal').toLowerCase(),
    steps: steps.length,
    source,
  };
}

function toDetail(p: any) {
  const meta = p.metadata || {};
  return {
    metadata: {
      title: meta.title || p.title || 'Sans titre',
      code: String(meta.code || p.code || '').toUpperCase(),
      category: String(meta.category || p.category || '—').toUpperCase(),
      subcategory: meta.subcategory || '',
      department: meta.department || '',
      criticality: String(meta.criticality || p.criticality || 'normal').toLowerCase(),
      version: meta.version || '1.0.0',
      author: meta.author || { id: 'local', name: 'Local Station', role: 'operator', department: '' },
      approvers: meta.approvers || [],
      tags: meta.tags || [],
      language: meta.language || 'fr',
      createdAt: meta.createdAt || new Date().toISOString(),
      lastUpdated: meta.lastUpdated || new Date().toISOString(),
      description: meta.description || p.description || '',
    },
    prerequisites: p.prerequisites || { items: [] },
    steps: p.steps || [],
    postExecution: p.postExecution || null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const list = searchParams.get('list');
  const code = searchParams.get('code');
  const id = searchParams.get('id');

  try {
    // ── Liste des guides ──
    if (list) {
      const fromReg = readRegistryProcedures().map((p) => toSummary(p, 'file'));
      let fromDb: any[] = [];
      try {
        const dbProcs = await prisma.procedure.findMany({ orderBy: { createdAt: 'desc' } });
        fromDb = dbProcs.map((p: any) => toSummary(p, 'db'));
      } catch {
        /* SQL non critique */
      }

      // Fusion + déduplication par code (priorité au Registre Physique)
      const map = new Map<string, any>();
      for (const p of [...fromDb, ...fromReg]) {
        const key = p.code || p.id;
        const existing = map.get(key);
        if (!existing || (existing.source === 'db' && p.source === 'file')) {
          map.set(key, p);
        }
      }
      return NextResponse.json({ success: true, procedures: Array.from(map.values()) });
    }

    // ── Détail d'un guide ──
    let proc: any = null;

    if (code) {
      const file = path.join(REGISTRY, code.toLowerCase(), 'procedure.json');
      if (fs.existsSync(file)) {
        proc = JSON.parse(fs.readFileSync(file, 'utf8'));
      } else {
        try {
          proc = await prisma.procedure.findUnique({ where: { code: code.toUpperCase() } });
        } catch {
          /* ignore */
        }
      }
    } else if (id) {
      proc = readRegistryProcedures().find((p) => (p._id || p.id) === id) || null;
      if (!proc) {
        try {
          proc = await prisma.procedure.findUnique({ where: { id } });
        } catch {
          /* ignore */
        }
      }
    }

    if (!proc) {
      return NextResponse.json({ success: false, error: 'Procédure introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, procedure: toDetail(proc) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Erreur interne' }, { status: 500 });
  }
}
