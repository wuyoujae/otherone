'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronRight,
  Rows3,
  Columns3,
  ArrowUpDown,
  Check,
  FolderOpen,
  GripVertical,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import http from '@/lib/http';
import { useMessage } from '@/components/ui/message/message-provider';
import { CraftEditor } from '@/components/editor/craft-editor';

/* ═══════════ Types ═══════════ */

interface ProjectInfo { id: string; name: string; icon: string; status: number }
interface TodoModule { id: string; projectId: string; parentId: string | null; name: string; color: string | null; sortOrder: number }
interface TodoItem { id: string; projectId: string; moduleId: string | null; title: string; description: string | null; content: string | null; status: number; priority: number; sortOrder: number; startDate: string | null; endDate: string | null; startTime: string | null; endTime: string | null; createdAt: string; updatedAt: string }

type SortMode = 'priority' | 'time' | 'created';
type LayoutMode = 'horizontal' | 'vertical';

const PRIORITY_CFG: Record<number, { dot: string; text: string; bg: string; label: string; color: string }> = {
  1: { dot: 'bg-zinc-300', text: 'text-foreground-lighter', bg: '', label: 'priorityLow', color: '#a1a1aa' },
  2: { dot: 'bg-blue-400', text: 'text-blue-600', bg: 'bg-blue-50', label: 'priorityMed', color: '#3b82f6' },
  3: { dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50', label: 'priorityHigh', color: '#f59e0b' },
  4: { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', label: 'priorityUrgent', color: '#ef4444' },
};

const STATUS_OPTS = [
  { value: 1, key: 'statusTodo' },
  { value: 2, key: 'statusProgress' },
  { value: 3, key: 'statusDone' },
] as const;

function getTimeGap(item: TodoItem): number {
  if (!item.endDate) return Infinity;
  const start = item.startDate ? new Date(item.startDate).getTime() : Date.now();
  return new Date(item.endDate).getTime() - start;
}

function isTodayDate(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/* ═══════════ Page ═══════════ */

export default function TaskDesignPage() {
  const t = useTranslations('todo');
  const { message, confirm } = useMessage();

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [allModules, setAllModules] = useState<TodoModule[]>([]);
  const [allTodos, setAllTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchVer, setFetchVer] = useState(0);
  const [layout, setLayout] = useState<LayoutMode>('horizontal');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);

  // Selection
  const [selectedCraft, setSelectedCraft] = useState<TodoItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragType, setDragType] = useState<'module' | 'craft' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projRes: any = await http.get('/projects');
        const projs: ProjectInfo[] = projRes.data?.projects || [];
        setProjects(projs);
        const modsArr: TodoModule[] = [];
        const todosArr: TodoItem[] = [];
        await Promise.all(projs.map(async (p) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [mRes, tRes]: any[] = await Promise.all([http.get(`/todo/${p.id}/modules`), http.get(`/todo/${p.id}`)]);
            (mRes.data || []).forEach((m: TodoModule) => modsArr.push(m));
            (tRes.data || []).forEach((item: TodoItem) => todosArr.push(item));
          } catch { /* skip */ }
        }));
        setAllModules(modsArr);
        setAllTodos(todosArr);
      } catch { /* interceptor */ } finally { setLoading(false); }
    }
    load();
  }, [fetchVer]);

  const visibleTodos = useMemo(() => allTodos.filter((item) => item.status !== 3 || isTodayDate(new Date(item.updatedAt))), [allTodos]);

  const sortItems = useCallback((items: TodoItem[]): TodoItem[] => {
    return [...items].sort((a, b) => {
      if (sortMode === 'priority') { if (a.priority !== b.priority) return b.priority - a.priority; return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); }
      if (sortMode === 'time') { const gA = getTimeGap(a); const gB = getTimeGap(b); if (gA !== gB) return gA - gB; if (gA === Infinity && gB === Infinity && a.priority !== b.priority) return b.priority - a.priority; return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [sortMode]);

  const getRootModules = useCallback((pid: string) => allModules.filter((m) => m.projectId === pid && m.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder), [allModules]);
  const getSubModules = useCallback((pid: string) => allModules.filter((m) => m.parentId === pid).sort((a, b) => a.sortOrder - b.sortOrder), [allModules]);
  const getModuleTodos = useCallback((mid: string) => sortItems(visibleTodos.filter((item) => item.moduleId === mid)), [visibleTodos, sortItems]);

  const moduleNameMap = useMemo(() => { const m = new Map<string, string>(); allModules.forEach((mod) => m.set(mod.id, mod.name)); return m; }, [allModules]);
  const craftTitle = useCallback((item: TodoItem) => item.moduleId && moduleNameMap.has(item.moduleId) ? `${moduleNameMap.get(item.moduleId)} - ${item.title}` : item.title, [moduleNameMap]);

  const toggleCollapse = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const toggleComplete = async (item: TodoItem) => {
    const s = item.status === 3 ? 1 : 3;
    try { await http.put(`/todo/${item.projectId}/${item.id}`, { status: s }); setAllTodos((p) => p.map((t) => t.id === item.id ? { ...t, status: s, updatedAt: new Date().toISOString() } : t)); } catch { /* */ }
  };

  const activeProjects = useMemo(() => projects.filter((p) => getRootModules(p.id).length > 0), [projects, getRootModules]);

  // Reorder: selected craft's project goes first
  const orderedProjects = useMemo(() => {
    if (!selectedCraft) return activeProjects;
    const sid = selectedCraft.projectId;
    return [...activeProjects.filter((p) => p.id === sid), ...activeProjects.filter((p) => p.id !== sid)];
  }, [activeProjects, selectedCraft]);

  const handleCraftClick = (item: TodoItem) => {
    setSelectedCraft((prev) => prev?.id === item.id ? null : item);
    if (layout === 'horizontal' && scrollRef.current) scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const closePanel = () => setSelectedCraft(null);

  // Drag-and-drop handlers
  const handleDragStart = (type: 'module' | 'craft', id: string) => { setDragType(type); setDragId(id); };
  const handleDragEnd = () => { setDragType(null); setDragId(null); setDragOverId(null); };
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId || !dragType) return;
    if (dragType === 'craft') {
      const dragItem = allTodos.find((t) => t.id === dragId);
      const targetItem = allTodos.find((t) => t.id === targetId);
      if (!dragItem || !targetItem || dragItem.moduleId !== targetItem.moduleId) return;
      try {
        await http.put(`/todo/${dragItem.projectId}/${dragId}`, { sortOrder: targetItem.sortOrder });
        await http.put(`/todo/${targetItem.projectId}/${targetId}`, { sortOrder: dragItem.sortOrder });
        setFetchVer((v) => v + 1);
      } catch { /* */ }
    } else {
      const dragMod = allModules.find((m) => m.id === dragId);
      const targetMod = allModules.find((m) => m.id === targetId);
      if (!dragMod || !targetMod || dragMod.parentId !== targetMod.parentId) return;
      try {
        await http.put(`/todo/${dragMod.projectId}/modules/${dragId}`, { sortOrder: targetMod.sortOrder });
        await http.put(`/todo/${targetMod.projectId}/modules/${targetId}`, { sortOrder: dragMod.sortOrder });
        setFetchVer((v) => v + 1);
      } catch { /* */ }
    }
    handleDragEnd();
  };

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: 'priority', label: t('sortPriority') },
    { key: 'time', label: t('sortTime') },
    { key: 'created', label: t('sortCreated') },
  ];

  // Recursive module renderer. focusCraftId: when set, only that craft is fully visible
  const renderModuleBlock = (mod: TodoModule, depth: number, focusCraftId?: string | null): React.ReactNode => {
    const isCol = collapsed.has(mod.id);
    const items = getModuleTodos(mod.id);
    const subs = getSubModules(mod.id);
    const pad = depth * 16;
    const inFocusMode = focusCraftId !== undefined;

    return (
      <div key={mod.id}>
        <div
          className={cn('flex items-center gap-1.5 w-full py-2 px-2 text-left transition-all hover:bg-surface-hover/50 rounded-lg', dragOverId === mod.id && 'bg-surface-hover', inFocusMode && 'opacity-50')}
          style={{ paddingLeft: pad + 8 }}
          draggable
          onDragStart={() => handleDragStart('module', mod.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(mod.id); }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => { e.preventDefault(); handleDrop(mod.id); }}
        >
          <GripVertical size={12} className="text-foreground-lighter/40 flex-shrink-0 cursor-grab active:cursor-grabbing" />
          <button onClick={() => toggleCollapse(mod.id)} className="flex-shrink-0">
            <span className={cn('block transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', isCol ? '' : 'rotate-90')}>
              <ChevronRight size={14} className="text-foreground-muted" />
            </span>
          </button>
          {mod.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: mod.color }} />}
          <span className="text-sm font-semibold text-foreground truncate">{mod.name}</span>
          <span className="text-xs text-foreground-lighter ml-auto tabular-nums">{items.length}</span>
        </div>

        <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ gridTemplateRows: isCol ? '0fr' : '1fr' }}>
          <div className="overflow-hidden">
            {items.map((item) => {
              const isFocused = focusCraftId === item.id;
              const isDimmed = inFocusMode && !isFocused;
              return (
                <CraftRow key={item.id} item={item} depth={depth} selected={selectedCraft?.id === item.id} focused={isFocused} dimmed={isDimmed} onToggle={() => toggleComplete(item)} onClick={() => handleCraftClick(item)} dragOverId={dragOverId} onDragStart={() => handleDragStart('craft', item.id)} onDragEnd={handleDragEnd} onDragOver={item.id} setDragOverId={setDragOverId} onDrop={() => handleDrop(item.id)} t={t} />
              );
            })}
            {subs.map((sub) => renderModuleBlock(sub, depth + 1, focusCraftId))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" /></div>;

  const panelOpen = !!selectedCraft;

  return (
    <div className="flex flex-col h-full relative">
      {/* Full-screen overlay — only in DOM when panel is open */}
      {panelOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[45] animate-fade-in" onClick={closePanel} />}

      {/* Header */}
      <div className={cn('flex items-center justify-between px-8 pt-8 pb-5 flex-shrink-0 transition-opacity duration-500', panelOpen && 'opacity-30 pointer-events-none')}>
        <h1 className="text-2xl font-bold tracking-tight">{t('design')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setSortOpen(!sortOpen)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border-strong)] text-xs font-medium transition-all hover:bg-surface-subtle">
              <ArrowUpDown size={13} />{sortOptions.find((o) => o.key === sortMode)?.label}
            </button>
            {sortOpen && (
              <><div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} /><div className="absolute top-full right-0 mt-1 bg-surface border border-[var(--border)] rounded-lg shadow-lg z-40 py-1 min-w-[130px] cal-dropdown-enter">
                {sortOptions.map((opt) => (<button key={opt.key} onClick={() => { setSortMode(opt.key); setSortOpen(false); }} className={cn('w-full px-3 py-1.5 text-sm text-left transition-colors', sortMode === opt.key ? 'bg-foreground text-white font-medium' : 'text-foreground hover:bg-surface-subtle')}>{opt.label}</button>))}
              </div></>
            )}
          </div>
          <div className="flex items-center p-0.5 bg-surface-subtle rounded-lg border border-[var(--border)]">
            <button onClick={() => { setLayout('horizontal'); setSelectedCraft(null); }} className={cn('w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200', layout === 'horizontal' ? 'bg-foreground text-white shadow-sm' : 'text-foreground-muted hover:text-foreground')}><Columns3 size={14} /></button>
            <button onClick={() => { setLayout('vertical'); setSelectedCraft(null); }} className={cn('w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200', layout === 'vertical' ? 'bg-foreground text-white shadow-sm' : 'text-foreground-muted hover:text-foreground')}><Rows3 size={14} /></button>
          </div>
        </div>
      </div>

      {/* Content — z-[46] floats above the fixed overlay */}
      <div className={cn('flex-1 overflow-hidden relative', panelOpen ? 'z-[46]' : 'z-0')}>
        {activeProjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <FolderOpen size={36} className="text-foreground-lighter" />
            <p className="text-sm text-foreground-muted">{t('noModulesYet')}</p>
            <p className="text-xs text-foreground-lighter">{t('noModulesHint')}</p>
          </div>
        ) : layout === 'horizontal' ? (
          <div ref={scrollRef} className="h-full flex pl-8 pr-4 pb-6 overflow-x-auto">
            {/* All cards — non-selected collapse to w-0 */}
            {orderedProjects.map((proj) => {
              const isActive = panelOpen && selectedCraft?.projectId === proj.id;
              const isHidden = panelOpen && !isActive;
              return (
                <div
                  key={proj.id}
                  className={cn(
                    'h-full bg-surface border rounded-2xl flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isHidden ? 'w-0 min-w-0 opacity-0 border-transparent mx-0 px-0' : 'w-[360px] flex-shrink-0 mr-4',
                    isActive && 'shadow-xl',
                    !panelOpen && 'hover:shadow-md border-[var(--border)]',
                    !isHidden && !isActive && 'border-[var(--border)]'
                  )}
                >
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border)] bg-surface-subtle/40 flex-shrink-0 whitespace-nowrap">
                    <div className="w-7 h-7 rounded-lg bg-foreground text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{proj.name.charAt(0).toUpperCase()}</div>
                    <h3 className="text-base font-bold text-foreground truncate">{proj.name}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 px-1">
                    {getRootModules(proj.id).map((mod) => renderModuleBlock(mod, 0, isActive ? selectedCraft?.id : undefined))}
                  </div>
                </div>
              );
            })}

            {/* Editor panel — grows from w-0 to flex-1 */}
            <div className={cn(
              'h-full bg-surface border border-[var(--border)] rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
              panelOpen ? 'flex-1 min-w-[300px] opacity-100 mr-4' : 'w-0 min-w-0 opacity-0 pointer-events-none border-transparent'
            )}>
              {selectedCraft && <CraftPanel craft={selectedCraft} projectId={selectedCraft.projectId} onClose={closePanel} onSaved={() => setFetchVer((v) => v + 1)} t={t} message={message} confirm={confirm} />}
            </div>
          </div>
        ) : (
          /* ── Vertical ── */
          <div className="h-full flex flex-col px-8 pb-6 overflow-y-auto">
            {orderedProjects.map((proj) => {
              const isActive = panelOpen && selectedCraft?.projectId === proj.id;
              const isHidden = panelOpen && !isActive;
              return (
                <div
                  key={proj.id}
                  className={cn(
                    'bg-surface border rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isHidden ? 'h-0 min-h-0 opacity-0 border-transparent my-0 py-0' : 'mb-4',
                    isActive && 'shadow-xl flex-shrink-0',
                    !panelOpen && 'hover:shadow-md border-[var(--border)]',
                    !isHidden && !isActive && 'border-[var(--border)]'
                  )}
                >
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border)] bg-surface-subtle/40 whitespace-nowrap">
                    <div className="w-7 h-7 rounded-lg bg-foreground text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{proj.name.charAt(0).toUpperCase()}</div>
                    <h3 className="text-base font-bold text-foreground truncate">{proj.name}</h3>
                  </div>
                  <div className="py-2 px-1">
                    {getRootModules(proj.id).map((mod) => renderModuleBlock(mod, 0, isActive ? selectedCraft?.id : undefined))}
                  </div>
                </div>
              );
            })}

            <div className={cn(
              'bg-surface border border-[var(--border)] rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
              panelOpen ? 'flex-1 min-h-[200px] opacity-100' : 'h-0 min-h-0 opacity-0 pointer-events-none border-transparent'
            )}>
              {selectedCraft && <CraftPanel craft={selectedCraft} projectId={selectedCraft.projectId} onClose={closePanel} onSaved={() => setFetchVer((v) => v + 1)} t={t} message={message} confirm={confirm} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ Craft Row ═══════════ */

function CraftRow({ item, depth, selected, focused, dimmed, onToggle, onClick, dragOverId, onDragStart, onDragEnd, onDragOver, setDragOverId, onDrop, t }: {
  item: TodoItem; depth: number; selected: boolean; focused?: boolean; dimmed?: boolean; onToggle: () => void; onClick: () => void;
  dragOverId: string | null; onDragStart: () => void; onDragEnd: () => void; onDragOver: string; setDragOverId: (id: string | null) => void; onDrop: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const done = item.status === 3;
  const ps = PRIORITY_CFG[item.priority] || PRIORITY_CFG[2];
  const doneToday = done && isTodayDate(new Date(item.updatedAt));

  const dateLabel = useMemo(() => {
    if (!item.startDate && !item.endDate) return null;
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    if (item.startDate && item.endDate) return `${fmt.format(new Date(item.startDate))} \u2013 ${fmt.format(new Date(item.endDate))}`;
    if (item.startDate) return `${fmt.format(new Date(item.startDate))} \u2192`;
    return `\u2192 ${fmt.format(new Date(item.endDate!))}`;
  }, [item.startDate, item.endDate]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 group',
        focused ? 'bg-amber-50 ring-2 ring-amber-300/60 shadow-[0_0_12px_rgba(251,191,36,0.15)] relative z-10' : selected ? 'bg-foreground/[0.04] ring-1 ring-foreground/10' : 'hover:bg-surface-hover/50',
        dimmed && 'opacity-20',
        done && !selected && !focused && 'opacity-50',
        dragOverId === onDragOver && 'bg-surface-hover ring-1 ring-foreground/10'
      )}
      style={{ paddingLeft: (depth + 1) * 16 + 8 }}
      onClick={onClick}
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(onDragOver); }}
      onDragLeave={() => setDragOverId(null)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(); }}
    >
      <GripVertical size={12} className="text-foreground-lighter/30 flex-shrink-0 cursor-grab active:cursor-grabbing" />
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={cn('w-4 h-4 rounded flex-shrink-0 border-[1.5px] flex items-center justify-center transition-all', done ? 'bg-foreground border-foreground' : 'border-[var(--border-strong)] hover:border-foreground')}>
        {done && <Check size={9} className="text-white" strokeWidth={3} />}
      </button>
      <span className={cn('flex-1 text-sm truncate', done && 'line-through text-foreground-muted')}>{item.title}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {dateLabel && <span className="text-[0.65rem] text-foreground-lighter tabular-nums whitespace-nowrap">{dateLabel}</span>}
        {item.priority >= 3 && <span className={cn('text-[0.65rem] font-semibold px-1.5 py-0.5 rounded', ps.text, ps.bg)}>{t(ps.label)}</span>}
      </div>
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', ps.dot)} />
      {doneToday && <span className="text-[0.6rem] text-emerald-500 font-medium flex-shrink-0">{t('completedToday')}</span>}
    </div>
  );
}

