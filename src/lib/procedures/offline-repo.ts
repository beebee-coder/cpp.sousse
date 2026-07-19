// src/lib/procedures/offline-repo.ts
/**
 * @fileOverview Source de vérité OFFLINE pour les procédures en mode
 * Locale / Hybride-offline. Opère directement sur le Registre Physique
 * `.registry/procedures/{code}/procedure.json` (le même FS que la couche Rust
 * et que `guide/route.ts`). Aucune dépendance Prisma/Neon, aucun réseau.
 *
 * En mode Web (Vercel serverless, FS read-only) ce module est inutilisé ; tout
 * passe par le cloud. En Desktop offline, il est la SEULE voie de CRUD car
 * l'API Next (`/api/procedures`) court-circuite en `STATIC_EXPORT`.
 */

import fs from 'fs';
import path from 'path';

const REGISTRY_OVERRIDE = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
const REGISTRY_ROOT = REGISTRY_OVERRIDE
  ? REGISTRY_OVERRIDE
  : path.join(process.cwd(), '.registry');
const PROC_DIR = path.join(REGISTRY_ROOT, 'procedures');
const TEMPLATE_DIR = path.join(REGISTRY_ROOT, 'procedure-templates');

export interface OfflineProcedureRecord {
  _id: string;
  _version: string;
  _type: 'industrial_procedure';
  metadata: {
    title: string;
    code: string;
    category: string;
    criticality: string;
    version: string;
    createdAt: string;
    lastUpdated: string;
  };
  prerequisites: any;
  steps: any[];
  parameters?: any;
  mediaLibrary?: any;
  postExecution?: any;
}

function ensureProcDir() {
  try {
    if (!fs.existsSync(PROC_DIR)) fs.mkdirSync(PROC_DIR, { recursive: true });
  } catch {
    /* FS read-only : ignoré */
  }
}

function procPath(code: string): string {
  // Cohérence : create écrit en UPPERCASE, delete lit donc en UPPERCASE.
  return path.join(PROC_DIR, String(code).toUpperCase(), 'procedure.json');
}

export function listOfflineProcedures(): OfflineProcedureRecord[] {
  ensureProcDir();
  const out: OfflineProcedureRecord[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(PROC_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return out;
  }
  for (const dir of entries) {
    const file = path.join(PROC_DIR, dir, 'procedure.json');
    if (!fs.existsSync(file)) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      /* fichier corrompu : ignoré */
    }
  }
  return out.sort((a, b) =>
    (b.metadata?.lastUpdated || '').localeCompare(a.metadata?.lastUpdated || '')
  );
}

export function getOfflineProcedure(opts: { id?: string; code?: string }): OfflineProcedureRecord | null {
  const all = listOfflineProcedures();
  if (opts.id) return all.find((p) => p._id === opts.id) || null;
  if (opts.code) {
    const code = String(opts.code).toUpperCase();
    return all.find((p) => p.metadata?.code?.toUpperCase() === code) || null;
  }
  return null;
}

export function upsertOfflineProcedure(record: OfflineProcedureRecord): OfflineProcedureRecord {
  ensureProcDir();
  const dir = path.join(PROC_DIR, record.metadata.code.toUpperCase());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Écriture atomique (tmp + rename) pour éviter la corruption JSON concurrente.
  const file = path.join(dir, 'procedure.json');
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  emitChanged();
  return record;
}

export function deleteOfflineProcedure(code: string): boolean {
  const dir = path.join(PROC_DIR, String(code).toUpperCase());
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    emitChanged();
    return true;
  }
  return false;
}

