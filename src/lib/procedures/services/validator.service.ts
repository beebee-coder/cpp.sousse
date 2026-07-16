export function validateProcedurePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'Payload invalide: objet attendu.';
  }

  const data = payload as Record<string, unknown>;

  if (!data.metadata || typeof data.metadata !== 'object') {
    return 'Champ metadata requis et objet attendu.';
  }

  const meta = data.metadata as Record<string, unknown>;

  if (!meta.title || typeof meta.title !== 'string') {
    return 'metadata.title requis (string).';
  }
  if (!meta.code || typeof meta.code !== 'string') {
    return 'metadata.code requis (string).';
  }
  if (!meta.category || typeof meta.category !== 'string') {
    return 'metadata.category requis (string).';
  }
  if (!meta.department || typeof meta.department !== 'string') {
    return 'metadata.department requis (string).';
  }
  if (!meta.criticality || typeof meta.criticality !== 'string') {
    return 'metadata.criticality requis (string).';
  }
  if (!meta.version || typeof meta.version !== 'string') {
    return 'metadata.version requis (string).';
  }

  if (!Array.isArray(data.steps)) {
    return 'steps requis (array).';
  }

  for (const step of data.steps) {
    if (!step || typeof step !== 'object') {
      return 'Chaque step doit être un objet.';
    }
    const s = step as Record<string, unknown>;
    if (!s.id || typeof s.id !== 'string') {
      return 'Chaque step nécessite un id (string).';
    }
    if (typeof s.order !== 'number') {
      return `Step ${s.id}: order requis (number).`;
    }
    if (!s.title || typeof s.title !== 'string') {
      return `Step ${s.id}: title requis (string).`;
    }
    if (!s.action || typeof s.action !== 'object') {
      return `Step ${s.id}: action requis (object).`;
    }
    if (!s.validation || typeof s.validation !== 'object') {
      return `Step ${s.id}: validation requis (object).`;
    }
  }

  if (!data.prerequisites || typeof data.prerequisites !== 'object') {
    return 'prerequisites requis (object).';
  }

  if (data.postExecution !== undefined && data.postExecution !== null && typeof data.postExecution !== 'object') {
    return 'postExecution doit être un objet.';
  }

  if (data.parameters !== undefined && data.parameters !== null && typeof data.parameters !== 'object') {
    return 'parameters doit être un objet.';
  }

  return null;
}
