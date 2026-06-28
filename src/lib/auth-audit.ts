/**
 * Utilitaire de logs d'audit structurés pour le flux d'authentification.
 * Format uniforme : [AUTH] { timestamp, event, level, ...meta }
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

interface AuditLog {
  timestamp: string;
  event: string;
  level: LogLevel;
  [key: string]: unknown;
}

function authLog(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const log: AuditLog = {
    timestamp: new Date().toISOString(),
    event,
    level,
    ...meta,
  };

  const prefix = `[AUTH:${level}]`;

  if (level === 'ERROR') {
    console.error(prefix, JSON.stringify(log, null, 2));
  } else if (level === 'WARN') {
    console.warn(prefix, JSON.stringify(log, null, 2));
  } else {
    console.log(prefix, JSON.stringify(log, null, 2));
  }
}

export const authAudit = {
  info: (event: string, meta?: Record<string, unknown>) => authLog('INFO', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => authLog('WARN', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => authLog('ERROR', event, meta),
  success: (event: string, meta?: Record<string, unknown>) => authLog('SUCCESS', event, meta),
};
