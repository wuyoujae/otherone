'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Columns3,
  Clock,
  Plus,
  X,
  PenLine,
  Sparkles,
  Flag,
  Trash2,
  Check,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import http from '@/lib/http';
import { useMessage } from '@/components/ui/message/message-provider';

type ViewMode = 'month' | 'week' | 'day';

interface TaskModalContext {
  date: Date;
  hour: number | null;
}

interface TodoItemData {
  id: string;
  title: string;
  description: string | null;
  status: number;
  priority: number;
  moduleId: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  updatedAt: string;
}

const HOUR_HEIGHT = 56;

const CRAFT_PALETTE = [
  { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  { bg: '#d1fae5', border: '#10b981', text: '#047857' },
  { bg: '#ffedd5', border: '#f97316', text: '#c2410c' },
  { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' },
  { bg: '#fecdd3', border: '#f43f5e', text: '#be123c' },
  { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },
  { bg: '#d9f99d', border: '#84cc16', text: '#4d7c0f' },
  { bg: '#fbcfe8', border: '#d946ef', text: '#a21caf' },
];

function craftColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return CRAFT_PALETTE[Math.abs(h) % CRAFT_PALETTE.length];
}

function getCraftDayType(craft: TodoItemData, dateStr: string): 'only' | 'first' | 'middle' | 'last' {
  const isFirst = !craft.startDate || dateStr === normalizeDate(craft.startDate);
  const isLast = !craft.endDate || dateStr === normalizeDate(craft.endDate);
  if (isFirst && isLast) return 'only';
  if (isFirst) return 'first';
  if (isLast) return 'last';
  return 'middle';
}

function getDayViewRange(craft: TodoItemData, dateStr: string): { startMin: number; endMin: number } {
  const type = getCraftDayType(craft, dateStr);
  const sMin = craft.startTime ? parseTimeMinutes(craft.startTime) : 0;
  const eMin = craft.endTime ? parseTimeMinutes(craft.endTime) : 1440;
  if (type === 'only') return { startMin: sMin, endMin: eMin };
  if (type === 'first') return { startMin: sMin, endMin: 1440 };
  if (type === 'last') return { startMin: 0, endMin: eMin };
  return { startMin: 0, endMin: 1440 };
}
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

/* ═══════════ Date Utilities ═══════════ */

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const offset = first.getDay();
  const start = new Date(year, month, 1 - offset);
  const weeks: Date[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const day = new Date(d); day.setDate(day.getDate() + i); return day; });
}

function getWeekRange(date: Date): [Date, Date] {
  const days = getWeekDays(date);
  return [days[0], days[6]];
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

function getDayShortNames(locale: string): string[] {
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(d.getDate() + i);
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
  });
}

function normalizeDate(d: string | null): string | null {
  return d ? d.slice(0, 10) : null;
}

function craftOnDate(craft: TodoItemData, dateStr: string): boolean {
  const sd = normalizeDate(craft.startDate);
  const ed = normalizeDate(craft.endDate);
  if (!sd && !ed) return true;
  if (sd && !ed) return dateStr >= sd;
  if (!sd && ed) return dateStr <= ed;
  return dateStr >= sd! && dateStr <= ed!;
}

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/* ═══════════ Main Page ═══════════ */

