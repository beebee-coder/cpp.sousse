'use client';

import { useEffect } from 'react';
import { onEviction } from '@/lib/embedded-vector-store';
import { toast } from '@/hooks/use-toast';

/**
 * Affiche un toast quand le store vectoriel embarqué évince silencieusement
 * des vecteurs (politique LRU 50k documents / 50 Mo). Sans cela, l'utilisateur
 * ignore la disparition de vecteurs indexés.
 */
export function useEvictionToast(): void {
  useEffect(() => {
    const off = onEviction((count) => {
      if (count <= 0) return;
      toast({
        title: 'Index vectoriel tronqué',
        description: `${count} document(s) évincé(s) du cache local (limite 50 000 docs / 50 Mo). Ré-indexez si nécessaire.`,
        variant: 'default',
      });
    });
    return off;
  }, []);
}
