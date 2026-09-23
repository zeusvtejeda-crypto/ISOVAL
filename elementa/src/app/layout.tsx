import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { CelebrationHost } from '@/components/gamification/CelebrationHost';
import { AppShell } from '@/components/layout/AppShell';
import { ChromeProvider } from '@/components/layout/ChromeContext';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { THEME_INIT_SCRIPT } from '@/services/theme';
import { ProgressProvider } from '@/store/ProgressProvider';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Elementa · Aprende la tabla periódica jugando',
    template: '%s · Elementa',
  },
  description:
    'Memoriza los 118 elementos de la tabla periódica jugando: flashcards, trivia, exámenes, retos contrarreloj y repetición espaciada. Funciona sin conexión.',
  applicationName: 'Elementa',
  keywords: ['tabla periódica', 'elementos químicos', 'química', 'aprender', 'flashcards', 'quiz'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elementa',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0c18' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={nunito.variable} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado (sin destello). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-bg font-sans text-fg antialiased">
        <ProgressProvider>
          <ChromeProvider>
            <AppShell>{children}</AppShell>
            <CelebrationHost />
          </ChromeProvider>
        </ProgressProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
