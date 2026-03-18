'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { setHttpErrorHandler } from '@/lib/http';

type MessageType = 'info' | 'success' | 'warning' | 'error';

interface ToastMessage {
  id: string;
  type: MessageType;
  content: string;
  exiting?: boolean;
}

interface ConfirmState {
  id: string;
  content: string;
  cancelable: boolean;
  resolve: (value: boolean) => void;
  exiting?: boolean;
}

interface MessageAPI {
  info: (content: string) => void;
  success: (content: string) => void;
  warning: (content: string) => void;
  error: (content: string) => void;
}

interface MessageContextType {
  message: MessageAPI;
  confirm: (
    content: string,
    options?: { cancelable?: boolean }
  ) => Promise<boolean>;
}

const MessageContext = createContext<MessageContextType | null>(null);

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider');
  }
  return context;
}

const iconMap: Record<MessageType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const styleMap: Record<MessageType, string> = {
  info: 'bg-zinc-50 border-zinc-200 text-zinc-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  error: 'bg-red-50 border-red-200 text-red-700',
};

export function MessageProvider({ children }: { children: ReactNode }) {
  const tc = useTranslations('common');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const counterRef = useRef(0);

  const addToast = useCallback((type: MessageType, content: string) => {
    const id = `msg-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, type, content }]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  const message: MessageAPI = {
    info: useCallback((content: string) => addToast('info', content), [addToast]),
    success: useCallback((content: string) => addToast('success', content), [addToast]),
    warning: useCallback((content: string) => addToast('warning', content), [addToast]),
    error: useCallback((content: string) => addToast('error', content), [addToast]),
  };

  const confirm = useCallback(
    (content: string, options?: { cancelable?: boolean }) => {
      return new Promise<boolean>((resolve) => {
        const id = `confirm-${++counterRef.current}`;
        setConfirmDialog({
          id,
          content,
          cancelable: options?.cancelable !== false,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (confirmDialog) {
      const { resolve } = confirmDialog;
      setConfirmDialog((prev) =>
        prev ? { ...prev, exiting: true } : null
      );
      setTimeout(() => {
        resolve(true);
        setConfirmDialog(null);
      }, 300);
    }
  }, [confirmDialog]);

  const handleCancel = useCallback(() => {
    if (confirmDialog) {
      const { resolve } = confirmDialog;
      setConfirmDialog((prev) =>
        prev ? { ...prev, exiting: true } : null
      );
      setTimeout(() => {
        resolve(false);
        setConfirmDialog(null);
      }, 300);
    }
  }, [confirmDialog]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    setHttpErrorHandler((msg) => addToast('error', msg));
    return () => setHttpErrorHandler(() => {});
  }, [addToast]);

  return (
    <MessageContext.Provider value={{ message, confirm }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
                'min-w-[280px] max-w-[420px]',
                styleMap[toast.type],
                toast.exiting ? 'animate-slide-up-out' : 'animate-slide-down'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{toast.content}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div
          className={cn(
            'fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh]',
            confirmDialog.exiting ? 'animate-fade-out' : 'animate-fade-in'
          )}
        >
          <div
            className="absolute inset-0 bg-black/20"
            onClick={confirmDialog.cancelable ? handleCancel : undefined}
          />
          <div
            className={cn(
              'relative bg-white rounded-xl border shadow-2xl p-6 min-w-[320px] max-w-[420px]',
              confirmDialog.exiting
                ? 'animate-slide-up-out'
                : 'animate-slide-down'
            )}
          >
            <div className="flex items-start gap-3 mb-6">
              <HelpCircle
                size={20}
                className="flex-shrink-0 text-foreground-muted mt-0.5"
              />
              <p className="text-sm text-foreground leading-relaxed">
                {confirmDialog.content}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              {confirmDialog.cancelable && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground-muted hover:bg-surface-hover transition-colors"
                >
                  {tc('cancel')}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-white hover:bg-zinc-800 transition-colors"
              >
                {tc('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MessageContext.Provider>
  );
}
