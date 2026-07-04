# Libellés FR & UX des formulaires (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher tout le back-office en français cohérent (fini les codes bruts `SUITABLE`/`PUBLISHED`/`HARVEST`) et rendre les formulaires UX-friendly (Labels, textarea, date picker shadcn), sans aucun changement backend.

**Architecture :** Un module unique `apps/admin/src/lib/labels.ts` mappe chaque code d'énumération → libellé FR ; il est consommé par les selects (options FR, valeur = code) **et** par les affichages en lecture (fiche, listes, badges) via `labelOf(MAP, code)`. On ajoute 3 primitifs shadcn (Textarea, Popover, Calendar) + un composant `DatePicker`, puis on applique le tout.

**Tech Stack :** Next.js 14 (App Router), TypeScript strict, TailwindCSS 3, shadcn/ui « new-york », Radix UI, react-day-picker + date-fns (date picker).

## Global Constraints

- **Aucun changement backend.** L'API conserve les codes d'énumération. Toute la traduction vit dans l'admin (`apps/admin/`).
- **La valeur envoyée à l'API reste le code** (ex. select d'aptitude → envoie `SUITABLE`, jamais `Favorable`). Une régression sur ce point est bloquante.
- **Zéro code d'énumération brut visible** à l'écran (selects, fiche, listes, badges, dashboard). Zéro couleur en dur (tokens uniquement, comme les lots précédents ; pas de `bg-green-*`/`text-red-6*`/`text-gray-*`/`bg-gray-*`).
- Style shadcn **new-york**, primitifs placés **verbatim**. Alias `@/` → `apps/admin/src/` ; `cn` depuis `@/lib/utils`.
- ESLint `react/no-unescaped-entities` : échapper `'` en `&apos;` dans le JSX.
- **Porte de validation par tâche** : `pnpm --filter @okko/admin build` réussit (types + lint). Pas de tests unitaires admin.
- Commits fréquents, préfixe `feat(admin):`/`refactor(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### Libellés FR validés (source de vérité — à reproduire exactement)

- **CycleType** : SEASONAL_ANNUAL=Annuelle (saisonnière) · BIENNIAL=Bisannuelle · PERENNIAL_HERBACEOUS=Pérenne herbacée · PERENNIAL_WOODY_FRUIT=Pérenne ligneuse (fruitière) · FORESTRY_WOOD=Forestière (bois)
- **SuitabilityRating** : SUITABLE=Favorable · MARGINAL=Marginale · UNSUITABLE=Défavorable
- **OperationType** : CLEARING=Défrichage / préparation du sol · NURSERY=Pépinière · PLANTING=Plantation / semis · FERTILIZATION=Fertilisation · WEEDING=Désherbage / sarclage · PEST_CONTROL=Traitement phytosanitaire · HARVEST=Récolte · OTHER=Autre
- **InputLevel** (rendement) : LOW=Faible · MEDIUM=Moyen · HIGH=Élevé
- **Susceptibility** (ravageur) : LOW=Faible · MEDIUM=Modérée · HIGH=Élevée
- **NutritionBasis** : PER_HECTARE=Par hectare (kg/ha) · PER_TONNE=Par tonne de récolte (kg/t)
- **PestType** : INSECT=Insecte · FUNGUS=Champignon (maladie fongique) · BACTERIA=Bactérie · VIRUS=Virus · WEED=Adventice (mauvaise herbe) · NEMATODE=Nématode · OTHER=Autre
- **CropStatus** : DRAFT=Brouillon · PUBLISHED=Publiée · ARCHIVED=Archivée
- **ControlCategory** (méthodes de lutte) : PREVENTION=Prévention · BIOLOGICAL=Lutte biologique · INTEGRATED=Lutte intégrée · CHEMICAL=Lutte chimique
- **Saisons** (select fixe) : `Saison des pluies`, `Saison sèche`, `Contre-saison`

---

## File Structure

Créés :
- `apps/admin/src/lib/labels.ts` — mappage codes → FR + `labelOf` + `SEASONS`
- `apps/admin/src/components/ui/textarea.tsx`, `popover.tsx`, `calendar.tsx` — primitifs shadcn
- `apps/admin/src/components/date-picker.tsx` — date picker (ISO yyyy-MM-dd)

Modifiés :
- `apps/admin/package.json` — `react-day-picker`, `@radix-ui/react-popover`, `date-fns`
- Éditeurs : `ZoneSuitabilityEditor.tsx`, `WindowEditor.tsx`, `YieldsEditor.tsx`, `NutritionEditor.tsx`, `PestControlEditor.tsx`, `PriceEditor.tsx`
- Pages « new » : `crops/new/page.tsx`, `pests/new/page.tsx`
- Affichages lecture : `crops/[id]/page.tsx`, `crops/page.tsx`, `pests/page.tsx`, `page.tsx` (dashboard)

---

## Task 1 : Module de libellés FR

**Files:**
- Create: `apps/admin/src/lib/labels.ts`

**Interfaces:**
- Produces : les constantes `CYCLE_TYPE_LABELS`, `SUITABILITY_LABELS`, `OPERATION_TYPE_LABELS`, `INPUT_LEVEL_LABELS`, `SUSCEPTIBILITY_LABELS`, `NUTRITION_BASIS_LABELS`, `PEST_TYPE_LABELS`, `CROP_STATUS_LABELS`, `CONTROL_CATEGORY_LABELS` (chacune `Record<string,string>`), `SEASONS: readonly string[]`, et `labelOf(map, code): string`.

- [ ] **Step 1 : Créer `apps/admin/src/lib/labels.ts`**

```ts
// Mappage codes d'énumération (API) → libellés FR (affichage). L'ordre des clés
// définit l'ordre des options de select (JS conserve l'ordre d'insertion).

