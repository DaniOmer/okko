# Édition en place de la fiche culture (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les 11 catégories de la fiche culture éditables en place depuis `/crops/[id]`, sans changement backend.

**Architecture:** La page détail reste un Server Component (lecture). Chaque section gagne un composant éditeur Client (`'use client'`) qui poste vers l'API existante puis appelle `router.refresh()`. Un `EditorShell` en render-prop factorise le squelette commun (toggle « Éditer/Ajouter », erreur inline, submit → refresh).

**Tech Stack:** Next.js 14 (App Router), React, TailwindCSS, TypeScript strict.

## Global Constraints

- **TypeScript strict** ; aucune dépendance nouvelle ; aucun changement backend.
- **Vérification = `pnpm --filter @okko/admin build`** (type-check) — l'app admin n'a pas de tests unitaires (patron établi Plans 1-7). Chaque tâche se termine par un build qui réussit ; la vérification fonctionnelle est manuelle.
- Éditeurs = **Client Components** (`'use client'`) ; la page reste Server Component.
- Sur succès d'une mutation : `router.refresh()`. Sur `!res.ok` : message d'erreur **inline**, pas de navigation, pas de crash de page.
- Chemin d'import depuis `app/crops/[id]/editors/` vers le client API : `../../../../lib/api`.
- Endpoints (vérifiés dans `apps/api/src/presentation/crop/crop.controller.ts`) : `POST /crops/:id/publish` · `PATCH /crops/:id/requirements|phenology|nutrition|yields` · `POST /crops/:id/varieties|windows|prices` · `PUT /crops/:id/zones/:zoneId` · `PUT /crops/:id/pests/:pestId`.
- L'API tourne sur `:3001` (redémarrer si elle sert du code périmé). Le build admin n'a pas besoin de l'API.

---

## File Structure

```
apps/admin/src/
├── lib/api.ts                          # MODIFY: 8 fonctions de mutation
└── app/crops/[id]/
    ├── page.tsx                        # MODIFY: fetch catalogues + composer les éditeurs
    └── editors/                        # NEW
        ├── EditorShell.tsx             # Task 2
        ├── PublishButton.tsx           # Task 3 (A)
        ├── RequirementsEditor.tsx      # Task 4 (B)
        ├── PhenologyEditor.tsx         # Task 5 (C)
        ├── NutritionEditor.tsx         # Task 5 (C)
        ├── YieldsEditor.tsx            # Task 5 (C)
        ├── VarietyEditor.tsx           # Task 6 (D)
        ├── PriceEditor.tsx             # Task 6 (D)
        ├── WindowEditor.tsx            # Task 7 (D)
        ├── ZoneSuitabilityEditor.tsx   # Task 8 (E)
        └── PestControlEditor.tsx       # Task 8 (E)
```

---

### Task 1: Fonctions de mutation dans `api.ts`

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Consumes: the existing `BASE` const and types (`Variety`, `PricePoint`, `CroppingWindow`, etc.) already in `api.ts`.
- Produces: `setRequirements`, `setPhenology`, `setNutrition`, `setYields`, `addWindow`, `addPrice`, `setZoneSuitability`, `setPestControl` — each `throw`s on `!res.ok`.

- [ ] **Step 1: Append the mutation functions**

Add to the end of `apps/admin/src/lib/api.ts` (the file already declares `const BASE`, `getCrop`, `addVariety`, etc.):
```ts
async function mutate(path: string, method: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json().catch(() => undefined);
}

export function setRequirements(cropId: string, body: {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string; drainage?: string };
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/requirements`, 'PATCH', body);
}

export function setPhenology(cropId: string, stages: { name: Record<string, string>; startDay: number; endDay: number; order: number }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/phenology`, 'PATCH', { stages });
}

export function setNutrition(cropId: string, requirements: { nutrient: string; amount: number; unit: string; basis: string; stage?: string }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/nutrition`, 'PATCH', { requirements });
}

export function setYields(cropId: string, yieldsList: { inputLevel: string; min: number; average: number; potential: number; unit: string; zoneId?: string }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/yields`, 'PATCH', { yields: yieldsList });
}

export function addWindow(cropId: string, body: {
  zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string }[]; notes?: string;
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/windows`, 'POST', body);
}

