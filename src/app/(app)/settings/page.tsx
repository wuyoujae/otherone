'use client';

import { useState, useCallback, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocale } from 'next-intl';
import {
  Search,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  GripVertical,
  Box,
  User,
  Globe,
  Keyboard,
  Cpu,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isElectron, getElectronAPI } from '@/lib/electron';

type NavKey = 'account' | 'preferences' | 'shortcuts' | 'modelApi';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [activeNav, setActiveNav] = useState<NavKey>('account');
  const [search, setSearch] = useState('');

  const navGroups = [
    {
      title: t('groupUser'),
      items: [
        { key: 'account' as NavKey, label: t('navAccount'), icon: User },
        { key: 'preferences' as NavKey, label: t('navPreferences'), icon: Globe },
        { key: 'shortcuts' as NavKey, label: t('navShortcuts'), icon: Keyboard },
      ],
    },
    {
      title: t('groupAi'),
      items: [
        { key: 'modelApi' as NavKey, label: t('navModelApi'), icon: Cpu },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search header */}
      <header className="px-8 py-6 border-b border-[var(--border)] bg-surface flex items-center justify-between z-[5]">
        <div className="relative flex-1 max-w-[600px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-12 rounded-lg border border-[var(--border-strong)] bg-surface-subtle text-base text-foreground placeholder:text-foreground-lighter outline-none transition-all focus:bg-surface focus:border-foreground focus:ring-1 focus:ring-foreground"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground-lighter bg-[var(--border)] px-1.5 py-0.5 rounded font-mono pointer-events-none">
            &#8984; ,
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <aside className="w-60 bg-surface-subtle border-r border-[var(--border)] py-5 overflow-y-auto hidden md:block">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="px-6 text-xs font-semibold text-foreground-lighter uppercase tracking-wider mb-2 mt-4 first:mt-0">
                {group.title}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={cn(
                    'w-full text-left px-6 py-2 text-sm text-foreground-muted cursor-pointer transition-all duration-150 border-l-2 border-transparent flex items-center gap-2.5',
                    'hover:text-foreground',
                    activeNav === item.key && 'text-foreground font-medium bg-black/[0.03] border-l-foreground'
                  )}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Right content */}
        <div className="flex-1 p-8 md:px-12 overflow-y-auto">
          {activeNav === 'account' && <AccountSection />}
          {activeNav === 'preferences' && <PreferencesSection />}
          {activeNav === 'shortcuts' && <ShortcutsSection />}
          {activeNav === 'modelApi' && <ModelApiSection />}
        </div>
      </div>
    </div>
  );
}

