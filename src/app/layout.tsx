import type { Metadata } from 'next';
import './globals.css';
import { PlatformProvider } from '@/components/PlatformProvider';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { Toaster } from '@/components/ui/toaster';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { auth } from '@/lib/auth';
import { SessionProvider } from '@/components/SessionProvider';
import { AppChrome } from '@/components/dashboard/AppChrome';
import { ModeAwareLayout } from '@/components/ModeAwareLayout';
import { AuthGate } from '@/components/auth/AuthGate';
import type { SessionUser } from '@/components/SessionProvider';
import { LazyAmbientBackground } from '@/components/three/LazyAmbientBackground';
import { ensureLocalDBInitialized } from '@/lib/db/local-db';

const fontInter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
});

const fontSpaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'], 
  variable: '--font-space-grotesk',
  display: 'swap',
});

const fontSourceCodePro = Source_Code_Pro({ 
  subsets: ['latin'], 
  variable: '--font-source-code-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisioNode Control | CCP Industrial Vision',
  description: 'Industrial Computer Vision Control Platform',
  icons: {
    // Favicon inline pour éviter les erreurs 404 Google Workstations polluantes
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👁️</text></svg>',
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDesktop = process.env.TAURI_ENV === 'true';

  if (!isDesktop) {
    try {
      await ensureLocalDBInitialized();
    } catch (e) {
      console.warn('[LAYOUT] Initialisation .local-db ignorée (FS read-only):', e);
    }
  }

  let initialUser: SessionUser | undefined;
  if (!isDesktop) {
    const session = await auth();
    const sUser = session?.user as SessionUser | undefined;
    initialUser = sUser
      ? {
          id: sUser.id,
          firstName: sUser.firstName,
          lastName: sUser.lastName,
          email: sUser.email ?? '',
          role: sUser.role,
          approved: sUser.approved,
          image: sUser.image ?? null,
          createdAt: sUser.createdAt,
        }
      : undefined;
  }

  return (
    <html lang="fr" className="dark">
      <body className={`${fontInter.variable} ${fontSpaceGrotesk.variable} ${fontSourceCodePro.variable} font-body antialiased selection:bg-primary/30 selection:text-primary`}>
        <PlatformProvider initialIsDesktop={isDesktop}>
          <SessionProvider initialUser={initialUser}>
            <ModeAwareLayout>
              <LazyAmbientBackground />
              <DeepLinkHandler />
              <AuthGate />
              <AppChrome>{children}</AppChrome>
              <Toaster />
            </ModeAwareLayout>
          </SessionProvider>
        </PlatformProvider>
      </body>
    </html>
  );
}
