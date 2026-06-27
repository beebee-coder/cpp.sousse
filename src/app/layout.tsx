import type {Metadata} from 'next';
import './globals.css';
import { PlatformProvider } from '@/components/PlatformProvider';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontInter.variable} ${fontSpaceGrotesk.variable} ${fontSourceCodePro.variable} font-body antialiased selection:bg-primary/30 selection:text-primary`}>
        <PlatformProvider>
          <DeepLinkHandler />
          {children}
        </PlatformProvider>
      </body>
    </html>
  );
}
