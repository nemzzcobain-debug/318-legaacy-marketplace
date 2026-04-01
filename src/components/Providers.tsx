'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import InstallPWA from '@/components/pwa/InstallPWA';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <ServiceWorkerRegistration />
        <InstallPWA />
      </ThemeProvider>
    </SessionProvider>
  );
}
