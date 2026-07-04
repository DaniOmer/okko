# Refonte admin — Plan 1 : Fondation (shadcn + app shell + thème + recherche) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation visuelle de l'admin : shadcn/ui (style new-york, thème vert clair+sombre), un app shell (sidebar + header) responsive, la bascule de thème et la recherche fonctionnelle.

**Architecture:** shadcn installé manuellement (config + composants écrits verbatim, pas de CLI interactif). App shell dans `layout.tsx` : `ThemeProvider` (next-themes) → `AppShell` (sidebar fixe en desktop + header ; sidebar en `Sheet` sur mobile). Recherche = le header navigue vers `/crops?q=`, la page filtre côté serveur.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript strict, TailwindCSS 3, shadcn/ui (new-york), Radix, next-themes.

## Global Constraints

- **TypeScript strict** ; **aucun changement backend**.
- **Vérification = `pnpm --filter @okko/admin build`** (type-check + ESLint incl. `no-unescaped-entities` — échapper les apostrophes en texte JSX via `&apos;`). Pas de tests unitaires (patron admin établi). Vérification fonctionnelle manuelle.
- **Nouvelles dépendances assumées** (implicites au choix de shadcn) : `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `next-themes`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`. `lucide-react` est déjà présent.
- Alias `@/*` → `./src/*` déjà configuré dans `apps/admin/tsconfig.json` (ne pas y toucher).
- Style shadcn : **new-york**, `cssVariables: true`, thème **vert agri**.
- Composants clients : `'use client'` où il y a état/hooks ; la page reste Server Component.
- Working dir : toutes les commandes depuis `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

```
apps/admin/
├── package.json                        # MODIFY: deps
├── components.json                     # NEW
├── tailwind.config.ts                  # MODIFY (replace)
├── src/
│   ├── lib/utils.ts                    # NEW (cn)
│   ├── components/
│   │   ├── ui/button.tsx               # NEW
│   │   ├── ui/input.tsx                # NEW
│   │   ├── ui/sheet.tsx                # NEW
│   │   ├── theme-provider.tsx          # NEW
│   │   ├── sidebar.tsx                 # NEW
│   │   ├── header.tsx                  # NEW (client)
│   │   └── app-shell.tsx               # NEW
│   └── app/
│       ├── globals.css                 # MODIFY (replace: theme tokens)
│       ├── layout.tsx                  # MODIFY (ThemeProvider + AppShell)
│       └── crops/page.tsx              # MODIFY (q filter)
```

---

### Task 1: Fondation shadcn (deps, config, thème, ui/{button,input,sheet})

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/components.json`, `apps/admin/src/lib/utils.ts`, `apps/admin/src/components/ui/button.tsx`, `apps/admin/src/components/ui/input.tsx`, `apps/admin/src/components/ui/sheet.tsx`
- Modify (replace): `apps/admin/tailwind.config.ts`, `apps/admin/src/app/globals.css`

**Interfaces:**
- Produces: `cn` util; `Button` (+ `buttonVariants`), `Input`, `Sheet`/`SheetTrigger`/`SheetContent`/`SheetClose` components; the theme tokens.

- [ ] **Step 1: Add dependencies**

Set `apps/admin/package.json` `dependencies` to include (keep existing next/react/react-dom/lucide-react):
```json
    "next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0", "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0", "clsx": "^2.1.1", "tailwind-merge": "^2.5.0",
    "tailwindcss-animate": "^1.0.7", "next-themes": "^0.3.0",
    "@radix-ui/react-slot": "^1.1.0", "@radix-ui/react-dialog": "^1.1.0"
```
Then run `pnpm install`.

- [ ] **Step 2: `components.json`**

`apps/admin/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3: `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Replace `tailwind.config.ts`**

`apps/admin/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

- [ ] **Step 5: Replace `src/app/globals.css`** (thème vert new-york, clair + sombre)

`apps/admin/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 142.1 76.2% 36.3%;
    --primary-foreground: 355.7 100% 97.3%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 142.1 76.2% 36.3%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 20 14.3% 4.1%;
    --foreground: 0 0% 95%;
    --card: 24 9.8% 10%;
    --card-foreground: 0 0% 95%;
    --popover: 0 0% 9%;
    --popover-foreground: 0 0% 95%;
    --primary: 142.1 70.6% 45.3%;
    --primary-foreground: 144.9 80.4% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 15%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 142.4 71.8% 29.2%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 6: `ui/button.tsx`**