/* ============ Account & Security ============ */
function AccountSection() {
  const t = useTranslations('settings');
  const [user, setUser] = useState<{ id?: string; displayName?: string; email?: string; createdAt?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const avatarLetter = user?.displayName?.charAt(0)?.toUpperCase() || '?';

  const fields = [
    { label: t('username'), value: user?.displayName || '-' },
    { label: t('email'), value: user?.email || '-' },
    { label: t('uid'), value: user?.id || '-', mono: true },
    { label: t('joinedAt'), value: formatDate(user?.createdAt) },
  ];

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight mb-8">{t('accountTitle')}</h2>
      <div className="flex items-center gap-5 mb-8 pb-8 border-b border-[var(--border)]">
        <div className="w-16 h-16 rounded-full bg-foreground text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {avatarLetter}
        </div>
        <div>
          <div className="text-lg font-semibold">{user?.displayName || '...'}</div>
          <div className="text-sm text-foreground-muted">{user?.email || ''}</div>
        </div>
      </div>
      <div className="flex flex-col gap-0">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center py-4 border-b border-[var(--border)] last:border-b-0">
            <span className="w-40 text-sm text-foreground-muted flex-shrink-0">{f.label}</span>
            <span className={cn('text-sm', f.mono && 'font-mono text-foreground-lighter')}>{f.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Preferences ============ */
function PreferencesSection() {
  const t = useTranslations('settings');
  const currentLocale = useLocale();
  const [floatingBallEnabled, setFloatingBallEnabled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = isElectron();
    setIsDesktop(desktop);
    if (desktop) {
      const saved = localStorage.getItem('floatingBallEnabled');
      setFloatingBallEnabled(saved === 'true');
    }
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const api = getElectronAPI();
    if (!api) return;
    const handler = (...args: unknown[]) => {
      const data = args[0] as { enabled: boolean } | undefined;
      if (data) {
        setFloatingBallEnabled(data.enabled);
        localStorage.setItem('floatingBallEnabled', String(data.enabled));
      }
    };
    api.on('floating-ball:toggled', handler);
    return () => {
      api.removeAllListeners('floating-ball:toggled');
    };
  }, [isDesktop]);

  const toggleFloatingBall = useCallback(() => {
    const newVal = !floatingBallEnabled;
    setFloatingBallEnabled(newVal);
    localStorage.setItem('floatingBallEnabled', String(newVal));
    const api = getElectronAPI();
    if (api) {
      api.send('floating-ball:toggle', { enabled: newVal });
    }
  }, [floatingBallEnabled]);

  const switchLanguage = (newLang: string) => {
    document.cookie = `NEXT_LOCALE=${newLang};path=/;max-age=31536000`;
    window.location.reload();
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight mb-8">{t('preferencesTitle')}</h2>

      {/* Language */}
      <div className="py-5 border-b border-[var(--border)]">
        <div className="flex justify-between items-start gap-10">
          <div>
            <div className="text-base font-medium mb-1">{t('language')}</div>
            <div className="text-sm text-foreground-muted">{t('languageDesc')}</div>
          </div>
          <div className="flex p-1 rounded-lg bg-surface-subtle border border-[var(--border)] gap-1">
            <button
              onClick={() => switchLanguage('zh')}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                currentLocale === 'zh' ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              {t('langZh')}
            </button>
            <button
              onClick={() => switchLanguage('en')}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                currentLocale === 'en' ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              {t('langEn')}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Ball - Desktop only */}
      {isDesktop && (
        <div className="py-5 border-b border-[var(--border)]">
          <div className="flex justify-between items-center gap-10">
            <div>
              <div className="text-base font-medium mb-1">{t('floatingBall')}</div>
              <div className="text-sm text-foreground-muted">{t('floatingBallDesc')}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={floatingBallEnabled}
                onChange={toggleFloatingBall}
                className="sr-only peer"
              />
              <div className="w-10 h-[22px] relative">
                <span className="switch-slider" />
              </div>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============ Keyboard Shortcuts ============ */
interface Shortcut {
  id: string;
  command: string;
  keys: string;
}

const shortcutDefs = [
  { id: '1', cmdKey: 'cmdNewProject', keys: '⌘ N' },
  { id: '2', cmdKey: 'cmdSearch', keys: '⌘ K' },
  { id: '3', cmdKey: 'cmdSettings', keys: '⌘ ,' },
  { id: '4', cmdKey: 'cmdToggleSidebar', keys: '⌘ B' },
  { id: '5', cmdKey: 'cmdAiGenerate', keys: '⌘ ↵' },
  { id: '6', cmdKey: 'cmdSave', keys: '⌘ S' },
  { id: '7', cmdKey: 'cmdCloseTab', keys: '⌘ W' },
  { id: '8', cmdKey: 'cmdCommandPalette', keys: '⌘ ⇧ P' },
  { id: '9', cmdKey: 'cmdQuickOpen', keys: '⌘ P' },
  { id: '10', cmdKey: 'cmdGoToLine', keys: '⌃ G' },
  { id: '11', cmdKey: 'cmdUndo', keys: '⌘ Z' },
  { id: '12', cmdKey: 'cmdRedo', keys: '⌘ ⇧ Z' },
];

function ShortcutsSection() {
  const t = useTranslations('settings');
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() =>
    shortcutDefs.map((d) => ({ id: d.id, command: d.cmdKey, keys: d.keys }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = shortcuts.filter(
    (s) => s.command.toLowerCase().includes(filter.toLowerCase()) || s.keys.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const handleKeyCapture = (e: ReactKeyboardEvent<HTMLInputElement>, id: string) => {
    e.preventDefault();
    if (e.key === 'Escape') { setEditingId(null); return; }
    if (e.key === 'Enter') { setEditingId(null); return; }

    const parts: string[] = [];
    if (e.metaKey) parts.push('⌘');
    if (e.ctrlKey) parts.push('⌃');
    if (e.altKey) parts.push('⌥');
    if (e.shiftKey) parts.push('⇧');

    const key = e.key;
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    }

    if (parts.length > 0) {
      setShortcuts((prev) =>
        prev.map((s) => (s.id === id ? { ...s, keys: parts.join(' ') } : s))
      );
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">{t('shortcutsTitle')}</h2>
      <p className="text-sm text-foreground-muted mb-6">{t('shortcutsDesc')}</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-lighter" />
        <input
          type="text"
          placeholder={t('shortcutSearch')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-[360px] h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
        />
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex px-4 py-2.5 bg-surface-subtle border-b border-[var(--border)] text-xs font-semibold text-foreground-muted uppercase tracking-wider">
          <div className="flex-1">{t('shortcutCommand')}</div>
          <div className="w-48">{t('shortcutKeybinding')}</div>
        </div>
        {/* Rows */}
        {filtered.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex items-center px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-surface-hover/50 transition-colors"
          >
            <div className="flex-1 text-sm">{t(shortcut.command)}</div>
            <div className="w-48">
              {editingId === shortcut.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  readOnly
                  placeholder={t('pressKeys')}
                  onKeyDown={(e) => handleKeyCapture(e, shortcut.id)}
                  onBlur={() => setEditingId(null)}
                  className="h-7 px-2 w-full rounded border border-foreground bg-surface-subtle text-sm font-mono text-center outline-none ring-1 ring-foreground animate-pulse"
                />
              ) : (
                <button
                  onDoubleClick={() => setEditingId(shortcut.id)}
                  className="h-7 px-3 rounded bg-surface-subtle border border-[var(--border)] text-xs font-mono text-foreground-muted cursor-pointer hover:border-foreground-muted transition-colors"
                >
                  {shortcut.keys}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Model / API Configuration ============ */
interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  contextWindow: number;
}

function ModelApiSection() {
  const t = useTranslations('settings');
  const [providers, setProviders] = useState<ModelProvider[]>([
    {
      id: '1',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-proj-xxxxxxxxxxxxx',
      models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
      contextWindow: 128000,
    },
    {
      id: '2',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-xxxxxxxxxxxxx',
      models: ['claude-sonnet-4-20250514'],
      contextWindow: 200000,
    },
  ]);

  const addProvider = () => {
    setProviders((prev) => [
      ...prev,
      { id: `${Date.now()}`, name: '', baseUrl: '', apiKey: '', models: [], contextWindow: 128000 },
    ]);
  };

  const removeProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  const updateProvider = (id: string, field: keyof ModelProvider, value: string | number | string[]) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const moveProvider = (id: string, direction: 'up' | 'down') => {
    setProviders((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">{t('modelApiTitle')}</h2>
      <p className="text-sm text-foreground-muted mb-8">{t('modelApiDesc')}</p>

      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-subtle border border-[var(--border)] flex items-center justify-center text-foreground-lighter mb-4">
            <Box size={24} />
          </div>
          <p className="text-sm font-medium text-foreground-muted mb-1">{t('noProviders')}</p>
          <p className="text-xs text-foreground-lighter">{t('noProvidersHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {providers.map((provider, idx) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              index={idx}
              total={providers.length}
              onUpdate={updateProvider}
              onRemove={removeProvider}
              onMove={moveProvider}
            />
          ))}
        </div>
      )}

      <button
        onClick={addProvider}
        className="mt-6 flex items-center gap-2 h-10 px-5 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-medium text-foreground-muted transition-all hover:border-foreground hover:text-foreground hover:bg-surface-subtle"
      >
        <Plus size={16} />
        {t('addProvider')}
      </button>
    </section>
  );
}

/* ============ Provider Card ============ */
function ProviderCard({
  provider,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  provider: ModelProvider;
  index: number;
  total: number;
  onUpdate: (id: string, field: keyof ModelProvider, value: string | number | string[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}) {
  const t = useTranslations('settings');
  const [showKey, setShowKey] = useState(false);
  const [modelInput, setModelInput] = useState('');

  const addModel = () => {
    const val = modelInput.trim();
    if (val && !provider.models.includes(val)) {
      onUpdate(provider.id, 'models', [...provider.models, val]);
      setModelInput('');
    }
  };

  const removeModel = (model: string) => {
    onUpdate(provider.id, 'models', provider.models.filter((m) => m !== model));
  };

  const inputCls =
    'w-full h-9 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground';

  return (
    <div className="border border-[var(--border)] rounded-2xl bg-surface p-6 relative group">
      {/* Order + actions */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <span className="text-xs text-foreground-lighter font-mono mr-2">#{index + 1}</span>
        <button
          onClick={() => onMove(provider.id, 'up')}
          disabled={index === 0}
          className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => onMove(provider.id, 'down')}
          disabled={index === total - 1}
          className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pr-24">
        {/* Provider name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('providerName')}</label>
          <input
            type="text"
            value={provider.name}
            onChange={(e) => onUpdate(provider.id, 'name', e.target.value)}
            placeholder={t('providerNamePlaceholder')}
            className={inputCls}
          />
        </div>

        {/* Context window */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('contextWindow')}</label>
          <input
            type="number"
            value={provider.contextWindow}
            onChange={(e) => onUpdate(provider.id, 'contextWindow', parseInt(e.target.value) || 0)}
            className={cn(inputCls, 'font-mono')}
          />
        </div>

        {/* Base URL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('baseUrl')}</label>
          <input
            type="text"
            value={provider.baseUrl}
            onChange={(e) => onUpdate(provider.id, 'baseUrl', e.target.value)}
            placeholder={t('baseUrlPlaceholder')}
            className={cn(inputCls, 'font-mono')}
          />
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('apiKey')}</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onUpdate(provider.id, 'apiKey', e.target.value)}
              placeholder={t('apiKeyPlaceholder')}
              className={cn(inputCls, 'font-mono pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-lighter hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Models */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs font-medium text-foreground-muted">{t('models')}</label>
          <div className="flex flex-wrap items-center gap-2 p-2.5 min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-surface transition-all focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground">
            {provider.models.map((model) => (
              <span
                key={model}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-subtle border border-[var(--border)] text-xs font-mono"
              >
                {model}
                <button
                  onClick={() => removeModel(model)}
                  className="text-foreground-lighter hover:text-foreground transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addModel(); }
                if (e.key === 'Backspace' && modelInput === '' && provider.models.length > 0) {
                  removeModel(provider.models[provider.models.length - 1]);
                }
              }}
              placeholder={provider.models.length === 0 ? t('modelsPlaceholder') : ''}
              className="flex-1 min-w-[120px] h-6 border-none outline-none bg-transparent text-sm font-mono placeholder:text-foreground-lighter"
            />
          </div>
        </div>
      </div>

      {/* Remove */}
      <div className="mt-5 pt-4 border-t border-[var(--border)] flex justify-end">
        <button
          onClick={() => onRemove(provider.id)}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
        >
          <Trash2 size={13} />
          {t('removeProvider')}
        </button>
      </div>
    </div>
  );
}