export function addPrice(cropId: string, body: { market: string; date: string; price: number; unit: string; currency: string }): Promise<unknown> {
  return mutate(`/crops/${cropId}/prices`, 'POST', body);
}

export function setZoneSuitability(cropId: string, zoneId: string, body: { rating: string; justification?: string }): Promise<unknown> {
  return mutate(`/crops/${cropId}/zones/${zoneId}`, 'PUT', body);
}

export function setPestControl(cropId: string, pestId: string, body: {
  susceptibility: string; sensitiveStages?: string[]; threshold?: string;
  controlMethods?: { category: string; description: Record<string, string>; inputs: string[] }[];
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/pests/${pestId}`, 'PUT', body);
}
```

- [ ] **Step 2: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds (the new functions are unused so far, but must type-check).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): add crop mutation api client functions"
```

---

### Task 2: `EditorShell` (squelette DRY)

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx`

**Interfaces:**
- Consumes: `next/navigation` `useRouter`.
- Produces: `EditorShell` — a render-prop client component. Signature:
  `EditorShell({ label, children }: { label: string; children: (h: { submit: (fn: () => Promise<unknown>) => Promise<void>; close: () => void; busy: boolean }) => ReactNode })`.
  On `submit(fn)`: runs `fn()`, on success closes + `router.refresh()`, on error shows `err.message`.

- [ ] **Step 1: Implement `EditorShell.tsx`**

`apps/admin/src/app/crops/[id]/editors/EditorShell.tsx`:
```tsx
'use client';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-green-700 underline">
        {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded border p-3 bg-gray-50">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {children({ submit, close: () => setOpen(false), busy })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds (EditorShell unused so far but must type-check).

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/EditorShell.tsx"
git commit -m "feat(admin): add EditorShell render-prop component"
```

---

### Task 3: `PublishButton` (patron A) + câblage page

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `publishCrop` (existant).
- Produces: `PublishButton({ cropId, status }: { cropId: string; status: string })`.

- [ ] **Step 1: Implement `PublishButton.tsx`**

`apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`:
```tsx
'use client';
import { EditorShell } from './EditorShell';
import { publishCrop } from '../../../../lib/api';

export function PublishButton({ cropId, status }: { cropId: string; status: string }) {
  if (status === 'PUBLISHED') return <span className="text-sm text-gray-500">Publiée</span>;
  return (
    <EditorShell label="Publier">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Publier cette fiche ?</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => submit(() => publishCrop(cropId))} className="rounded bg-green-700 px-3 py-1 text-sm text-white">Confirmer</button>
            <button onClick={close} className="text-sm">Annuler</button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Wire it into the detail page header**

In `apps/admin/src/app/crops/[id]/page.tsx`, add the import at the top:
```tsx
import { PublishButton } from './editors/PublishButton';
```
Then, just after the status line (`<p className="text-sm">{crop.cycleType} · {crop.status} (v{crop.version})</p>`), add:
```tsx
      <PublishButton cropId={params.id} status={crop.status} />
```

- [ ] **Step 3: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; `/crops/[id]` compiles.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/PublishButton.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add publish button to crop detail"
```

---

### Task 4: `RequirementsEditor` (patron B) + câblage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `setRequirements`.
- Produces: `RequirementsEditor({ cropId }: { cropId: string })`.

- [ ] **Step 1: Implement `RequirementsEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
            <input className="w-16 border p-1" placeholder="min" value={tMin} onChange={(e)=>setTMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={tOpt} onChange={(e)=>setTOpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={tMax} onChange={(e)=>setTMax(e.target.value)} /><span>°C</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Pluviométrie</span>
            <input className="w-16 border p-1" placeholder="min" value={rMin} onChange={(e)=>setRMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={rOpt} onChange={(e)=>setROpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={rMax} onChange={(e)=>setRMax(e.target.value)} /><span>mm</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">pH du sol</span>
            <input className="w-16 border p-1" placeholder="min" value={phMin} onChange={(e)=>setPhMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={phOpt} onChange={(e)=>setPhOpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={phMax} onChange={(e)=>setPhMax(e.target.value)} />
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Texture</span>
            <input className="flex-1 border p-1" placeholder="ex. limono-sableux" value={texture} onChange={(e)=>setTexture(e.target.value)} />
          </fieldset>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Enregistrer</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Wire it into the requirements sections**

In `apps/admin/src/app/crops/[id]/page.tsx`, add the import:
```tsx
import { RequirementsEditor } from './editors/RequirementsEditor';
```
Add `<RequirementsEditor cropId={params.id} />` immediately after the "Exigences édaphiques" section (or once, after the climatic/edaphic display blocks — a single editor covers both).

- [ ] **Step 3: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add climatic/edaphic requirements editor"
```

---

### Task 5: Éditeurs de liste (patron C) — Phénologie, Nutrition, Rendement + câblage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`, `NutritionEditor.tsx`, `YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `setPhenology`, `setNutrition`, `setYields`, and the existing detail types `PhenologicalStage`, `NutrientRequirement`, `YieldReference`.
- Produces: `PhenologyEditor({ cropId, current })`, `NutritionEditor({ cropId, current })`, `YieldsEditor({ cropId, current })` where `current` is the existing list (so a new row is appended, not overwriting).

- [ ] **Step 1: Implement `PhenologyEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setPhenology } from '../../../../lib/api';
import type { PhenologicalStage } from '../../../../lib/api';

export function PhenologyEditor({ cropId, current }: { cropId: string; current: PhenologicalStage[] }) {
  const [name, setName] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  return (
    <EditorShell label="+ Ajouter un stade phénologique">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { name: { fr: name }, startDay: Number(start), endDay: Number(end), order: current.length + 1 }];
            submit(() => setPhenology(cropId, next));
          }}
          className="space-y-2 text-sm"
        >
          <input className="w-full border p-1" placeholder="Nom du stade (ex. Levée)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <div className="flex gap-1 items-center">
            <input className="w-20 border p-1" placeholder="jour début" value={start} onChange={(e)=>setStart(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="jour fin" value={end} onChange={(e)=>setEnd(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Implement `NutritionEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setNutrition } from '../../../../lib/api';