`apps/admin/src/components/ui/button.tsx`:
```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 7: `ui/input.tsx`**

`apps/admin/src/components/ui/input.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 8: `ui/sheet.tsx`**

`apps/admin/src/components/ui/sheet.tsx`:
```tsx
"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  }
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent };
```

- [ ] **Step 9: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds (components are unused so far but must type-check; the theme tokens apply to `body`).

- [ ] **Step 10: Commit**

```bash
git add apps/admin/package.json apps/admin/pnpm-lock.yaml apps/admin/components.json apps/admin/tailwind.config.ts apps/admin/src/lib/utils.ts apps/admin/src/components/ui apps/admin/src/app/globals.css
git commit -m "feat(admin): set up shadcn/ui foundation (new-york, green theme)"
```
(If the lockfile lives at the repo root, `git add pnpm-lock.yaml` there instead.)

---

### Task 2: Thème (ThemeProvider + wrapping layout)

**Files:**
- Create: `apps/admin/src/components/theme-provider.tsx`
- Modify: `apps/admin/src/app/layout.tsx`

**Interfaces:**
- Consumes: `next-themes`.
- Produces: `ThemeProvider` wrapping the app; `<html>` gets `suppressHydrationWarning`.

- [ ] **Step 1: `theme-provider.tsx`**