export const CYCLE_TYPE_LABELS: Record<string, string> = {
  SEASONAL_ANNUAL: 'Annuelle (saisonnière)',
  BIENNIAL: 'Bisannuelle',
  PERENNIAL_HERBACEOUS: 'Pérenne herbacée',
  PERENNIAL_WOODY_FRUIT: 'Pérenne ligneuse (fruitière)',
  FORESTRY_WOOD: 'Forestière (bois)',
};

export const SUITABILITY_LABELS: Record<string, string> = {
  SUITABLE: 'Favorable',
  MARGINAL: 'Marginale',
  UNSUITABLE: 'Défavorable',
};

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  CLEARING: 'Défrichage / préparation du sol',
  NURSERY: 'Pépinière',
  PLANTING: 'Plantation / semis',
  FERTILIZATION: 'Fertilisation',
  WEEDING: 'Désherbage / sarclage',
  PEST_CONTROL: 'Traitement phytosanitaire',
  HARVEST: 'Récolte',
  OTHER: 'Autre',
};

export const INPUT_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
};

export const SUSCEPTIBILITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Modérée',
  HIGH: 'Élevée',
};

export const NUTRITION_BASIS_LABELS: Record<string, string> = {
  PER_HECTARE: 'Par hectare (kg/ha)',
  PER_TONNE: 'Par tonne de récolte (kg/t)',
};

export const PEST_TYPE_LABELS: Record<string, string> = {
  INSECT: 'Insecte',
  FUNGUS: 'Champignon (maladie fongique)',
  BACTERIA: 'Bactérie',
  VIRUS: 'Virus',
  WEED: 'Adventice (mauvaise herbe)',
  NEMATODE: 'Nématode',
  OTHER: 'Autre',
};

export const CROP_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publiée',
  ARCHIVED: 'Archivée',
};

export const CONTROL_CATEGORY_LABELS: Record<string, string> = {
  PREVENTION: 'Prévention',
  BIOLOGICAL: 'Lutte biologique',
  INTEGRATED: 'Lutte intégrée',
  CHEMICAL: 'Lutte chimique',
};

export const SEASONS: readonly string[] = ['Saison des pluies', 'Saison sèche', 'Contre-saison'];