import type { NutrientRequirement } from '../../../../lib/api';

const BASES = ['PER_HECTARE', 'PER_TONNE'];

export function NutritionEditor({ cropId, current }: { cropId: string; current: NutrientRequirement[] }) {
  const [nutrient, setNutrient] = useState(''); const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('kg/ha'); const [basis, setBasis] = useState(BASES[0]); const [stage, setStage] = useState('');
  return (
    <EditorShell label="+ Ajouter un besoin nutritif">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { nutrient, amount: Number(amount), unit, basis, stage: stage || undefined }];
            submit(() => setNutrition(cropId, next));
          }}
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1">
            <input className="w-20 border p-1" placeholder="N / P2O5…" value={nutrient} onChange={(e)=>setNutrient(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="quantité" value={amount} onChange={(e)=>setAmount(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            <select className="border p-1" value={basis} onChange={(e)=>setBasis(e.target.value)}>{BASES.map((b)=><option key={b} value={b}>{b}</option>)}</select>
          </div>
          <input className="w-full border p-1" placeholder="stade (optionnel)" value={stage} onChange={(e)=>setStage(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 3: Implement `YieldsEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setYields } from '../../../../lib/api';
import type { YieldReference } from '../../../../lib/api';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export function YieldsEditor({ cropId, current }: { cropId: string; current: YieldReference[] }) {
  const [level, setLevel] = useState(LEVELS[1]);
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
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1 items-center">
            <select className="border p-1" value={level} onChange={(e)=>setLevel(e.target.value)}>{LEVELS.map((l)=><option key={l} value={l}>{l}</option>)}</select>
            <input className="w-16 border p-1" placeholder="min" value={min} onChange={(e)=>setMin(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="moyen" value={avg} onChange={(e)=>setAvg(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="potentiel" value={pot} onChange={(e)=>setPot(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 4: Wire the three editors into the page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add imports:
```tsx
import { PhenologyEditor } from './editors/PhenologyEditor';
import { NutritionEditor } from './editors/NutritionEditor';
import { YieldsEditor } from './editors/YieldsEditor';
```
Place each inside its matching section:
- `<PhenologyEditor cropId={params.id} current={crop.phenology} />` in the Phénologie section.
- `<NutritionEditor cropId={params.id} current={crop.nutrition} />` in the Nutrition section.
- `<YieldsEditor cropId={params.id} current={crop.yields} />` in the Rendement section.

> Note: `PhenologicalStage`, `NutrientRequirement`, `YieldReference` types already exist in `api.ts` and `crop.phenology`/`crop.nutrition`/`crop.yields` are already on `CropDetail`.

- [ ] **Step 5: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx" "apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx" "apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add phenology, nutrition and yields list editors"
```

---

### Task 6: Ajout d'un élément (patron D) — Variétés, Prix + câblage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`, `PriceEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `addVariety` (existant), `addPrice`.
- Produces: `VarietyEditor({ cropId })`, `PriceEditor({ cropId })`.

- [ ] **Step 1: Implement `VarietyEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { addVariety } from '../../../../lib/api';

export function VarietyEditor({ cropId }: { cropId: string }) {
  const [name, setName] = useState(''); const [maturityDays, setMaturityDays] = useState(''); const [traits, setTraits] = useState('');
  return (
    <EditorShell label="+ Ajouter une variété">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => addVariety(cropId, {
              name: { fr: name },
              maturityDays: maturityDays ? Number(maturityDays) : undefined,
              traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
            }));
          }}
          className="space-y-2 text-sm"
        >
          <input className="w-full border p-1" placeholder="Nom (fr)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <input className="w-full border p-1" placeholder="Cycle (jours, optionnel)" value={maturityDays} onChange={(e)=>setMaturityDays(e.target.value)} />
          <input className="w-full border p-1" placeholder="Traits (séparés par des virgules)" value={traits} onChange={(e)=>setTraits(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Implement `PriceEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
            submit(() => addPrice(cropId, { market, date, price: Number(price), unit, currency }));
          }}
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1">
            <input className="flex-1 border p-1" placeholder="Marché" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            <input className="w-32 border p-1" type="date" value={date} onChange={(e)=>setDate(e.target.value)} required />
          </div>
          <div className="flex gap-1">
            <input className="w-24 border p-1" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
            <input className="w-24 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            <input className="w-20 border p-1" placeholder="devise" value={currency} onChange={(e)=>setCurrency(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 3: Wire into the page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add imports:
```tsx
import { VarietyEditor } from './editors/VarietyEditor';
import { PriceEditor } from './editors/PriceEditor';
```
Add `<VarietyEditor cropId={params.id} />` in the Variétés section and `<PriceEditor cropId={params.id} />` in the Prix section.

- [ ] **Step 4: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx" "apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add variety and price editors"
```

---

### Task 7: `WindowEditor` (patron D, avec sous-liste d'opérations) + câblage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `addWindow`, the existing `Zone` type, and `listZones` result passed as `zones` prop (the page fetches it).
- Produces: `WindowEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] })` — the `zones` come from the catalog so the window can reference a real zone. Includes a repeatable operations sub-list.

- [ ] **Step 1: Implement `WindowEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { addWindow } from '../../../../lib/api';

const OP_TYPES = ['CLEARING', 'NURSERY', 'PLANTING', 'FERTILIZATION', 'WEEDING', 'PEST_CONTROL', 'HARVEST', 'OTHER'];

interface Op { type: string; label: string; timingDays: string; }

export function WindowEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState('');
  const [season, setSeason] = useState('');
  const [sowingStart, setSowingStart] = useState(''); const [sowingEnd, setSowingEnd] = useState('');
  const [irrigation, setIrrigation] = useState(false);
  const [ops, setOps] = useState<Op[]>([]);

  if (zones.length === 0) {
    return <p className="text-sm text-gray-500">Créez d'abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label="+ Ajouter une fenêtre de production">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => addWindow(cropId, {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
            }));
          }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={zoneId} onChange={(e)=>setZoneId(e.target.value)} required>
            <option value="">— Zone —</option>
            {zones.map((z)=><option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input className="w-full border p-1" placeholder="Saison (ex. Saison sèche)" value={season} onChange={(e)=>setSeason(e.target.value)} required />
          <div className="flex gap-1">
            <input className="flex-1 border p-1" placeholder="semis début" value={sowingStart} onChange={(e)=>setSowingStart(e.target.value)} />
            <input className="flex-1 border p-1" placeholder="semis fin" value={sowingEnd} onChange={(e)=>setSowingEnd(e.target.value)} />
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e)=>setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire ({ops.length} opérations)</p>
            {ops.map((o, i) => (
              <div key={i} className="flex gap-1 my-1">
                <select className="border p-1" value={o.type} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,type:e.target.value}:x))}>{OP_TYPES.map((t)=><option key={t} value={t}>{t}</option>)}</select>
                <input className="flex-1 border p-1" placeholder="libellé" value={o.label} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,label:e.target.value}:x))} />
                <input className="w-16 border p-1" placeholder="J+" value={o.timingDays} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,timingDays:e.target.value}:x))} />
              </div>
            ))}
            <button type="button" onClick={()=>setOps([...ops, { type: OP_TYPES[2], label: '', timingDays: '0' }])} className="text-green-700 underline">+ opération</button>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Fetch zones in the page and wire the editor**