`apps/admin/src/components/theme-provider.tsx`:
```tsx
"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 2: Wrap `layout.tsx`**

`apps/admin/src/app/layout.tsx`:
```tsx
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; the app still renders children (shell comes in Task 5).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/theme-provider.tsx apps/admin/src/app/layout.tsx
git commit -m "feat(admin): add next-themes ThemeProvider"
```

---

### Task 3: `Sidebar` (navigation)

**Files:**
- Create: `apps/admin/src/components/sidebar.tsx`

**Interfaces:**
- Consumes: `next/link`, `next/navigation` `usePathname`, `cn`, `lucide-react` icons.
- Produces: `Sidebar` — the nav list, reused in the desktop rail AND inside the mobile Sheet. Active link highlighted via `usePathname`.

- [ ] **Step 1: `sidebar.tsx`**

`apps/admin/src/components/sidebar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout, Map, Bug, History } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { title: "Base de connaissances", items: [
    { href: "/crops", label: "Cultures", icon: Sprout },
    { href: "/zones", label: "Zones", icon: Map },
    { href: "/pests", label: "Ravageurs", icon: Bug },
  ] },
  { title: "Suivi", items: [
    { href: "/history", label: "Historique", icon: History },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 text-lg font-extrabold text-primary">🌱 Okko</div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          {g.items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

> Note: `/history` is a placeholder route (no page yet). The link renders; a 404 on click is acceptable for this lot (a history page is out of scope). Keep it — it demonstrates the "Suivi" group.

- [ ] **Step 2: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds (Sidebar unused so far).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/sidebar.tsx
git commit -m "feat(admin): add Sidebar navigation component"
```

---

### Task 4: `Header` (recherche, thème, cloche, avatar, ☰ mobile)

**Files:**
- Create: `apps/admin/src/components/header.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Sheet`/`SheetContent`/`SheetTrigger`, `Sidebar`, `next-themes` `useTheme`, `next/navigation` `useRouter`, `lucide-react` icons.
- Produces: `Header` — client component: mobile ☰ (opens a left `Sheet` containing `<Sidebar/>`), search input (Enter → `router.push('/crops?q=' + term)`), theme toggle (sun/moon), decorative bell with red dot, avatar.

- [ ] **Step 1: `header.tsx`**

`apps/admin/src/components/header.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Search, Bell, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";

export function Header() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [q, setQ] = useState("");

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <form
        onSubmit={(e) => { e.preventDefault(); router.push(`/crops?q=${encodeURIComponent(q)}`); }}
        className="relative flex-1 max-w-md"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une culture…"
          className="pl-8"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Basculer le thème"
        >
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </Button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds (Header unused so far).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/header.tsx
git commit -m "feat(admin): add Header (search, theme toggle, bell, mobile drawer)"
```

---

### Task 5: `AppShell` + câblage dans `layout.tsx` (responsive)

**Files:**
- Create: `apps/admin/src/components/app-shell.tsx`
- Modify: `apps/admin/src/app/layout.tsx`

**Interfaces:**
- Consumes: `Sidebar`, `Header`.
- Produces: `AppShell({ children })` — desktop : sidebar fixe (`hidden md:flex`) + colonne (Header + main). Mobile : pas de sidebar fixe (elle est dans le Sheet du Header).

- [ ] **Step 1: `app-shell.tsx`**

`apps/admin/src/components/app-shell.tsx`:
```tsx
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `layout.tsx`**

Update `apps/admin/src/app/layout.tsx` to render `AppShell` inside `ThemeProvider`:
```tsx
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; every page now renders inside the shell (sidebar + header).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/app-shell.tsx apps/admin/src/app/layout.tsx
git commit -m "feat(admin): compose AppShell (responsive sidebar + header) in layout"
```

---

### Task 6: Recherche fonctionnelle — filtre de la liste des cultures

**Files:**
- Modify: `apps/admin/src/app/crops/page.tsx`

**Interfaces:**
- Consumes: `listCrops()` (existing), `searchParams`.
- Produces: `/crops?q=<term>` filters the list on `name` + `scientificName` (case-insensitive); empty `q` → full list.

- [ ] **Step 1: Read the current page**

READ `apps/admin/src/app/crops/page.tsx` to see its current shape (it maps `listCrops()` results). It is an `async` Server Component.

- [ ] **Step 2: Add the `q` filter**

Change the page signature to accept `searchParams` and filter:
```tsx
export default async function CropsPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const all = await listCrops();
  const crops = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q))
    : all;
  // ... render `crops` exactly as before (keep the existing JSX, just use `crops` instead of the inline await)
}
```
Keep the rest of the JSX identical — only source the list from the filtered `crops`. If there is a header/title, optionally show the active query (e.g. `{q && <p className="text-sm text-muted-foreground">Résultats pour « {q} »</p>}`), escaping apostrophes if any.

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/crops/page.tsx
git commit -m "feat(admin): server-side crop search via ?q= filter"
```

---

## Self-Review

**1. Spec coverage (Plan 1 = Fondation):**
- shadcn setup (new-york, green tokens light+dark, cn, ui components) → Task 1. ✅
- Thème via next-themes → Task 2 (provider) + Task 4 (toggle). ✅
- Sidebar → Task 3. ✅
- Header (recherche, cloche décorative, toggle, avatar, ☰ mobile) → Task 4. ✅
- App shell responsive (sidebar fixe desktop, Sheet mobile) → Task 5. ✅
- Recherche fonctionnelle (`/crops?q=`) → Task 4 (émission) + Task 6 (filtre). ✅
- Restyle des pages + modales → **Plan 2** (hors de ce plan). ✅ (périmètre)

**2. Placeholder scan:** aucun TBD/TODO ; code complet à chaque étape ; commandes fournies. Le `/history` est un lien vers une route inexistante, documenté comme intentionnel (hors périmètre). ✅

**3. Type consistency:** `cn` (Task 1) utilisé par `Button`/`Input`/`Sheet`/`Sidebar`/etc. `Button`/`Input`/`Sheet*` (Task 1) importés par `Header` (Task 4). `Sidebar` (Task 3) importé par `Header` (Task 4) et `AppShell` (Task 5). `ThemeProvider` (Task 2) + `AppShell` (Task 5) câblés dans `layout.tsx`. La recherche émise par `Header` (`/crops?q=`) est consommée par `CropsPage` (Task 6). `CropDocument` a `name`+`scientificName` (utilisés par le filtre). ✅

---

## Vérification manuelle (post-implémentation)
Admin sur `:3000` : la sidebar + le header apparaissent sur toutes les pages ; le toggle ◐ bascule clair/sombre (persistant) ; taper dans la recherche + Entrée navigue vers `/crops?q=…` et filtre la liste ; sous ~768px la sidebar disparaît et le ☰ ouvre le tiroir. (Le restyle fin des pages arrive au Plan 2.)
