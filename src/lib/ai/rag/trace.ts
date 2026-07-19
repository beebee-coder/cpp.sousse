/**
 * @fileOverview Logger RAG structuré et consolidé.
 *
 * Problème traité : le pipeline RAG émettait des dizaines de
 * `console.error`/`console.warn` isolés (un par étage / par catch), ce qui
 * saturait la console et masquait la cause réelle des réponses négatives
 * (« AUCUN_CONTEXTE » / confiance none).
 *
 * Solution : un seul `RagTrace` par requête regroupe TOUS les étages
 * (vectoriel, lexical, procédural, cloud, bank…). Un unique log consolidé
 * est émis en fin de requête — jamais en boucle. Le trace contient un
 * bloc `diagnosis` explicite qui dit OÙ l'IA n'a PAS accédé à l'information.
 *
 * Activation : `RAG_TRACE=1` (ou `NODE_ENV !== 'production'`).
 * Désactivez avec `RAG_TRACE=0` pour un silence total en prod.
 */

export type RagStageStatus = 'hit' | 'empty' | 'error' | 'skipped';

export interface RagStageTrace {
  stage: string;
  label: string;
  status: RagStageStatus;
  count: number;
  topScore: number | null;
  /** Millisecondes écoulées pour cet étage. */
  ms: number;
  /** Message d'erreur si status==='error'. */
  error?: string;
  /** Raison de non-accès (ex: clé absente, FS vide, score < min). */
  reason?: string;
}

export class RagTrace {
  readonly query: string;
  readonly mode: string;
  readonly startedAt: number;
  private stages: RagStageTrace[] = [];
  private readonly enabled: boolean;

  constructor(query: string, mode: string) {
    this.query = query;
    this.mode = mode;
    this.startedAt = Date.now();
    const env = process.env.RAG_TRACE;
    this.enabled =
      env === '0'
        ? false
        : env === '1'
          ? true
          : process.env.NODE_ENV !== 'production';
  }

  /** Enregistre le résultat d'un étage RAG. */
  stage(
    stage: string,
    label: string,
    input: { count: number; topScore: number | null; ms: number; error?: string; reason?: string; skipped?: boolean }
  ): void {
    let status: RagStageStatus = 'hit';
    if (input.error) status = 'error';
    else if (input.skipped) status = 'skipped';
    else if (input.count === 0) status = 'empty';

    this.stages.push({
      stage,
      label,
      status,
      count: input.count,
      topScore: input.topScore,
      ms: Math.round(input.ms),
      error: input.error,
      reason: input.reason,
    });
  }

  /**
   * Émet un unique log consolidé. Jamais appelé en boucle : une seule
   * fois par requête, en fin de pipeline.
   */
  flush(resultCount: number, confidence: string): void {
    if (!this.enabled) return;

    const totalMs = Date.now() - this.startedAt;
    const failed = this.stages.filter((s) => s.status === 'error');
    const empty = this.stages.filter((s) => s.status === 'empty');
    const reachable = this.stages.filter((s) => s.status !== 'skipped');
    const anyReachable = reachable.length > 0;
    const allEmpty = anyReachable && reachable.every((s) => s.status === 'empty');

    const ts = new Date(this.startedAt).toISOString();
    const header = `%c[RAG_TRACE]%c ${ts} | mode=${this.mode} | q="${this.query.slice(0, 60)}" | résultats=${resultCount} | confiance=${confidence} | ${totalMs}ms`;

    const lines: string[] = [];
    lines.push(
      `Étages (${this.stages.length}): ` +
        this.stages
          .map((s) => {
            const tag =
              s.status === 'hit' ? `✓${s.count}` : s.status === 'empty' ? '∅' : s.status === 'error' ? '✗' : '⊘';
            const score = s.topScore != null ? ` score=${s.topScore.toFixed(2)}` : '';
            const reason = s.reason ? ` (${s.reason})` : s.error ? ` (${s.error.slice(0, 80)})` : '';
            return `${s.stage}[${tag}${score}${reason}]`;
          })
          .join('  ')
    );

    // ── Bloc diagnostic : OÙ l'IA n'a PAS accédé à l'information ──
    let diagnosis: string;
    if (resultCount === 0 && failed.length > 0 && !allEmpty) {
      diagnosis = `NON-ACCÈS: ${failed.length} étage(s) en ERREUR — ` +
        failed.map((f) => `${f.stage}: ${f.error?.slice(0, 90) || f.reason || 'échec'}`).join(' ; ');
    } else if (resultCount === 0 && allEmpty) {
      diagnosis = `NON-ACCÈS: aucun étage RAG n'a retourné de résultat (tous ∅). ` +
        empty.map((e) => `${e.stage}${e.reason ? `: ${e.reason}` : ''}`).join(' ; ') +
        ' → réponse négative IA (« information non disponible ») attendue.';
    } else if (resultCount === 0 && !anyReachable) {
      diagnosis = `NON-ACCÈS: tous les étages RAG étaient désactivés/skippés pour ce mode=${this.mode}.`;
    } else if (resultCount > 0 && confidence === 'none') {
      diagnosis = `ACCÈS PARTIEL: ${resultCount} résultat(s) mais score < 0.2 partout → confiance none. Affiner la requête ou vérifier le seeding.`;
    } else {
      diagnosis = `ACCÈS OK: ${resultCount} résultat(s), confiance=${confidence}.`;
    }

    lines.push(`DIAGNOSTIC: ${diagnosis}`);

    const styles = [
      'background:#0e7490;color:#fff;font-weight:bold;border-radius:3px;padding:0 4px',
      'color:#0e7490',
    ];
    // eslint-disable-next-line no-console
    console.log(header, ...styles);
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[RAG_TRACE] ${failed.length} étage(s) en erreur — voir le détail ci-dessus.`);
    }
  }
}

/** Fabrique un traceur pour une requête RAG. */
export function createRagTrace(query: string, mode: string): RagTrace {
  return new RagTrace(query, mode);
}
