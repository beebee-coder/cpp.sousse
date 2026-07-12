import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Mode = 'web' | 'desktop' | 'pull';

function runGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).toString();
}

function parseRemote(repoCwd: string): { owner: string; name: string } | null {
  try {
    const url = runGit('remote get-url origin', repoCwd).trim();
    const match = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const repoCwd = process.cwd();
  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === 'desktop' ? 'web' : body.mode === 'pull' ? 'pull' : 'web';

  const logs: string[] = [];
  const errors: string[] = [];

  try {
    const branch = runGit('rev-parse --abbrev-ref HEAD', repoCwd).trim();
    const remote = parseRemote(repoCwd);
    const repoLabel = remote ? `${remote.owner}/${remote.name}` : 'origin';

    if (mode === 'pull') {
      logs.push(`> PHASE_AVAL: récupération depuis ${repoLabel} (${branch})`);
      const out = runGit(`pull origin ${branch}`, repoCwd).trim();
      logs.push(out || 'Déjà à jour.');
      return NextResponse.json({
        success: true,
        message: `Downlink terminé depuis ${repoLabel}.`,
        logs: logs.join('\n'),
      });
    }

    // web / desktop => uplink: commit (si nécessaire) puis push pour déclencher le workflow
    logs.push(`> PHASE_AMONT: synchronisation vers ${repoLabel} (${branch})`);
    logs.push(`> TRANSFERT DU CODE VERS LA STATION DE COMPILATION GITHUB...`);

    const status = runGit('status --porcelain', repoCwd).trim();
    if (status) {
      runGit('add -A', repoCwd);
      const stamp = new Date().toISOString();
      runGit(`commit -m "chore(pipeline): uplink automatique ${stamp}"`, repoCwd);
      logs.push('> Changements commités localement.');
    } else {
      logs.push('> Aucun changement local à synchroniser.');
    }

    const pushOut = runGit(`push origin ${branch}`, repoCwd).trim();
    logs.push(pushOut || 'Push effectué.');
    logs.push(
      `> UPLINK_RÉUSSI : Compilation GitHub Actions lancée (workflow release-tauri).`
    );
    if (remote) {
      logs.push(
        `> Suivi: https://github.com/${remote.owner}/${remote.name}/actions`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Uplink réussi vers ${repoLabel}.`,
      logs: logs.join('\n'),
    });
  } catch (err: any) {
    errors.push(`> ERREUR_LIAISON: ${err?.message || String(err)}`);
    if (err?.stderr) errors.push(err.stderr.toString().trim());
    return NextResponse.json(
      {
        success: false,
        message: 'Échec de la liaison GitHub.',
        logs: logs.join('\n'),
        errors: errors.join('\n'),
      },
      { status: 500 }
    );
  }
}
