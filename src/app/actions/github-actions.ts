'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Server Action to trigger the local sync.sh script for WEB update.
 */
export async function triggerGitHubSync() {
  try {
    await execPromise('chmod +x sync.sh');
    
    // Execute script and capture output
    // Git progress goes to stdout now thanks to redirection in sync.sh
    const { stdout, stderr } = await execPromise('./sync.sh web', {
      env: { 
        ...process.env, 
        GITHUB_TOKEN: process.env.GITHUB_TOKEN 
      }
    });
    
    return { 
      success: true, 
      message: 'Web Production Uplink complete. Registry synchronized.',
      logs: stdout,
      errors: stderr // This should now be empty or minimal unless a real error occurred
    };
  } catch (error: any) {
    // If the process itself failed (non-zero exit code)
    return { 
      success: false, 
      message: 'Critical failure during Web Uplink.',
      logs: error.stdout || '',
      errors: error.stderr || error.message
    };
  }
}

/**
 * Server Action to trigger a Desktop Forge via GitHub Actions.
 */
export async function triggerDesktopForge() {
  try {
    await execPromise('chmod +x sync.sh');
    
    const { stdout, stderr } = await execPromise('./sync.sh desktop', {
      env: { 
        ...process.env, 
        GITHUB_TOKEN: process.env.GITHUB_TOKEN 
      }
    });

    return {
      success: true,
      message: 'Desktop Forge initiated. GitHub Actions release pipeline triggered.',
      logs: stdout,
      errors: stderr
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Critical failure during Desktop Forge.',
      logs: error.stdout || '',
      errors: error.stderr || error.message
    };
  }
}