/* ═══════════ Craft Edit Panel ═══════════ */

function CraftPanel({ craft, projectId, onClose, onSaved, t, message }: {
  craft: TodoItem; projectId: string; onClose: () => void; onSaved: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any; message: any; confirm: any;
}) {
  const [title, setTitle] = useState(craft.title);
  const [content, setContent] = useState(craft.content || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(craft.title);
    setContent(craft.content || '');
  }, [craft]);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await http.put(`/todo/${projectId}/${craft.id}`, {
        title: title.trim(),
        content: content || null,
      });
      message.success(t('save'));
      onSaved();
    } catch { /* */ } finally { setSaving(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header: title + save */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border)] flex-shrink-0">
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground flex-shrink-0">
          <X size={15} />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-base font-semibold bg-transparent outline-none placeholder:text-foreground-lighter"
          placeholder="Craft title..."
        />
        <button
          disabled={!title.trim() || saving}
          onClick={handleSave}
          className={cn(
            'h-8 px-4 rounded-lg text-xs font-medium transition-all flex-shrink-0',
            title.trim() && !saving
              ? 'bg-foreground text-white hover:bg-zinc-700 hover:-translate-y-px'
              : 'bg-surface-subtle text-foreground-lighter cursor-default'
          )}
        >
          {saving ? '...' : t('save')}
        </button>
      </div>

      {/* Editor: Craft canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <CraftEditor
          content={content}
          onChange={setContent}
          placeholder="Type / for commands, or start writing your craft..."
        />
      </div>
    </div>
  );
}
