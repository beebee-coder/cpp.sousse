import { isDesktop } from '@/lib/platform';

export type HybridMode = 'web' | 'hybride' | 'locale';

export interface HybridCapabilities {
  canUseCloudAPI: boolean;
  canUseNativeGroq: boolean;
  canUseLocalRAG: boolean;
  canUseLocalDB: boolean;
  canStream: boolean;
  fallbackAvailable: boolean;
}

export function detectHybridCapabilities(mode: HybridMode, online: boolean): HybridCapabilities {
  const isTauri = isDesktop;

  if (mode === 'web') {
    return {
      canUseCloudAPI: true,
      canUseNativeGroq: false,
      canUseLocalRAG: true,
      canUseLocalDB: false,
      canStream: true,
      fallbackAvailable: false,
    };
  }

  if (mode === 'hybride') {
    return {
      canUseCloudAPI: online,
      canUseNativeGroq: isTauri,
      canUseLocalRAG: isTauri,
      canUseLocalDB: isTauri,
      canStream: true,
      fallbackAvailable: true,
    };
  }

  if (mode === 'locale') {
    return {
      canUseCloudAPI: false,
      canUseNativeGroq: isTauri,
      canUseLocalRAG: isTauri,
      canUseLocalDB: isTauri,
      canStream: isTauri,
      fallbackAvailable: false,
    };
  }

  return {
    canUseCloudAPI: false,
    canUseNativeGroq: false,
    canUseLocalRAG: false,
    canUseLocalDB: false,
    canStream: false,
    fallbackAvailable: false,
  };
}

export function getPreferredProvider(mode: HybridMode, capabilities: HybridCapabilities): string {
  if (mode === 'web') return 'Groq LPU + Pro-Search (cloud)';
  if (mode === 'hybride') return capabilities.canUseNativeGroq ? 'Groq/LLAMA-3.3 (NATIF)' : 'Groq LPU + Pro-Search (cloud)';
  if (mode === 'locale') return 'Groq/LLAMA-3.3 (NATIF)';
  return 'INCONNU';
}
