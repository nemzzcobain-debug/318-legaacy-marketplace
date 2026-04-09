'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import InstallPWA from '@/components/pwa/InstallPWA';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
