'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  ListTodo,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'taskDesign', href: '/task-design', icon: ListTodo },
  { key: 'projects', href: '/projects', icon: FolderOpen },
  { key: 'settings', href: '/settings', icon: Settings },
] as const;

interface UserInfo {
  displayName: string;
  email: string;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();
  const t = useTranslations('sidebar');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);

  const avatarLetter = user?.displayName?.charAt(0)?.toUpperCase() || '?';

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed top-5 left-4 z-[60] md:hidden p-2 rounded-lg bg-surface border border-[var(--border)] shadow-sm hover:bg-surface-hover transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-surface border-r border-[var(--border)] flex flex-col',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'fixed inset-y-0 left-0 z-50 w-[260px]',
          'md:relative md:z-10',
          collapsed ? 'md:w-[80px]' : 'md:w-[260px]',
          mobileOpen
            ? 'translate-x-0 shadow-xl'
            : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Toggle button (desktop) */}
        <button
          className={cn(
            'absolute -right-3.5 top-[21px] z-20',
            'w-7 h-7 items-center justify-center',
            'bg-surface border border-[var(--border)] rounded-md',
            'text-foreground-muted hover:text-foreground hover:border-[var(--border-strong)]',
            'transition-all duration-200',
            'hidden md:flex'
          )}
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>

        {/* Mobile close button */}
        <button
          className="absolute top-5 right-4 z-20 md:hidden text-foreground-muted hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

        {/* Header spacer */}
        <div className="h-[20px]" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 flex flex-col gap-2">
          {navItems.map((item) => {
            const isPill = item.key === 'dashboard';
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center px-3 py-2.5',
                  'text-[0.95rem] font-medium',
                  'transition-all duration-200 whitespace-nowrap overflow-hidden',
                  isPill && 'rounded-full border border-[var(--border)]',
                  isPill && 'hover:bg-foreground hover:text-white hover:border-foreground',
                  isPill && isActive(item.href) && 'bg-foreground text-white border-foreground',
                  !isPill && 'rounded-lg',
                  !isPill && 'hover:bg-surface-hover hover:text-foreground',
                  !isPill && isActive(item.href) && 'bg-surface-hover text-foreground',
                  'text-foreground-muted'
                )}
              >
                <item.icon
                  size={20}
                  className={cn(
                    'min-w-[20px] flex-shrink-0',
                    collapsed ? 'md:mr-0' : 'mr-3'
                  )}
                />
                <span
                  className={cn(
                    'transition-all duration-300',
                    collapsed && 'md:opacity-0 md:w-0 md:hidden'
                  )}
                >
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div
          className={cn(
            'border-t border-[var(--border)] mx-3 mb-3 rounded-b-lg',
            'flex items-center gap-3 cursor-pointer',
            'transition-all duration-200 hover:bg-surface-hover',
            collapsed ? 'md:p-3 md:justify-center p-4' : 'p-4'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-foreground text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {avatarLetter}
          </div>
          <div
            className={cn(
              'flex flex-col whitespace-nowrap overflow-hidden',
              'transition-all duration-300',
              collapsed && 'md:opacity-0 md:w-0 md:hidden'
            )}
          >
            <span className="text-sm font-semibold truncate">{user?.displayName || '...'}</span>
            <span className="text-xs text-foreground-muted truncate">{user?.email || ''}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
