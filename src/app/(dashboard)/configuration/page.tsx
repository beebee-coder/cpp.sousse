'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * La gestion des champs de configuration (Attributs Personnalisés) est
 * centralisée dans la Bibliothèque de Templates (`/procedures/templates`).
 * Cette route legacy est conservée uniquement comme redirection pour ne
 * pas casser d'éventuels favoris/liens existants.
 */
export default function ConfigurationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/procedures/templates');
  }, [router]);
  return null;
}
