'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Search, FolderPlus, ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { AiChatPanel } from '@/components/ui/ai-chat-panel';
import { getElectronAPI } from '@/lib/electron';

type View = 'collapsed' | 'actions' | 'chat';
type Direction = 'down' | 'up';

interface Layout {
  direction: Direction;
  ballX: number;
}

const BRIGHTNESS_THRESHOLD_TO_DARK = 110;
const BRIGHTNESS_THRESHOLD_TO_LIGHT = 145;
const BALL_SIZE = 48;
const BALL_AREA = 64;

export default function FloatingBallPage() {
  const t = useTranslations('floatingBall');
  const [view, setView] = useState<View>('collapsed');
  const [panelVisible, setPanelVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isDarkBg, setIsDarkBg] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const prevView = useRef<View>('collapsed');

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, []);

  // Listen for brightness updates
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    const handler = (...args: unknown[]) => {
      const brightness = args[0] as number;
      if (typeof brightness !== 'number') return;
      setIsDarkBg((prev) => {
        if (prev && brightness > BRIGHTNESS_THRESHOLD_TO_LIGHT) return false;
        if (!prev && brightness < BRIGHTNESS_THRESHOLD_TO_DARK) return true;
        return prev;
      });
    };
    api.on('floating-ball:brightness', handler);
    return () => { api.removeAllListeners('floating-ball:brightness'); };
  }, []);

  // Listen for layout info from main process
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    const handler = (...args: unknown[]) => {
      const data = args[0] as Layout;
      if (data && typeof data.direction === 'string') {
        setLayout(data);
        // Trigger panel animation after layout is set
        requestAnimationFrame(() => {
          setPanelVisible(true);
        });
      }
    };
    api.on('floating-ball:layout', handler);
    return () => { api.removeAllListeners('floating-ball:layout'); };
  }, []);

  const sendResize = useCallback((expanded: boolean) => {
    const api = getElectronAPI();
    if (api) api.send('floating-ball:resize', { expanded });
  }, []);

  const handleBallClick = useCallback(() => {
    setView('actions');
    sendResize(true);
  }, [sendResize]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setPanelVisible(false);
    setTimeout(() => {
      setView('collapsed');
      setClosing(false);
      setLayout(null);
      sendResize(false);
    }, 220);
  }, [sendResize]);

  const openChat = useCallback(() => {
    prevView.current = 'actions';
    setView('chat');
  }, []);

  const backToActions = useCallback(() => {
    setView('actions');
  }, []);

  const isExpanded = view !== 'collapsed' || closing;
  const dir = layout?.direction ?? 'down';

  // ---- Collapsed state: just the ball ----
  if (!isExpanded) {
    return (
      <div
        className="w-full h-full flex items-center justify-center floating-ball-drag"
        style={{ color: isDarkBg ? '#ffffff' : '#09090b', transition: 'color 0.4s ease' }}
      >
        <button
          onClick={handleBallClick}
          className="floating-ball-no-drag w-[48px] h-[48px] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-300 cursor-pointer"
          style={{
            filter: isDarkBg
              ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.2))'
              : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))',
            transition: 'filter 0.4s ease',
          }}
        >
          <AnimatedLogo size={BALL_SIZE} />
        </button>
      </div>
    );
  }

  // ---- Expanded state: ball + panel ----
  const ballLeft = layout ? layout.ballX + (BALL_AREA - BALL_SIZE) / 2 : 8;
  const ballTop = dir === 'down' ? (BALL_AREA - BALL_SIZE) / 2 : undefined;
  const ballBottom = dir === 'up' ? (BALL_AREA - BALL_SIZE) / 2 : undefined;

  return (
    <div className={cn('w-full h-full flex', dir === 'down' ? 'flex-col' : 'flex-col-reverse')}>
      {/* Ball row - stays at edge, same screen position */}
      <div className="relative flex-shrink-0" style={{ height: BALL_AREA }}>
        <button
          onClick={handleClose}
          className="absolute flex items-center justify-center w-[48px] h-[48px] cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ left: ballLeft, top: ballTop, bottom: ballBottom }}
        >
          <div className={cn(
            'w-full h-full rounded-full flex items-center justify-center transition-all duration-300',
            'bg-surface border border-[var(--border-strong)] shadow-sm',
            'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
          )}>
            <X size={18} />
          </div>
        </button>
      </div>

      {/* Gap */}
      <div className="flex-shrink-0 h-2" />

      {/* Panel */}
      <div
        className={cn(
          'flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden',
          'bg-surface border border-[var(--border-strong)]',
          'shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.04)]',
        )}
        style={{
          transformOrigin: dir === 'down' ? 'top center' : 'bottom center',
          opacity: panelVisible ? 1 : 0,
          transform: panelVisible
            ? 'scaleY(1) translateY(0)'
            : `scaleY(0.85) translateY(${dir === 'down' ? '-12px' : '12px'})`,
          transition: closing
            ? 'opacity 0.18s ease-in, transform 0.18s ease-in'
            : 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {view === 'actions' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-semibold tracking-tight">{t('actions')}</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openChat}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[var(--border)] bg-surface hover:bg-surface-subtle hover:border-foreground-lighter transition-all duration-200 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-foreground text-white flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    <Sparkles size={20} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{t('aiChat')}</span>
                </button>
                <button className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[var(--border)] bg-surface hover:bg-surface-subtle hover:border-foreground-lighter transition-all duration-200 cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-[var(--border)] text-foreground-muted flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    <Search size={20} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{t('quickSearch')}</span>
                </button>
                <button className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[var(--border)] bg-surface hover:bg-surface-subtle hover:border-foreground-lighter transition-all duration-200 cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-[var(--border)] text-foreground-muted flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    <FolderPlus size={20} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{t('newProject')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <button
                onClick={backToActions}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs text-foreground-muted">{t('back')}</span>
            </div>
            <AiChatPanel compact onClose={handleClose} className="flex-1 min-h-0" />
          </div>
        )}
      </div>
    </div>
  );
}
