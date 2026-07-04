# Refonte admin — Lot 2 : Restyle & modales (shadcn) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habiller tout le back-office admin avec shadcn/ui — édition en **modales** (Dialog), listes en **Table**, fiche en **Cards** + anneau de complétude, formulaires en **Card** — en clair + sombre, sans aucun changement backend.

**Architecture :** Le lot 1 (Fondation) a déjà posé le thème (variables CSS), l'app shell (sidebar + header), `cn`, et les primitives `button`/`input`/`sheet`. Ce lot ajoute les primitives manquantes (`dialog`, `select`, `card`, `table`, `badge`, `label`), refond `EditorShell` en `Dialog` **en conservant son contrat render-prop `{ submit, close, busy }`** (les 11 éditeurs continuent donc de fonctionner, seul leur habillage change), puis restyle les pages. Le build (type-check + ESLint) est la seule porte de validation — l'admin n'a pas de tests unitaires.

**Tech Stack :** Next.js 14 (App Router), TypeScript strict, TailwindCSS 3, shadcn/ui « new-york », Radix UI, next-themes.

## Global Constraints

- **Aucun changement backend.** Aucun nouvel endpoint. La cloche de notifications reste **décorative**. Le `/history` global n'existe pas côté API (seul `GET /crops/:id/history` existe) → la page `/history` est une page **informative** sans appel réseau.
- **Style shadcn « new-york »**, composants placés **verbatim** depuis la source shadcn/ui (comme `button`/`input`/`sheet` du lot 1). Chemin des primitives : `apps/admin/src/components/ui/`.
- **Import alias** : `@/` → `apps/admin/src/` (déjà configuré). `cn` vit dans `@/lib/utils`.
- **Palette** : `--primary` est le vert agri (déjà en place). Utiliser **exclusivement les tokens de thème** (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, etc.) — **jamais** de couleur en dur type `bg-green-700`, `text-red-600`, `bg-gray-50` (elles cassent le mode sombre). C'est la règle de restyle nº 1.
- **Résilience déjà acquise à préserver** : `apps/admin/src/app/crops/[id]/page.tsx` fait `getCrop(...).catch(() => null)` puis `notFound()`, et enveloppe les fetchs annexes de `.catch(() => [])`. La page `/` (dashboard) fait de même. **Ne pas retirer ces garde-fous** en restylant.
- **Contrat `EditorShell` inchangé** : `{ submit, close, busy }` — `submit(fn)` exécute `fn`, ferme la modale et fait `router.refresh()` en cas de succès, affiche l'erreur sinon ; `close()` ferme ; `busy` = en cours.
- **Porte de validation par tâche** : `pnpm --filter @okko/admin build` réussit (compilation + ESLint `no-unescaped-entities` : échapper `'` en `&apos;`, `«»` avec `&laquo;`/`&raquo;`). Vérif manuelle indiquée quand pertinent.
- **Commits fréquents**, un par tâche minimum, préfixe `feat(admin):` ou `refactor(admin):`. Terminer chaque message par la ligne `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

Créés :
- `apps/admin/src/components/ui/dialog.tsx` — Radix Dialog (modale)
- `apps/admin/src/components/ui/select.tsx` — Radix Select
- `apps/admin/src/components/ui/card.tsx` — Card + sous-composants
- `apps/admin/src/components/ui/table.tsx` — Table + sous-composants
- `apps/admin/src/components/ui/badge.tsx` — Badge (statut)
- `apps/admin/src/components/ui/label.tsx` — Label
- `apps/admin/src/components/completeness-ring.tsx` — anneau de complétude réutilisable
- `apps/admin/src/app/history/page.tsx` — page informative Historique

Modifiés :
- `apps/admin/package.json` — ajout `@radix-ui/react-select`, `@radix-ui/react-label`
- `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx` — inline → Dialog
- Les 11 éditeurs `apps/admin/src/app/crops/[id]/editors/*.tsx` — habillage shadcn
- `apps/admin/src/app/crops/page.tsx` — Table + Badge + complétude
- `apps/admin/src/app/crops/[id]/page.tsx` — Cards + anneau (préserver résilience)
- `apps/admin/src/app/page.tsx` — dashboard en Card
- `apps/admin/src/app/crops/new/page.tsx`, `zones/page.tsx`, `zones/new/page.tsx`, `pests/page.tsx`, `pests/new/page.tsx` — Card + Select + Table
- `apps/admin/src/components/header.tsx` — toggle thème via `resolvedTheme`

---

## Task 1 : Primitives shadcn manquantes

**Files:**
- Modify: `apps/admin/package.json` (dependencies)
- Create: `apps/admin/src/components/ui/dialog.tsx`
- Create: `apps/admin/src/components/ui/select.tsx`
- Create: `apps/admin/src/components/ui/card.tsx`
- Create: `apps/admin/src/components/ui/table.tsx`
- Create: `apps/admin/src/components/ui/badge.tsx`
- Create: `apps/admin/src/components/ui/label.tsx`

**Interfaces:**
- Produces (exports consommés par les tâches suivantes) :
  - `dialog` : `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose`
  - `select` : `Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel`
  - `card` : `Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent`
  - `table` : `Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption`
  - `badge` : `Badge` (variant `default | secondary | destructive | outline`)
  - `label` : `Label`

- [ ] **Step 1 : Installer les dépendances Radix manquantes**

`@radix-ui/react-dialog` est déjà installé (utilisé par `sheet`). Ajouter les deux manquants :

```bash
cd apps/admin && pnpm add @radix-ui/react-select@^2.1.0 @radix-ui/react-label@^2.1.0
```

- [ ] **Step 2 : Créer `dialog.tsx`** (verbatim shadcn new-york)

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 3 : Créer `select.tsx`** (verbatim shadcn new-york)

```tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
```

- [ ] **Step 4 : Créer `card.tsx`** (verbatim shadcn new-york)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 5 : Créer `table.tsx`** (verbatim shadcn new-york)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
))
TableCaption.displayName = "TableCaption"

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
```

- [ ] **Step 6 : Créer `badge.tsx`** (verbatim shadcn new-york)

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 7 : Créer `label.tsx`** (verbatim shadcn new-york)

```tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

- [ ] **Step 8 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`, aucune erreur de type/lint. (Les composants ne sont pas encore importés ; on valide juste qu'ils compilent.)

- [ ] **Step 9 : Commit**

```bash
git add apps/admin/package.json apps/admin/src/components/ui/ pnpm-lock.yaml
git commit -m "feat(admin): primitives shadcn (dialog, select, card, table, badge, label)"
```

---

## Task 2 : EditorShell → Dialog (contrat inchangé)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx`

**Interfaces:**
- Consumes : `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle` (Task 1), `Button` (`@/components/ui/button`).
- Produces : `EditorShell` — même signature `{ label: string; children: (h: { submit; close; busy }) => ReactNode }` qu'aujourd'hui. **Le contrat render-prop ne change pas** : les 11 éditeurs restent compatibles sans modification fonctionnelle.

**Contexte :** Aujourd'hui `EditorShell` affiche un `<button>` qui, au clic, remplace le bouton par un panneau inline. On le remplace par une `Dialog` shadcn contrôlée : le déclencheur est un `Button` portant `label`, le contenu (titre = `label`, zone d'erreur, puis `children(...)`) s'affiche dans une modale centrée. `submit` ferme la modale et rafraîchit ; `close` ferme.

- [ ] **Step 1 : Réécrire `EditorShell.tsx`**

```tsx
'use client';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Helpers {
  submit: (fn: () => Promise<unknown>) => Promise<void>;
  close: () => void;
  busy: boolean;
}

export function EditorShell({ label, children }: { label: string; children: (h: Helpers) => ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(fn: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {children({ submit, close: () => setOpen(false), busy })}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. Les éditeurs, inchangés, compilent toujours (leur JSX interne est valide dans une modale).

- [ ] **Step 3 : Vérification manuelle (si l'API + l'admin tournent)**

Ouvrir une fiche culture, cliquer un déclencheur d'édition (ex. « Publier ») : une **modale** s'ouvre, centrée, avec titre + croix de fermeture. Enregistrer ferme la modale et rafraîchit. (Les champs sont encore au style brut — c'est l'objet des tâches 3-4.)

- [ ] **Step 4 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/editors/EditorShell.tsx
git commit -m "refactor(admin): EditorShell rendu en Dialog shadcn (contrat inchangé)"
```

---

## Task 3 : Habillage des éditeurs à champs simples (sans `<select>`)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`

**Interfaces:**
- Consumes : `Input` (`@/components/ui/input`), `Button` (`@/components/ui/button`). Le contrat `{ submit, close, busy }` d'`EditorShell` (Task 2) est inchangé.
- Produces : rien de nouveau (mêmes exports de composants, mêmes props).

**Recette de restyle (à appliquer à chaque fichier, à l'identique) :**
1. Ajouter les imports : `import { Input } from '@/components/ui/input';` et `import { Button } from '@/components/ui/button';`.
2. Remplacer chaque `<input className="... border ...">` par `<Input ...>` en **supprimant** les classes de bordure/padding brutes (`border`, `p-1`, `p-2`) ; **conserver** les classes de largeur utiles (`w-16`, `w-full`, `flex-1`) et toutes les props (`value`, `onChange`, `placeholder`, `required`).
3. Remplacer le bouton de soumission `<button type="submit" ... className="rounded bg-green-700 ...">Enregistrer</button>` par `<Button type="submit" size="sm" disabled={busy}>Enregistrer</Button>`.
4. Remplacer le bouton d'annulation `<button type="button" onClick={close}>Annuler</button>` par `<Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>`.
5. Remplacer tout libellé/texte en couleur brute (`text-gray-500`, `text-red-600`) par le token équivalent (`text-muted-foreground`, `text-destructive`).
6. Aucune couleur en dur ne doit subsister (règle Global Constraints nº palette).

- [ ] **Step 1 : Restyler `RequirementsEditor.tsx`** selon la recette. Résultat attendu du `<form>` (les `fieldset`/labels de plage restent identiques, seuls les `<input>`/boutons changent) :

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setRequirements } from '../../../../lib/api';

const n = (v: string): number => Number(v);

export function RequirementsEditor({ cropId }: { cropId: string }) {
  const [tMin, setTMin] = useState(''); const [tOpt, setTOpt] = useState(''); const [tMax, setTMax] = useState('');
  const [rMin, setRMin] = useState(''); const [rOpt, setROpt] = useState(''); const [rMax, setRMax] = useState('');
  const [phMin, setPhMin] = useState(''); const [phOpt, setPhOpt] = useState(''); const [phMax, setPhMax] = useState('');
  const [texture, setTexture] = useState('');

  return (
    <EditorShell label="Éditer les exigences climat/sol">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body: Parameters<typeof setRequirements>[1] = {};
            if (tMin && tOpt && tMax) body.climatic = { ...(body.climatic ?? {}), temperature: { min: n(tMin), optimal: n(tOpt), max: n(tMax), unit: '°C' } };
            if (rMin && rOpt && rMax) body.climatic = { ...(body.climatic ?? {}), rainfall: { min: n(rMin), optimal: n(rOpt), max: n(rMax), unit: 'mm' } };
            if (phMin && phOpt && phMax) body.edaphic = { ...(body.edaphic ?? {}), ph: { min: n(phMin), optimal: n(phOpt), max: n(phMax), unit: 'pH' } };
            if (texture) body.edaphic = { ...(body.edaphic ?? {}), texture };
            submit(() => setRequirements(cropId, body));
          }}
          className="space-y-2 text-sm"
        >
          <fieldset className="flex gap-1 items-center"><span className="w-24">Température</span>
            <Input className="w-16" placeholder="min" value={tMin} onChange={(e)=>setTMin(e.target.value)} />
            <Input className="w-16" placeholder="opt" value={tOpt} onChange={(e)=>setTOpt(e.target.value)} />
            <Input className="w-16" placeholder="max" value={tMax} onChange={(e)=>setTMax(e.target.value)} /><span>°C</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Pluviométrie</span>
            <Input className="w-16" placeholder="min" value={rMin} onChange={(e)=>setRMin(e.target.value)} />
            <Input className="w-16" placeholder="opt" value={rOpt} onChange={(e)=>setROpt(e.target.value)} />
            <Input className="w-16" placeholder="max" value={rMax} onChange={(e)=>setRMax(e.target.value)} /><span>mm</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">pH du sol</span>
            <Input className="w-16" placeholder="min" value={phMin} onChange={(e)=>setPhMin(e.target.value)} />
            <Input className="w-16" placeholder="opt" value={phOpt} onChange={(e)=>setPhOpt(e.target.value)} />
            <Input className="w-16" placeholder="max" value={phMax} onChange={(e)=>setPhMax(e.target.value)} />
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Texture</span>
            <Input className="flex-1" placeholder="ex. limono-sableux" value={texture} onChange={(e)=>setTexture(e.target.value)} />
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Enregistrer</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2 : Restyler `VarietyEditor.tsx`** selon la recette (3 `<input>` → `Input className="w-full"`, boutons Ajouter/Annuler → `Button`). Le bouton de soumission garde son libellé « Ajouter ».

- [ ] **Step 3 : Restyler `PhenologyEditor.tsx`** selon la recette. Lire le fichier, appliquer les points 1-6. (Pas de `<select>` ; que des `<input>` et boutons.)

- [ ] **Step 4 : Restyler `PriceEditor.tsx`** selon la recette. Lire le fichier, appliquer les points 1-6.

- [ ] **Step 5 : Restyler `PublishButton.tsx`** : remplacer les deux `<button>` par `Button` (« Confirmer » = `Button size="sm" disabled={busy}`, « Annuler » = `Button variant="ghost" size="sm"`), et `text-gray-500` → `text-muted-foreground`. Structure inchangée.

- [ ] **Step 6 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`, aucune couleur brute résiduelle dans ces 5 fichiers.

- [ ] **Step 7 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx apps/admin/src/app/crops/[id]/editors/PublishButton.tsx
git commit -m "feat(admin): habillage shadcn des éditeurs à champs simples"
```

---

## Task 4 : Habillage des éditeurs à `<select>` (Radix Select)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`

**Interfaces:**
- Consumes : `Input`, `Button`, et `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` (Task 1). Contrat `EditorShell` inchangé.
- Produces : rien de nouveau.

**Différence clé vs Task 3 — conversion `<select>` → Radix `Select` :** Radix Select est **contrôlé par valeur**, pas par événement DOM. Le HTML natif :

```tsx
<select className="w-full border p-1" value={rating} onChange={(e)=>setRating(e.target.value)}>
  {RATINGS.map((r)=><option key={r} value={r}>{r}</option>)}
</select>
```

devient :

```tsx
<Select value={rating} onValueChange={setRating}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
  </SelectContent>
</Select>
```

Règles de conversion :
- `onChange={(e)=>setX(e.target.value)}` → `onValueChange={setX}` (Radix passe la valeur, pas l'événement).
- Un `<option value="">— placeholder —</option>` (valeur vide) n'est **pas** autorisé comme `SelectItem` (Radix interdit la valeur vide). Le remplacer par un placeholder : `<SelectValue placeholder="— Zone —" />` et **retirer** l'option vide de la liste. La validation `required` du `<select>` natif disparaît → si le champ est obligatoire, garder l'état initial vide (`useState('')`) et bloquer la soumission si vide (voir ZoneSuitabilityEditor ci-dessous).
- Appliquer aussi la recette Task 3 pour les `<input>`/boutons du même fichier.

- [ ] **Step 1 : Restyler `ZoneSuitabilityEditor.tsx`.** Résultat attendu :

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setZoneSuitability } from '../../../../lib/api';

const RATINGS = ['SUITABLE', 'MARGINAL', 'UNSUITABLE'];

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState(RATINGS[0]); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!zoneId) return; submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-2 text-sm"
        >
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="— Zone —" /></SelectTrigger>
            <SelectContent>
              {zones.map((z)=><SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RATINGS.map((r)=><SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="justification (optionnel)" value={justification} onChange={(e)=>setJustification(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Rattacher</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2 : Restyler `YieldsEditor.tsx`** : lire le fichier, convertir le(s) `<select>` (ex. niveau d'intrant `LOW/MEDIUM/HIGH`) en `Select`, `<input>` → `Input`, boutons → `Button`. Un `<select>` sur enum non-vide n'a pas d'option vide → conversion directe sans placeholder.

- [ ] **Step 3 : Restyler `NutritionEditor.tsx`** : idem, convertir le(s) `<select>` en `Select`, inputs/boutons selon la recette.

- [ ] **Step 4 : Restyler `WindowEditor.tsx`** : idem (le `<select>` de saison → `Select` ; c'est le plus long fichier, 66 lignes — convertir chaque `<input>`/`<select>`/`<button>` sans toucher à la logique de construction du body).

- [ ] **Step 5 : Restyler `PestControlEditor.tsx`** : idem (selects type/catégorie/susceptibilité → `Select`). Conserver la branche « aucun ravageur au catalogue » si présente, en passant ses couleurs brutes aux tokens.

- [ ] **Step 6 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. Vérifier qu'aucun `<select>`/`<option>` ni couleur brute ne subsiste dans ces 5 fichiers (`grep -n "<select\|<option\|bg-green\|text-gray\|text-red" <fichiers>` → vide).

- [ ] **Step 7 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx
git commit -m "feat(admin): habillage shadcn des éditeurs à sélecteurs (Radix Select)"
```

---

## Task 5 : Liste des cultures en Table

**Files:**
- Modify: `apps/admin/src/app/crops/page.tsx`

**Interfaces:**
- Consumes : `Table, TableHeader, TableBody, TableHead, TableRow, TableCell` (Task 1), `Badge` (Task 1), `Button` (lot 1), `listCrops()` → `CropDocument[]` (`{ id, name, scientificName, cycleType, status, version, completeness }`).
- Produces : rien.

**Contexte :** Page serveur. Aujourd'hui une `<ul>` filtrée par `searchParams.q`. On passe à une `Table`. **Corriger l'affichage de la requête** : afficher la saisie brute, pas la version minusculée (aujourd'hui `{q}` affiche la version lowercasée). Filtrer reste insensible à la casse.

- [ ] **Step 1 : Réécrire `crops/page.tsx`**

```tsx
import Link from 'next/link';
import { listCrops } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

export default async function CropsPage({ searchParams }: { searchParams: { q?: string } }) {
  const raw = (searchParams.q ?? '').trim();
  const q = raw.toLowerCase();
  const all = await listCrops().catch(() => []);
  const crops = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q))
    : all;
  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <Button asChild><Link href="/crops/new">Nouvelle culture</Link></Button>
      </div>
      {raw && <p className="text-sm text-muted-foreground">Résultats pour &laquo;&nbsp;{raw}&nbsp;&raquo; ({crops.length})</p>}
      {crops.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune culture.</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Nom scientifique</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Complétude</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/crops/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell className="italic text-muted-foreground">{c.scientificName}</TableCell>
                  <TableCell>{c.cycleType}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.completeness?.percent ?? '—'}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3 : Commit**

```bash
git add apps/admin/src/app/crops/page.tsx
git commit -m "feat(admin): liste des cultures en Table + Badge de statut"
```

---

## Task 6 : Fiche culture en Cards + anneau de complétude

**Files:**
- Create: `apps/admin/src/components/completeness-ring.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes : `Card, CardHeader, CardTitle, CardContent` (Task 1), `Badge` (Task 1), les 11 éditeurs (inchangés), `getCrop/getCropHistory/listZones/listPests` (lot 1).
- Produces : `CompletenessRing` — `function CompletenessRing({ percent }: { percent: number }): JSX.Element`, un anneau conique (vert `--primary` rempli à `percent`, reste en `--muted`) avec `percent%` au centre.

**Contexte critique — préserver la résilience :** le haut du fichier fait déjà `getCrop(...).catch(() => null)` + `notFound()` puis `Promise.all` avec `.catch(() => [])` sur les fetchs annexes. **Garder ce bloc tel quel.** On ne restyle que le JSX de rendu : chaque `<section>` devient une `Card` (`CardHeader > CardTitle` = titre + le déclencheur d'éditeur ; `CardContent` = la liste). L'anneau va dans l'en-tête à côté du titre + `Badge` de statut.

- [ ] **Step 1 : Créer `completeness-ring.tsx`**

```tsx
export function CompletenessRing({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(hsl(var(--primary)) ${p}%, hsl(var(--muted)) ${p}%)` }}
      aria-label={`Complétude ${p}%`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
        {p}%
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Restyler `crops/[id]/page.tsx`.** Conserver **à l'identique** l'en-tête de la fonction (imports + le bloc de fetch résilient `getCrop(...).catch(() => null)` / `if (!crop) notFound();` / `Promise.all([... .catch(() => [])])`). Ajouter les imports Card/Badge/CompletenessRing. Remplacer l'en-tête de page et chaque `<section>` par des `Card`. Modèle de l'en-tête + d'une section (appliquer le même patron à toutes les sections existantes, sans changer les props passées aux éditeurs ni les champs affichés) :

```tsx
import { notFound } from 'next/navigation';
import { getCrop, getCropHistory, listZones, listPests } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompletenessRing } from '@/components/completeness-ring';
import { PublishButton } from './editors/PublishButton';
// ... (mêmes imports des 10 autres éditeurs qu'aujourd'hui)

export default async function CropDetailPage({ params }: { params: { id: string } }) {
  const crop = await getCrop(params.id).catch(() => null);
  if (!crop) notFound();
  const [history, zones, pests] = await Promise.all([
    getCropHistory(params.id).catch(() => []),
    listZones().catch(() => []),
    listPests().catch(() => []),
  ]);

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            {crop.name} <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em>
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{crop.cycleType}</span>
            <Badge variant={crop.status === 'PUBLISHED' ? 'default' : 'secondary'}>{crop.status}</Badge>
            <span>v{crop.version}</span>
          </div>
          <PublishButton cropId={params.id} status={crop.status} />
        </div>
        {crop.completeness && <CompletenessRing percent={crop.completeness.percent} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Exigences climatiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {crop.climatic?.temperature
              ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
              : <p className="text-muted-foreground">Non renseignées</p>}
          </CardContent>
        </Card>
        {/* … même patron Card pour : Exigences édaphiques (+ RequirementsEditor), Variétés (+ VarietyEditor),
            Zones (+ ZoneSuitabilityEditor zones={zones}), Phénologie (+ PhenologyEditor current={crop.phenology}),
            Fenêtres (+ WindowEditor zones={zones}), Ravageurs (+ PestControlEditor pests={pests}),
            Nutrition (+ NutritionEditor current={crop.nutrition}), Rendement (+ YieldsEditor current={crop.yields}),
            Prix (+ PriceEditor), Historique (liste history, sans éditeur). Placer chaque déclencheur d'éditeur
            dans le CardHeader (à droite du titre) ou en bas du CardContent. */}
      </div>
    </main>
  );
}
```

Reprendre **le contenu exact de chaque section actuelle** (mêmes accès `crop.varieties.map`, `crop.zones.map`, etc., mêmes props aux éditeurs) — seul l'emballage `<section><h2>` → `<Card><CardHeader><CardTitle>` change. Remplacer les `text-gray-400`/`text-gray-500` par `text-muted-foreground`.

- [ ] **Step 3 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. Vérifier `grep -n "notFound()\|catch(() =>" apps/admin/src/app/crops/[id]/page.tsx` → le bloc résilient est toujours là.

- [ ] **Step 4 : Commit**

```bash
git add apps/admin/src/components/completeness-ring.tsx apps/admin/src/app/crops/[id]/page.tsx
git commit -m "feat(admin): fiche culture en Cards + anneau de complétude"
```

---

## Task 7 : Formulaires & listes secondaires (Card + Select + Table)

**Files:**
- Modify: `apps/admin/src/app/crops/new/page.tsx`
- Modify: `apps/admin/src/app/zones/page.tsx`
- Modify: `apps/admin/src/app/zones/new/page.tsx`
- Modify: `apps/admin/src/app/pests/page.tsx`
- Modify: `apps/admin/src/app/pests/new/page.tsx`

**Interfaces:**
- Consumes : `Card, CardHeader, CardTitle, CardContent`, `Input`, `Button`, `Label`, `Select…`, `Table…` (Tasks 1). `createCrop`, `listZones`, `createZone`, `listPests`, `createPest` (lot 1).
- Produces : rien.

**Recette :** formulaires « new » → envelopper le `<form>` dans une `Card` (`CardHeader>CardTitle` = titre de page, `CardContent` = le form) ; `<input>`→`Input` (+ `Label` au-dessus quand un placeholder faisait office de libellé), `<select>`→`Select` (règle Task 4), bouton submit→`Button`, message d'erreur `text-red-600`→`text-destructive`. Listes → `Table` comme Task 5 (ou liste en `Card` si une seule colonne utile).

- [ ] **Step 1 : `crops/new/page.tsx`** — Card autour du form ; les 3 `<input>` → `Input` ; le `<select>` de `CYCLE_TYPES` → `Select` (enum non-vide, conversion directe) ; bouton « Créer » → `Button type="submit"` ; erreur → `text-destructive`. Modèle du select :

```tsx
<Select value={cycleType} onValueChange={setCycle}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {CYCLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
  </SelectContent>
</Select>
```

- [ ] **Step 2 : `zones/new/page.tsx`** — Card + 3 `<input>` → `Input` + bouton → `Button` + erreur → `text-destructive` (pas de select).

- [ ] **Step 3 : `pests/new/page.tsx`** — Card + `<input>` → `Input` + le(s) `<select>` → `Select` + bouton → `Button` + erreur → `text-destructive`. Lire le fichier pour l'enum du/des select(s).

- [ ] **Step 4 : `zones/page.tsx`** — liste → `Table` (colonnes Nom, Pays, Köppen) + bouton « Nouvelle zone » en `Button asChild > Link`. État vide en encart pointillé `text-muted-foreground`. Envelopper `listZones()` de `.catch(() => [])`.

- [ ] **Step 5 : `pests/page.tsx`** — idem `zones/page.tsx` avec les colonnes du modèle Pest (lire le fichier pour les champs affichés). Envelopper `listPests()` de `.catch(() => [])`.

- [ ] **Step 6 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. `grep -rn "<select\|bg-green\|text-red-600\|text-gray" apps/admin/src/app/crops/new apps/admin/src/app/zones apps/admin/src/app/pests` → vide.

- [ ] **Step 7 : Commit**

```bash
git add apps/admin/src/app/crops/new/page.tsx apps/admin/src/app/zones/page.tsx apps/admin/src/app/zones/new/page.tsx apps/admin/src/app/pests/page.tsx apps/admin/src/app/pests/new/page.tsx
git commit -m "feat(admin): formulaires en Card + listes zones/ravageurs en Table"
```

---

## Task 8 : Finitions shell (dashboard Card, page Historique, toggle thème)

**Files:**
- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/history/page.tsx`
- Modify: `apps/admin/src/components/header.tsx`

**Interfaces:**
- Consumes : `Card…`, `Badge`, `Table…` (Tasks 1). `useTheme` (next-themes, déjà utilisé).
- Produces : `HistoryPage` (page informative statique).

**Contexte :** (1) Le dashboard `/` existe déjà (fait maison avec des divs `bg-card`) — le passer aux vrais composants `Card`/`Badge` pour l'uniformité. (2) Le lien sidebar « Historique » → `/history` fait 404 (pas de page ; pas d'endpoint global côté API). Créer une page **informative** (sans appel réseau) qui explique que l'historique est consultable par fiche. (3) Le toggle de thème lit `theme`, qui peut valoir `"system"` → premier clic sans effet ; utiliser `resolvedTheme`.

