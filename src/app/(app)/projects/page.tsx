'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  MoreHorizontal,
  DollarSign,
  Box,
  FileText,
  Cpu,
  Zap,
  Globe,
  Database,
  FolderOpen,
  Loader,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMessage } from '@/components/ui/message/message-provider';
import http from '@/lib/http';

type FilterKey = 'all' | 'ai' | 'review' | 'archived';

interface ProjectMember {
  memberType: number;
  displayLabel: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  status: number;
  aiStatus: number;
  aiStatusText: string | null;
  aiAgentName: string | null;
  progress: number;
  updatedAt: string;
  members: ProjectMember[];
}

interface ProjectCounts {
  total: number;
  aiCount: number;
  reviewCount: number;
  archivedCount: number;
}

const iconMap: Record<string, typeof Box> = {
  DollarSign, Box, FileText, Cpu, Zap, Globe, Database, FolderOpen,
};

function getIcon(name: string) {
  return iconMap[name] || Box;
}

function formatRelativeTime(dateStr: string, isZh: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return isZh ? '刚刚' : 'Just now';
  if (min < 60) return isZh ? `${min} 分钟前` : `${min}m ago`;
  if (hour < 24) return isZh ? `${hour} 小时前` : `${hour}h ago`;
  if (day < 7) return isZh ? `${day} 天前` : `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ProjectsPage() {
  const t = useTranslations('projects');
  const { message } = useMessage();
  const router = useRouter();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [counts, setCounts] = useState<ProjectCounts>({ total: 0, aiCount: 0, reviewCount: 0, archivedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const isZh = typeof document !== 'undefined' && document.cookie.includes('NEXT_LOCALE=zh');

  const fetchProjects = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await http.get('/projects', {
        params: { filter: filter !== 'all' ? filter : undefined, search: search || undefined },
      });
      setProjects(res.data.projects);
      setCounts(res.data.counts);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    setLoading(true);
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await http.post('/projects', { displayName: user.displayName || 'U' });
      router.push(`/projects/${res.data.id}/craft`);
    } catch {
      message.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleCardClick = (project: ProjectData) => {
    if (project.status === 0) {
      router.push(`/projects/${project.id}/craft`);
    } else {
      router.push(`/projects/${project.id}`);
    }
  };

  const filters: { key: FilterKey; label: string; count?: number; bold?: boolean }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'ai', label: t('filterAi'), count: counts.aiCount },
    { key: 'review', label: t('filterReview'), count: counts.reviewCount, bold: true },
    { key: 'archived', label: t('filterArchived') },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 md:px-10 pt-8 pb-6 border-b border-[var(--border)] bg-white/80 backdrop-blur-xl sticky top-0 z-[5] flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h1 className="text-[1.8rem] font-bold tracking-tight flex items-center gap-3">
            {t('title')}
            <span className="text-sm font-medium text-foreground-muted bg-surface-subtle px-2.5 py-0.5 rounded-full border border-[var(--border)]">
              {counts.total}
            </span>
          </h1>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:flex items-center">
              <Search size={16} className="absolute left-3 text-foreground-muted" />
              <input
                type="text"
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-60 h-9 pl-9 pr-10 rounded-lg border border-[var(--border)] bg-surface text-sm text-foreground placeholder:text-foreground-lighter outline-none transition-all shadow-sm focus:border-foreground focus:ring-1 focus:ring-foreground"
              />
              <span className="absolute right-2 text-[0.7rem] text-foreground-lighter bg-surface-subtle px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">
                &#8984;K
              </span>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className={cn(
                'flex items-center gap-2 px-4 h-9 rounded-lg bg-foreground text-white text-sm font-medium shadow-md transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-px',
                creating && 'opacity-70 pointer-events-none'
              )}
            >
              {creating ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              {t('create')}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-[0.85rem] font-medium border border-transparent transition-all duration-200 cursor-pointer',
                filter === f.key
                  ? 'bg-surface-subtle text-foreground border-[var(--border)] shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className={cn('ml-1.5 text-xs', f.bold ? 'text-foreground font-bold' : 'text-foreground-lighter')}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface border border-[var(--border)] rounded-2xl p-6 animate-pulse">
                <div className="flex gap-4 mb-5">
                  <div className="w-11 h-11 rounded-[10px] bg-surface-subtle" />
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-surface-subtle rounded mb-2" />
                    <div className="h-3 w-48 bg-surface-subtle rounded" />
                  </div>
                </div>
                <div className="h-10 bg-surface-subtle rounded-lg mb-5" />
                <div className="h-1 bg-surface-subtle rounded-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-[var(--border)] flex items-center justify-center mb-5">
              <FolderOpen size={24} className="text-foreground-lighter" />
            </div>
            <p className="text-base font-medium text-foreground mb-2">{t('noProjects')}</p>
            <p className="text-sm text-foreground-muted max-w-[320px]">{t('noProjectsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {projects.map((project) => (
              <ProjectCardItem
                key={project.id}
                project={project}
                isZh={isZh}
                onClick={() => handleCardClick(project)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCardItem({ project, isZh, onClick }: { project: ProjectData; isZh: boolean; onClick: () => void }) {
  const t = useTranslations('projects');
  const IconComp = getIcon(project.icon);
  const aiStatusKey = project.aiStatus === 1 ? 'ai-running' : project.aiStatus === 2 ? 'review' : 'idle';

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface border rounded-2xl p-6 flex flex-col gap-5 cursor-pointer',
        'transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:border-[var(--border-strong)] hover:shadow-lg hover:-translate-y-0.5',
        aiStatusKey === 'review'
          ? 'border-foreground shadow-[0_0_0_1px_rgba(9,9,11,0.05)]'
          : 'border-[var(--border)]'
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="w-11 h-11 rounded-[10px] bg-surface-subtle border border-[var(--border)] flex items-center justify-center text-foreground">
            <IconComp size={20} />
          </div>
          <div>
            <h3 className="text-[1.1rem] font-semibold tracking-tight mb-1">{project.name}</h3>
            <p className="text-xs text-foreground-muted">{project.description || ''}</p>
          </div>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover p-1 rounded transition-colors"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div
        className={cn(
          'rounded-lg px-3 py-2.5 flex items-center gap-2.5 text-xs',
          aiStatusKey === 'ai-running' && 'bg-surface-hover border border-black/[0.03] text-foreground-muted',
          aiStatusKey === 'review' && 'bg-zinc-50 border border-[var(--border)] text-foreground',
          aiStatusKey === 'idle' && 'bg-transparent border border-dashed border-[var(--border)] text-foreground-muted'
        )}
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            aiStatusKey === 'ai-running' && 'bg-foreground animate-pulse-dot',
            aiStatusKey === 'review' && 'bg-amber-400',
            aiStatusKey === 'idle' && 'bg-foreground-lighter'
          )}
        />
        <span>
          {project.aiAgentName && aiStatusKey !== 'idle' && (
            <span className="font-semibold">{project.aiAgentName}</span>
          )}{' '}
          {project.aiStatusText || (isZh ? '暂无 AI 任务运行' : 'No AI tasks running')}
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-medium text-foreground-muted">
            <span>{t('progress')}</span>
            <span>{project.progress}%</span>
          </div>
          <div className="h-1 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', aiStatusKey === 'idle' ? 'bg-foreground-lighter' : 'bg-foreground')}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-[var(--border)] pt-4">
          <span className="text-xs text-foreground-lighter">
            {formatRelativeTime(project.updatedAt, isZh)}
          </span>
          <div className="flex items-center">
            {project.members.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-[0.65rem] font-semibold',
                  i > 0 && '-ml-1.5',
                  m.memberType === 2 ? 'bg-foreground text-white z-[2]' : 'bg-zinc-200 text-foreground z-[1]'
                )}
              >
                {m.memberType === 2 ? <Loader size={12} strokeWidth={2.5} /> : m.displayLabel}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
