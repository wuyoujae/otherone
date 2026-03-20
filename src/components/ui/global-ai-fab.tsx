'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { hydrateAuthSession, onAuthChanged } from '@/lib/auth-session';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { AiChatPanel } from '@/components/ui/ai-chat-panel';

export function GlobalAiFab() {
  const t = useTranslations('globalAi');
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const syncAuth = async () => {
      const session = await hydrateAuthSession();
      if (!active) return;
      setAuthed(!!session?.token);
      setMounted(true);
    };

    void syncAuth();

    const onStorage = () => setAuthed(!!localStorage.getItem('token'));
    const offAuthChanged = onAuthChanged(() => setAuthed(!!localStorage.getItem('token')));
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      offAuthChanged();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  // Hide on setup, login, and floating-ball pages, and when not authenticated
  const isPublicPage = typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/setup') ||
     window.location.pathname.startsWith('/login') ||
     window.location.pathname.startsWith('/floating-ball'));
  if (!mounted || !authed || isPublicPage) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[998] transition-all duration-500',
          open
            ? 'bg-black/8 backdrop-blur-[3px] pointer-events-auto'
            : 'bg-transparent backdrop-blur-0 pointer-events-none opacity-0'
        )}
      />

      {/* FAB + Panel container */}
      <div
        ref={panelRef}
        className="fixed z-[999] bottom-8 left-1/2 -translate-x-1/2"
      >
        {/* The logo button */}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fab-orb relative z-[1001]',
            'w-[48px] h-[48px]',
            'flex items-center justify-center',
            'text-foreground',
            'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
            'hover:scale-110 active:scale-95',
            'cursor-pointer',
            open && 'scale-0 opacity-0 pointer-events-none',
            !open && 'scale-100 opacity-100'
          )}
          aria-label="Open AI Assistant"
        >
          <AnimatedLogo size={48} />
        </button>

        {/* Expanded panel */}
        <div
          className={cn(
            'absolute bottom-0 left-1/2',
            'w-[min(560px,calc(100vw-2rem))]',
            'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
            'origin-bottom',
            open
              ? '-translate-x-1/2 scale-100 opacity-100 pointer-events-auto'
              : '-translate-x-1/2 scale-[0.08] opacity-0 pointer-events-none'
          )}
        >
          <div
            className={cn(
              'rounded-[1.25rem] overflow-hidden',
              'bg-surface border border-[var(--border-strong)]',
              'shadow-[0_32px_100px_-16px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.03)]',
              'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
              open ? 'translate-y-0' : 'translate-y-4'
            )}
          >
            <AiChatPanel onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