// Résout un code en FR ; repli défensif sur le code si non mappé (jamais de blanc).
export function labelOf(map: Record<string, string>, code: string): string {
  return map[code] ?? code;
}
```

- [ ] **Step 2 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully` (module non encore consommé — on valide juste qu'il compile).

- [ ] **Step 3 : Commit**

```bash
git add apps/admin/src/lib/labels.ts
git commit -m "feat(admin): module de libellés FR des énumérations"
```

---

## Task 2 : Primitifs Textarea / Popover / Calendar + composant DatePicker

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/src/components/ui/textarea.tsx`
- Create: `apps/admin/src/components/ui/popover.tsx`
- Create: `apps/admin/src/components/ui/calendar.tsx`
- Create: `apps/admin/src/components/date-picker.tsx`

**Interfaces:**
- Consumes : `cn` (`@/lib/utils`), `buttonVariants`/`Button` (`@/components/ui/button`).
- Produces :
  - `Textarea` (props d'un `<textarea>` natif).
  - `Popover, PopoverTrigger, PopoverContent`.
  - `Calendar` (props de `DayPicker` de react-day-picker v8 ; accepte `mode`, `selected`, `onSelect`, `locale`).
  - `DatePicker` — `function DatePicker({ value: string; onChange: (iso: string) => void; placeholder?: string; id?: string }): JSX.Element` ; `value`/`onChange` en ISO `yyyy-MM-dd`.

- [ ] **Step 1 : Installer les dépendances**

```bash
cd apps/admin && pnpm add react-day-picker@8.10.1 date-fns@3.6.0 @radix-ui/react-popover@1.1.1
```

(react-day-picker est **épinglé en v8** : le `calendar.tsx` ci-dessous utilise l'API v8 — `classNames` + `components.IconLeft/IconRight`.)

- [ ] **Step 2 : Créer `ui/textarea.tsx`** (verbatim shadcn new-york)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 3 : Créer `ui/popover.tsx`** (verbatim shadcn new-york)

```tsx
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
```

- [ ] **Step 4 : Créer `ui/calendar.tsx`** (verbatim shadcn new-york, react-day-picker v8)

```tsx
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
```

- [ ] **Step 5 : Créer `components/date-picker.tsx`**

```tsx
"use client"

import { format, parse, isValid } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// value / onChange en ISO yyyy-MM-dd (contrat API inchangé).
export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  id,
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  id?: string
}) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !selected && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd MMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          onSelect={(d) => { if (d) onChange(format(d, "yyyy-MM-dd")) }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 6 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. (Aucun consommateur encore ; on valide la compilation des primitifs + du DatePicker.)

- [ ] **Step 7 : Commit**

```bash
git add apps/admin/package.json pnpm-lock.yaml apps/admin/src/components/ui/textarea.tsx apps/admin/src/components/ui/popover.tsx apps/admin/src/components/ui/calendar.tsx apps/admin/src/components/date-picker.tsx
git commit -m "feat(admin): primitifs Textarea/Popover/Calendar + DatePicker (locale FR)"
```

---

## Task 3 : Éditeurs Zone & Fenêtre (FR + textarea + saison select)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`

**Interfaces:**
- Consumes : `SUITABILITY_LABELS, OPERATION_TYPE_LABELS, SEASONS` (`@/lib/labels`), `Textarea` (`@/components/ui/textarea`), `Label` (`@/components/ui/label`), primitifs existants.

**Règle de conversion select → FR** (à appliquer partout dans ce lot) : un select sur énum garde `value`/`onValueChange` mais ses options deviennent
```tsx
{Object.entries(MAP).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
```
et l'état initial passe d'un ancien `ARR[i]` à un **code littéral** (ex. `useState('SUITABLE')`).

- [ ] **Step 1 : Réécrire `ZoneSuitabilityEditor.tsx`** (aptitude en FR ; justification en `Textarea` ; `Label` sur chaque champ)

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SUITABILITY_LABELS } from '@/lib/labels';
import { setZoneSuitability } from '../../../../lib/api';

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState('SUITABLE'); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!zoneId) return; submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="— Choisir une zone —" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Aptitude</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SUITABILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="zone-justif">Justification</Label>
            <Textarea id="zone-justif" placeholder="ex. pluviométrie insuffisante en saison sèche…" value={justification} onChange={(e) => setJustification(e.target.value)} />
          </div>
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

- [ ] **Step 2 : Réécrire `WindowEditor.tsx`** (saison en select fixe ; opérations en FR ; `Label` sur les champs principaux). Conserver **à l'identique** la logique de construction du body `addWindow`, la garde `if (!zoneId) return;`, la fermeture d'index des opérations, et la case à cocher irrigation.

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { OPERATION_TYPE_LABELS, SEASONS } from '@/lib/labels';
import { addWindow } from '../../../../lib/api';

interface Op { type: string; label: string; timingDays: string; }