- [ ] **Step 1 : Corriger le toggle de thème dans `header.tsx`** — remplacer :

```tsx
  const { theme, setTheme } = useTheme();
```
par
```tsx
  const { resolvedTheme, setTheme } = useTheme();
```
et le `onClick` du bouton thème :
```tsx
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
```

- [ ] **Step 2 : Créer `history/page.tsx`** (informative, aucun fetch — l'API n'a pas d'endpoint global) :

```tsx
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function HistoryPage() {
  return (
    <main className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Historique</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des modifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            L&apos;historique des modifications est consultable <strong>fiche par fiche</strong> :
            ouvrez une culture depuis <Link href="/crops" className="text-primary hover:underline">Cultures</Link>,
            la section « Historique » liste ses changements.
          </p>
          <p>Un journal global transverse sera ajouté ultérieurement (nécessite un nouvel endpoint API).</p>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3 : Passer le dashboard `page.tsx` aux composants Card/Badge.** Conserver la logique (fetch résilient `.catch(() => [])`, calculs `published/drafts/avgCompleteness/recent`). Remplacer les cartes de stats `<Link><div className="rounded-lg border bg-card…">` par `<Card>` (garder le `Link` autour), et la liste des cultures récentes par une `Card` contenant les lignes ; statut via `Badge`. Ne pas introduire de couleur brute.

- [ ] **Step 4 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`, route `/history` listée dans la sortie.

- [ ] **Step 5 : Commit**

```bash
git add apps/admin/src/app/page.tsx apps/admin/src/app/history/page.tsx apps/admin/src/components/header.tsx
git commit -m "feat(admin): dashboard en Card, page Historique, toggle thème via resolvedTheme"
```

---

## Notes de vérification finale (revue de branche)

- **Sombre** : basculer le thème et parcourir dashboard / liste / fiche / une modale d'édition / un formulaire « new » — aucun texte illisible, aucun fond blanc résiduel (signe d'une couleur brute oubliée).
- **Modales** : les 11 déclencheurs ouvrent une `Dialog` ; succès ferme + rafraîchit ; erreur API (ex. 409 double-publication) s'affiche **dans** la modale sans la fermer.
- **Recherche** : header → `/crops?q=` filtre (insensible à la casse), l'encart affiche la saisie **brute**.
- **Résilience** : `crops/[id]/page.tsx` conserve `notFound()` + les `.catch(() => [])` ; `/` et les listes aussi.
- **Zéro couleur brute** : `grep -rn "bg-green-\|text-green-\|text-red-6\|text-gray-\|bg-gray-" apps/admin/src` doit être vide (hors commentaires).
- **Aucun changement backend** : `git diff --stat` ne touche que `apps/admin/`.
```
