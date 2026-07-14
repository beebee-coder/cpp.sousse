'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/components/SessionProvider';
import { usePlatform } from '@/components/PlatformProvider';

/**
 * En mode desktop (hybride ou local), l'authentification est gérée côté client
 * (localStorage), il n'y a donc pas de redirection serveur comme en mode web.
 * Ce garde-fou renvoie systématiquement vers la page de connexion tant qu'aucune
 * session (cloud transférée ou locale) n'est établie — y compris au premier
 * lancement / installation en mode local.
 */
export function AuthGate() {
  const { status } = useSession();
  const { isDesktop, isReady } = usePlatform();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    const onAuthScreen = pathname.startsWith('/auth');
    if (isDesktop && status === 'unauthenticated' && !onAuthScreen) {
      router.replace('/auth/signin');
    }
  }, [isDesktop, isReady, status, pathname, router]);

  return null;
}
