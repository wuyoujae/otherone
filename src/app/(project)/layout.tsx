import { AuthGuard } from '@/components/auth/auth-guard';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
