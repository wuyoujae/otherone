import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-y-auto bg-surface rounded-l-2xl mt-2 mr-2 mb-2 shadow-sm border border-[var(--border)]">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
