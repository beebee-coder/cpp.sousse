import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Exécute la synchronisation Git de manière native en JS.
 * Évite les dépendances vers WSL/Bash sous Windows.
 */
export async function runGitSync(mode: string): Promise<{ success: boolean; logs: string; errors: string }> {
  const logs: string[] = [];
  const errors: string[] = [];

  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  const logError = (msg: string) => {
    console.error(msg);
    errors.push(msg);
  };

  try {
    const cwd = process.cwd();
    log(`🚀 VisioNode Sync Engine (Native JS Fallback)`);
    log(`🛠️  Mode Pipeline : ${mode.toUpperCase()}`);
    log(`------------------------------------------`);

    // 1. Identity & Environment
    log(`👤 Configuration de l'identité Git...`);
    await execPromise('git config user.email "uplink-bot@visionode.precision"', { cwd });
    await execPromise('git config user.name "VisioNode Precision Bot"', { cwd });

    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      log(`🔑 Utilisation du jeton GITHUB_TOKEN fourni...`);
      const repoUrl = "https://github.com/beebee-coder/cpp.sousse.git";
      const cleanUrl = repoUrl.replace(/^https:\/\//, '');
      const authUrl = `https://x-access-token:${githubToken}@${cleanUrl}`;
      try {
        await execPromise(`git remote set-url origin "${authUrl}"`, { cwd });
      } catch {
        try {
          await execPromise(`git remote add origin "${authUrl}"`, { cwd });
        } catch (e: any) {
          logError(`⚠️ Configuration remote origin: ${e.message}`);
        }
      }
    }

    // 2. Mode Logic
    if (mode === 'pull') {
      log(`📡 Initiation DOWNLINK depuis Registre...`);
      const fetchRes = await execPromise('git fetch origin main', { cwd });
      if (fetchRes.stdout) log(fetchRes.stdout);
      if (fetchRes.stderr) log(fetchRes.stderr);

      const resetRes = await execPromise('git reset --hard origin/main', { cwd });
      if (resetRes.stdout) log(resetRes.stdout);
      if (resetRes.stderr) log(resetRes.stderr);

      log(`✅ Downlink Successful!`);
      return { success: true, logs: logs.join('\n'), errors: errors.join('\n') };
    }

    if (mode === 'desktop') {
      log(`🏗️  Initiation FORGE DESKTOP...`);
      log(`📦 Staging current state for build traceability...`);
    }

    // 3. Staging
    log(`📦 Analyse des modifications...`);
    await execPromise('git add .', { cwd });

    // Check if dirty
    let isDirty = true;
    try {
      await execPromise('git diff-index --quiet HEAD --', { cwd });
      isDirty = false;
    } catch {
      isDirty = true;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const commitMsg = `[${mode.toUpperCase()}_SESSION] v1.0 - Sync (${timestamp})`;

    if (!isDirty) {
      log(`ℹ️ Registre déjà synchronisé.`);
    } else {
      log(`💾 Création du point de restauration : ${commitMsg}`);
      const commitRes = await execPromise(`git commit -m "${commitMsg}"`, { cwd });
      if (commitRes.stdout) log(commitRes.stdout);
    }

    // 4. Physical Transfer
    log(`📡 Transmission vers main...`);
    try {
      await execPromise('git fetch origin main', { cwd });
    } catch (e: any) {
      logError(`⚠️ Fetch origin main: ${e.message}`);
    }

    log(`🚀 Exécution du git push...`);
    const pushRes = await execPromise('git push origin main --force', { cwd });
    if (pushRes.stdout) log(pushRes.stdout);
    if (pushRes.stderr) log(pushRes.stderr);

    log(`------------------------------------------`);
    log(`✅ ${mode.toUpperCase()} Uplink Successful!`);
    
    return {
      success: true,
      logs: logs.join('\n'),
      errors: errors.join('\n')
    };

  } catch (error: any) {
    logError(`❌ Échec de la transmission (Erreur: ${error.message}).`);
    return {
      success: false,
      logs: logs.join('\n'),
      errors: errors.join('\n') || error.message
    };
  }
}
