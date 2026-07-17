'use client';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import type { SessionUser } from '@/lib/jwt';

function isBare(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/') || pathname.startsWith('/confirm/') || pathname === '/bientot';
}

export function AppShell({ session, children }: { session: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  if (isBare(pathname) || !session) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-card md:flex md:flex-col">
        <Sidebar session={session} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header session={session} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
