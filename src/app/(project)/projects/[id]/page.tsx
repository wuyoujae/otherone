'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Info,
  Paperclip,
  Globe,
  ArrowUp,
  Activity,
  Bug,
  Code,
  Calendar,
  X,
  AlertTriangle,
  FolderOpen,
  Plus,
  Bot,
  BarChart3,
  LayoutGrid,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMessage } from '@/components/ui/message/message-provider';
import http from '@/lib/http';
import { getAllModules, getModuleIcon } from '@/lib/plugins/plugin-registry';

type TabKey = 'agent' | 'metrics' | 'features';

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  icon: string;
  status: number;
  aiStatus: number;
  aiStatusText: string | null;
  aiAgentName: string | null;
  progress: number;
  systemPrompt: string | null;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useTranslations('projectDetail');
  const ts = useTranslations('projectSettings');
  const { message } = useMessage();

  const [activeTab, setActiveTab] = useState<TabKey>('agent');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await http.get(`/projects/${projectId}`);
        setProject(res.data);
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [settingsOpen]);

  const tabs: { key: TabKey; label: string; icon: typeof Bot }[] = [
    { key: 'agent', label: t('agentHub'), icon: Bot },
    { key: 'metrics', label: t('metrics'), icon: BarChart3 },
    { key: 'features', label: t('features'), icon: LayoutGrid },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface gap-4">
        <FolderOpen size={32} className="text-foreground-lighter" />
        <p className="text-foreground-muted">Project not found</p>
        <button onClick={() => router.push('/projects')} className="text-sm text-foreground underline">
          Back to projects
        </button>
      </div>
    );
  }

  const aiLabel = project.aiStatus === 1
    ? t('agentListening')
    : project.aiStatus === 2
      ? 'Pending review'
      : 'Idle';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <header className="px-6 md:px-12 pt-6 bg-white/90 backdrop-blur-xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/projects')}
              className="flex items-center justify-center text-foreground-muted transition-all hover:text-foreground hover:-translate-x-0.5"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-[1.8rem] font-bold tracking-tight leading-none flex items-center gap-3">
              {project.name}
              {project.aiStatus > 0 && (
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-subtle border border-black/5 text-xs font-medium text-foreground-muted">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    project.aiStatus === 1 ? 'bg-foreground animate-pulse-dot' : 'bg-amber-400'
                  )} />
                  {aiLabel}
                </span>
              )}
            </h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-[var(--border-strong)] bg-surface text-sm font-medium transition-all hover:bg-surface-subtle hover:border-foreground shadow-sm"
          >
            <Info size={16} />
            {t('projectSettings')}
          </button>
        </div>

        <nav className="flex gap-8 border-b border-[var(--border)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-3 text-[0.95rem] font-medium relative transition-colors flex items-center gap-2',
                activeTab === tab.key
                  ? 'text-foreground font-semibold'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-foreground rounded-t" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto bg-surface-subtle relative">
        {activeTab === 'agent' && <AgentHubTab />}
        {activeTab === 'metrics' && <MetricsTab project={project} />}
        {activeTab === 'features' && <FeaturesTab projectId={projectId} />}

        <div
          className={cn(
            'absolute inset-0 bg-white/85 backdrop-blur-2xl z-20 flex justify-center',
            'transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
            settingsOpen
              ? 'opacity-100 pointer-events-auto translate-y-0'
              : 'opacity-0 pointer-events-none translate-y-5'
          )}
          style={{ minHeight: '100%' }}
        >
          <div className="w-full max-w-[760px] overflow-y-auto">
            <SettingsPanel
              project={project}
              onClose={() => setSettingsOpen(false)}
              onSaved={(updated) => setProject((prev) => prev ? { ...prev, ...updated } : prev)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ============ Agent Hub Tab ============ */
function AgentHubTab() {
  const t = useTranslations('projectDetail');
  const [promptValue, setPromptValue] = useState('');

  const suggestChips = [
    { icon: Activity, label: t('suggestPerf') },
    { icon: Bug, label: t('suggestRefactor') },
    { icon: Code, label: t('suggestTest') },
    { icon: Calendar, label: t('suggestSprint') },
  ];

  const hasContent = promptValue.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[720px] flex flex-col gap-5">
        {/* Prompt box */}
        <div className="prompt-box-wrapper">
          <div className="bg-surface rounded-[1.2rem] overflow-hidden">
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full min-h-[130px] max-h-[400px] border-none resize-none text-[1.05rem] leading-relaxed text-foreground outline-none bg-transparent placeholder:text-foreground-lighter/50 px-5 pt-5 pb-2"
              placeholder={t('promptPlaceholder')}
            />

            {/* Shimmer divider */}
            <div className="prompt-shimmer-bar mx-5" />

            {/* Toolbar */}
            <div className="flex justify-between items-center px-3 pb-3 pt-2">
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground">
                  <Plus size={18} />
                </button>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground">
                  <Paperclip size={17} />
                </button>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground">
                  <Globe size={17} />
                </button>
              </div>

              <button
                className={cn(
                  'prompt-send-btn w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                  hasContent
                    ? 'bg-foreground text-white hover:bg-zinc-700'
                    : 'bg-surface-subtle text-foreground-lighter cursor-default'
                )}
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2.5 justify-center">
          {suggestChips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => setPromptValue(chip.label)}
              className="prompt-chip flex items-center gap-2 bg-surface border border-[var(--border)] pl-3.5 pr-4 py-2 rounded-full text-sm text-foreground-muted cursor-pointer transition-all duration-200 hover:border-foreground-lighter hover:text-foreground hover:bg-surface-subtle hover:shadow-sm"
            >
              <chip.icon size={14} />
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Metrics Tab ============ */
function MetricsTab({ project }: { project: ProjectData }) {
  const t = useTranslations('projectDetail');

  return (
    <div className="p-6 md:p-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* AI Contribution */}
        <div className="card-animate-in bg-surface border border-[var(--border)] rounded-2xl p-6 flex flex-col">
          <h3 className="text-[0.95rem] font-semibold mb-5 flex justify-between items-center">
            {t('aiContribution')}
            <Info size={16} className="text-foreground-muted" />
          </h3>
          <div className="flex-1 flex justify-center items-center py-2">
            <div
              className="w-[120px] h-[120px] rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(#09090b 0% ${project.progress}%, var(--surface-subtle) ${project.progress}% 100%)`,
              }}
            >
              <div className="w-[90px] h-[90px] rounded-full bg-surface flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none">{project.progress}%</span>
                <small className="text-[0.7rem] text-foreground-muted mt-1">
                  {t('thisMonth')}
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Saved time */}
        <div className="card-animate-in bg-surface border border-[var(--border)] rounded-2xl p-6 flex flex-col">
          <h3 className="text-[0.95rem] font-semibold mb-5">{t('savedTime')}</h3>
          <div className="text-[2.5rem] font-bold tracking-tight leading-none mb-2">
            0
            <span className="text-base text-foreground-lighter font-normal ml-1">{t('hours')}</span>
          </div>
          <div className="text-xs text-foreground-muted mb-4">{t('growth')}</div>
          <div className="flex items-end gap-2 h-20 mt-auto">
            {[10, 10, 10, 10, 10].map((h, i) => (
              <div key={i} className="flex-1 bg-surface-subtle rounded" style={{ height: `${h}%` }}>
                <div className="w-full h-full bg-foreground-lighter/30 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Key activity */}
        <div className="card-animate-in bg-surface border border-[var(--border)] rounded-2xl p-6 flex flex-col md:col-span-2">
          <h3 className="text-[0.95rem] font-semibold mb-5">{t('keyActivity')}</h3>
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-sm text-foreground-muted">{t('noActivity')}</p>
          </div>
        </div>

        {/* Weekly tasks */}
        <div className="card-animate-in bg-surface border border-[var(--border)] rounded-2xl p-6 xl:col-span-4 md:col-span-2">
          <h3 className="text-[0.95rem] font-semibold mb-5">{t('weeklyTasks')}</h3>
          <div className="flex gap-1 h-4 rounded-lg overflow-hidden mb-3">
            <div className="bg-surface-subtle w-full" />
          </div>
          <div className="flex justify-between text-sm text-foreground-muted">
            <span><b className="text-foreground">0</b> {t('completed')}</span>
            <span><b className="text-foreground">0</b> {t('inProgress')}</span>
            <span><b className="text-foreground">0</b> {t('todo')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Features Tab ============ */
function FeaturesTab({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const modules = getAllModules();

  return (
    <div className="p-6 md:p-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {modules.map((mod) => {
          const Icon = getModuleIcon(mod.icon);
          const href = `/projects/${projectId}/${mod.routePath}`;

          const inner = (
            <>
              <div
                className={cn(
                  'w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0 border',
                  mod.primary
                    ? 'bg-foreground text-white border-foreground'
                    : 'bg-surface-subtle text-foreground border-[var(--border)]'
                )}
              >
                <Icon size={24} />
              </div>
              <div>
                <h3 className="text-[1.1rem] font-semibold mb-1.5">{t(mod.titleKey)}</h3>
                <p className="text-sm text-foreground-muted leading-snug">{t(mod.descKey)}</p>
              </div>
            </>
          );

          const cls =
            'card-animate-in bg-surface border border-[var(--border)] rounded-xl p-6 flex items-start gap-4 cursor-pointer transition-all duration-300 hover:border-foreground hover:shadow-lg hover:-translate-y-0.5';

          return (
            <Link key={mod.id} href={href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Settings Panel ============ */
function SettingsPanel({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectData;
  onClose: () => void;
  onSaved: (data: Partial<ProjectData>) => void;
}) {
  const t = useTranslations('projectSettings');
  const { message, confirm } = useMessage();
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [systemPrompt, setSystemPrompt] = useState(project.systemPrompt || '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await http.put(`/projects/${project.id}`, { name, description, systemPrompt: systemPrompt || null });
      onSaved({ name, description, systemPrompt: systemPrompt || null });
      message.success('Saved');
    } catch {
      // interceptor
    } finally {
      setSaving(false);
    }
  }, [saving, project.id, name, description, systemPrompt, onSaved, message]);

  const handleArchive = useCallback(async () => {
    const ok = await confirm(t('archiveDesc'), { cancelable: true });
    if (!ok) return;
    try {
      await http.post(`/projects/${project.id}/archive`);
      message.success('Archived');
      router.push('/projects');
    } catch {
      // interceptor
    }
  }, [project.id, confirm, t, message, router]);

  const handleDelete = useCallback(async () => {
    const ok = await confirm(t('deleteDesc'), { cancelable: true });
    if (!ok) return;
    try {
      await http.delete(`/projects/${project.id}`);
      message.success('Deleted');
      router.push('/projects');
    } catch {
      // interceptor
    }
  }, [project.id, confirm, t, message, router]);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div className="w-full max-w-[760px] bg-surface border-x border-[var(--border)] p-8 md:p-12 pb-24 min-h-full shadow-[0_0_40px_rgba(0,0,0,0.03)] relative">
      <button
        onClick={onClose}
        className="absolute top-6 right-8 flex items-center gap-2 text-foreground-muted px-2.5 py-1.5 rounded-md transition-all hover:bg-surface-subtle hover:text-foreground"
      >
        <X size={20} />
        <span className="font-mono text-[0.7rem] bg-[var(--border)] px-1.5 py-0.5 rounded text-foreground">Esc</span>
      </button>

      <h1 className="text-2xl font-semibold tracking-tight mb-10 pb-4 border-b border-[var(--border)]">
        {t('title')}
      </h1>

      {/* Basic Info */}
      <section className="mb-12">
        <FormGroup label={t('name')} desc={t('nameDesc')}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3.5 rounded-lg border border-[var(--border-strong)] bg-surface text-[0.95rem] outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
          />
        </FormGroup>
        <FormGroup label={t('slug')} desc={t('slugDesc')}>
          <input
            type="text"
            value={slug}
            disabled
            className="w-full h-10 px-3.5 rounded-lg border border-[var(--border-strong)] bg-surface-subtle text-[0.95rem] text-foreground-muted font-mono outline-none"
          />
        </FormGroup>
        <FormGroup label={t('desc')} desc={t('descHint')}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] px-3.5 py-2.5 rounded-lg border border-[var(--border-strong)] bg-surface text-[0.95rem] outline-none resize-y transition-all focus:border-foreground focus:ring-1 focus:ring-foreground"
          />
        </FormGroup>
      </section>

      {/* AI Behavior */}
      <section className="mb-12">
        <h3 className="text-lg font-semibold mb-5">{t('aiBehavior')}</h3>
        <FormGroup label={t('projectPrompt')} desc={t('projectPromptDesc')}>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. You are an expert in FinTech..."
            className="w-full min-h-[100px] px-3.5 py-2.5 rounded-lg border border-[var(--border-strong)] bg-surface text-sm font-mono outline-none resize-y transition-all focus:border-foreground focus:ring-1 focus:ring-foreground placeholder:text-foreground-lighter"
          />
        </FormGroup>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'h-10 px-6 rounded-lg bg-foreground text-white text-[0.95rem] font-medium transition-all hover:bg-zinc-800 hover:-translate-y-px',
          saving && 'opacity-70 pointer-events-none'
        )}
      >
        {t('save')}
      </button>

      {/* Danger Zone */}
      <section className="mt-16 pb-8">
        <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={2.5} />
          {t('dangerZone')}
        </h3>
        <div className="border border-red-300 rounded-xl overflow-hidden bg-surface">
          <div className="flex justify-between items-center px-6 py-5 border-b border-red-300">
            <div>
              <h4 className="text-[0.95rem] font-semibold mb-1">{t('archive')}</h4>
              <p className="text-xs text-foreground-muted">{t('archiveDesc')}</p>
            </div>
            <button
              onClick={handleArchive}
              className="h-9 px-4 rounded-md text-sm font-medium transition-all flex-shrink-0 ml-4 bg-surface text-red-600 border border-[var(--border-strong)] hover:bg-red-50 hover:border-red-300"
            >
              {t('archiveBtn')}
            </button>
          </div>
          <div className="flex justify-between items-center px-6 py-5">
            <div>
              <h4 className="text-[0.95rem] font-semibold mb-1">{t('delete')}</h4>
              <p className="text-xs text-foreground-muted">{t('deleteDesc')}</p>
            </div>
            <button
              onClick={handleDelete}
              className="h-9 px-4 rounded-md text-sm font-medium transition-all flex-shrink-0 ml-4 bg-surface text-red-600 border border-red-600 hover:bg-red-600 hover:text-white"
            >
              {t('deleteBtn')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FormGroup({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-foreground-muted">{desc}</p>
      {children}
    </div>
  );
}
