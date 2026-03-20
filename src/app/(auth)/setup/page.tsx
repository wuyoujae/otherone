'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Globe,
  Cpu,
  Layers,
  Rocket,
  Loader2,
  CircleCheck,
  CircleX,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  X,
  SkipForward,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { getElectronAPI } from '@/lib/electron';
import type { BootstrapStatus } from '@/types/electron';
import http from '@/lib/http';

const TOTAL_STEPS = 6;

interface DbConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  contextWindow: number;
}

interface StepStatus {
  dbConnected: boolean;
  dbInitialized: boolean;
  securityPasswordConfigured: boolean;
  aiConfigured: boolean;
  aiProviders: AiProvider[];
  language: string;
}

export default function SetupPage() {
  const t = useTranslations('setup');
  const currentLocale = useLocale();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [animKey, setAnimKey] = useState(0);

  // Step status
  const [status, setStatus] = useState<StepStatus>({
    dbConnected: false,
    dbInitialized: false,
    securityPasswordConfigured: false,
    aiConfigured: false,
    aiProviders: [],
    language: currentLocale,
  });
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');

  // Database form
  const [dbConfig, setDbConfig] = useState<DbConfig>({
    host: 'localhost',
    port: '5432',
    username: 'postgres',
    password: '',
    database: 'otherone',
  });
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<'success' | 'error' | null>(null);
  const [dbTestMessage, setDbTestMessage] = useState('');

  // DB Init
  const [dbInitializing, setDbInitializing] = useState(false);
  const [dbInitResult, setDbInitResult] = useState<'success' | 'error' | null>(null);
  const [dbInitMessage, setDbInitMessage] = useState('');
  const [dbConsent, setDbConsent] = useState(false);

  // AI Provider
  const [aiProviders, setAiProviders] = useState<AiProvider[]>([]);

  // Detection states
  const [dbDetected, setDbDetected] = useState(false);
  const [dbDetectedChecking, setDbDetectedChecking] = useState(false);
  const [tablesDetected, setTablesDetected] = useState(false);
  const [tablesDetectedChecking, setTablesDetectedChecking] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);
  const [showDbForm, setShowDbForm] = useState(false);
  const [showAiForm, setShowAiForm] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityPasswordConfirm, setSecurityPasswordConfirm] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityResult, setSecurityResult] = useState<'success' | 'error' | null>(null);
  const [securityMessage, setSecurityMessage] = useState('');

  const refreshBootstrap = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {
      setBootstrapLoading(false);
      return null;
    }

    setBootstrapLoading(true);
    try {
      const result = await api.invoke('app-config:get-bootstrap') as BootstrapStatus;
      setBootstrap(result);
      setBootstrapError('');
      setStatus((prev) => ({
        ...prev,
        dbConnected: result.databaseConnected,
        dbInitialized: result.databaseSchemaReady,
        securityPasswordConfigured: result.securityPasswordConfigured,
      }));

      if (result.databaseConfig) {
        setDbConfig({
          host: result.databaseConfig.host || 'localhost',
          port: String(result.databaseConfig.port || 5432),
          username: result.databaseConfig.username || 'postgres',
          password: result.databaseConfig.password || '',
          database: result.databaseConfig.database || 'otherone',
        });
      }

      return result;
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : t('bootstrap.failed'));
      return null;
    } finally {
      setBootstrapLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  useEffect(() => {
    if (!bootstrapLoading && bootstrap && !bootstrap.needsSetup) {
      window.location.replace(bootstrap.hasAuthSession ? '/dashboard' : '/login');
    }
  }, [bootstrap, bootstrapLoading]);

  // Auto-detect database connection on step 2
  useEffect(() => {
    if (step === 2) {
      setDbDetectedChecking(true);
      const hasStoredConfig = Boolean(bootstrap?.databaseConfig);
      const passwordStored = Boolean(bootstrap?.databasePasswordStored && bootstrap?.databaseConfig?.password);
      setDbDetected(hasStoredConfig && passwordStored && Boolean(bootstrap?.databaseConnected));
      setShowDbForm(!hasStoredConfig || !passwordStored || !bootstrap?.databaseConnected);
      setDbDetectedChecking(false);
    }
  }, [step, bootstrap]);

  // Auto-detect tables on step 3
  useEffect(() => {
    if (step === 3) {
      if (bootstrap?.databaseSchemaReady) {
        setTablesDetected(true);
        setStatus((prev) => ({ ...prev, dbInitialized: true }));
        setTablesDetectedChecking(false);
        return;
      }

      setTablesDetectedChecking(true);
      http.post('/setup/check-tables', {
        host: dbConfig.host,
        port: parseInt(dbConfig.port, 10),
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
      })
        .then((res: any) => {
          if (res?.data?.initialized) {
            setTablesDetected(true);
            setStatus((prev) => ({ ...prev, dbInitialized: true }));
          } else {
            setTablesDetected(false);
          }
        })
        .catch(() => {
          setTablesDetected(false);
        })
        .finally(() => setTablesDetectedChecking(false));
    }
  }, [step, bootstrap?.databaseSchemaReady, dbConfig.host, dbConfig.port, dbConfig.username, dbConfig.password, dbConfig.database]);

  // Auto-detect AI providers on step 4
  useEffect(() => {
    if (step === 5) {
      try {
        const saved = localStorage.getItem('otherone_ai_providers');
        if (saved) {
          const parsed = JSON.parse(saved) as AiProvider[];
          if (parsed.length > 0) {
            setAiDetected(true);
            setAiProviders(parsed);
            setShowAiForm(false);
            setStatus((prev) => ({ ...prev, aiConfigured: true, aiProviders: parsed }));
            return;
          }
        }
      } catch { /* ignore */ }
      setAiDetected(false);
      setShowAiForm(true);
    }
  }, [step]);

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) {
      setDirection('forward');
      setAnimKey((k) => k + 1);
      setStep((s) => s + 1);
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) {
      setDirection('backward');
      setAnimKey((k) => k + 1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleLanguageChange = (lang: string) => {
    setStatus((prev) => ({ ...prev, language: lang }));
    document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=31536000`;
    window.location.reload();
  };

  const handleTestDb = async () => {
    setDbTesting(true);
    setDbTestResult(null);
    setDbTestMessage('');

    try {
      const res: any = await http.post('/setup/test-database', {
        host: dbConfig.host,
        port: parseInt(dbConfig.port, 10),
        username: dbConfig.username,
        password: dbConfig.password,
      });

      if (res?.success) {
        const api = getElectronAPI();
        if (api) {
          await api.invoke('app-config:save-database', {
            host: dbConfig.host,
            port: parseInt(dbConfig.port, 10),
            username: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
          });
          const nextBootstrap = await refreshBootstrap();
          setDbDetected(Boolean(nextBootstrap?.databaseConnected));
        }

        setDbTestResult('success');
        setDbTestMessage(res.message || t('database.connected'));
        setStatus((prev) => ({
          ...prev,
          dbConnected: true,
        }));
      } else {
        setDbTestResult('error');
        setDbTestMessage(res?.message || t('database.failed'));
      }
    } catch (err: unknown) {
      setDbTestResult('error');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('database.failed');
      setDbTestMessage(msg);
    } finally {
      setDbTesting(false);
    }
  };

  const handleInitDb = async () => {
    setDbInitializing(true);
    setDbInitResult(null);
    setDbInitMessage('');

    try {
      const res: any = await http.post('/setup/init-database', {
        host: dbConfig.host,
        port: parseInt(dbConfig.port, 10),
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
      });

      if (res?.success) {
        const api = getElectronAPI();
        if (api) {
          await api.invoke('app-config:save-database', {
            host: dbConfig.host,
            port: parseInt(dbConfig.port, 10),
            username: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
          });
          await refreshBootstrap();
        }

        setDbInitResult('success');
        setDbInitMessage(t('dbInit.success'));
        setStatus((prev) => ({ ...prev, dbInitialized: true }));
      } else {
        setDbInitResult('error');
        setDbInitMessage(res?.message || t('dbInit.failed'));
      }
    } catch (err: unknown) {
      setDbInitResult('error');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('dbInit.failed');
      setDbInitMessage(msg);
    } finally {
      setDbInitializing(false);
    }
  };

  const handleSaveSecurityPassword = async () => {
    if (securitySaving) {
      return;
    }

    if (!securityPassword || securityPassword.length < 6) {
      setSecurityResult('error');
      setSecurityMessage(t('securityPassword.minLength'));
      return;
    }

    if (securityPassword !== securityPasswordConfirm) {
      setSecurityResult('error');
      setSecurityMessage(t('securityPassword.mismatch'));
      return;
    }

    const api = getElectronAPI();
    if (!api) {
      setSecurityResult('error');
      setSecurityMessage(t('securityPassword.desktopOnly'));
      return;
    }

    setSecuritySaving(true);
    setSecurityResult(null);
    setSecurityMessage('');

    try {
      await api.invoke('app-config:save-security-password', {
        password: securityPassword,
      });
      await refreshBootstrap();
      setStatus((prev) => ({ ...prev, securityPasswordConfigured: true }));
      setSecurityResult('success');
      setSecurityMessage(t('securityPassword.saved'));
    } catch (error) {
      setSecurityResult('error');
      setSecurityMessage(error instanceof Error ? error.message : t('securityPassword.failed'));
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleComplete = () => {
    // Save AI providers to localStorage
    if (aiProviders.length > 0) {
      localStorage.setItem('otherone_ai_providers', JSON.stringify(aiProviders));
    }
    // Save setup config to localStorage
    localStorage.setItem('otherone_setup_complete', 'true');
    localStorage.setItem('otherone_setup_config', JSON.stringify({
      language: status.language,
      dbConnected: status.dbConnected,
      dbInitialized: status.dbInitialized,
      securityPasswordConfigured: status.securityPasswordConfigured,
      aiConfigured: aiProviders.length > 0,
      completedAt: new Date().toISOString(),
    }));

    window.location.href = '/login';
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return status.dbConnected || dbDetected || Boolean(bootstrap?.databaseConnected);
      case 3: return status.dbInitialized || tablesDetected || Boolean(bootstrap?.databaseSchemaReady);
      case 4: return status.securityPasswordConfigured || Boolean(bootstrap?.securityPasswordConfigured);
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  };

  const progressPercent = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const stepIcons = [
    { icon: Globe, label: 'Welcome' },
    { icon: Database, label: 'Database' },
    { icon: Layers, label: 'Initialize' },
    { icon: EyeOff, label: 'Security' },
    { icon: Cpu, label: 'AI' },
    { icon: Rocket, label: 'Complete' },
  ];

  if (bootstrapLoading && !bootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <Loader2 size={18} className="animate-spin" />
          <span>{t('bootstrap.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-shell-min-height flex flex-col setup-grid-bg">
      {/* Top progress bar */}
      <div className="fixed left-0 right-0 top-[var(--desktop-titlebar-height,0px)] h-1 bg-[var(--border)] z-50">
        <div
          className="h-full bg-foreground setup-progress-bar"
          style={{
            '--progress-from': `${((step - 2) / (TOTAL_STEPS - 1)) * 100}%`,
            '--progress-to': `${progressPercent}%`,
          } as React.CSSProperties}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 pt-8 pb-2 px-4">
        {stepIcons.map((s, i) => {
          const stepNum = i + 1;
          const isCompleted = step > stepNum;
          const isCurrent = step === stepNum;
          const Icon = s.icon;

          return (
            <div key={i} className="flex items-center">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
                isCompleted && 'bg-foreground text-white',
                isCurrent && 'bg-foreground text-white ring-4 ring-foreground/10',
                !isCompleted && !isCurrent && 'bg-[var(--border)] text-foreground-lighter'
              )}>
                {isCompleted ? <Check size={16} /> : <Icon size={16} />}
              </div>
              {i < stepIcons.length - 1 && (
                <div className={cn(
                  'w-8 md:w-16 h-0.5 mx-1 transition-all duration-500',
                  step > stepNum + 1 ? 'bg-foreground' : step > stepNum ? 'bg-foreground/40' : 'bg-[var(--border)]'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step info */}
      <div className="text-center text-xs text-foreground-lighter mt-1 mb-4">
        {t('nav.step', { current: step.toString(), total: TOTAL_STEPS.toString() })}
      </div>

      {bootstrapError && (
        <div className="mx-auto mb-4 w-full max-w-2xl px-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {bootstrapError}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex items-start justify-center px-4 pb-24">
        <div className="w-full max-w-2xl">
          <div
            key={animKey}
            className={direction === 'forward' ? 'setup-step-enter' : 'setup-step-enter-reverse'}
          >
            {step === 1 && (
              <WelcomeStep
                language={status.language}
                currentLocale={currentLocale}
                onLanguageChange={handleLanguageChange}
                onNext={goNext}
                t={t}
              />
            )}
            {step === 2 && (
              <DatabaseStep
                config={dbConfig}
                setConfig={setDbConfig}
                testing={dbTesting}
                testResult={dbTestResult}
                testMessage={dbTestMessage}
                onTest={handleTestDb}
                detected={dbDetected}
                detectChecking={dbDetectedChecking}
                bootstrap={bootstrap}
                showForm={showDbForm}
                setShowForm={setShowDbForm}
                onSkip={() => {
                  setStatus((prev) => ({ ...prev, dbConnected: true }));
                  goNext();
                }}
                t={t}
              />
            )}
            {step === 3 && (
              <DbInitStep
                config={dbConfig}
                setConfig={setDbConfig}
                consent={dbConsent}
                setConsent={setDbConsent}
                initializing={dbInitializing}
                initResult={dbInitResult}
                initMessage={dbInitMessage}
                onInit={handleInitDb}
                detected={tablesDetected}
                detectChecking={tablesDetectedChecking}
                onSkip={() => {
                  setStatus((prev) => ({ ...prev, dbInitialized: true }));
                  goNext();
                }}
                bootstrap={bootstrap}
                t={t}
              />
            )}
            {step === 4 && (
              <SecurityPasswordStep
                configured={Boolean(bootstrap?.securityPasswordConfigured)}
                password={securityPassword}
                confirmPassword={securityPasswordConfirm}
                setPassword={setSecurityPassword}
                setConfirmPassword={setSecurityPasswordConfirm}
                saving={securitySaving}
                result={securityResult}
                message={securityMessage}
                onSave={handleSaveSecurityPassword}
                t={t}
              />
            )}
            {step === 5 && (
              <AiProviderStep
                providers={aiProviders}
                setProviders={setAiProviders}
                detected={aiDetected}
                showForm={showAiForm}
                setShowForm={setShowAiForm}
                onSkip={() => goNext()}
                t={t}
              />
            )}
            {step === 6 && (
              <CompleteStep
                status={status}
                aiProviders={aiProviders}
                onStart={handleComplete}
                t={t}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      {step > 1 && step < TOTAL_STEPS && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-md border-t border-[var(--border)] z-40">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-6 py-4">
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              {t('nav.back')}
            </button>
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-medium transition-all',
                canProceed()
                  ? 'bg-foreground text-white hover:bg-foreground/90'
                  : 'bg-[var(--border)] text-foreground-lighter cursor-not-allowed'
              )}
            >
              {t('nav.next')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Step 1: Welcome ============ */
function WelcomeStep({
  language,
  currentLocale,
  onLanguageChange,
  onNext,
  t,
}: {
  language: string;
  currentLocale: string;
  onLanguageChange: (lang: string) => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  return (
    <div className="flex flex-col items-center text-center pt-8 md:pt-16">
      {/* Logo */}
      <div className="mb-8">
        <AnimatedLogo size={88} />
      </div>

      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
        {t('welcome.title')}
      </h1>
      <p className="text-lg text-foreground-muted mb-2">
        {t('welcome.subtitle')}
      </p>
      <p className="text-sm text-foreground-lighter max-w-md mb-10">
        {t('welcome.desc')}
      </p>

      {/* Language selector */}
      <div className="mb-10">
        <div className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
          {t('welcome.langLabel')}
        </div>
        <div className="flex p-1 rounded-xl bg-surface border border-[var(--border)] gap-1 shadow-sm">
          <button
            onClick={() => currentLocale !== 'zh' && onLanguageChange('zh')}
            className={cn(
              'px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
              currentLocale === 'zh'
                ? 'bg-foreground text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
            )}
          >
            中文
          </button>
          <button
            onClick={() => currentLocale !== 'en' && onLanguageChange('en')}
            className={cn(
              'px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
              currentLocale === 'en'
                ? 'bg-foreground text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
            )}
          >
            English
          </button>
        </div>
      </div>

      {/* Get Started */}
      <button
        onClick={onNext}
        className="relative flex items-center gap-2.5 h-12 px-8 rounded-xl text-base font-medium text-white btn-create-gradient btn-sweep-effect overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {t('welcome.getStarted')}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

/* ============ Step 2: Database Connection ============ */
function DatabaseStep({
  config,
  setConfig,
  testing,
  testResult,
  testMessage,
  onTest,
  detected,
  detectChecking,
  bootstrap,
  showForm,
  setShowForm,
  onSkip,
  t,
}: {
  config: DbConfig;
  setConfig: (c: DbConfig) => void;
  testing: boolean;
  testResult: 'success' | 'error' | null;
  testMessage: string;
  onTest: () => void;
  detected: boolean;
  detectChecking: boolean;
  bootstrap: BootstrapStatus | null;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSkip: () => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  const inputCls = 'w-full h-10 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground';

  return (
    <div className="pt-4 md:pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
          <Database size={20} className="text-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('database.title')}</h2>
          <p className="text-sm text-foreground-muted">{t('database.subtitle')}</p>
        </div>
      </div>
      <p className="text-sm text-foreground-lighter mb-6 ml-[52px]">{t('database.desc')}</p>

      {/* Detected state */}
      {detectChecking && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-[var(--border)] mb-6">
          <Loader2 size={18} className="animate-spin text-foreground-muted" />
          <span className="text-sm text-foreground-muted">{t('database.checking')}</span>
        </div>
      )}

      {detected && !showForm && !detectChecking && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
          <div className="flex items-start gap-3">
            <CircleCheck size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-800">{t('database.detected')}</div>
              <p className="text-xs text-emerald-600 mt-1">{t('database.detectedDesc')}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                >
                  <SkipForward size={13} />
                  {t('database.skip')}
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  <RefreshCw size={13} />
                  {t('database.reconfigure')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bootstrap?.databaseConfigured && !bootstrap.databasePasswordStored && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-medium">{t('database.passwordMissing')}</div>
          <p className="mt-1 text-xs text-amber-700">{t('database.passwordMissingDesc')}</p>
        </div>
      )}

      {bootstrap?.lastDatabaseError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium">{t('database.connectionIssue')}</div>
          <p className="mt-1 break-all text-xs text-red-600">{bootstrap.lastDatabaseError}</p>
        </div>
      )}

      {/* Connection form */}
      {showForm && !detectChecking && (
        <div className="bg-surface border border-[var(--border)] rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">{t('database.host')}</label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder={t('database.hostPlaceholder')}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">{t('database.port')}</label>
              <input
                type="text"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                placeholder={t('database.portPlaceholder')}
                className={cn(inputCls, 'font-mono')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">{t('database.username')}</label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder={t('database.usernamePlaceholder')}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">{t('database.password')}</label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder={t('database.passwordPlaceholder')}
                className={inputCls}
              />
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn(
              'flex items-center gap-2 mt-4 p-3 rounded-lg text-sm',
              testResult === 'success' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              testResult === 'error' && 'bg-red-50 text-red-700 border border-red-200'
            )}>
              {testResult === 'success' ? <CircleCheck size={16} /> : <CircleX size={16} />}
              <span className="break-all">{testMessage}</span>
            </div>
          )}

          {/* Test button */}
          <button
            onClick={onTest}
            disabled={testing || !config.host || !config.username}
            className={cn(
              'mt-5 flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-medium transition-all',
              testing
                ? 'bg-foreground/60 text-white cursor-wait'
                : 'bg-foreground text-white hover:bg-foreground/90 disabled:bg-[var(--border)] disabled:text-foreground-lighter disabled:cursor-not-allowed'
            )}
          >
            {testing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('database.testing')}
              </>
            ) : (
              <>
                <Database size={16} />
                {t('database.testConnection')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============ Step 3: Database Initialize ============ */
function DbInitStep({
  config,
  setConfig,
  consent,
  setConsent,
  initializing,
  initResult,
  initMessage,
  onInit,
  detected,
  detectChecking,
  onSkip,
  bootstrap,
  t,
}: {
  config: DbConfig;
  setConfig: (c: DbConfig) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  initializing: boolean;
  initResult: 'success' | 'error' | null;
  initMessage: string;
  onInit: () => void;
  detected: boolean;
  detectChecking: boolean;
  onSkip: () => void;
  bootstrap: BootstrapStatus | null;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  const inputCls = 'w-full h-10 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground';

  return (
    <div className="pt-4 md:pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
          <Layers size={20} className="text-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('dbInit.title')}</h2>
          <p className="text-sm text-foreground-muted">{t('dbInit.subtitle')}</p>
        </div>
      </div>
      <p className="text-sm text-foreground-lighter mb-6 ml-[52px]">{t('dbInit.desc')}</p>

      {detectChecking && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-[var(--border)] mb-6">
          <Loader2 size={18} className="animate-spin text-foreground-muted" />
          <span className="text-sm text-foreground-muted">{t('dbInit.checking')}</span>
        </div>
      )}

      {bootstrap?.databaseConfigured && bootstrap.databaseConnected && !bootstrap.databaseSchemaReady && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-medium">{t('dbInit.autoUpgradePending')}</div>
          <p className="mt-1 text-xs text-amber-700">{t('dbInit.autoUpgradePendingDesc')}</p>
        </div>
      )}

      {detected && !detectChecking && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
          <div className="flex items-start gap-3">
            <CircleCheck size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-800">{t('dbInit.detected')}</div>
              <p className="text-xs text-emerald-600 mt-1">{t('dbInit.detectedDesc')}</p>
              <button
                onClick={onSkip}
                className="flex items-center gap-1.5 h-8 px-4 mt-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                <SkipForward size={13} />
                {t('dbInit.skip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!detected && !detectChecking && (
        <div className="bg-surface border border-[var(--border)] rounded-2xl p-6">
          <div className="flex flex-col gap-1.5 mb-5">
            <label className="text-xs font-medium text-foreground-muted">{t('database.dbName')}</label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              placeholder={t('database.dbNamePlaceholder')}
              className={inputCls}
            />
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="sr-only"
              />
              <div className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                consent
                  ? 'bg-foreground border-foreground'
                  : 'border-[var(--border-strong)] group-hover:border-foreground-muted'
              )}>
                {consent && <Check size={13} className="text-white" />}
              </div>
            </div>
            <span className="text-sm text-foreground leading-relaxed">
              {t('dbInit.consent')}
            </span>
          </label>

          {/* Init result */}
          {initResult && (
            <div className={cn(
              'flex items-center gap-2 mt-4 p-3 rounded-lg text-sm',
              initResult === 'success' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              initResult === 'error' && 'bg-red-50 text-red-700 border border-red-200'
            )}>
              {initResult === 'success' ? <CircleCheck size={16} /> : <CircleX size={16} />}
              <span className="break-all">{initMessage}</span>
            </div>
          )}

          {/* Init button */}
          <button
            onClick={onInit}
            disabled={!config.database || !consent || initializing || initResult === 'success'}
            className={cn(
              'mt-5 flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-medium transition-all',
              initializing
                ? 'bg-foreground/60 text-white cursor-wait'
                : initResult === 'success'
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-foreground text-white hover:bg-foreground/90 disabled:bg-[var(--border)] disabled:text-foreground-lighter disabled:cursor-not-allowed'
            )}
          >
            {initializing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('dbInit.initializing')}
              </>
            ) : initResult === 'success' ? (
              <>
                <CircleCheck size={16} />
                {t('dbInit.success')}
              </>
            ) : (
              <>
                <Layers size={16} />
                {t('dbInit.initButton')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============ Step 4: Security Password ============ */
function SecurityPasswordStep({
  configured,
  password,
  confirmPassword,
  setPassword,
  setConfirmPassword,
  saving,
  result,
  message,
  onSave,
  t,
}: {
  configured: boolean;
  password: string;
  confirmPassword: string;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  saving: boolean;
  result: 'success' | 'error' | null;
  message: string;
  onSave: () => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  const inputCls = 'w-full h-10 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground';

  return (
    <div className="pt-4 md:pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
          <EyeOff size={20} className="text-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('securityPassword.title')}</h2>
          <p className="text-sm text-foreground-muted">{t('securityPassword.subtitle')}</p>
        </div>
      </div>
      <p className="mb-6 ml-[52px] text-sm text-foreground-lighter">{t('securityPassword.desc')}</p>

      {configured && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CircleCheck size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-emerald-800">{t('securityPassword.detected')}</div>
              <p className="mt-1 text-xs text-emerald-600">{t('securityPassword.detectedDesc')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground-muted">{t('securityPassword.label')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('securityPassword.placeholder')}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground-muted">{t('securityPassword.confirmLabel')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('securityPassword.confirmPlaceholder')}
              className={inputCls}
            />
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
          {t('securityPassword.hint')}
        </p>

        {result && (
          <div className={cn(
            'mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm',
            result === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            result === 'error' && 'border-red-200 bg-red-50 text-red-700'
          )}>
            {result === 'success' ? <CircleCheck size={16} /> : <CircleX size={16} />}
            <span>{message}</span>
          </div>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          className={cn(
            'mt-5 flex h-10 items-center gap-2 rounded-lg px-6 text-sm font-medium transition-all',
            saving
              ? 'cursor-wait bg-foreground/60 text-white'
              : 'bg-foreground text-white hover:bg-foreground/90'
          )}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <EyeOff size={16} />}
          {configured ? t('securityPassword.updateButton') : t('securityPassword.saveButton')}
        </button>
      </div>
    </div>
  );
}

/* ============ Step 4: AI Provider ============ */
function AiProviderStep({
  providers,
  setProviders,
  detected,
  showForm,
  setShowForm,
  onSkip,
  t,
}: {
  providers: AiProvider[];
  setProviders: (p: AiProvider[]) => void;
  detected: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSkip: () => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  const addProvider = () => {
    setProviders([
      ...providers,
      { id: `${Date.now()}`, name: '', baseUrl: '', apiKey: '', models: [], contextWindow: 128000 },
    ]);
  };

  const removeProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id));
  };

  const updateProvider = (id: string, field: keyof AiProvider, value: string | number | string[]) => {
    setProviders(providers.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="pt-4 md:pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
          <Cpu size={20} className="text-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('aiProvider.title')}</h2>
          <p className="text-sm text-foreground-muted">{t('aiProvider.subtitle')}</p>
        </div>
      </div>
      <p className="text-sm text-foreground-lighter mb-6 ml-[52px]">{t('aiProvider.desc')}</p>

      {/* Detected state */}
      {detected && !showForm && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
          <div className="flex items-start gap-3">
            <CircleCheck size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-800">{t('aiProvider.detected')}</div>
              <p className="text-xs text-emerald-600 mt-1">
                {t('aiProvider.detectedDesc', { count: providers.length.toString() })}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                >
                  <SkipForward size={13} />
                  {t('aiProvider.skip')}
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  <RefreshCw size={13} />
                  {t('aiProvider.reconfigure')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider form */}
      {(showForm || !detected) && (
        <>
          {providers.length > 0 && (
            <div className="flex flex-col gap-4 mb-4">
              {providers.map((provider) => (
                <AiProviderCard
                  key={provider.id}
                  provider={provider}
                  onUpdate={updateProvider}
                  onRemove={removeProvider}
                  t={t}
                />
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={addProvider}
              className="flex items-center gap-2 h-9 px-4 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-medium text-foreground-muted transition-all hover:border-foreground hover:text-foreground hover:bg-surface-subtle"
            >
              <Plus size={15} />
              {t('aiProvider.addProvider')}
            </button>
            <button
              onClick={() => {
                if (providers.length > 0) {
                  localStorage.setItem('otherone_ai_providers', JSON.stringify(providers));
                }
                onSkip();
              }}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              <SkipForward size={15} />
              {t('aiProvider.skip')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============ AI Provider Card ============ */
function AiProviderCard({
  provider,
  onUpdate,
  onRemove,
  t,
}: {
  provider: AiProvider;
  onUpdate: (id: string, field: keyof AiProvider, value: string | number | string[]) => void;
  onRemove: (id: string) => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
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

  const inputCls = 'w-full h-9 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground';

  return (
    <div className="bg-surface border border-[var(--border)] rounded-2xl p-5 relative">
      <button
        onClick={() => onRemove(provider.id)}
        className="absolute top-4 right-4 w-7 h-7 rounded-md flex items-center justify-center text-foreground-lighter hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <Trash2 size={14} />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('aiProvider.providerName')}</label>
          <input
            type="text"
            value={provider.name}
            onChange={(e) => onUpdate(provider.id, 'name', e.target.value)}
            placeholder={t('aiProvider.providerNamePlaceholder')}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('aiProvider.contextWindow')}</label>
          <input
            type="number"
            value={provider.contextWindow}
            onChange={(e) => onUpdate(provider.id, 'contextWindow', parseInt(e.target.value) || 0)}
            className={cn(inputCls, 'font-mono')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('aiProvider.baseUrl')}</label>
          <input
            type="text"
            value={provider.baseUrl}
            onChange={(e) => onUpdate(provider.id, 'baseUrl', e.target.value)}
            placeholder={t('aiProvider.baseUrlPlaceholder')}
            className={cn(inputCls, 'font-mono')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">{t('aiProvider.apiKey')}</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onUpdate(provider.id, 'apiKey', e.target.value)}
              placeholder={t('aiProvider.apiKeyPlaceholder')}
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
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs font-medium text-foreground-muted">{t('aiProvider.models')}</label>
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
              placeholder={provider.models.length === 0 ? t('aiProvider.modelsPlaceholder') : ''}
              className="flex-1 min-w-[120px] h-6 border-none outline-none bg-transparent text-sm font-mono placeholder:text-foreground-lighter"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Step 5: Complete ============ */
function CompleteStep({
  status,
  aiProviders,
  onStart,
  t,
}: {
  status: StepStatus;
  aiProviders: AiProvider[];
  onStart: () => void;
  t: ReturnType<typeof useTranslations<'setup'>>;
}) {
  const summaryItems = [
    {
      label: t('complete.language'),
      value: status.language === 'zh' ? '中文' : 'English',
      ok: true,
    },
    {
      label: t('complete.database'),
      value: status.dbConnected ? t('complete.configured') : t('complete.skipped'),
      ok: status.dbConnected,
    },
    {
      label: t('complete.dbInit'),
      value: status.dbInitialized ? t('complete.initialized') : t('complete.skipped'),
      ok: status.dbInitialized,
    },
    {
      label: t('complete.aiProvider'),
      value: aiProviders.length > 0
        ? `${t('complete.configured')} (${aiProviders.length})`
        : t('complete.notConfigured'),
      ok: aiProviders.length > 0,
    },
  ];

  return (
    <div className="flex flex-col items-center text-center pt-8 md:pt-16">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M10 20L17 27L30 13"
            stroke="#059669"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="setup-check-icon"
          />
        </svg>
      </div>

      <h2 className="text-3xl font-bold tracking-tight mb-2">{t('complete.title')}</h2>
      <p className="text-base text-foreground-muted mb-8">{t('complete.subtitle')}</p>

      {/* Summary card */}
      <div className="w-full max-w-md bg-surface border border-[var(--border)] rounded-2xl overflow-hidden mb-8 text-left">
        <div className="px-5 py-3 bg-surface-subtle border-b border-[var(--border)]">
          <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
            {t('complete.summaryTitle')}
          </span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-foreground-muted">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  item.ok ? 'text-emerald-600' : 'text-foreground-lighter'
                )}>
                  {item.value}
                </span>
                {item.ok ? (
                  <CircleCheck size={16} className="text-emerald-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--border-strong)]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="relative flex items-center gap-2.5 h-12 px-10 rounded-xl text-base font-medium text-white btn-create-gradient btn-sweep-effect overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Rocket size={18} />
        {t('complete.startButton')}
      </button>
    </div>
  );
}
