'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import InstallPWA from '@/components/pwa/InstallPWA';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Une PWA mobile peut revenir au premier plan avant que le réseau soit
      // totalement disponible. Éviter une revérification immédiate empêche
      // NextAuth de remplacer temporairement une session valide par `null`.
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <ThemeProvider>
        <LanguageProvider>
          {children}
          <ServiceWorkerRegistration />
          <InstallPWA />
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
