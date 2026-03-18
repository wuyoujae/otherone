'use client';

import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useTranslations('plugins');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <header className="flex items-center gap-4 px-6 md:px-12 pt-6 pb-4 bg-white/90 backdrop-blur-xl border-b border-[var(--border)]">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="text-foreground-muted transition-all hover:text-foreground hover:-translate-x-0.5"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold tracking-tight">{t('knowledgeBaseTitle')}</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 bg-surface-subtle">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-[var(--border)] flex items-center justify-center">
            <BookOpen size={32} className="text-foreground-muted" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('comingSoon')}</h2>
          <p className="text-sm text-foreground-muted max-w-sm leading-relaxed">{t('knowledgeBaseComingSoonDesc')}</p>
        </div>
      </main>
    </div>
  );
}