export function WindowEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState('');
  const [season, setSeason] = useState('');
  const [sowingStart, setSowingStart] = useState(''); const [sowingEnd, setSowingEnd] = useState('');
  const [irrigation, setIrrigation] = useState(false);
  const [ops, setOps] = useState<Op[]>([]);

  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label="+ Ajouter une fenêtre de production">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!zoneId || !season) return;
            submit(() => addWindow(cropId, {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
            }));
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="— Choisir une zone —" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Saison *</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger><SelectValue placeholder="— Choisir une saison —" /></SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fenêtre de semis (jours de l&apos;année)</Label>
            <div className="flex gap-1">
              <Input className="flex-1" placeholder="début" value={sowingStart} onChange={(e) => setSowingStart(e.target.value)} />
              <Input className="flex-1" placeholder="fin" value={sowingEnd} onChange={(e) => setSowingEnd(e.target.value)} />
            </div>
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e) => setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire technique ({ops.length} opérations)</p>
            {ops.map((o, i) => (
              <div key={i} className="flex gap-1 my-1">
                <Select value={o.type} onValueChange={(val) => setOps(ops.map((x, j) => j === i ? { ...x, type: val } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="libellé" value={o.label} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input className="w-16" placeholder="J+" value={o.timingDays} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, timingDays: e.target.value } : x))} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: 'PLANTING', label: '', timingDays: '0' }])}>+ opération</Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 3 : Vérifier le build + absence de codes bruts dans ces 2 fichiers**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.
Puis `grep -n "SUITABLE\|MARGINAL\|UNSUITABLE\|CLEARING\|PLANTING\|HARVEST" apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx` → seules occurrences autorisées : le code littéral d'état initial (`'SUITABLE'`, `'PLANTING'`) et les `value={code}` implicites via `Object.entries`. Aucun **texte affiché** brut.

- [ ] **Step 4 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx
git commit -m "feat(admin): éditeurs zone (FR + textarea) et fenêtre (saison select + opérations FR)"
```

---

## Task 4 : Éditeurs Rendement, Nutrition, Ravageur (FR + Labels)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`

**Interfaces:**
- Consumes : `INPUT_LEVEL_LABELS, NUTRITION_BASIS_LABELS, SUSCEPTIBILITY_LABELS` (`@/lib/labels`), `Label` (`@/components/ui/label`), primitifs existants.

Appliquer la règle de conversion select → FR (cf. Task 3), garder toute la logique de submit / state / props inchangée, et ajouter un `Label` de section pour clarifier les groupes de champs.

- [ ] **Step 1 : `YieldsEditor.tsx`** — remplacer `const LEVELS = [...]` et son select par `INPUT_LEVEL_LABELS` ; état initial `useState('MEDIUM')`. Ajouter un `Label` « Niveau d'intrants » au-dessus du select et un `Label` « Rendement (min · moyen · potentiel) » au-dessus de la rangée d'inputs. Résultat attendu :

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INPUT_LEVEL_LABELS } from '@/lib/labels';
import { setYields } from '../../../../lib/api';
import type { YieldReference } from '../../../../lib/api';

export function YieldsEditor({ cropId, current }: { cropId: string; current: YieldReference[] }) {
  const [level, setLevel] = useState('MEDIUM');
  const [min, setMin] = useState(''); const [avg, setAvg] = useState(''); const [pot, setPot] = useState(''); const [unit, setUnit] = useState('t/ha');
  return (
    <EditorShell label="+ Ajouter un rendement de référence">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { inputLevel: level, min: Number(min), average: Number(avg), potential: Number(pot), unit }];
            submit(() => setYields(cropId, next));
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Niveau d&apos;intrants</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INPUT_LEVEL_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rendement (min · moyen · potentiel) et unité</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} required />
              <Input className="w-16" placeholder="moyen" value={avg} onChange={(e) => setAvg(e.target.value)} required />
              <Input className="w-16" placeholder="potentiel" value={pot} onChange={(e) => setPot(e.target.value)} required />
              <Input className="w-20" placeholder="unité" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2 : `NutritionEditor.tsx`** — remplacer `const BASES = [...]` et son select par `NUTRITION_BASIS_LABELS` ; état initial `useState('PER_HECTARE')`. Ajouter des `Label` : « Élément & quantité » au-dessus de la rangée (nutrient/quantité/unité/base) et garder le champ « stade » avec son `Label` « Stade (optionnel) ». Conserver la logique de submit inchangée.

- [ ] **Step 3 : `PestControlEditor.tsx`** — remplacer `const LEVELS = [...]` et le select de sensibilité par `SUSCEPTIBILITY_LABELS` ; état initial `useState('MEDIUM')`. Garder le select de ravageur (`value={p.id}`, placeholder), la garde `if (!pestId) return;`, la branche « aucun ravageur au catalogue », et la logique de submit. Ajouter `Label` « Ravageur / maladie * », « Sensibilité », « Seuil de nuisibilité (optionnel) », « Stades sensibles (optionnel) ».

