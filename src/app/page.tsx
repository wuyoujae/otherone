'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron';
import { hydrateAuthSession } from '@/lib/auth-session';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const api = getElectronAPI();

      if (!api) {
        router.replace('/setup');
        return;
      }

      try {
        const bootstrapStatus = await api.invoke('app-config:get-bootstrap') as {
          needsSetup?: boolean;
          hasAuthSession?: boolean;
        } | null;

        if (cancelled) {
          return;
        }

        if (bootstrapStatus?.needsSetup) {
          router.replace('/setup');
          return;
        }

        const session = await hydrateAuthSession();
        if (cancelled) {
          return;
        }

        if (session?.token || bootstrapStatus?.hasAuthSession) {
          router.replace('/dashboard');
          return;
        }

        router.replace('/login');
      } catch {
        if (!cancelled) {
          router.replace('/setup');
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="desktop-shell-height flex items-center justify-center bg-surface">
      <div className="flex items-center gap-3 text-sm text-foreground-muted">
        <Loader2 size={18} className="animate-spin" />
        <span>Loading workspace...</span>
      </div>
    </div>
  );
}
