'use server';

import { runGitSync } from '@/lib/git-sync';

/**
 * Server Action to trigger the local sync.sh script for WEB update.
 */
export async function triggerGitHubSync() {
  try {
    const result = await runGitSync('web');
    
    if (result.success) {
      return { 
        success: true, 
        message: 'Web Production Uplink complete. Registry synchronized.',
        logs: result.logs,
        errors: result.errors
      };
    } else {
      return { 
        success: false, 
        message: 'Failure during Web Uplink.',
        logs: result.logs,
        errors: result.errors
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: 'Critical failure during Web Uplink.',
      logs: '',
      errors: error.message
    };
  }
}

/**
 * Server Action to trigger a Desktop Forge via GitHub Actions.
 */
export async function triggerDesktopForge() {
  try {
    const result = await runGitSync('desktop');

    if (result.success) {
      return {
        success: true,
        message: 'Desktop Forge initiated. GitHub Actions release pipeline triggered.',
        logs: result.logs,
        errors: result.errors
      };
    } else {
      return {
        success: false,
        message: 'Failure during Desktop Forge.',
        logs: result.logs,
        errors: result.errors
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'Critical failure during Desktop Forge.',
      logs: '',
      errors: error.message
    };
  }
}