export interface OfflineTemplateRecord {
  id: string;
  name: string;
  type: string; // 'text' | 'number' | 'boolean' | 'select'
  description: string | null;
  options: string[] | null;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

function ensureTemplateDir() {
  try {
    if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  } catch {
    /* FS read-only : ignoré */
  }
}

export function listOfflineTemplates(): OfflineTemplateRecord[] {
  ensureTemplateDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(TEMPLATE_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  } catch {
    return [];
  }
  const out: OfflineTemplateRecord[] = [];
  for (const file of entries) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8')));
    } catch {
      /* fichier corrompu : ignoré */
    }
  }
  return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function getOfflineTemplate(id: string): OfflineTemplateRecord | null {
  const file = path.join(TEMPLATE_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function upsertOfflineTemplate(record: OfflineTemplateRecord): OfflineTemplateRecord {
  ensureTemplateDir();
  const file = path.join(TEMPLATE_DIR, `${record.id}.json`);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  emitTemplateChanged();
  return record;
}

export function deleteOfflineTemplate(id: string): boolean {
  const file = path.join(TEMPLATE_DIR, `${id}.json`);
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    emitTemplateChanged();
    // Nettoyage des champs orphelins : retirer templateId des steps des procédures.
    for (const proc of listOfflineProcedures()) {
      const steps: any[] = Array.isArray(proc.steps) ? proc.steps : [];
      let changed = false;
      const cleaned = steps.map((step: any) => {
        if (!step || !Array.isArray(step.fields)) return step;
        const filtered = step.fields.filter((f: any) => f?.templateId !== id);
        if (filtered.length !== step.fields.length) {
          changed = true;
          return { ...step, fields: filtered };
        }
        return step;
      });
      if (changed) upsertOfflineProcedure({ ...proc, steps: cleaned });
    }
    return true;
  }
  return false;
}

/**
 * Amorce le Registre offline avec les champs de configuration par défaut
 * (cohérents avec le seed cloud) UNIQUEMENT si aucun template n'existe
 * déjà. Idempotent : ne touche jamais aux templates créés par l'utilisateur.
 */
export const DEFAULT_OFFLINE_TEMPLATES: OfflineTemplateRecord[] = [
  { id: 'seed-cf-pression-de-consigne', name: 'Pression de consigne', type: 'number', description: 'Pression cible en bar', options: null, required: true, createdAt: '', updatedAt: '' },
  { id: 'seed-cf-temperature', name: 'Température', type: 'number', description: 'Température mesurée en °C', options: null, required: false, createdAt: '', updatedAt: '' },
  { id: 'seed-cf-etat-vanne', name: 'État vanne', type: 'select', description: 'Position de la vanne', options: ['Ouvert', 'Fermé', 'Maintenance'], required: false, createdAt: '', updatedAt: '' },
  { id: 'seed-cf-validation-operateur', name: 'Validation opérateur', type: 'boolean', description: 'Confirmation manuelle requise', options: null, required: false, createdAt: '', updatedAt: '' },
  { id: 'seed-cf-observation', name: 'Observation', type: 'text', description: 'Note libre de l\'opérateur', options: null, required: false, createdAt: '', updatedAt: '' },
];

export function ensureDefaultTemplates(): void {
  try {
    if (listOfflineTemplates().length > 0) return;
    const now = new Date().toISOString();
    for (const t of DEFAULT_OFFLINE_TEMPLATES) {
      upsertOfflineTemplate({ ...t, createdAt: now, updatedAt: now });
    }
  } catch {
    /* FS read-only : ignoré */
  }
}

/**
 * Normalise les options d'un template en tableau de chaînes (string[]),
 * unique format de stockage. Tolère : string[], string séparée par
 * sauts de ligne, objets {value,label}, ou null/undefined → null.
 */
export function normalizeTemplateOptions(input: any): string[] | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length > 0 ? lines : null;
  }
  if (Array.isArray(input)) {
    const out = input
      .map((o: any) => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object') return o.value ?? o.label ?? null;
        return null;
      })
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
    return out.length > 0 ? out : null;
  }
  return null;
}

let templateChangeListeners: Array<() => void> = [];
export function onTemplatesChanged(cb: () => void): () => void {
  templateChangeListeners.push(cb);
  return () => {
    templateChangeListeners = templateChangeListeners.filter((c) => c !== cb);
  };
}
function emitTemplateChanged() {
  for (const cb of templateChangeListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}

let changeListeners: Array<() => void> = [];
export function onProceduresChanged(cb: () => void): () => void {
  changeListeners.push(cb);
  return () => {
    changeListeners = changeListeners.filter((c) => c !== cb);
  };
}
function emitChanged() {
  for (const cb of changeListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}
