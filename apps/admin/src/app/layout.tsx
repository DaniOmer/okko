import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { getSession } from '@/lib/session';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AppShell session={session}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