- [ ] **Step 4 : Vérifier le build + absence de codes bruts**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.
`grep -n "\bLOW\b\|\bMEDIUM\b\|\bHIGH\b\|PER_HECTARE\|PER_TONNE" apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx` → seules occurrences autorisées : codes littéraux d'état initial. Aucun texte affiché brut.

- [ ] **Step 5 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx
git commit -m "feat(admin): éditeurs rendement/nutrition/ravageur en FR + Labels"
```

---

## Task 5 : Pages « new » (FR) + PriceEditor (date picker)

**Files:**
- Modify: `apps/admin/src/app/crops/new/page.tsx`
- Modify: `apps/admin/src/app/pests/new/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`

**Interfaces:**
- Consumes : `CYCLE_TYPE_LABELS`, `PEST_TYPE_LABELS` (`@/lib/labels`), `DatePicker` (`@/components/date-picker`), `Label` (existant).

- [ ] **Step 1 : `crops/new/page.tsx`** — remplacer `const CYCLE_TYPES = [...]` et son select par `CYCLE_TYPE_LABELS` ; état initial `useState('SEASONAL_ANNUAL')`. Le reste de la page (Labels déjà présents, submit, redirect) est inchangé. Le select devient :

```tsx
<Select value={cycleType} onValueChange={setCycle}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {Object.entries(CYCLE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
  </SelectContent>
</Select>
```

- [ ] **Step 2 : `pests/new/page.tsx`** — remplacer `const TYPES = [...]` et son select par `PEST_TYPE_LABELS` ; état initial `useState('INSECT')`. Même patron `Object.entries(PEST_TYPE_LABELS)`. Reste inchangé.

- [ ] **Step 3 : `PriceEditor.tsx`** — remplacer le champ date natif (`<Input type="date" …>`) par le `DatePicker`, et ajouter des `Label`. La date reste en ISO `yyyy-MM-dd` (le `DatePicker` s'en charge) donc l'appel `addPrice(cropId, { market, date, price, unit, currency })` est **inchangé**. Résultat attendu :

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/date-picker';
import { addPrice } from '../../../../lib/api';

export function PriceEditor({ cropId }: { cropId: string }) {
  const [market, setMarket] = useState(''); const [date, setDate] = useState('');
  const [price, setPrice] = useState(''); const [unit, setUnit] = useState('FCFA/kg'); const [currency, setCurrency] = useState('XOF');
  return (
    <EditorShell label="+ Ajouter un relevé de prix">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            submit(() => addPrice(cropId, { market, date, price: Number(price), unit, currency }));
          }}
          className="space-y-3 text-sm"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="price-market">Marché *</Label>
              <Input id="price-market" placeholder="ex. Dantokpa" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Prix, unité, devise</Label>
            <div className="flex gap-1">
              <Input className="w-24" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
              <Input className="w-24" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
              <Input className="w-20" placeholder="devise" value={currency} onChange={(e)=>setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 4 : Vérifier le build**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`. `grep -n "SEASONAL_ANNUAL\|INSECT\|type=\"date\"" apps/admin/src/app/crops/new/page.tsx apps/admin/src/app/pests/new/page.tsx apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx` → seules occurrences autorisées : codes littéraux d'état initial ; **plus aucun** `type="date"`.

- [ ] **Step 5 : Commit**

```bash
git add apps/admin/src/app/crops/new/page.tsx apps/admin/src/app/pests/new/page.tsx apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx
git commit -m "feat(admin): cycle/type en FR sur les pages new + date picker sur les prix"
```

---

## Task 6 : Affichages en lecture (fiche, listes, dashboard) en FR

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`
- Modify: `apps/admin/src/app/crops/page.tsx`
- Modify: `apps/admin/src/app/pests/page.tsx`
- Modify: `apps/admin/src/app/page.tsx`

**Interfaces:**
- Consumes : `labelOf` + les maps concernées (`@/lib/labels`).

Remplacer chaque rendu d'un code d'énumération par `labelOf(MAP, code)`. **Préserver** la résilience de la fiche (`getCrop().catch(()=>null)` + `notFound()` + 3 `.catch(()=>[])`) et des listes/dashboard (`.catch(()=>[])`), et ne rien changer d'autre.

- [ ] **Step 1 : `crops/[id]/page.tsx`** — ajouter l'import `import { labelOf, CROP_STATUS_LABELS, CYCLE_TYPE_LABELS, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS, OPERATION_TYPE_LABELS, INPUT_LEVEL_LABELS, CONTROL_CATEGORY_LABELS } from '@/lib/labels';` puis remplacer :
  - en-tête cycle : `{crop.cycleType}` → `{labelOf(CYCLE_TYPE_LABELS, crop.cycleType)}`
  - badge statut : `{crop.status}` → `{labelOf(CROP_STATUS_LABELS, crop.status)}`
  - zones : `<strong>{z.rating}</strong>` → `<strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>`
  - fenêtres, opérations : `({op.type})` → `({labelOf(OPERATION_TYPE_LABELS, op.type)})`
  - ravageurs : `<strong>{p.susceptibility}</strong> ({p.type})` → `<strong>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</strong> ({labelOf(PEST_TYPE_LABELS, p.type)})`
  - méthodes de lutte : `{m.category}` → `{labelOf(CONTROL_CATEGORY_LABELS, m.category)}`
  - rendement : `{y.inputLevel} :` → `{labelOf(INPUT_LEVEL_LABELS, y.inputLevel)} :`

  Ne pas toucher au `PublishButton cropId status={crop.status}` (il reçoit le **code**, comportement inchangé).

- [ ] **Step 2 : `crops/page.tsx`** — importer `labelOf, CYCLE_TYPE_LABELS, CROP_STATUS_LABELS`. Remplacer la cellule cycle `{c.cycleType}` → `{labelOf(CYCLE_TYPE_LABELS, c.cycleType)}` et le contenu du Badge `{c.status}` → `{labelOf(CROP_STATUS_LABELS, c.status)}` (garder la logique de `variant`). Filtre de recherche et résilience inchangés.

- [ ] **Step 3 : `pests/page.tsx`** — importer `labelOf, PEST_TYPE_LABELS`. Remplacer la cellule type `{p.type}` → `{labelOf(PEST_TYPE_LABELS, p.type)}`. Reste inchangé.

- [ ] **Step 4 : `page.tsx` (dashboard)** — importer `labelOf, CROP_STATUS_LABELS`. Dans la liste des cultures récentes, remplacer le contenu du Badge `{c.status}` → `{labelOf(CROP_STATUS_LABELS, c.status)}` (garder la logique de `variant`). Résilience et calculs inchangés.

- [ ] **Step 5 : Vérifier le build + absence de codes bruts affichés**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.
`grep -rn "{crop.status}\|{c.status}\|{p.type}\|{z.rating}\|{op.type}\|{p.susceptibility}\|{m.category}\|{crop.cycleType}\|{c.cycleType}\|{y.inputLevel}" apps/admin/src/app` → **vide** (tous passés par `labelOf`).
Vérifier la résilience : `grep -n "notFound()\|catch(() =>" apps/admin/src/app/crops/[id]/page.tsx` → `notFound()` + 4 `.catch`.

- [ ] **Step 6 : Commit**

```bash
git add apps/admin/src/app/crops/[id]/page.tsx apps/admin/src/app/crops/page.tsx apps/admin/src/app/pests/page.tsx apps/admin/src/app/page.tsx
git commit -m "feat(admin): affichages lecture (fiche, listes, dashboard) en libellés FR"
```

---

## Notes de vérification finale (revue de branche)

- **Aucun code brut** : `grep -rnE "SUITABLE|MARGINAL|UNSUITABLE|PUBLISHED|DRAFT|ARCHIVED|CLEARING|NURSERY|PLANTING|FERTILIZATION|WEEDING|PEST_CONTROL|HARVEST|PER_HECTARE|PER_TONNE|INSECT|FUNGUS|BACTERIA|NEMATODE|BIOLOGICAL|CHEMICAL|INTEGRATED|PREVENTION" apps/admin/src/app` ne doit remonter que des **codes littéraux d'état initial** (`useState('…')`), jamais du texte affiché.
- **Valeur API = code** : ouvrir chaque select, enregistrer, vérifier que la fiche affiche bien la donnée (donc l'API a reçu le code).
- **Date picker** : la date choisie s'affiche en FR (`05 juil. 2026`) et le relevé apparaît sur la fiche (ISO bien envoyé).
- **Clair + sombre** OK ; **résilience** de la fiche/listes préservée ; **aucun changement backend** (`git diff --stat` limité à `apps/admin/`).
