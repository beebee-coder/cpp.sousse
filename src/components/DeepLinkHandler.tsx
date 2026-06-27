"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Vérifier si on est dans l'environnement Tauri
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/plugin-deep-link').then((deepLink) => {
        deepLink.onOpenUrl((urls) => {
          const url = urls[0];
          if (url && url.startsWith('visionode://auth')) {
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            if (token) {
              try {
                // Le token est en base64 : { firstName, lastName, role, exp }
                const decoded = JSON.parse(atob(token));
                if (decoded && decoded.role) {
                  // Sauvegarder la session locale
                  localStorage.setItem('visionode-desktop-session', token);
                  localStorage.setItem('visionode-user-role', decoded.role);
                  localStorage.setItem('visionode-user-name', `${decoded.firstName} ${decoded.lastName}`);
                  
                  // Rediriger vers le dashboard
                  router.push('/dashboard');
                }
              } catch (e) {
                console.error("Token invalide ou corrompu", e);
              }
            }
          }
        }).catch(console.error);
      }).catch(console.error);
    }
  }, [router]);

  return null;
}
