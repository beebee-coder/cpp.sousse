// src/lib/procedures/options.ts
/**
 * Helpers purs (sans dépendance FS) pour la gestion des options de champs
 * de configuration. Importable côté client (composants React) comme côté
 * serveur. Unique format de stockage/transmission : string[] | null.
 */

/**
 * Normalise les options en tableau de chaînes (string[]), tolère :
 * string[], string séparée par sauts de ligne, objets {value,label},
 * ou null/undefined → null.
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

/**
 * Convertit les options normalisées (string[]) en format affichable pour un
 * <select> (valeur = label = string). Tolère déjà le format objet.
 */
export function renderTemplateOptions(options: any): { value: string; label: string }[] {
  const norm = normalizeTemplateOptions(options);
  if (!norm) return [];
  return norm.map((s) => ({ value: s, label: s }));
}
