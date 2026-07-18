# Fiche Culture — prix rattachés à une forme + débouchés structurés — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rattacher chaque relevé de prix à une forme commercialisée (code `PRODUCT_FORM`), transformer l'unité de prix en code `SALE_UNIT`, structurer les débouchés en codes, et passer selects + dates de l'admin aux composants shadcn.

**Architecture:** API NestJS hexagonale event-sourcée (agrégat `Crop`, VO `PricePoint` séparé + repo + table). Admin Next.js 14 (Server Actions, éditeurs client recevant les données depuis la page serveur). Le couplage prix↔forme (« modèle A ») vit dans l'UX (selects pilotés par la commercialisation déclarée) ; côté domaine `form` est un champ requis structuré, sans validation d'enum serveur.

**Tech Stack:** TypeScript, NestJS 10, Prisma 5/Postgres, Jest ; Next.js 14, shadcn/ui (Select, Calendar, Popover, Badge), Vitest.

## Global Constraints

- `PricePoint` (VO, snapshot, event, colonne DB, use-cases, contrôleur, admin) gagne `form: string` **requis** (code `PRODUCT_FORM`). Le champ `unit` **n'est pas renommé** ; sa valeur devient un code `SALE_UNIT` (contrainte par l'UI).
- **Pas** de validation serveur de l'appartenance de `form` aux formes déclarées (YAGNI, client admin unique). Les specs prix existantes ajoutent simplement `form: 'GRAIN'` à leurs entrées.
- Migration Prisma **manuelle** (comme les précédentes du dépôt) : `ALTER TABLE "PricePoint" ADD COLUMN "form" TEXT;` (nullable). Repo `toSnapshot` : `form: row.form ?? 'GRAIN'`.
- `OUTLET_LABELS` (codes de canal) — valeurs FR exactes : `SELF_CONSUMPTION: 'Autoconsommation'`, `LOCAL_MARKET: 'Marché local'`, `WHOLESALER: 'Grossiste / collecteur'`, `PROCESSOR: 'Transformateur'`, `EXPORT: 'Export'`, `COOPERATIVE: 'Coopérative / groupement'`.
- Selects → shadcn `Select` (`@/components/ui/select`). Dates de période → shadcn `Calendar` dans `Popover`. Réutiliser `PRODUCT_FORM_LABELS`/`SALE_UNIT_LABELS`.
- Pas de nouvelle catégorie de complétude. Clean architecture + TDD (test rouge d'abord).
- Chaque commit se termine par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: API — `PricePoint` gagne `form`

**Files:**
- Modify: `apps/api/src/domain/price/price-point.ts`
- Test: `apps/api/src/domain/price/price-point.spec.ts`
- Modify: `apps/api/src/application/price/add-price-point.use-case.ts`
- Modify: `apps/api/src/application/price/update-price-point.use-case.ts`
- Test: `apps/api/src/application/price/add-price-point.use-case.spec.ts`, `apps/api/src/application/price/update-price-point.use-case.spec.ts`
- Modify: `apps/api/prisma/schema.prisma` + Create migration `apps/api/prisma/migrations/20260718160000_pricepoint_form/migration.sql`
- Modify: `apps/api/src/infrastructure/price/prisma-price-point.repository.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (bodies POST/PUT `/crops/:id/prices`)
- Test: `apps/api/src/application/crop/crop-diff.spec.ts`

**Interfaces:**
- Consumes: `PricePointSnapshot` (existant), `Crop` events `PricePointAdded/Updated`.
- Produces: `PricePointSnapshot` gagne `form: string` ; `AddPricePointInput`/`UpdatePricePointInput` gagnent `form: string`.

- [ ] **Step 1: Test rouge — round-trip `form` dans le VO.** Dans `price-point.spec.ts`, ajouter `form: 'GRAIN'` à `base()` (l'objet passé à `PricePoint.create`), et deux assertions :

```ts
  it('porte la forme (code PRODUCT_FORM)', () => {
    expect(base().form).toBe('GRAIN');
  });

  it('round-trips form through snapshot', () => {
    const restored = PricePoint.fromSnapshot(base().toSnapshot());
    expect(restored.form).toBe('GRAIN');
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec.** Run: `cd apps/api && npx jest price-point.spec.ts`. Expected: FAIL (`form` n'existe pas sur `CreateProps`/`PricePoint`).

- [ ] **Step 3: Implémenter `form` dans le VO.** Dans `price-point.ts` : ajouter `form: string;` à `PricePointSnapshot` (après `id`/`cropId`, avant `market`) et à `CreateProps` ; ajouter `private readonly _form: string,` au constructeur ; passer `props.form` dans `create` ; ajouter `get form(): string { return this._form; }` ; inclure `form: this._form` dans `toSnapshot()` ; passer `s.form` dans `fromSnapshot`. Ordre des paramètres du constructeur : insérer `_form` juste après `_cropId`.

```ts
export interface PricePointSnapshot {
  id: string;
  cropId: string;
  form: string;
  market: string;
  periodStart: string;
  periodEnd: string;
  price: number;
  unit: string;
  currency: string;
}
```
Le constructeur et `create`/`fromSnapshot` suivent le même ordre : `(id, cropId, form, market, periodStart, periodEnd, price, unit, currency)`.

- [ ] **Step 4: Vérifier le VO vert.** Run: `cd apps/api && npx jest price-point.spec.ts`. Expected: PASS.

- [ ] **Step 5: Test rouge — use-cases acceptent et persistent `form`.** Dans `add-price-point.use-case.spec.ts` : ajouter `form: 'GRAIN'` à **chaque** appel `.execute({...})` existant (4 appels). Ajouter un test dédié :

```ts
  it('persiste la forme', async () => {
    const { events, prices, audit } = await setup();
    const out = await new AddPricePointUseCase(events, prices, audit, clock, ids).execute({
      cropId: 'c1', form: 'OIL', market: 'Dantokpa', periodStart: '2026-06-01',
      price: 900, unit: 'KG', currency: 'XOF', actor: 'a',
    });
    expect(out.form).toBe('OIL');
  });
```
Dans `update-price-point.use-case.spec.ts` : ajouter `form: 'GRAIN'` à chaque `.execute({...})` existant, et si un test lit le snapshot retourné, ajouter une assertion `expect(out.form).toBe('GRAIN')` (ou `'OIL'` selon l'entrée).

- [ ] **Step 6: Lancer, vérifier l'échec.** Run: `cd apps/api && npx jest price-point.use-case`. Expected: FAIL (type `form` absent de l'input / non retourné).

- [ ] **Step 7: Implémenter `form` dans les use-cases.** Dans `add-price-point.use-case.ts` : ajouter `form: string;` à `AddPricePointInput` (après `id?`) ; passer `form: input.form` dans `PricePoint.create({...})`. Dans `update-price-point.use-case.ts` : ajouter `form: string;` à `UpdatePricePointInput` (après `priceId`) ; passer `form: input.form` dans `PricePoint.create({...})`.

- [ ] **Step 8: Vérifier les use-cases verts.** Run: `cd apps/api && npx jest price-point.use-case`. Expected: PASS.

- [ ] **Step 9: Contrôleur — bodies prix gagnent `form`.** Dans `crop.controller.ts`, aux endpoints `POST /crops/:id/prices` et `PUT /crops/:id/prices/:priceId` : ajouter `form: string;` au type `@Body()` inline (après l'ouverture de l'objet) et passer `form: body.form` dans l'appel `.execute({...})` de chaque handler.

- [ ] **Step 10: Migration Prisma — colonne `form`.** Dans `schema.prisma`, modèle `PricePoint` : ajouter `form String?` juste après `cropId String`. Créer `apps/api/prisma/migrations/20260718160000_pricepoint_form/migration.sql` :

```sql
ALTER TABLE "PricePoint" ADD COLUMN "form" TEXT;
```
Appliquer manuellement (le repo ne peut pas utiliser `prisma migrate dev` interactif) :
```bash
cd apps/api
npx prisma db execute --file prisma/migrations/20260718160000_pricepoint_form/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260718160000_pricepoint_form
npx prisma generate
npx prisma migrate status
```
Expected: `migrate status` → « Database schema is up to date! ».

- [ ] **Step 11: Repo — mapper `form`.** Dans `prisma-price-point.repository.ts` : dans `toRow`, ajouter `form: p.form,` (après `cropId`) ; dans `toSnapshot`, ajouter `form: row.form ?? 'GRAIN',` (après `cropId`).

- [ ] **Step 12: Test rouge — le diff remonte un changement de `form`.** Dans `crop-diff.spec.ts`, ajouter :

```ts
  it('prix — changement de forme (même id) -> changed', () => {
    const p = (form: string) => ({ id: 'pp1', cropId: 'c1', form, market: 'M', periodStart: '2026-06-01', periodEnd: '2026-06-01', price: 300, unit: 'KG', currency: 'XOF' } as any);
    const d = diffCropDocuments(1, 2, doc({ prices: [p('GRAIN')] }), doc({ prices: [p('OIL')] }));
    expect(d.sections).toEqual([{ section: 'prices', added: [], removed: [],
      changed: [{ key: 'pp1', before: p('GRAIN'), after: p('OIL'), fields: [{ field: 'form', before: 'GRAIN', after: 'OIL' }] }] }]);
  });
```

- [ ] **Step 13: Lancer.** Run: `cd apps/api && npx jest crop-diff.spec.ts`. Expected: PASS (aucun changement de code : `prices` est déjà une section à clé `id` et `diffObjectFields` compare toutes les clés — ce test verrouille le comportement).

- [ ] **Step 14: Non-régression + typecheck.** Run: `cd apps/api && npx tsc --noEmit` puis `npx jest price crop-diff`. Expected: aucune erreur de type ; suites vertes.

- [ ] **Step 15: Commit.**

```bash
git add apps/api
git commit -m "feat(price): relevé de prix rattaché à une forme (code PRODUCT_FORM)"
```

---

### Task 2: Admin — éditeur prix (forme + unité couplées à la commercialisation, calendrier shadcn)

**Files:**
- Create: `apps/admin/src/components/shadcn-date-picker.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`
- Modify: `apps/admin/src/lib/api.ts` (interface `PricePoint`)
- Modify: `apps/admin/src/lib/actions.ts` (bodies `addPrice`/`updatePrice`)
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (passer `commercialization` au `PriceEditor`)
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx`, `apps/admin/src/app/crops/[id]/FicheClientView.tsx` (affichage forme + unité)

**Interfaces:**
- Consumes: `CommercializationProduct` (`@/lib/api`), `PRODUCT_FORM_LABELS`/`SALE_UNIT_LABELS` (`@/lib/labels`), shadcn `Calendar`/`Popover`/`Select`.
- Produces: `PriceEditor` prend une prop `commercialization: CommercializationProduct[]`.

- [ ] **Step 1: Composant date-picker shadcn.** Créer `apps/admin/src/components/shadcn-date-picker.tsx` (même interface `{ value, onChange, id? }` que l'ancien, drop-in) :

```tsx
'use client';
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function labelFr(iso: string): string {
  if (!iso) return 'Choisir…';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ShadcnDatePicker({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" size="sm" className="w-36 justify-start font-normal">
          {labelFr(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isoToDate(value)}
          onSelect={(d?: Date) => { if (d) onChange(dateToIso(d)); setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: `lib/api.ts` — `PricePoint.form`.** Ajouter `form: string;` à l'interface `PricePoint` (après `cropId`).

- [ ] **Step 3: `lib/actions.ts` — bodies gagnent `form`.** Dans `addPrice` et `updatePrice`, ajouter `form: string;` au type `body` (après l'accolade ouvrante). Le corps de fonction (fetch) est inchangé (il transmet `body` tel quel).

- [ ] **Step 4: `PriceEditor.tsx` — refonte.** Remplacer le contenu par la version couplée. Points clés : prop `commercialization` ; garde si vide ; select forme (formes déclarées distinctes) ; select unité (saleUnits de la forme choisie, réinitialisé au changement de forme) ; `ShadcnDatePicker` pour les dates ; `currency` reste un `<Input>`.

```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ShadcnDatePicker } from '@/components/shadcn-date-picker';
import { PRODUCT_FORM_LABELS, SALE_UNIT_LABELS } from '@/lib/labels';
import { addPrice, updatePrice } from '@/lib/actions';
import type { CommercializationProduct } from '@/lib/api';

interface PriceInitial {
  id: string;
  form: string;
  market: string;
  periodStart: string;
  periodEnd: string;
  price: number;
  unit: string;
  currency: string;
}

export function PriceEditor({ cropId, commercialization, initial }: {
  cropId: string;
  commercialization: CommercializationProduct[];
  initial?: PriceInitial;
}) {
  const editing = !!initial;
  const forms = Array.from(new Set(commercialization.map((p) => p.form)));
  const unitsFor = (f: string) => Array.from(new Set(commercialization.filter((p) => p.form === f).flatMap((p) => p.saleUnits)));

  const [form, setForm] = useState(initial?.form ?? forms[0] ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? unitsFor(initial?.form ?? forms[0] ?? '')[0] ?? '');
  const [market, setMarket] = useState(initial?.market ?? '');
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'XOF');

  function onFormChange(f: string) {
    setForm(f);
    setUnit(unitsFor(f)[0] ?? '');
  }

  if (commercialization.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Déclare d'abord la commercialisation (au moins une forme) pour saisir des prix.
      </p>
    );
  }

  const units = unitsFor(form);

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un relevé de prix'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!periodStart || !form || !unit) return;
            const body = { form, market, periodStart, periodEnd: periodEnd || undefined, price: Number(price), unit, currency };
            submit(async () => {
              if (editing) {
                await updatePrice(cropId, initial!.id, body);
              } else {
                await addPrice(cropId, body);
                setMarket(''); setPeriodStart(''); setPeriodEnd(''); setPrice('');
                setForm(forms[0] ?? ''); setUnit(unitsFor(forms[0] ?? '')[0] ?? ''); setCurrency('XOF');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Forme *</Label>
              <Select value={form} onValueChange={onFormChange}>
                <SelectTrigger><SelectValue placeholder="Forme" /></SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f} value={f}>{PRODUCT_FORM_LABELS[f] ?? f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>Unité *</Label>
              <Select value={unit} onValueChange={setUnit} disabled={units.length === 0}>
                <SelectTrigger><SelectValue placeholder="Unité" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{SALE_UNIT_LABELS[u] ?? u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="price-market">Marché *</Label>
              <Input id="price-market" placeholder="ex. Dantokpa" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Début *</Label>
              <ShadcnDatePicker value={periodStart} onChange={setPeriodStart} />
            </div>
            <div className="space-y-1">
              <Label>Fin (optionnelle)</Label>
              <ShadcnDatePicker value={periodEnd} onChange={setPeriodEnd} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Prix & devise</Label>
            <div className="flex gap-1">
              <Input className="w-28" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
              <Input className="w-20" placeholder="devise" value={currency} onChange={(e)=>setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 5: `page.tsx` — passer `commercialization`.** Aux deux points de rendu du `PriceEditor` (add + edit, autour des lignes 244-259), ajouter la prop `commercialization={crop.commercialization ?? []}`. Exemple : `<PriceEditor cropId={params.id} commercialization={crop.commercialization ?? []} />` et pour l'édition `<PriceEditor cropId={params.id} commercialization={crop.commercialization ?? []} initial={p} />`.

- [ ] **Step 6: Vues lecture — afficher forme + unité en libellé.** Lire `CropReadView.tsx` (prix ~lignes 112-119) et `FicheClientView.tsx` (prix ~lignes 92-96). Dans chaque ligne de prix, préfixer la forme et libeller l'unité via les helpers déjà utilisés dans ces fichiers (`labelOf(PRODUCT_FORM_LABELS, p.form)` et `labelOf(SALE_UNIT_LABELS, p.unit)`). Rendu cible d'une ligne, p.ex. : `{labelOf(PRODUCT_FORM_LABELS, p.form)} — {p.price} {p.currency}/{labelOf(SALE_UNIT_LABELS, p.unit)} @ {p.market} ({période})`. Importer `PRODUCT_FORM_LABELS`/`SALE_UNIT_LABELS` si absents. Conserver le repli brut de `labelOf` pour les codes inconnus (anciennes lignes).

- [ ] **Step 7: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 8: Commit.**

```bash
git add apps/admin
git commit -m "feat(admin): éditeur prix — forme + unité couplées à la commercialisation, dates shadcn"
```

---

### Task 3: Admin — débouchés structurés (codes + select shadcn)

**Files:**
- Modify: `apps/admin/src/lib/labels.ts` (ajouter `OUTLET_LABELS`)
- Modify: `apps/admin/src/app/crops/[id]/editors/CommercializationEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx`, `apps/admin/src/app/crops/[id]/FicheClientView.tsx`

**Interfaces:**
- Consumes: `OUTLET_LABELS`, shadcn `Select`, `Badge`.
- Produces: néant (admin uniquement ; VO `CommercializationProduct` inchangé).

- [ ] **Step 1: `lib/labels.ts` — `OUTLET_LABELS`.** Ajouter, à côté de `SALE_UNIT_LABELS` :

```ts
export const OUTLET_LABELS: Record<string, string> = {
  SELF_CONSUMPTION: 'Autoconsommation',
  LOCAL_MARKET: 'Marché local',
  WHOLESALER: 'Grossiste / collecteur',
  PROCESSOR: 'Transformateur',
  EXPORT: 'Export',
  COOPERATIVE: 'Coopérative / groupement',
};
```

- [ ] **Step 2: `CommercializationEditor.tsx` — débouchés en select + badges.** Remplacer l'état et le bloc « Débouchés » (texte libre) par une sélection de codes. Modifications :
  - Import : ajouter `Badge` (`@/components/ui/badge`) et `OUTLET_LABELS` (`@/lib/labels`).
  - État : `const [outlets, setOutlets] = useState<string[]>(initial?.outlets ?? []);` (retirer le `['']` par défaut et les fonctions `addOutlet`/`removeOutlet`/`updateOutlet`).
  - Ajouter :

```tsx
  const availableOutlets = Object.keys(OUTLET_LABELS).filter((c) => !outlets.includes(c));
  function addOutlet(code: string) { setOutlets((prev) => (prev.includes(code) ? prev : [...prev, code])); }
  function removeOutlet(code: string) { setOutlets((prev) => prev.filter((c) => c !== code)); }
```
  - À la soumission (`nouvelItem`), remplacer `outlets: outlets.map((o) => o.trim()).filter(Boolean)` par `outlets`.
  - À la réinitialisation après ajout (`if (!editing) {...}`), remplacer `setOutlets([''])` par `setOutlets([])`.
  - Remplacer le JSX du bloc « Débouchés » par :

```tsx
          <div className="space-y-2">
            <Label>Débouchés</Label>
            <div className="flex flex-wrap gap-2">
              {outlets.map((code) => (
                <Badge key={code} variant="secondary" className="cursor-pointer" onClick={() => removeOutlet(code)}>
                  {OUTLET_LABELS[code] ?? code} ✕
                </Badge>
              ))}
              {outlets.length === 0 && <span className="text-xs text-muted-foreground">Aucun débouché</span>}
            </div>
            {availableOutlets.length > 0 && (
              <Select value="" onValueChange={addOutlet}>
                <SelectTrigger className="w-56"><SelectValue placeholder="+ Ajouter un débouché" /></SelectTrigger>
                <SelectContent>
                  {availableOutlets.map((code) => (
                    <SelectItem key={code} value={code}>{OUTLET_LABELS[code]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
```

- [ ] **Step 3: Vues lecture — débouchés en libellé.** Dans `CropReadView.tsx` (commercialisation ~lignes 121-134) et `FicheClientView.tsx` (~lignes 98-108), remplacer l'affichage brut des `outlets` par leur libellé via `labelOf(OUTLET_LABELS, o)` (importer `OUTLET_LABELS`). Ex. : `p.outlets.map((o) => labelOf(OUTLET_LABELS, o)).join(', ')`. Conserver le repli brut pour les codes inconnus (anciens textes libres).

- [ ] **Step 4: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 5: Commit.**

```bash
git add apps/admin
git commit -m "feat(admin): débouchés commercialisation en codes (select shadcn + badges)"
```

---

### Task 4: Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1: Suite API complète.** ⚠️ **efface la DB dev.** Run: `pnpm --filter @okko/api test`. Expected: toutes suites vertes.
- [ ] **Step 2: `migrate status`.** Run: `cd apps/api && npx prisma migrate status`. Expected: « up to date ».
- [ ] **Step 3: Admin.** Run: `cd apps/admin && pnpm test && npx tsc --noEmit && pnpm build`. Expected: verts + « Compiled successfully ».
- [ ] **Step 4: Smoke manuel (à relayer à l'utilisateur).** Déclarer commercialisation (grain: kg/sac + débouchés grossiste/export) → ajouter un prix (le select forme propose grain ; l'unité suit ; dates via calendrier shadcn) → publier → vérifier diff (forme visible) + affichage lecture.