export default function TodoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useTranslations('todo');
  const locale = useLocale();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Date picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPickerClosing, setIsPickerClosing] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const pickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Task creation modal
  const [modalCtx, setModalCtx] = useState<TaskModalContext | null>(null);

  // Craft edit modal
  const [editingCraft, setEditingCraft] = useState<TodoItemData | null>(null);
  const onCraftClick = useCallback((craft: TodoItemData) => setEditingCraft(craft), []);
  const closeEditModal = useCallback(() => { setEditingCraft(null); setFetchVer((v) => v + 1); }, []);

  // Todo data
  const [todos, setTodos] = useState<TodoItemData[]>([]);
  const [moduleMap, setModuleMap] = useState<Map<string, string>>(new Map());
  const [fetchVer, setFetchVer] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setIsLoading(false), 500);
    const t2 = setTimeout(() => setIsTransitioning(false), 560);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    Promise.all([
      http.get(`/todo/${projectId}`),
      http.get(`/todo/${projectId}/modules`),
    ]).then(([todosRes, modsRes]: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[]) => {
      setTodos(todosRes.data || []);
      const map = new Map<string, string>();
      for (const m of (modsRes.data || [])) map.set(m.id, m.name);
      setModuleMap(map);
    }).catch(() => {});
  }, [projectId, fetchVer]);

  const craftDisplayTitle = useCallback((craft: TodoItemData) => {
    if (craft.moduleId && moduleMap.has(craft.moduleId)) {
      return `${moduleMap.get(craft.moduleId)} - ${craft.title}`;
    }
    return craft.title;
  }, [moduleMap]);

  const visibleTodos = useMemo(() => {
    const now = new Date();
    return todos.filter((t) => {
      if (t.status !== 3) return true;
      const u = new Date(t.updatedAt);
      return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth() && u.getDate() === now.getDate();
    });
  }, [todos]);

  const closePicker = useCallback(() => {
    setIsPickerClosing(true);
    pickerCloseTimer.current = setTimeout(() => { setPickerOpen(false); setIsPickerClosing(false); }, 150);
  }, []);

  const togglePicker = useCallback(() => {
    if (pickerOpen) { closePicker(); return; }
    if (pickerCloseTimer.current) { clearTimeout(pickerCloseTimer.current); pickerCloseTimer.current = null; }
    const rect = dateButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const pw = 280;
      let left = rect.left + rect.width / 2 - pw / 2;
      if (left < 12) left = 12;
      if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
      setPickerPos({ top: rect.bottom + 8, left });
    }
    setPickerOpen(true);
    setIsPickerClosing(false);
  }, [pickerOpen, closePicker]);

  const transition = useCallback((fn: () => void) => {
    if (pickerOpen) { setPickerOpen(false); setIsPickerClosing(false); if (pickerCloseTimer.current) clearTimeout(pickerCloseTimer.current); }
    setIsTransitioning(true);
    setTimeout(() => { fn(); setTimeout(() => setIsTransitioning(false), 30); }, 180);
  }, [pickerOpen]);

  const switchView = useCallback((v: ViewMode) => { if (v === viewMode) return; transition(() => setViewMode(v)); }, [viewMode, transition]);
  const navigate = useCallback((dir: 'prev' | 'next') => {
    transition(() => {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        const delta = dir === 'next' ? 1 : -1;
        if (viewMode === 'month') d.setMonth(d.getMonth() + delta);
        else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7);
        else d.setDate(d.getDate() + delta);
        return d;
      });
    });
  }, [viewMode, transition]);
  const goToday = useCallback(() => { transition(() => setCurrentDate(new Date())); }, [transition]);
  const handlePickerSelect = useCallback((date: Date) => { closePicker(); transition(() => setCurrentDate(date)); }, [closePicker, transition]);

  const openTaskModal = useCallback((date: Date, hour: number | null) => {
    setModalCtx({ date, hour });
  }, []);
  const closeTaskModal = useCallback(() => { setModalCtx(null); setFetchVer((v) => v + 1); }, []);

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(currentDate);
    if (viewMode === 'week') {
      const [start, end] = getWeekRange(currentDate);
      const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
      if (start.getMonth() === end.getMonth()) {
        return `${fmt.format(start)} \u2013 ${new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(end)}, ${start.getFullYear()}`;
      }
      return `${fmt.format(start)} \u2013 ${fmt.format(end)}, ${end.getFullYear()}`;
    }
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(currentDate);
  }, [currentDate, viewMode, locale]);

  const viewButtons: { key: ViewMode; label: string; icon: typeof Clock }[] = [
    { key: 'day', label: t('day'), icon: Clock },
    { key: 'week', label: t('week'), icon: Columns3 },
    { key: 'month', label: t('month'), icon: LayoutGrid },
  ];

  return (
    <div className="desktop-shell-height flex flex-col overflow-hidden bg-surface">
      <header className="flex flex-col px-6 md:px-10 pt-6 bg-white/90 backdrop-blur-xl border-b border-[var(--border)] relative z-10">
        <div className="flex items-center gap-4 mb-5">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="text-foreground-muted transition-all hover:text-foreground hover:-translate-x-0.5">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <div className="grid items-center pb-4" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
          <div />
          <div className="flex items-center gap-0.5">
            <button onClick={() => navigate('prev')} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronLeft size={18} /></button>
            <button ref={dateButtonRef} onClick={togglePicker} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-surface-subtle', pickerOpen && 'bg-surface-subtle')}>
              <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap">{headerTitle}</h2>
              <ChevronDown size={16} className={cn('text-foreground-muted transition-transform duration-200', pickerOpen && 'rotate-180')} />
            </button>
            <button onClick={() => navigate('next')} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronRight size={18} /></button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={goToday} className="h-7 px-3 rounded-lg border border-[var(--border-strong)] text-xs font-medium transition-all hover:bg-surface-subtle hover:border-foreground">{t('today')}</button>
            <div className="flex items-center p-1 bg-surface-subtle rounded-xl border border-[var(--border)]">
              {viewButtons.map((btn) => (
                <button key={btn.key} onClick={() => switchView(btn.key)} className={cn('flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200', viewMode === btn.key ? 'bg-foreground text-white shadow-sm' : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover')}>
                  <btn.icon size={13} /><span className="hidden sm:inline">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className={cn('absolute inset-0 z-10 bg-surface transition-opacity duration-400', isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none')}><CalendarSkeleton /></div>
        <div className={cn('h-full', isTransitioning ? 'opacity-0 translate-y-1 scale-[0.998] transition-all duration-150 ease-in' : 'opacity-100 translate-y-0 scale-100 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]')}>
          {viewMode === 'month' && <MonthView currentDate={currentDate} locale={locale} todos={visibleTodos} getTitle={craftDisplayTitle} onCellClick={(d) => openTaskModal(d, null)} onCraftClick={onCraftClick} />}
          {viewMode === 'week' && <TimeGrid days={getWeekDays(currentDate)} locale={locale} todos={visibleTodos} getTitle={craftDisplayTitle} onSlotClick={openTaskModal} onCraftClick={onCraftClick} />}
          {viewMode === 'day' && <TimeGrid days={[currentDate]} locale={locale} todos={visibleTodos} getTitle={craftDisplayTitle} onSlotClick={openTaskModal} onCraftClick={onCraftClick} />}
        </div>
      </main>

      {pickerOpen && <DatePickerPopover currentDate={currentDate} locale={locale} position={pickerPos} isClosing={isPickerClosing} onSelect={handlePickerSelect} onClose={closePicker} />}

      {modalCtx && <TaskCreationModal projectId={projectId} context={modalCtx} locale={locale} onClose={closeTaskModal} />}

      {editingCraft && <CraftEditModal projectId={projectId} craft={editingCraft} locale={locale} onClose={closeEditModal} />}
    </div>
  );
}

/* ═══════════ Calendar Skeleton ═══════════ */

function CalendarSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 bg-surface border-b border-[var(--border)]">
        {Array.from({ length: 7 }).map((_, i) => (<div key={i} className="flex justify-center py-3"><div className="w-8 h-3 rounded-sm cal-shimmer" style={{ animationDelay: `${i * 80}ms` }} /></div>))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="border-b border-r border-[var(--border)] p-2.5">
            <div className="flex justify-end"><div className="w-7 h-7 rounded-full cal-shimmer" style={{ animationDelay: `${Math.floor(i / 7) * 100 + (i % 7) * 50}ms` }} /></div>
            {i % 5 === 0 && <div className="mt-2 w-3/4 h-2 rounded cal-shimmer" style={{ animationDelay: `${i * 30 + 200}ms` }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════ Month View ═══════════ */

function MonthView({ currentDate, locale, todos, getTitle, onCellClick, onCraftClick }: { currentDate: Date; locale: string; todos: TodoItemData[]; getTitle: (c: TodoItemData) => string; onCellClick: (date: Date) => void; onCraftClick: (craft: TodoItemData) => void }) {
  const dayNames = useMemo(() => getDayShortNames(locale), [locale]);
  const weeks = useMemo(() => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);
  const currentMonth = currentDate.getMonth();

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 bg-surface border-b border-[var(--border)]">
        {dayNames.map((name, i) => (<div key={i} className={cn('text-center py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider', i === 0 || i === 6 ? 'text-foreground-lighter' : 'text-foreground-muted')}>{name}</div>))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
        {weeks.flat().map((day, idx) => {
          const isOtherMonth = day.getMonth() !== currentMonth;
          const today = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const ds = toDateStr(day);
          const dayCrafts = todos.filter((t) => craftOnDate(t, ds));

          return (
            <div key={idx} onClick={() => onCellClick(day)} className={cn('border-b border-r border-[var(--border)] px-1 pt-1 pb-0.5 transition-colors duration-150 cursor-pointer group flex flex-col overflow-hidden', 'hover:bg-surface-hover', isOtherMonth ? 'bg-surface-subtle/60' : 'bg-surface')}>
              <div className="flex justify-end flex-shrink-0">
                <span className={cn('inline-flex items-center justify-center w-6 h-6 text-[0.75rem] rounded-full transition-all duration-200', today && 'bg-foreground text-white font-bold', !today && isOtherMonth && 'text-foreground-lighter', !today && !isOtherMonth && isWeekend && 'text-foreground-muted', !today && !isOtherMonth && !isWeekend && 'text-foreground font-medium', !today && 'group-hover:bg-surface-subtle')}>
                  {day.getDate()}
                </span>
              </div>
              {dayCrafts.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col gap-[2px] mt-0.5 overflow-hidden">
                  {dayCrafts.slice(0, 3).map((craft) => {
                    const cc = craftColor(craft.id);
                    return (
                      <div key={craft.id} onClick={(e) => { e.stopPropagation(); onCraftClick(craft); }} className={cn('rounded-sm px-1 py-px truncate border-l-2 cursor-pointer transition-opacity hover:opacity-80', craft.status === 3 && 'opacity-40')} style={{ backgroundColor: cc.bg, borderColor: cc.border }}>
                        <span className={cn('text-[0.6rem] leading-tight truncate block', craft.status === 3 && 'line-through')} style={{ color: cc.text }}>{getTitle(craft)}</span>
                      </div>
                    );
                  })}
                  {dayCrafts.length > 3 && (
                    <span className="text-[0.55rem] text-foreground-lighter px-0.5">+{dayCrafts.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ Shared Time Grid ═══════════ */

function TimeGrid({ days, locale, todos, getTitle, onSlotClick, onCraftClick }: { days: Date[]; locale: string; todos: TodoItemData[]; getTitle: (c: TodoItemData) => string; onSlotClick: (date: Date, hour: number) => void; onCraftClick: (craft: TodoItemData) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('todo');
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = Math.max(0, (new Date().getHours() - 1) * HOUR_HEIGHT); }, []);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto relative">
        <div className="flex bg-surface border-b border-[var(--border)] sticky top-0 z-20">
          <div className="w-16 flex-shrink-0 flex items-end justify-end pr-3 pb-2 text-[0.6rem] text-foreground-lighter font-medium uppercase tracking-wider">{t('allDay')}</div>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(80px, 1fr))` }}>
            {days.map((day, i) => { const today = isToday(day); return (
              <div key={i} className={cn('flex flex-col items-center py-2.5 border-l border-[var(--border)] transition-colors', today && 'bg-foreground/[0.02]')}>
                <span className={cn('text-[0.6rem] font-semibold uppercase tracking-wider mb-1', today ? 'text-foreground' : 'text-foreground-lighter')}>{dayFmt.format(day)}</span>
                <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors', today ? 'bg-foreground text-white font-bold' : 'text-foreground font-semibold')}>{day.getDate()}</span>
              </div>
            ); })}
          </div>
        </div>
        <div className="flex min-w-0">
          <div className="w-16 flex-shrink-0 relative">
            {HOURS.map((h) => (<div key={h} style={{ height: HOUR_HEIGHT }} className="relative">{h > 0 && <span className="absolute -top-[7px] right-3 text-[0.6rem] text-foreground-lighter font-medium tabular-nums select-none">{formatHour(h)}</span>}</div>))}
          </div>
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(80px, 1fr))` }}>
            {days.map((day, colIdx) => {
              const today = isToday(day);
              const ds = toDateStr(day);
              const dayCrafts = todos.filter((craft) => craftOnDate(craft, ds));
              const isDayMode = days.length === 1;

              return (
                <div key={colIdx} className={cn('border-l border-[var(--border)] relative', today && 'bg-foreground/[0.015]')}>
                  {HOURS.map((h) => (<div key={h} onClick={() => onSlotClick(day, h)} style={{ height: HOUR_HEIGHT }} className="border-b border-[var(--border)] transition-colors hover:bg-surface-hover/50 cursor-pointer" />))}

                  {isDayMode
                    ? <DayColumnCrafts crafts={dayCrafts} dateStr={ds} getTitle={getTitle} onCraftClick={onCraftClick} />
                    : <WeekColumnCrafts crafts={dayCrafts} dateStr={ds} getTitle={getTitle} onCraftClick={onCraftClick} />
                  }

                  {today && <CurrentTimeLine />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ Week Column Crafts ═══════════ */

function WeekColumnCrafts({ crafts, dateStr, getTitle, onCraftClick }: { crafts: TodoItemData[]; dateStr: string; getTitle: (c: TodoItemData) => string; onCraftClick: (craft: TodoItemData) => void }) {
  const PILL_H = 19;
  const MAX_PER_SLOT = 2;

  // Compute base position for each craft, then resolve overlaps by stacking
  const items = crafts.map((craft) => {
    const type = getCraftDayType(craft, dateStr);
    let posMin: number;
    if (type === 'first' || type === 'only') posMin = craft.startTime ? parseTimeMinutes(craft.startTime) : 0;
    else if (type === 'last') posMin = craft.endTime ? parseTimeMinutes(craft.endTime) : 0;
    else posMin = 0;
    return { craft, basePx: (posMin / 60) * HOUR_HEIGHT };
  }).sort((a, b) => a.basePx - b.basePx);

  // Group items that share the same base position (within PILL_H range)
  const groups: { basePx: number; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(item.basePx - last.basePx) < PILL_H) {
      last.items.push(item);
    } else {
      groups.push({ basePx: item.basePx, items: [item] });
    }
  }

  return (
    <>
      {groups.map((group, gi) => {
        const visible = group.items.slice(0, MAX_PER_SLOT);
        const overflowCount = group.items.length - visible.length;
        return visible.map((item, vi) => {
          const cc = craftColor(item.craft.id);
          const top = group.basePx + vi * PILL_H;
          return (
            <div key={item.craft.id}>
              <div
                onClick={(e) => { e.stopPropagation(); onCraftClick(item.craft); }}
                className={cn('absolute left-0.5 right-0.5 rounded-sm px-1 overflow-hidden border-l-2 z-[5] flex items-center cursor-pointer transition-opacity hover:opacity-80', item.craft.status === 3 && 'opacity-40')}
                style={{ top, height: PILL_H - 1, backgroundColor: cc.bg, borderColor: cc.border }}
              >
                <span className={cn('text-[0.6rem] font-medium truncate', item.craft.status === 3 && 'line-through')} style={{ color: cc.text }}>{getTitle(item.craft)}</span>
              </div>
              {vi === visible.length - 1 && overflowCount > 0 && (
                <div className="absolute left-0.5 right-0.5 text-center pointer-events-none z-[5]" style={{ top: top + PILL_H }}>
                  <span className="text-[0.55rem] text-foreground-lighter font-medium">+{overflowCount}</span>
                </div>
              )}
            </div>
          );
        });
      })}
    </>
  );
}

/* ═══════════ Day Column Crafts ═══════════ */

function DayColumnCrafts({ crafts, dateStr, getTitle, onCraftClick }: { crafts: TodoItemData[]; dateStr: string; getTitle: (c: TodoItemData) => string; onCraftClick: (craft: TodoItemData) => void }) {
  const MAX_COLS = 5;

  // Compute time ranges and assign columns
  const items = crafts.map((craft) => {
    const { startMin, endMin } = getDayViewRange(craft, dateStr);
    return { craft, startMin, endMin };
  }).sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  // Track-based column assignment
  const tracks: number[] = [];
  const layout: { craft: TodoItemData; startMin: number; endMin: number; col: number }[] = [];
  const overflow: { craft: TodoItemData; startMin: number }[] = [];

  for (const item of items) {
    let col = -1;
    for (let t = 0; t < tracks.length; t++) {
      if (tracks[t] <= item.startMin) {
        col = t;
        tracks[t] = item.endMin;
        break;
      }
    }
    if (col === -1) {
      if (tracks.length < MAX_COLS) {
        col = tracks.length;
        tracks.push(item.endMin);
      } else {
        overflow.push({ craft: item.craft, startMin: item.startMin });
        continue;
      }
    }
    layout.push({ ...item, col });
  }

  const totalCols = Math.max(1, tracks.length);

  // Group overflow by hour slot for "+N" badges
  const overflowByHour = new Map<number, number>();
  for (const o of overflow) {
    const h = Math.floor(o.startMin / 60);
    overflowByHour.set(h, (overflowByHour.get(h) || 0) + 1);
  }

  return (
    <>
      {layout.map(({ craft, startMin, endMin, col }) => {
        const cc = craftColor(craft.id);
        const topPx = (startMin / 60) * HOUR_HEIGHT;
        const heightPx = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT);
        const colW = 100 / totalCols;

        return (
          <div
            key={craft.id}
            onClick={(e) => { e.stopPropagation(); onCraftClick(craft); }}
            className={cn('absolute rounded-md px-1.5 py-0.5 overflow-hidden border-l-[3px] z-[5] cursor-pointer transition-opacity hover:opacity-80', craft.status === 3 && 'opacity-40')}
            style={{
              top: topPx,
              height: heightPx,
              left: `calc(${col * colW}% + 2px)`,
              width: `calc(${colW}% - 4px)`,
              backgroundColor: cc.bg,
              borderColor: cc.border,
            }}
          >
            <span className={cn('text-[0.7rem] font-medium truncate block leading-tight', craft.status === 3 && 'line-through')} style={{ color: cc.text }}>{getTitle(craft)}</span>
            {heightPx > 34 && (
              <span className="text-[0.55rem] block mt-px" style={{ color: cc.text + 'aa' }}>
                {craft.startTime || '00:00'} {'\u2013'} {craft.endTime || '23:59'}
              </span>
            )}
          </div>
        );
      })}

      {/* Overflow badges */}
      {Array.from(overflowByHour).map(([h, count]) => (
        <div key={`ov-${h}`} className="absolute right-1 z-[6] pointer-events-none" style={{ top: h * HOUR_HEIGHT + 2 }}>
          <span className="text-[0.55rem] font-semibold text-foreground-lighter bg-surface-subtle px-1.5 py-0.5 rounded-full border border-[var(--border)]">+{count}</span>
        </div>
      ))}
    </>
  );
}

/* ═══════════ Current Time Indicator ═══════════ */

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] flex-shrink-0 shadow-sm" />
      <div className="flex-1 h-[1.5px] bg-red-500/80" />
    </div>
  );
}

/* ═══════════ Date Picker Popover ═══════════ */

function DatePickerPopover({ currentDate, locale, position, isClosing, onSelect, onClose }: {
  currentDate: Date; locale: string; position: { top: number; left: number }; isClosing: boolean; onSelect: (d: Date) => void; onClose: () => void;
}) {
  const [viewingMonth, setViewingMonth] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const dayNames = useMemo(() => getDayShortNames(locale), [locale]);
  const weeks = useMemo(() => getMonthGrid(viewingMonth.getFullYear(), viewingMonth.getMonth()), [viewingMonth]);
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(viewingMonth), [viewingMonth, locale]);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  const viewMonth = viewingMonth.getMonth();
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={cn('fixed z-50 w-[280px] bg-surface border border-[var(--border)] rounded-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]', isClosing ? 'cal-popover-exit' : 'cal-popover-enter')} style={{ top: position.top, left: position.left }}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <button onClick={() => setViewingMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
          <button onClick={() => setViewingMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 px-2">{dayNames.map((n, i) => (<div key={i} className="text-center py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-foreground-lighter">{n.slice(0, 2)}</div>))}</div>
        <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3 pt-1">
          {weeks.flat().map((day, idx) => {
            const isOther = day.getMonth() !== viewMonth;
            const today = isToday(day);
            const sel = isSameDay(day, currentDate);
            return (<button key={idx} onClick={() => onSelect(day)} className={cn('h-8 rounded-md flex items-center justify-center text-[0.78rem] transition-all duration-150 hover:bg-surface-subtle', today && !sel && 'font-bold text-foreground', sel && 'bg-foreground text-white font-bold hover:bg-zinc-700', !today && !sel && isOther && 'text-foreground-lighter', !today && !sel && !isOther && 'text-foreground')}>{day.getDate()}</button>);
          })}
        </div>
      </div>
    </>
  );
}

/* ═══════════ Task Creation Modal ═══════════ */

interface LocalModule { lid: string; name: string; parentLid: string | null }
interface LocalCraft { lid: string; title: string; moduleLid: string | null; priority: number }

function sortModulesTopological(mods: LocalModule[]): LocalModule[] {
  const r: LocalModule[] = []; const v = new Set<string>();
  function visit(m: LocalModule) { if (v.has(m.lid)) return; if (m.parentLid) { const p = mods.find((x) => x.lid === m.parentLid); if (p) visit(p); } v.add(m.lid); r.push(m); }
  mods.forEach(visit); return r;
}

function TaskCreationModal({ projectId, context, locale, onClose }: {
  projectId: string; context: TaskModalContext; locale: string; onClose: () => void;
}) {
  const t = useTranslations('todo');
  const { message } = useMessage();

  const [startDate, setStartDate] = useState<string>(toDateStr(context.date));
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(context.hour !== null ? `${String(context.hour).padStart(2, '0')}:00` : '');
  const [endTime, setEndTime] = useState<string>(context.hour !== null ? `${String(Math.min(23, context.hour + 1)).padStart(2, '0')}:00` : '');
  const [dpTarget, setDpTarget] = useState<'start' | 'end' | null>(null);
  const [dpPos, setDpPos] = useState({ top: 0, left: 0 });

  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [aiText, setAiText] = useState('');

  const [modules, setModules] = useState<LocalModule[]>([]);
  const [crafts, setCrafts] = useState<LocalCraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lidRef = useRef(0);
  const genLid = () => `l${++lidRef.current}`;

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (dpTarget) setDpTarget(null); else onClose(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, dpTarget]);

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }), [locale]);
  const startTimeSlot = startTime ? TIME_SLOTS.indexOf(startTime) : -1;

  // Module helpers
  const addModule = (parentLid: string | null) => {
    const lid = genLid();
    setModules((p) => [...p, { lid, name: '', parentLid }]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-mod="${lid}"]`)?.focus(), 30);
  };
  const updateModuleName = (lid: string, name: string) => setModules((p) => p.map((m) => m.lid === lid ? { ...m, name } : m));
  const removeModule = (lid: string) => {
    const toRemove = new Set<string>([lid]);
    const collectDesc = (id: string) => { modules.filter((m) => m.parentLid === id).forEach((m) => { toRemove.add(m.lid); collectDesc(m.lid); }); };
    collectDesc(lid);
    setModules((p) => p.filter((m) => !toRemove.has(m.lid)));
    setCrafts((p) => p.filter((c) => !c.moduleLid || !toRemove.has(c.moduleLid)));
  };

  // Craft helpers
  const addCraft = (moduleLid: string | null) => {
    const lid = genLid();
    setCrafts((p) => [...p, { lid, title: '', moduleLid, priority: 2 }]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-craft="${lid}"]`)?.focus(), 30);
  };
  const updateCraftTitle = (lid: string, title: string) => setCrafts((p) => p.map((c) => c.lid === lid ? { ...c, title } : c));
  const removeCraft = (lid: string) => setCrafts((p) => p.filter((c) => c.lid !== lid));

  const handleCraftKey = (e: React.KeyboardEvent, craft: LocalCraft) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCraft(craft.moduleLid);
    }
    if (e.key === 'Backspace' && craft.title === '') {
      const siblings = crafts.filter((c) => c.moduleLid === craft.moduleLid);
      if (siblings.length <= 1) return;
      e.preventDefault();
      const idx = siblings.findIndex((c) => c.lid === craft.lid);
      const prevLid = idx > 0 ? siblings[idx - 1].lid : null;
      removeCraft(craft.lid);
      if (prevLid) setTimeout(() => document.querySelector<HTMLInputElement>(`[data-craft="${prevLid}"]`)?.focus(), 20);
    }
  };

  const handleModuleKey = (e: React.KeyboardEvent, mod: LocalModule) => {
    if (e.key === 'Enter') { e.preventDefault(); addCraft(mod.lid); }
  };

  const openDatePicker = (target: 'start' | 'end', el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const pw = 280;
    let left = rect.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    setDpPos({ top: rect.bottom + 6, left });
    setDpTarget(target);
  };

  // Validation
  const validCrafts = crafts.filter((c) => c.title.trim());
  const validModules = modules.filter((m) => m.name.trim());
  const canSubmit = (validCrafts.length > 0 || validModules.length > 0) && !submitting;

  // Submit
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const idMap = new Map<string, string>();
      for (const mod of sortModulesTopological(validModules)) {
        const parentId = mod.parentLid ? idMap.get(mod.parentLid) : undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await http.post(`/todo/${projectId}/modules`, { name: mod.name.trim(), parentId: parentId || undefined });
        idMap.set(mod.lid, res.data?.id);
      }
      if (validCrafts.length > 0) {
        const items = validCrafts.map((c) => ({
          title: c.title.trim(),
          priority: c.priority,
          moduleId: c.moduleLid ? idMap.get(c.moduleLid) || undefined : undefined,
          startDate: startDate || undefined, endDate: endDate || undefined,
          startTime: startTime || undefined, endTime: endTime || undefined,
        }));
        await http.post(`/todo/${projectId}/batch`, { items });
      }
      message.success(t('create'));
      onClose();
    } catch { /* interceptor */ } finally { setSubmitting(false); }
  };

  // Recursive tree renderer: modules + their crafts together
  const renderTree = (parentLid: string | null, depth: number): React.ReactNode => {
    const childMods = modules.filter((m) => m.parentLid === parentLid);
    return childMods.map((mod) => {
      const modCrafts = crafts.filter((c) => c.moduleLid === mod.lid);
      const pad = depth * 22;
      return (
        <div key={mod.lid} className="flex flex-col">
          {/* Module row */}
          <div className="flex items-center gap-1 group" style={{ paddingLeft: pad }}>
            {depth > 0 && <span className="text-foreground-lighter/60 text-[0.65rem] select-none mr-0.5">{'\u2514'}</span>}
            <input
              data-mod={mod.lid}
              type="text"
              value={mod.name}
              onChange={(e) => updateModuleName(mod.lid, e.target.value)}
              onKeyDown={(e) => handleModuleKey(e, mod)}
              placeholder={t('modulePlaceholder')}
              className="flex-1 h-8 px-2.5 rounded-md border border-[var(--border)] bg-surface-subtle/50 text-sm font-semibold outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground focus:bg-surface placeholder:text-foreground-lighter placeholder:font-normal"
            />
            <button onClick={() => addModule(mod.lid)} title={t('addSubModule')} className="w-6 h-6 rounded flex items-center justify-center text-foreground-lighter transition-all hover:bg-surface-subtle hover:text-foreground"><Plus size={11} /></button>
            <button onClick={() => removeModule(mod.lid)} className="w-6 h-6 rounded flex items-center justify-center text-foreground-lighter transition-all hover:bg-surface-subtle hover:text-red-500"><X size={12} /></button>
          </div>

          {/* Crafts within this module */}
          {modCrafts.map((craft) => {
            const pColors = [, 'bg-zinc-300', 'bg-blue-400', 'bg-amber-400', 'bg-red-500'];
            const cyclePriority = () => setCrafts((p) => p.map((c) => c.lid === craft.lid ? { ...c, priority: (c.priority % 4) + 1 } : c));
            return (
              <div key={craft.lid} className="flex items-center gap-1" style={{ paddingLeft: pad + 22 }}>
                <button onClick={cyclePriority} title={`P${craft.priority}`} className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-125">
                  <span className={cn('w-2 h-2 rounded-full', pColors[craft.priority])} />
                </button>
                <input
                  data-craft={craft.lid}
                  type="text"
                  value={craft.title}
                  onChange={(e) => updateCraftTitle(craft.lid, e.target.value)}
                  onKeyDown={(e) => handleCraftKey(e, craft)}
                  placeholder={t('craftPlaceholder')}
                  className="flex-1 h-7 px-2 rounded-md border border-transparent bg-transparent text-sm outline-none transition-all focus:border-[var(--border)] focus:bg-surface placeholder:text-foreground-lighter/70"
                />
                <button onClick={() => removeCraft(craft.lid)} className="w-5 h-5 rounded flex items-center justify-center text-foreground-lighter/50 transition-all hover:text-red-500"><X size={11} /></button>
              </div>
            );
          })}

          {/* Add craft button for this module */}
          <button onClick={() => addCraft(mod.lid)} className="flex items-center gap-1 py-1 text-[0.75rem] text-foreground-lighter transition-colors hover:text-foreground-muted" style={{ paddingLeft: pad + 22 }}>
            <Plus size={11} />
            <span>{t('addCraft')}</span>
          </button>

          {/* Recursive sub-modules */}
          {renderTree(mod.lid, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setDpTarget(null); onClose(); }}>
      <div className="absolute inset-0 bg-black/15 backdrop-blur-[2px]" />
      <div onClick={(e) => { e.stopPropagation(); setDpTarget(null); }} className="relative w-[500px] max-w-[calc(100vw-2rem)] max-h-[85vh] bg-surface border border-[var(--border)] rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.2)] flex flex-col cal-popover-enter overflow-hidden">
        {/* Header with tabs */}
        <div className="px-6 pt-5 pb-0 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">{t('addCrafts')}</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="flex gap-6">
            {([
              { key: 'manual' as const, label: t('tabManual'), icon: PenLine },
              { key: 'ai' as const, label: t('tabAi'), icon: Sparkles },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'pb-2.5 text-sm font-medium relative transition-colors flex items-center gap-1.5',
                  activeTab === tab.key ? 'text-foreground' : 'text-foreground-muted hover:text-foreground'
                )}
              >
                <tab.icon size={14} />
                {tab.label}
                {activeTab === tab.key && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-foreground rounded-t" />}
              </button>
            ))}
          </div>
        </div>

        {/* Manual tab body */}
        {activeTab === 'manual' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Schedule */}
              <section className="flex flex-col gap-3">
                <h4 className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('schedule')}</h4>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-foreground-lighter font-medium w-8">{t('startDate')}</span>
                    <button onClick={(e) => { e.stopPropagation(); openDatePicker('start', e.currentTarget); }} className="h-8 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm tabular-nums transition-all hover:border-foreground-lighter min-w-[130px] text-left">
                      {startDate ? dateFmt.format(new Date(startDate + 'T00:00:00')) : '\u2013'}
                    </button>
                    <span className="text-foreground-lighter text-xs">{'\u2192'}</span>
                    <span className="text-xs text-foreground-lighter font-medium w-8">{t('endDate')}</span>
                    <button onClick={(e) => { e.stopPropagation(); openDatePicker('end', e.currentTarget); }} className={cn('h-8 px-3 rounded-lg border text-sm tabular-nums transition-all min-w-[130px] text-left', endDate ? 'border-[var(--border-strong)] bg-surface hover:border-foreground-lighter' : 'border-dashed border-[var(--border)] text-foreground-lighter hover:border-foreground-lighter')}>
                      {endDate ? dateFmt.format(new Date(endDate + 'T00:00:00')) : t('ongoing')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-foreground-lighter font-medium w-8">{t('startTime')}</span>
                    <TimeSelect value={startTime} onChange={(v) => { setStartTime(v); if (v && !endTime) { const i = TIME_SLOTS.indexOf(v); if (i >= 0 && i + 2 < 48) setEndTime(TIME_SLOTS[i + 2]); } }} placeholder={t('allDayLong')} />
                    <span className="text-foreground-lighter text-xs">{'\u2192'}</span>
                    <span className="text-xs text-foreground-lighter font-medium w-8">{t('endTime')}</span>
                    <TimeSelect value={endTime} onChange={setEndTime} min={startTimeSlot >= 0 ? startTimeSlot + 1 : 0} placeholder={t('allDayLong')} />
                    {(startTime || endTime) && <button onClick={() => { setStartTime(''); setEndTime(''); }} className="text-[0.65rem] text-foreground-lighter hover:text-foreground transition-colors">{t('clearTimes')}</button>}
                  </div>
                </div>
              </section>

              {/* Module + Craft tree */}
              <section className="flex flex-col gap-2">
                <h4 className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('modules')} & {t('crafts')}</h4>
                <div className="flex flex-col gap-0.5">
                  {renderTree(null, 0)}
                  <button onClick={() => addModule(null)} className="flex items-center gap-1.5 py-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground">
                    <Plus size={14} />{t('addModule')}
                  </button>
                </div>
              </section>
            </div>

            {/* Manual footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border-strong)] text-sm font-medium transition-all hover:bg-surface-subtle">{t('cancel')}</button>
              <button disabled={!canSubmit} onClick={handleSubmit} className={cn('h-9 px-5 rounded-lg text-sm font-medium transition-all', canSubmit ? 'bg-foreground text-white hover:bg-zinc-700 hover:-translate-y-px' : 'bg-surface-subtle text-foreground-lighter cursor-default')}>
                {t('create')}
              </button>
            </div>
          </>
        )}

        {/* AI tab body */}
        {activeTab === 'ai' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <p className="text-sm text-foreground-muted leading-relaxed">{t('aiHint')}</p>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder={t('aiPlaceholder')}
                className="flex-1 min-h-[240px] w-full px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-surface text-sm leading-relaxed outline-none resize-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground placeholder:text-foreground-lighter/60"
              />
            </div>

            {/* AI footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
              <button
                disabled={!aiText.trim()}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                  aiText.trim()
                    ? 'bg-foreground text-white hover:bg-zinc-700 hover:-translate-y-px'
                    : 'bg-surface-subtle text-foreground-lighter cursor-default'
                )}
              >
                <Sparkles size={14} />
                {t('aiRecognize')}
              </button>
              <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border-strong)] text-sm font-medium transition-all hover:bg-surface-subtle">{t('cancel')}</button>
            </div>
          </>
        )}
      </div>

      {dpTarget && <ModalDatePicker locale={locale} currentValue={dpTarget === 'start' ? startDate : endDate} position={dpPos} onSelect={(d) => { if (dpTarget === 'start') setStartDate(toDateStr(d)); else setEndDate(toDateStr(d)); setDpTarget(null); }} onClose={() => setDpTarget(null)} />}
    </div>
  );
}

/* ═══════════ Modal Inline Date Picker ═══════════ */

function ModalDatePicker({ locale, currentValue, position, onSelect, onClose }: {
  locale: string; currentValue: string; position: { top: number; left: number }; onSelect: (d: Date) => void; onClose: () => void;
}) {
  const initDate = currentValue ? new Date(currentValue + 'T00:00:00') : new Date();
  const [vm, setVm] = useState(new Date(initDate.getFullYear(), initDate.getMonth(), 1));
  const dayNames = useMemo(() => getDayShortNames(locale), [locale]);
  const weeks = useMemo(() => getMonthGrid(vm.getFullYear(), vm.getMonth()), [vm]);
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(vm), [vm, locale]);
  const selDate = currentValue ? new Date(currentValue + 'T00:00:00') : null;

  return (
    <div className="fixed z-[70] w-[280px] bg-surface border border-[var(--border)] rounded-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)] cal-popover-enter" style={{ top: position.top, left: position.left }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button onClick={() => setVm((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button onClick={() => setVm((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 px-2">{dayNames.map((n, i) => (<div key={i} className="text-center py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-foreground-lighter">{n.slice(0, 2)}</div>))}</div>
      <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3 pt-1">
        {weeks.flat().map((day, idx) => {
          const isOther = day.getMonth() !== vm.getMonth();
          const today = isToday(day);
          const sel = selDate ? isSameDay(day, selDate) : false;
          return (<button key={idx} onClick={() => onSelect(day)} className={cn('h-8 rounded-md flex items-center justify-center text-[0.78rem] transition-all duration-150 hover:bg-surface-subtle', today && !sel && 'font-bold text-foreground', sel && 'bg-foreground text-white font-bold hover:bg-zinc-700', !today && !sel && isOther && 'text-foreground-lighter', !today && !sel && !isOther && 'text-foreground')}>{day.getDate()}</button>);
        })}
      </div>
    </div>
  );
}

/* ═══════════ Craft Edit Modal ═══════════ */

const STATUS_OPTIONS = [
  { value: 1, key: 'statusTodo' },
  { value: 2, key: 'statusProgress' },
  { value: 3, key: 'statusDone' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 1, color: '#a1a1aa', label: 'priorityLow' },
  { value: 2, color: '#3b82f6', label: 'priorityMed' },
  { value: 3, color: '#f59e0b', label: 'priorityHigh' },
  { value: 4, color: '#ef4444', label: 'priorityUrgent' },
] as const;

function CraftEditModal({ projectId, craft, locale, onClose }: {
  projectId: string; craft: TodoItemData; locale: string; onClose: () => void;
}) {
  const t = useTranslations('todo');
  const { message, confirm } = useMessage();

  const [title, setTitle] = useState(craft.title);
  const [description, setDescription] = useState(craft.description || '');
  const [status, setStatus] = useState(craft.status);
  const [priority, setPriority] = useState(craft.priority);
  const [startDate, setStartDate] = useState(craft.startDate ? craft.startDate.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(craft.endDate ? craft.endDate.slice(0, 10) : '');
  const [startTime, setStartTime] = useState(craft.startTime || '');
  const [endTime, setEndTime] = useState(craft.endTime || '');
  const [saving, setSaving] = useState(false);
  const [dpTarget, setDpTarget] = useState<'start' | 'end' | null>(null);
  const [dpPos, setDpPos] = useState({ top: 0, left: 0 });

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }), [locale]);
  const startTimeSlot = startTime ? TIME_SLOTS.indexOf(startTime) : -1;

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (dpTarget) setDpTarget(null); else onClose(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, dpTarget]);

  const openDatePicker = (target: 'start' | 'end', el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const pw = 280;
    let left = rect.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    setDpPos({ top: rect.bottom + 6, left });
    setDpTarget(target);
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await http.put(`/todo/${projectId}/${craft.id}`, {
        title: title.trim(),
        description: description || null,
        status,
        priority,
        startDate: startDate || null,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
      });
      message.success(t('save'));
      onClose();
    } catch { /* interceptor */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    const ok = await confirm(t('deleteConfirm'), { cancelable: true });
    if (!ok) return;
    try {
      await http.delete(`/todo/${projectId}/${craft.id}`);
      onClose();
    } catch { /* interceptor */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setDpTarget(null); onClose(); }}>
      <div className="absolute inset-0 bg-black/15 backdrop-blur-[2px]" />
      <div onClick={(e) => { e.stopPropagation(); setDpTarget(null); }} className="relative w-[440px] max-w-[calc(100vw-2rem)] max-h-[85vh] bg-surface border border-[var(--border)] rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.2)] flex flex-col cal-popover-enter overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold">{t('editCraft')}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('craftTitle')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none transition-all focus:border-foreground focus:ring-1 focus:ring-foreground" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} rows={3} className="w-full px-3 py-2 rounded-lg border border-[var(--border-strong)] bg-surface text-sm outline-none resize-y transition-all focus:border-foreground focus:ring-1 focus:ring-foreground placeholder:text-foreground-lighter" />
          </div>

          {/* Status + Priority row */}
          <div className="flex gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('status')}</label>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setStatus(opt.value)} className={cn('h-7 px-2.5 rounded-md text-xs font-medium transition-all border', status === opt.value ? 'bg-foreground text-white border-foreground' : 'border-[var(--border)] text-foreground-muted hover:border-foreground-lighter')}>
                    {t(opt.key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('sortPriority')}</label>
              <div className="flex gap-1.5 items-center">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setPriority(opt.value)} title={t(opt.label)} className={cn('w-7 h-7 rounded-md flex items-center justify-center transition-all border', priority === opt.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105')}>
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color, opacity: priority === opt.value ? 1 : 0.4 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[0.65rem] font-semibold text-foreground-muted uppercase tracking-wider">{t('schedule')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-foreground-lighter font-medium w-8">{t('startDate')}</span>
              <button onClick={(e) => { e.stopPropagation(); openDatePicker('start', e.currentTarget); }} className="h-8 px-3 rounded-lg border border-[var(--border-strong)] bg-surface text-sm tabular-nums transition-all hover:border-foreground-lighter min-w-[120px] text-left">
                {startDate ? dateFmt.format(new Date(startDate + 'T00:00:00')) : '\u2013'}
              </button>
              <span className="text-foreground-lighter text-xs">{'\u2192'}</span>
              <span className="text-xs text-foreground-lighter font-medium w-8">{t('endDate')}</span>
              <button onClick={(e) => { e.stopPropagation(); openDatePicker('end', e.currentTarget); }} className={cn('h-8 px-3 rounded-lg border text-sm tabular-nums transition-all min-w-[120px] text-left', endDate ? 'border-[var(--border-strong)] bg-surface hover:border-foreground-lighter' : 'border-dashed border-[var(--border)] text-foreground-lighter hover:border-foreground-lighter')}>
                {endDate ? dateFmt.format(new Date(endDate + 'T00:00:00')) : t('ongoing')}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-foreground-lighter font-medium w-8">{t('startTime')}</span>
              <TimeSelect value={startTime} onChange={(v) => { setStartTime(v); if (v && !endTime) { const i = TIME_SLOTS.indexOf(v); if (i >= 0 && i + 2 < 48) setEndTime(TIME_SLOTS[i + 2]); } }} placeholder={t('allDayLong')} />
              <span className="text-foreground-lighter text-xs">{'\u2192'}</span>
              <span className="text-xs text-foreground-lighter font-medium w-8">{t('endTime')}</span>
              <TimeSelect value={endTime} onChange={setEndTime} min={startTimeSlot >= 0 ? startTimeSlot + 1 : 0} placeholder={t('allDayLong')} />
              {(startTime || endTime) && <button onClick={() => { setStartTime(''); setEndTime(''); }} className="text-[0.65rem] text-foreground-lighter hover:text-foreground transition-colors">{t('clearTimes')}</button>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          <button onClick={handleDelete} className="h-9 px-4 rounded-lg text-sm font-medium text-red-600 transition-all hover:bg-red-50 flex items-center gap-1.5">
            <Trash2 size={14} />{t('delete')}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border-strong)] text-sm font-medium transition-all hover:bg-surface-subtle">{t('cancel')}</button>
            <button disabled={!title.trim() || saving} onClick={handleSave} className={cn('h-9 px-5 rounded-lg text-sm font-medium transition-all', title.trim() && !saving ? 'bg-foreground text-white hover:bg-zinc-700 hover:-translate-y-px' : 'bg-surface-subtle text-foreground-lighter cursor-default')}>
              {t('save')}
            </button>
          </div>
        </div>
      </div>

      {dpTarget && <ModalDatePicker locale={locale} currentValue={dpTarget === 'start' ? startDate : endDate} position={dpPos} onSelect={(d) => { if (dpTarget === 'start') setStartDate(toDateStr(d)); else setEndDate(toDateStr(d)); setDpTarget(null); }} onClose={() => setDpTarget(null)} />}
    </div>
  );
}

/* ═══════════ Time Select Dropdown ═══════════ */

function TimeSelect({ value, onChange, min = 0, placeholder }: {
  value: string; onChange: (v: string) => void; min?: number; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && listRef.current) { const el = listRef.current.querySelector('[data-selected="true"]'); if (el) el.scrollIntoView({ block: 'center' }); } }, [open]);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);

  const slotIdx = value ? TIME_SLOTS.indexOf(value) : -1;

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen(!open)} className={cn('h-8 px-3 rounded-lg border text-sm tabular-nums transition-all flex items-center gap-1.5 min-w-[90px]', open ? 'border-foreground ring-1 ring-foreground bg-surface' : 'border-[var(--border-strong)] bg-surface hover:border-foreground-lighter', !value && 'text-foreground-lighter')}>
        {value || placeholder || '\u2013'}
        <ChevronDown size={12} className={cn('text-foreground-muted transition-transform duration-200 ml-auto', open && 'rotate-180')} />
      </button>
      {open && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 max-h-[180px] overflow-y-auto bg-surface border border-[var(--border)] rounded-lg shadow-lg z-[60] cal-dropdown-enter py-1">
          {placeholder && (<button onClick={() => { onChange(''); setOpen(false); }} className={cn('w-full px-3 py-1.5 text-sm text-left transition-colors', !value ? 'bg-foreground text-white font-medium' : 'text-foreground-muted hover:bg-surface-subtle')}>{placeholder}</button>)}
          {TIME_SLOTS.map((slot, idx) => {
            if (idx < min) return null;
            const sel = idx === slotIdx;
            return (<button key={idx} data-selected={sel} onClick={() => { onChange(slot); setOpen(false); }} className={cn('w-full px-3 py-1.5 text-sm text-left tabular-nums transition-colors', sel ? 'bg-foreground text-white font-medium' : 'text-foreground hover:bg-surface-subtle')}>{slot}</button>);
          })}
        </div>
      )}
    </div>
  );
}
