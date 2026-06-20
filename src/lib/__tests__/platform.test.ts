
import { describe, it, expect, vi } from 'vitest';
import { isDesktop, isWeb, getPlatformInfo } from '../platform';

describe('Platform Bridge Logic', () => {
  it('identifies web environment by default', () => {
    // In a testing environment without window.__TAURI_METADATA__
    expect(isWeb).toBe(true);
    expect(isDesktop).toBe(false);
  });

  it('returns correct capabilities for web', () => {
    const info = getPlatformInfo();
    expect(info.platform).toBe('Vercel Web');
    expect(info.capabilities).toContainEqual({ name: 'Pipeline IA Cloud', status: 'actif' });
  });

  it('correctly maps emulated features on web', () => {
    const info = getPlatformInfo();
    const localProcessing = info.capabilities.find(c => c.name === 'Traitement Local');
    expect(localProcessing?.status).toBe('émulé');
  });
});
