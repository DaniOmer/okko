'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Search, Sun, Moon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from '@/components/sidebar';
import { logoutAction } from '@/lib/auth-actions';
import type { SessionUser } from '@/lib/jwt';

export function Header({ session }: { session: SessionUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState('');

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar session={session} />
        </SheetContent>
      </Sheet>

      {session.role === 'superadmin' && (
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(`/crops?q=${encodeURIComponent(q)}`); }}
          className="relative flex-1 max-w-md"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une culture…" className="pl-8" />
        </form>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Basculer le thème">
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{session.email}</span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
