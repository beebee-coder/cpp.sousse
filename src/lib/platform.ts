/**
 * @fileOverview Détection de plateforme et pont hybride Web/Desktop (Tauri).
 */

export const isBrowser = typeof window !== 'undefined';
export const isDesktop = isBrowser && (
  (window as any).__TAURI_METADATA__ !== undefined ||
  (window as any).__TAURI_IPC__ !== undefined ||
  (window as any).__TAURI_INTERNALS__ !== undefined ||
  (window as any).__TAURI__ !== undefined
);
export const isWeb = !isDesktop;

export type PlatformType = 'Tauri Natif' | 'Vercel Web';

export interface PlatformCapabilities {
  name: string;
  status: 'actif' | 'indisponible' | 'émulé';
}

export function detectDesktop(): boolean {
  if (!isBrowser) return false;
  return (
    (window as any).__TAURI_METADATA__ !== undefined ||
    (window as any).__TAURI_IPC__ !== undefined ||
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined
  );
}

export function performHealthCheck() {
  const issues: string[] = [];
  if (!isBrowser) issues.push('ENV_SSR_DETECTE');
  const detected = detectDesktop();
  if (detected && !(window as any).__TAURI__) issues.push('PONT_TAURI_INTROUVABLE');
  
  return {
    healthy: issues.length === 0,
    issues,
    timestamp: new Date().toISOString()
  };
}

export function getPlatformInfo() {
  const detectedIsDesktop = detectDesktop();
  const platform: PlatformType = detectedIsDesktop ? 'Tauri Natif' : 'Vercel Web';
  
  const capabilities: PlatformCapabilities[] = detectedIsDesktop 
    ? [
        { name: 'Système Fichiers Natif', status: 'actif' },
        { name: 'Accès Caméra USB', status: 'actif' },
        { name: 'Traitement Sharp Local', status: 'actif' },
        { name: 'Accélération Matérielle', status: 'actif' }
      ]
    : [
        { name: 'Flux WebRTC', status: 'actif' },
        { name: 'Pipeline IA Cloud', status: 'actif' },
        { name: 'Registre Serverless', status: 'actif' },
        { name: 'Traitement Local', status: 'émulé' }
      ];

  return { isDesktop: detectedIsDesktop, isWeb: !detectedIsDesktop, platform, capabilities };
}
