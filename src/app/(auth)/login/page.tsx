'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Github } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMessage } from '@/components/ui/message/message-provider';
import { persistDesktopAuthSession, writeBrowserAuthSession } from '@/lib/auth-session';
import http from '@/lib/http';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const { message } = useMessage();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isLogin = mode === 'login';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any;

      if (isLogin) {
        res = await http.post('/auth/login', { email, password });
      } else {
        res = await http.post('/auth/register', { displayName, email, password });
      }

      const token = res?.data?.token;
      const user = res?.data?.user;

      if (!token) {
        message.error('Unexpected response');
        return;
      }

      writeBrowserAuthSession(token, user);
      await persistDesktopAuthSession(token, user);
      message.success(isLogin ? t('loginSuccess') : t('registerSuccess'));

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left brand area (dark) */}
      <div className="hidden lg:flex flex-1 bg-[#09090b] text-zinc-50 relative flex-col justify-between p-10 overflow-hidden">
        <div className="auth-grid-bg absolute inset-0 z-[1]" />
        <div className="absolute -top-[20%] -left-[10%] w-1/2 h-1/2 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] z-[1]" />

        <div className="relative z-[2]">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
            <Image src="/otherone-icon.svg" alt="OtherOne" width={32} height={32} className="invert" />
            <span>{tc('appName')}</span>
          </div>
        </div>

        <div className="relative z-[2] max-w-[480px] mb-20">
          <div className="text-[2rem] font-semibold leading-[1.3] tracking-tight whitespace-pre-line">
            &ldquo;{t('brandQuote')}&rdquo;
          </div>
        </div>
      </div>

      {/* Right form area */}
      <div className="flex-1 flex items-center justify-center bg-surface p-10">
        <div className="w-full max-w-[400px] flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <Image src="/otherone-icon.svg" alt="OtherOne" width={28} height={28} />
            <span className="font-bold text-lg tracking-tight">{tc('appName')}</span>
          </div>

          <h1 className="text-[1.8rem] font-bold tracking-tight text-center mb-2">
            {isLogin ? t('welcomeBack') : t('createAccount')}
          </h1>
          <p className="text-[0.95rem] text-foreground-muted text-center mb-8">
            {isLogin ? t('loginSubtitle') : t('registerSubtitle')}
          </p>

          {/* Tabs */}
          <div className="relative flex bg-surface-subtle p-1 rounded-lg mb-6">
            <div
              className={cn(
                'auth-tab-slider absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface rounded-md shadow-md z-[1]',
                mode === 'register' && 'translate-x-full'
              )}
            />
            <button
              onClick={() => setMode('login')}
              className={cn(
                'flex-1 text-center py-2 text-sm font-semibold rounded-md relative z-[2] transition-colors',
                isLogin ? 'text-foreground' : 'text-foreground-muted'
              )}
            >
              {t('login')}
            </button>
            <button
              onClick={() => setMode('register')}
              className={cn(
                'flex-1 text-center py-2 text-sm font-semibold rounded-md relative z-[2] transition-colors',
                !isLogin ? 'text-foreground' : 'text-foreground-muted'
              )}
            >
              {t('register')}
            </button>
          </div>

          {/* SSO */}
          <div className="flex flex-col gap-3 mb-6">
            <button className="w-full h-11 bg-surface border border-[var(--border-strong)] rounded-lg flex items-center justify-center gap-2.5 text-[0.95rem] font-medium text-foreground cursor-pointer transition-all hover:bg-surface-subtle">
              <Github size={18} />
              {t('githubLogin')}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center text-foreground-lighter text-xs uppercase tracking-wider mb-6">
            <div className="flex-1 border-b border-[var(--border)]" />
            <span className="px-3">{t('orEmail')}</span>
            <div className="flex-1 border-b border-[var(--border)]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Name (register only) */}
            <div
              className={cn(
                'flex flex-col gap-2 mb-4 overflow-hidden transition-all duration-300',
                isLogin ? 'max-h-0 opacity-0 mb-0' : 'max-h-24 opacity-100'
              )}
            >
              <label className="text-sm font-medium">{t('displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full h-11 px-3.5 border border-[var(--border-strong)] rounded-lg bg-surface text-[0.95rem] text-foreground outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
              />
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full h-11 px-3.5 border border-[var(--border-strong)] rounded-lg bg-surface text-[0.95rem] text-foreground outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
                required
              />
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium flex justify-between">
                {t('password')}
                {isLogin && (
                  <a
                    href="#"
                    className="text-foreground-muted font-normal hover:text-foreground hover:underline transition-colors"
                  >
                    {t('forgotPassword')}
                  </a>
                )}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 border border-[var(--border-strong)] rounded-lg bg-surface text-[0.95rem] text-foreground outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-11 bg-foreground text-white rounded-lg text-base font-medium mt-2 cursor-pointer transition-all shadow-md hover:bg-zinc-800 hover:-translate-y-px active:translate-y-0',
                loading && 'opacity-70 pointer-events-none'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              ) : (
                isLogin ? t('loginButton') : t('registerButton')
              )}
            </button>
          </form>

          <p className="text-xs text-foreground-muted text-center mt-6 leading-relaxed">
            {t('termsPrefix')}{' '}
            <a href="#" className="text-foreground underline underline-offset-2">
              {t('termsOfService')}
            </a>{' '}
            {t('and')}{' '}
            <a href="#" className="text-foreground underline underline-offset-2">
              {t('privacyPolicy')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
