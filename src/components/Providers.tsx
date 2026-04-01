'use client';

import { SessionProvider } from 'next-auth/react';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import InstallPWA from '@/components/pwa/InstallPWA';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ServiceWorkerRegistration />
      <InstallPWA />
    </SessionProvider>
  );
}
