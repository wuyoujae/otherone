'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import http from '@/lib/http';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await http.post('/projects', { displayName: user.displayName || 'U' });
      router.push(`/projects/${res.data.id}/craft`);
    } catch { /* interceptor */ }
    finally { setCreating(false); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="max-w-[1040px] mx-auto w-full px-6 py-10 md:px-10">
      <section className="relative text-center py-24 md:py-[100px] flex flex-col items-center justify-center">
        <div className="hero-grid-bg absolute inset-0 rounded-2xl -z-[1]" />
        <h1 className="text-4xl md:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] text-foreground mb-4">
          {t('subtitle')}
        </h1>
        <p className="text-base md:text-lg text-foreground-muted font-normal max-w-[500px] leading-relaxed mb-12">
          {t('subtitleLine2')}
        </p>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-black/[0.03] to-transparent">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-create-gradient btn-sweep-effect relative text-white px-8 pl-8 h-14 rounded-xl text-lg font-medium cursor-pointer flex items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 active:translate-y-px overflow-hidden"
          >
            <Plus size={20} />
            <span>{t('createProject')}</span>
            <div className="flex items-center gap-1 bg-white/10 border border-white/10 px-2 py-1 rounded-md text-xs text-zinc-400 font-mono ml-2">
              <span>&#8984;</span>
              <span>N</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
