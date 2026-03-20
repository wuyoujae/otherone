'use client';

import { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import Image from 'next/image';
import { getElectronAPI } from '@/lib/electron';
import { cn } from '@/lib/utils';

const TITLEBAR_HEIGHT = 72;

function WindowControlButton({
  label,
  variant = 'default',
  onClick,
  children,
}: {
  label: string;
  variant?: 'default' | 'close';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'desktop-titlebar-no-drag group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-200',
        'border-black/8 bg-white/65 text-zinc-700 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl',
        'hover:-translate-y-[1px] hover:border-black/12 hover:bg-white hover:text-zinc-950',
        'active:translate-y-0 active:scale-[0.98]',
        variant === 'close' &&
          'hover:border-[#f2b8bf] hover:bg-[#fff1f3] hover:text-[#b42318]'
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_70%)] opacity-80" />
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4.75 2.5H10.5V8.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.25 4.75H3.5V10.5H9.25V4.75Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

function detectPlatform(): string {
  if (typeof window === 'undefined') {
    return 'web';
  }

  const apiPlatform = getElectronAPI()?.platform;
  if (apiPlatform) {
    return apiPlatform;
  }

  const uaPlatform = window.navigator.platform.toLowerCase();
  if (uaPlatform.includes('mac')) {
    return 'darwin';
  }
  if (uaPlatform.includes('win')) {
    return 'win32';
  }
  if (uaPlatform.includes('linux')) {
    return 'linux';
  }

  return 'web';
}

export function DesktopTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const platform = detectPlatform();
  const visible = platform === 'win32' || platform === 'linux';

  useEffect(() => {
    const api = getElectronAPI();
    const shouldShow = visible;
    document.documentElement.style.setProperty(
      '--desktop-titlebar-height',
      shouldShow ? `${TITLEBAR_HEIGHT}px` : '0px'
    );

    document.body.style.setProperty(
      '--desktop-titlebar-height',
      shouldShow ? `${TITLEBAR_HEIGHT}px` : '0px'
    );

    if (!shouldShow || !api) {
      setIsMaximized(false);
      return;
    }

    void api.invoke('window:get-state').then((state) => {
      const nextState = state as { isMaximized?: boolean } | null;
      setIsMaximized(Boolean(nextState?.isMaximized));
    });

    const syncWindowState = (payload: unknown) => {
      const nextState = payload as { isMaximized?: boolean } | undefined;
      setIsMaximized(Boolean(nextState?.isMaximized));
    };

    api.on('window:state', syncWindowState);

    return () => {
      api.removeAllListeners('window:state');
      document.documentElement.style.setProperty('--desktop-titlebar-height', '0px');
      document.body.style.setProperty('--desktop-titlebar-height', '0px');
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const api = getElectronAPI();

  return (
    <header className="desktop-titlebar-drag sticky top-0 z-[120] flex h-[var(--desktop-titlebar-height)] shrink-0 items-center px-3 py-3">
      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      <div className="relative flex h-full w-full items-center justify-between overflow-hidden rounded-[24px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,244,245,0.86))] px-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_32%)]" />

        <div className="relative z-[1] flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-3 rounded-[18px] bg-white/45 px-2.5 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/8 bg-white/80 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)]">
              <Image src="/otherone-icon.svg" alt="OtherOne" width={24} height={24} className="h-6 w-6" />
            </div>

            <span className="truncate text-[16px] font-semibold tracking-[-0.04em] text-zinc-950">
              OtherOne
            </span>
          </div>
        </div>

        <div className="desktop-titlebar-no-drag relative z-[1] flex items-center gap-2 rounded-full border border-black/8 bg-white/48 p-1.5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl">
          <WindowControlButton
            label="Minimize window"
            onClick={() => api?.send('window:minimize', null)}
          >
            <Minus size={16} strokeWidth={2.2} />
          </WindowControlButton>

          <WindowControlButton
            label={isMaximized ? 'Restore window' : 'Maximize window'}
            onClick={() => api?.send('window:toggle-maximize', null)}
          >
            {isMaximized ? <RestoreIcon /> : <Square size={14} strokeWidth={2} />}
          </WindowControlButton>

          <WindowControlButton
            label="Close window"
            variant="close"
            onClick={() => api?.send('window:close', null)}
          >
            <X size={16} strokeWidth={2.2} />
          </WindowControlButton>
        </div>
      </div>
    </header>
  );
}
