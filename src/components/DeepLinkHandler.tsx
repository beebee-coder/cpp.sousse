"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function DeepLinkHandler() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Vérifier si on est dans l'environnement Tauri
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/plugin-deep-link').then((deepLink) => {
        deepLink.onOpenUrl(async (urls) => {
          const url = urls[0];
          if (url && url.startsWith('visionode://login')) {
            setIsVerifying(true);
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            if (token) {
              try {
                // Envoyer le token à l'API locale pour valider et créer le cookie de session
                const res = await fetch('/api/auth/verify-magic-link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token }),
                });

                if (res.ok) {
                  // Session établie, forcer un rechargement vers le dashboard
                  window.location.href = '/dashboard';
                } else {
                  console.error('Échec de la validation du lien magique');
                  setIsVerifying(false);
                }
              } catch (e) {
                console.error("Token invalide ou corrompu", e);
                setIsVerifying(false);
              }
            } else {
              setIsVerifying(false);
            }
          }
        }).catch(console.error);
      }).catch(console.error);
    }
  }, [router]);

  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold font-headline uppercase tracking-widest text-primary">Authentification en cours</h2>
        <p className="text-sm text-muted-foreground font-code mt-2">Synchronisation des identifiants...</p>
      </div>
    );
  }

  return null;
}
