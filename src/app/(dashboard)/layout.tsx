import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isDesktop = process.env.TAURI_ENV === 'true';

  // En mode web, on vérifie l'authentification serveur
  // En mode desktop (hybride), l'application est déjà connectée localement
  if (!isDesktop) {
    const session = await auth();
    if (!session?.user) {
      redirect('/auth/signin');
    }
  }

  return <>{children}</>;
}