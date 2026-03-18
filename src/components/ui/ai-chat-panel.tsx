'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ArrowUp,
  Paperclip,
  Globe,
  Plus,
  Code,
  Bug,
  Zap,
  Pen,
  User,
  Bot,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatPanelProps {
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

export function AiChatPanel({ onClose, compact = false, className }: AiChatPanelProps) {
  const t = useTranslations('globalAi');
  const [promptValue, setPromptValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasContent = promptValue.trim().length > 0;

  const suggestChips = [
    { icon: Code, label: t('chipExplain') },
    { icon: Bug, label: t('chipDebug') },
    { icon: Zap, label: t('chipOptimize') },
    { icon: Pen, label: t('chipWrite') },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, []);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    if (!hasContent || sending) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: promptValue.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPromptValue('');
    setSending(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'This is a placeholder response. AI integration coming soon.',
      };
      setMessages((prev) => [...prev, aiMsg]);
      setSending(false);
    }, 1500);
  }, [hasContent, sending, promptValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-semibold tracking-tight">otherone-agent</span>
        <div className="flex items-center gap-2">
          {!compact && (
            <span className="text-[0.65rem] text-foreground-lighter font-mono bg-surface-subtle px-1.5 py-0.5 rounded border border-[var(--border)]">
              &#8984;J
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className={cn(
        'flex-1 overflow-y-auto px-5 py-4',
        compact ? 'min-h-[160px] max-h-[280px]' : 'min-h-[200px] max-h-[360px]'
      )}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
            <p className="text-sm text-foreground-muted text-center">
              {t('emptyHint')}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {suggestChips.map((chip, i) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setPromptValue(chip.label);
                    textareaRef.current?.focus();
                  }}
                  className="fab-chip flex items-center gap-1.5 bg-surface border border-[var(--border)] pl-3 pr-3.5 py-1.5 rounded-full text-xs text-foreground-muted cursor-pointer transition-all duration-200 hover:border-foreground-lighter hover:text-foreground hover:bg-surface-subtle"
                  style={{ animationDelay: `${i * 0.06 + 0.2}s` }}
                >
                  <chip.icon size={12} />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'fab-msg flex gap-3 max-w-full',
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    msg.role === 'user'
                      ? 'bg-foreground text-white'
                      : 'bg-surface-subtle border border-[var(--border)] text-foreground-muted'
                  )}
                >
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%]',
                    msg.role === 'user'
                      ? 'bg-foreground text-white rounded-tr-md'
                      : 'bg-surface-subtle border border-[var(--border)] text-foreground rounded-tl-md'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="fab-msg flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-[var(--border)] flex items-center justify-center flex-shrink-0 mt-0.5 text-foreground-muted">
                  <Bot size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-surface-subtle border border-[var(--border)] px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="fab-dot w-1.5 h-1.5 rounded-full bg-foreground-lighter" />
                    <div className="fab-dot w-1.5 h-1.5 rounded-full bg-foreground-lighter" style={{ animationDelay: '0.15s' }} />
                    <div className="fab-dot w-1.5 h-1.5 rounded-full bg-foreground-lighter" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 pb-3">
        <div className="rounded-xl border border-[var(--border)] bg-surface-subtle transition-all duration-300 focus-within:border-foreground-lighter focus-within:bg-surface focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]">
          <textarea
            ref={textareaRef}
            value={promptValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full border-none resize-none text-sm leading-relaxed text-foreground outline-none bg-transparent placeholder:text-foreground-lighter/50 px-4 pt-3 pb-1 max-h-[160px]"
            placeholder={t('placeholder')}
          />
          <div className="flex justify-between items-center px-2 pb-2 pt-1">
            <div className="flex items-center gap-0.5">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-hover hover:text-foreground">
                <Plus size={16} />
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-hover hover:text-foreground">
                <Paperclip size={15} />
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-hover hover:text-foreground">
                <Globe size={15} />
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={!hasContent || sending}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                hasContent && !sending
                  ? 'bg-foreground text-white hover:bg-zinc-700 prompt-send-btn'
                  : 'bg-transparent text-foreground-lighter cursor-default'
              )}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