In `apps/admin/src/app/crops/[id]/page.tsx`:
- Add imports:
```tsx
import { WindowEditor } from './editors/WindowEditor';
import { listZones } from '../../../lib/api';
```
- Extend the data fetch to include zones (the page already does `Promise.all([getCrop, getCropHistory])` — add `listZones()`):
```tsx
  const [crop, history, zones] = await Promise.all([getCrop(params.id), getCropHistory(params.id), listZones()]);
```
- In the "Fenêtres de production" section, add `<WindowEditor cropId={params.id} zones={zones} />` (`zones` items already have `{ id, name }`).

- [ ] **Step 3: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add cropping-window editor with itinerary"
```

---

### Task 8: Éditeurs de relation (patron E) — Zones, Ravageurs + câblage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`, `PestControlEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `setZoneSuitability`, `setPestControl`, and the catalogs `zones`/`pests` passed as props.
- Produces: `ZoneSuitabilityEditor({ cropId, zones })`, `PestControlEditor({ cropId, pests })`.

- [ ] **Step 1: Implement `ZoneSuitabilityEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setZoneSuitability } from '../../../../lib/api';

const RATINGS = ['SUITABLE', 'MARGINAL', 'UNSUITABLE'];

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState(RATINGS[0]); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-gray-500">Créez d'abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={zoneId} onChange={(e)=>setZoneId(e.target.value)} required>
            <option value="">— Zone —</option>
            {zones.map((z)=><option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select className="w-full border p-1" value={rating} onChange={(e)=>setRating(e.target.value)}>{RATINGS.map((r)=><option key={r} value={r}>{r}</option>)}</select>
          <input className="w-full border p-1" placeholder="justification (optionnel)" value={justification} onChange={(e)=>setJustification(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Rattacher</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Implement `PestControlEditor.tsx`**

`apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setPestControl } from '../../../../lib/api';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export function PestControlEditor({ cropId, pests }: { cropId: string; pests: { id: string; name: string }[] }) {
  const [pestId, setPestId] = useState(''); const [susceptibility, setSusceptibility] = useState(LEVELS[1]);
  const [threshold, setThreshold] = useState(''); const [stages, setStages] = useState('');
  if (pests.length === 0) {
    return <p className="text-sm text-gray-500">Créez d'abord un <a href="/pests" className="underline">ravageur</a> pour le rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher un ravageur / une maladie">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => setPestControl(cropId, pestId, {
              susceptibility,
              threshold: threshold || undefined,
              sensitiveStages: stages ? stages.split(',').map((s)=>s.trim()).filter(Boolean) : undefined,
            }));
          }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={pestId} onChange={(e)=>setPestId(e.target.value)} required>
            <option value="">— Ravageur / maladie —</option>
            {pests.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-full border p-1" value={susceptibility} onChange={(e)=>setSusceptibility(e.target.value)}>{LEVELS.map((l)=><option key={l} value={l}>{l}</option>)}</select>
          <input className="w-full border p-1" placeholder="seuil de nuisibilité (optionnel)" value={threshold} onChange={(e)=>setThreshold(e.target.value)} />
          <input className="w-full border p-1" placeholder="stades sensibles (virgules, optionnel)" value={stages} onChange={(e)=>setStages(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Rattacher</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 3: Fetch pests in the page and wire both editors**

In `apps/admin/src/app/crops/[id]/page.tsx`:
- Add imports:
```tsx
import { ZoneSuitabilityEditor } from './editors/ZoneSuitabilityEditor';
import { PestControlEditor } from './editors/PestControlEditor';
import { listPests } from '../../../lib/api';
```
- Extend the `Promise.all` (already includes `getCrop`, `getCropHistory`, `listZones` after Task 7) to add `listPests()`:
```tsx
  const [crop, history, zones, pests] = await Promise.all([getCrop(params.id), getCropHistory(params.id), listZones(), listPests()]);
```
- In the Zones section add `<ZoneSuitabilityEditor cropId={params.id} zones={zones} />`; in the Ravageurs section add `<PestControlEditor cropId={params.id} pests={pests} />`. (`zones`/`pests` items already have `{ id, name }`.)

- [ ] **Step 4: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; `/crops/[id]` compiles with all editors.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx" "apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx" "apps/admin/src/app/crops/[id]/page.tsx"
git commit -m "feat(admin): add zone-suitability and pest-control relation editors"
```

---

## Self-Review

**1. Spec coverage:**
- Publication (A) → Task 3. ✅
- Exigences climat + sol (B) → Task 4. ✅
- Phénologie · Nutrition · Rendement (C) → Task 5. ✅
- Variétés · Prix (D) → Task 6 ; Fenêtres (D, avec opérations) → Task 7. ✅
- Zones · Ravageurs (E, depuis catalogues) → Task 8. ✅
- `api.ts` 8 mutations → Task 1. ✅
- `EditorShell` DRY → Task 2. ✅
- Gestion d'erreur inline → `EditorShell` (Task 2), utilisé partout. ✅
- Catalogue vide → message + lien (Tasks 7, 8). ✅
- Tests = build → chaque tâche. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code complet à chaque étape ; commandes fournies. ✅

**3. Type consistency:** `EditorShell` signature (Task 2) réutilisée par tous les éditeurs (render-prop `{ submit, close, busy }`). Les fonctions `api.ts` (Task 1) — `setRequirements`, `setPhenology`, `setNutrition`, `setYields`, `addWindow`, `addPrice`, `setZoneSuitability`, `setPestControl` — sont importées avec les bonnes signatures dans les Tasks 4-8. `addVariety`/`publishCrop`/`listZones`/`listPests` sont les fonctions existantes. Les types `PhenologicalStage`/`NutrientRequirement`/`YieldReference`/`Zone`/`Pest` existent déjà dans `api.ts`. Le prop `zones`/`pests` (`{ id, name }[]`) correspond aux types `Zone`/`Pest` existants (qui ont `id` + `name: string`). ✅

**Note de câblage :** les Tasks 3-8 modifient toutes `page.tsx` de façon additive (un import + un composant dans la bonne section). Le `Promise.all` de fetch est étendu en Task 7 (zones) puis Task 8 (pests) — l'ordre de destructuration `[crop, history, zones, pests]` doit rester cohérent.

---

## Vérification manuelle (post-implémentation)
Avec l'API à jour sur `:3001` (`pnpm --filter @okko/api start:dev`) et l'admin sur `:3000` :
1. Créer une culture, ouvrir son détail.
2. Publier ; renseigner climat/sol ; ajouter variété, prix, fenêtre (avec opérations) ; ajouter stades phéno / besoins nutritifs / rendements.
3. Créer une zone (`/zones`) et un ravageur (`/pests`), revenir sur la fiche, les rattacher.
4. Confirmer qu'après chaque action la donnée apparaît (`router.refresh()`) et que le **pourcentage de complétude** grimpe.
