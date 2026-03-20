'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hydrateAuthSession } from '@/lib/auth-session';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const session = await hydrateAuthSession();
      if (!active) {
        return;
      }

      if (!session?.token) {
        router.replace('/login');
        return;
      }

      setAuthorized(true);
    };

    void checkAuth();

    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="desktop-shell-height flex items-center justify-center bg-surface-subtle">
        <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
