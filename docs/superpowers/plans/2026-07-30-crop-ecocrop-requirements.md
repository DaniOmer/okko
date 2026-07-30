# Brique « exigences ECOCROP » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la fiche Culture les descripteurs écologiques ECOCROP manquants — photopériode + jour critique (climat), profondeur de sol + fertilité requise + tolérance à la salinité + drainage câblé (sol).

**Architecture:** Extension **additive** des value objects partagés `ClimaticRequirements` / `EdaphicRequirements` (sérialisés en bloc dans les colonnes `Json?` `Crop.climatic`/`Crop.edaphic`). Le use-case (`SetCropRequirementsUseCase`, full-replace via `fromJSON`) et le contrôleur (`PATCH :id/requirements`, typé par les interfaces JSON) restent inchangés. Côté admin : nouveaux libellés, extension des types TS, éditeur, et deux vues de lecture.

**Tech Stack:** NestJS + TypeScript (API, event-sourced Crop), Jest ; Next.js + React + shadcn/ui (admin).

## Global Constraints

- **Aucune migration Prisma** : `Crop.climatic`/`Crop.edaphic` sont des colonnes `Json?`.
- **Ne pas modifier** `SetCropRequirementsUseCase` (impl) ni `crop.controller.ts`.
- Champs quantitatifs = `RangeValue` `{ min, optimal, max, unit }` avec `min ≤ optimal ≤ max`.
- Champs qualitatifs = enum `string` (codes en MAJUSCULES), rendus via `Select` shadcn + `labelOf`.
- Enums (verbatim) :
  - `photoperiodResponse` : `DAY_NEUTRAL` | `SHORT_DAY` | `LONG_DAY`
  - `fertilityRequirement` : `LOW` | `MEDIUM` | `HIGH` (réutilise `FERTILITY_LABELS`)
  - `salinityTolerance` : `SENSITIVE` | `MODERATELY_TOLERANT` | `TOLERANT`
  - `drainage` : `POOR` | `MODERATE` | `WELL` | `EXCESSIVE`
  - Unités : `criticalDayLength` → `'h'`, `soilDepth` → `'cm'`.
- Gate de fin de tâche back : `cd apps/api && npx tsc --noEmit` vert + tests Jest concernés verts.
- Gate de fin de tâche front : `cd apps/admin && npx tsc --noEmit` vert.

---

### Task 1: Domaine — `ClimaticRequirements` (+ photopériode)

**Files:**
- Modify: `apps/api/src/domain/shared/climatic-requirements.ts`
- Test: `apps/api/src/domain/shared/climatic-requirements.spec.ts`

**Interfaces:**
- Consumes: `RangeValue` (`apps/api/src/domain/shared/range-value.ts`).
- Produces: `ClimaticRequirementsJSON` gagne `photoperiodResponse?: string` et `criticalDayLength?: { min; optimal; max; unit }` ; getters `photoperiodResponse`, `criticalDayLength` sur `ClimaticRequirements`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter ce `describe` à la fin de `apps/api/src/domain/shared/climatic-requirements.spec.ts` :

```ts
describe('ClimaticRequirements — photopériode (ECOCROP)', () => {
  it('round-trip conserve photoperiodResponse + criticalDayLength', () => {
    const c = ClimaticRequirements.create({
      photoperiodResponse: 'SHORT_DAY',
      criticalDayLength: RangeValue.create({ min: 11, optimal: 12, max: 13, unit: 'h' }),
    });
    const json = c.toJSON();
    expect(json.photoperiodResponse).toBe('SHORT_DAY');
    expect(json.criticalDayLength).toEqual({ min: 11, optimal: 12, max: 13, unit: 'h' });
    const back = ClimaticRequirements.fromJSON(json);
    expect(back.photoperiodResponse).toBe('SHORT_DAY');
    expect(back.criticalDayLength?.optimal).toBe(12);
  });
  it('champs photopériode absents → undefined', () => {
    const json = ClimaticRequirements.create({}).toJSON();
    expect(json.photoperiodResponse).toBeUndefined();
    expect(json.criticalDayLength).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer le test — vérifier l'échec**

Run: `cd apps/api && npx jest climatic-requirements -t photopériode`
Expected: FAIL (compilation — `photoperiodResponse`/`criticalDayLength` n'existent pas).

- [ ] **Step 3: Implémenter les 2 champs**

Dans `apps/api/src/domain/shared/climatic-requirements.ts` :

Dans `interface ClimaticProps`, après `droughtSensitivity?: string;` ajouter :
```ts
  photoperiodResponse?: string;
  criticalDayLength?: RangeValue;
```

Dans `interface ClimaticRequirementsJSON`, après `droughtSensitivity?: string;` ajouter :
```ts
  photoperiodResponse?: string;
  criticalDayLength?: ReturnType<RangeValue['toJSON']>;
```

Après le getter `droughtSensitivity`, ajouter :
```ts
  get photoperiodResponse(): string | undefined { return this.props.photoperiodResponse; }
  get criticalDayLength(): RangeValue | undefined { return this.props.criticalDayLength; }
```

Dans `toJSON()`, après `droughtSensitivity: this.props.droughtSensitivity,` ajouter :
```ts
      photoperiodResponse: this.props.photoperiodResponse,
      criticalDayLength: this.props.criticalDayLength?.toJSON(),
```

Dans `fromJSON()`, après `droughtSensitivity: json.droughtSensitivity,` ajouter :
```ts
      photoperiodResponse: json.photoperiodResponse,
      criticalDayLength: json.criticalDayLength ? RangeValue.create(json.criticalDayLength) : undefined,
```

- [ ] **Step 4: Lancer le test — vérifier le succès**

Run: `cd apps/api && npx jest climatic-requirements`
Expected: PASS (tous les `it`, anciens + nouveaux).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/shared/climatic-requirements.ts apps/api/src/domain/shared/climatic-requirements.spec.ts
git commit -m "feat(crop): ClimaticRequirements — photopériode + jour critique (ECOCROP)"
```

---

### Task 2: Domaine — `EdaphicRequirements` (+ profondeur, fertilité, salinité)

**Files:**
- Modify: `apps/api/src/domain/shared/edaphic-requirements.ts`
- Test: `apps/api/src/domain/shared/edaphic-requirements.spec.ts`

**Interfaces:**
- Consumes: `RangeValue`.
- Produces: `EdaphicRequirementsJSON` gagne `soilDepth?: { min; optimal; max; unit }`, `fertilityRequirement?: string`, `salinityTolerance?: string` (le `drainage?: string` existe déjà) ; getters correspondants.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter ce `describe` à la fin de `apps/api/src/domain/shared/edaphic-requirements.spec.ts` :

```ts
describe('EdaphicRequirements — profondeur / fertilité / salinité (ECOCROP)', () => {
  it('round-trip conserve soilDepth, fertilityRequirement, salinityTolerance', () => {
    const e = EdaphicRequirements.create({
      soilDepth: RangeValue.create({ min: 60, optimal: 100, max: 150, unit: 'cm' }),
      fertilityRequirement: 'MEDIUM',
      salinityTolerance: 'SENSITIVE',
    });
    const json = e.toJSON();
    expect(json.soilDepth).toEqual({ min: 60, optimal: 100, max: 150, unit: 'cm' });
    expect(json.fertilityRequirement).toBe('MEDIUM');
    expect(json.salinityTolerance).toBe('SENSITIVE');
    const back = EdaphicRequirements.fromJSON(json);
    expect(back.soilDepth?.optimal).toBe(100);
    expect(back.fertilityRequirement).toBe('MEDIUM');
    expect(back.salinityTolerance).toBe('SENSITIVE');
  });
  it('champs absents → undefined', () => {
    const json = EdaphicRequirements.create({}).toJSON();
    expect(json.soilDepth).toBeUndefined();
    expect(json.fertilityRequirement).toBeUndefined();
    expect(json.salinityTolerance).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer le test — vérifier l'échec**

Run: `cd apps/api && npx jest edaphic-requirements -t ECOCROP`
Expected: FAIL (compilation — champs inexistants).

- [ ] **Step 3: Implémenter les 3 champs**

Dans `apps/api/src/domain/shared/edaphic-requirements.ts` :

Dans `interface EdaphicProps`, après `drainage?: string;` ajouter :
```ts
  soilDepth?: RangeValue;
  fertilityRequirement?: string;
  salinityTolerance?: string;
```

Dans `interface EdaphicRequirementsJSON`, après `drainage?: string;` ajouter :
```ts
  soilDepth?: ReturnType<RangeValue['toJSON']>;
  fertilityRequirement?: string;
  salinityTolerance?: string;
```

Après le getter `drainage`, ajouter :
```ts
  get soilDepth(): RangeValue | undefined { return this.props.soilDepth; }
  get fertilityRequirement(): string | undefined { return this.props.fertilityRequirement; }
  get salinityTolerance(): string | undefined { return this.props.salinityTolerance; }
```

Dans `toJSON()`, après `drainage: this.props.drainage,` ajouter :
```ts
      soilDepth: this.props.soilDepth?.toJSON(),
      fertilityRequirement: this.props.fertilityRequirement,
      salinityTolerance: this.props.salinityTolerance,
```

Dans `fromJSON()`, après `drainage: json.drainage,` ajouter :
```ts
      soilDepth: json.soilDepth ? RangeValue.create(json.soilDepth) : undefined,
      fertilityRequirement: json.fertilityRequirement,
      salinityTolerance: json.salinityTolerance,
```

- [ ] **Step 4: Lancer le test — vérifier le succès**

Run: `cd apps/api && npx jest edaphic-requirements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/shared/edaphic-requirements.ts apps/api/src/domain/shared/edaphic-requirements.spec.ts
git commit -m "feat(crop): EdaphicRequirements — profondeur, fertilité requise, tolérance salinité (ECOCROP)"
```

---

### Task 3: Persistance bout-en-bout via le use-case (test)

**Files:**
- Test: `apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts`

**Interfaces:**
- Consumes: `SetCropRequirementsUseCase.execute` (inchangé), champs JSON produits par Task 1 & 2.
- Produces: aucun code de prod ; prouve que les nouveaux champs transitent use-case → repo → relecture.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter ce `it` dans le `describe('SetCropRequirementsUseCase', …)` de
`apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts` :

```ts
  it('persiste les champs ECOCROP (photopériode, profondeur, fertilité, salinité, drainage)', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const uc = new SetCropRequirementsUseCase(events, repo, audit, clock);
    const out = await uc.execute({
      id: 'c1', actor: 'a',
      climatic: { photoperiodResponse: 'SHORT_DAY', criticalDayLength: { min: 11, optimal: 12, max: 13, unit: 'h' } },
      edaphic: {
        soilDepth: { min: 60, optimal: 100, max: 150, unit: 'cm' },
        fertilityRequirement: 'MEDIUM', salinityTolerance: 'SENSITIVE', drainage: 'WELL',
      },
    });
    expect(out.climatic?.photoperiodResponse).toBe('SHORT_DAY');
    expect(out.climatic?.criticalDayLength?.optimal).toBe(12);
    expect(out.edaphic?.soilDepth?.optimal).toBe(100);
    expect(out.edaphic?.fertilityRequirement).toBe('MEDIUM');
    expect(out.edaphic?.salinityTolerance).toBe('SENSITIVE');
    expect(out.edaphic?.drainage).toBe('WELL');
    const reloaded = await repo.findById('c1');
    expect(reloaded?.edaphic?.salinityTolerance).toBe('SENSITIVE');
    expect(reloaded?.climatic?.photoperiodResponse).toBe('SHORT_DAY');
  });
```

- [ ] **Step 2: Lancer le test — vérifier le succès direct**

Run: `cd apps/api && npx jest set-crop-requirements`
Expected: PASS. (Le use-case étant générique — `fromJSON`/`toJSON` — les champs ajoutés en Task 1 & 2 passent sans changement de prod. Si ce test échoue, c'est que Task 1 ou 2 est incomplète.)

- [ ] **Step 3: Type-check API global**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune sortie (OK).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts
git commit -m "test(crop): persistance bout-en-bout des exigences ECOCROP"
```

---

### Task 4: Admin — libellés + types TS (plomberie)

**Files:**
- Modify: `apps/admin/src/lib/labels.ts`
- Modify: `apps/admin/src/lib/api.ts` (interface `Crop`, blocs `climatic`/`edaphic`, ~lignes 144-149)
- Modify: `apps/admin/src/lib/actions.ts` (body de `setRequirements`, ~lignes 59-66)

**Interfaces:**
- Produces (labels) : `PHOTOPERIOD_RESPONSE_LABELS`, `SALINITY_TOLERANCE_LABELS`, `DRAINAGE_LABELS` (`FERTILITY_LABELS` existe déjà).
- Produces (types) : `Crop.climatic` gagne `photoperiodResponse?`, `criticalDayLength?` ; `Crop.edaphic` gagne `drainage?`, `soilDepth?`, `fertilityRequirement?`, `salinityTolerance?`. Body `setRequirements` : mêmes ajouts.

- [ ] **Step 1: Ajouter les 3 maps de libellés**

Dans `apps/admin/src/lib/labels.ts`, juste après la ligne
`export const FERTILITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };`
ajouter :

```ts
export const PHOTOPERIOD_RESPONSE_LABELS: Record<string, string> = {
  DAY_NEUTRAL: 'Indifférente (jour-neutre)', SHORT_DAY: 'Jour court', LONG_DAY: 'Jour long',
};
export const SALINITY_TOLERANCE_LABELS: Record<string, string> = {
  SENSITIVE: 'Sensible', MODERATELY_TOLERANT: 'Moyennement tolérante', TOLERANT: 'Tolérante',
};
export const DRAINAGE_LABELS: Record<string, string> = {
  POOR: 'Mauvais (hydromorphe)', MODERATE: 'Modéré', WELL: 'Bon (drainant)', EXCESSIVE: 'Excessif',
};
```

- [ ] **Step 2: Étendre le type `Crop` (api.ts)**

Dans `apps/admin/src/lib/api.ts`, remplacer le bloc `climatic?`/`edaphic?` (≈ lignes 144-149) par :

```ts
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string };
               altitude?: { min: number; optimal: number; max: number; unit: string };
               waterNeed?: string;
               droughtSensitivity?: string;
               photoperiodResponse?: string;
               criticalDayLength?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string };
              texture?: string;
              drainage?: string;
              soilDepth?: { min: number; optimal: number; max: number; unit: string };
              fertilityRequirement?: string;
              salinityTolerance?: string };
```

- [ ] **Step 3: Étendre le body de `setRequirements` (actions.ts)**

Dans `apps/admin/src/lib/actions.ts`, remplacer le paramètre `body` de `setRequirements` (≈ lignes 59-66) par :

```ts
export async function setRequirements(cropId: string, body: {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string };
               altitude?: { min: number; optimal: number; max: number; unit: string };
               waterNeed?: string;
               droughtSensitivity?: string;
               photoperiodResponse?: string;
               criticalDayLength?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string };
              texture?: string;
              drainage?: string;
              soilDepth?: { min: number; optimal: number; max: number; unit: string };
              fertilityRequirement?: string;
              salinityTolerance?: string };
}): Promise<unknown> {
```

(Garder le corps de la fonction — l'appel `authFetch(... 'PATCH', body)` — inchangé.)

- [ ] **Step 4: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune sortie (OK). Les types s'étendent sans casser les consommateurs existants.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/labels.ts apps/admin/src/lib/api.ts apps/admin/src/lib/actions.ts
git commit -m "feat(admin): libellés + types exigences ECOCROP (photopériode, profondeur, fertilité, salinité, drainage)"
```

---

### Task 5: Admin — éditeur `RequirementsEditor`

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx`

**Interfaces:**
- Consumes: `PHOTOPERIOD_RESPONSE_LABELS`, `FERTILITY_LABELS`, `DRAINAGE_LABELS`, `SALINITY_TOLERANCE_LABELS` (Task 4) ; `setRequirements` body étendu (Task 4).
- Produces: éditeur qui saisit les 6 nouveaux champs. **`page.tsx` reste inchangé** — il passe déjà `initial={{ climatic: crop.climatic, edaphic: crop.edaphic }}` (objets complets).

- [ ] **Step 1: Étendre l'import des libellés**

En haut de `RequirementsEditor.tsx`, remplacer :
```ts
import { WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS } from '@/lib/labels';
```
par :
```ts
import { WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS, PHOTOPERIOD_RESPONSE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SALINITY_TOLERANCE_LABELS } from '@/lib/labels';
```

- [ ] **Step 2: Étendre `RequirementsInitial`**

Remplacer l'interface `RequirementsInitial` par :
```ts
export interface RequirementsInitial {
  climatic?: { temperature?: Range; rainfall?: Range; altitude?: Range; waterNeed?: string; droughtSensitivity?: string; photoperiodResponse?: string; criticalDayLength?: Range };
  edaphic?: { ph?: Range; texture?: string; drainage?: string; soilDepth?: Range; fertilityRequirement?: string; salinityTolerance?: string };
}
```

- [ ] **Step 3: Ajouter les états**

Juste après `const [texture, setTexture] = useState(e?.texture ?? '');` ajouter :
```ts
  const [photoperiod, setPhotoperiod] = useState(c?.photoperiodResponse ?? '');
  const [cdlMin, setCdlMin] = useState(s(c?.criticalDayLength?.min)); const [cdlOpt, setCdlOpt] = useState(s(c?.criticalDayLength?.optimal)); const [cdlMax, setCdlMax] = useState(s(c?.criticalDayLength?.max));
  const [depthMin, setDepthMin] = useState(s(e?.soilDepth?.min)); const [depthOpt, setDepthOpt] = useState(s(e?.soilDepth?.optimal)); const [depthMax, setDepthMax] = useState(s(e?.soilDepth?.max));
  const [drainage, setDrainage] = useState(e?.drainage ?? '');
  const [fertility, setFertility] = useState(e?.fertilityRequirement ?? '');
  const [salinity, setSalinity] = useState(e?.salinityTolerance ?? '');
```

- [ ] **Step 4: Ajouter la construction du payload**

Dans le `onSubmit`, juste après la ligne
`if (texture) body.edaphic = { ...(body.edaphic ?? {}), texture };`
ajouter :
```ts
            if (photoperiod) body.climatic = { ...(body.climatic ?? {}), photoperiodResponse: photoperiod };
            if (cdlMin && cdlOpt && cdlMax) body.climatic = { ...(body.climatic ?? {}), criticalDayLength: { min: n(cdlMin), optimal: n(cdlOpt), max: n(cdlMax), unit: 'h' } };
            if (depthMin && depthOpt && depthMax) body.edaphic = { ...(body.edaphic ?? {}), soilDepth: { min: n(depthMin), optimal: n(depthOpt), max: n(depthMax), unit: 'cm' } };
            if (drainage) body.edaphic = { ...(body.edaphic ?? {}), drainage };
            if (fertility) body.edaphic = { ...(body.edaphic ?? {}), fertilityRequirement: fertility };
            if (salinity) body.edaphic = { ...(body.edaphic ?? {}), salinityTolerance: salinity };
```

- [ ] **Step 5: Ajouter les champs climat (photopériode + jour critique)**

Juste après le `<div className="space-y-1">` bloc « Sensibilité à la sécheresse » (celui du `Select` `droughtSensitivity`), ajouter :
```tsx
          <div className="space-y-1">
            <Label>Photopériode</Label>
            <Select value={photoperiod} onValueChange={setPhotoperiod}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PHOTOPERIOD_RESPONSE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Jour critique — min · optimal · max (h)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={cdlMin} onChange={(e)=>setCdlMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={cdlOpt} onChange={(e)=>setCdlOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={cdlMax} onChange={(e)=>setCdlMax(e.target.value)} />
            </div>
          </div>
```

- [ ] **Step 6: Ajouter les champs sol (profondeur, drainage, fertilité, salinité)**

Juste après le bloc « Texture du sol » (l'`Input` `texture`, avant le `<div className="flex justify-end gap-2 pt-2">`), ajouter :
```tsx
          <div className="space-y-1">
            <Label>Profondeur de sol — min · optimal · max (cm)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={depthMin} onChange={(e)=>setDepthMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={depthOpt} onChange={(e)=>setDepthOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={depthMax} onChange={(e)=>setDepthMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Drainage</Label>
            <Select value={drainage} onValueChange={setDrainage}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DRAINAGE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fertilité requise</Label>
            <Select value={fertility} onValueChange={setFertility}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FERTILITY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tolérance à la salinité</Label>
            <Select value={salinity} onValueChange={setSalinity}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(SALINITY_TOLERANCE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 7: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune sortie (OK).

- [ ] **Step 8: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx"
git commit -m "feat(admin): RequirementsEditor — saisie photopériode, profondeur, drainage, fertilité, salinité"
```

---

### Task 6: Admin — affichage dans les deux vues de lecture

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx` (vue admin, `DenseCard`)
- Modify: `apps/admin/src/app/crops/[id]/FicheClientView.tsx` (vue client, `Section`/`StatRange`)

**Interfaces:**
- Consumes: types `Crop` étendus (Task 4), maps de libellés (Task 4), composants existants `ToneBadge`, `StatRange`, `labelOf`.
- Produces: rendu lecture des 6 nouveaux champs, incl. mise à jour des gardes « bloc vide ».

- [ ] **Step 1: Importer les libellés dans `CropReadView.tsx`**

Dans l'import de `@/lib/labels` (ligne ~6, contenant déjà `WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS`), ajouter `PHOTOPERIOD_RESPONSE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SALINITY_TOLERANCE_LABELS`.

- [ ] **Step 2: Climat — garde + affichage (`CropReadView.tsx`)**

Dans la garde « vide » climatique, remplacer :
```tsx
          {!crop.climatic?.temperature && !crop.climatic?.rainfall && !crop.climatic?.altitude && !crop.climatic?.waterNeed && !crop.climatic?.droughtSensitivity
```
par :
```tsx
          {!crop.climatic?.temperature && !crop.climatic?.rainfall && !crop.climatic?.altitude && !crop.climatic?.waterNeed && !crop.climatic?.droughtSensitivity && !crop.climatic?.photoperiodResponse && !crop.climatic?.criticalDayLength
```

Juste après le bloc `altitude` (avant le `<div className="mt-1 flex flex-wrap gap-1">` des badges eau/sécheresse), ajouter le range jour critique :
```tsx
                {crop.climatic?.criticalDayLength && (
                  <div className="text-[12.5px] leading-snug">
                    Jour critique :{' '}
                    {crop.climatic.criticalDayLength.min}–
                    <strong className="text-[#245c27]">{crop.climatic.criticalDayLength.optimal}</strong>–
                    {crop.climatic.criticalDayLength.max}{' '}
                    {crop.climatic.criticalDayLength.unit}
                  </div>
                )}
```

Dans la condition d'ouverture du bloc badges, remplacer :
```tsx
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity) && (
```
par :
```tsx
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity || crop.climatic?.photoperiodResponse) && (
```
et à l'intérieur de ce bloc, après le badge `droughtSensitivity`, ajouter :
```tsx
                    {crop.climatic?.photoperiodResponse && (
                      <ToneBadge tone="neutral">
                        Photopériode : {labelOf(PHOTOPERIOD_RESPONSE_LABELS, crop.climatic.photoperiodResponse)}
                      </ToneBadge>
                    )}
```

- [ ] **Step 3: Sol — garde + affichage (`CropReadView.tsx`)**

Dans la garde « vide » édaphique, remplacer :
```tsx
          {!crop.edaphic?.ph && !crop.edaphic?.texture
```
par :
```tsx
          {!crop.edaphic?.ph && !crop.edaphic?.texture && !crop.edaphic?.soilDepth && !crop.edaphic?.drainage && !crop.edaphic?.fertilityRequirement && !crop.edaphic?.salinityTolerance
```

Juste après le bloc `texture` (à l'intérieur du `<div className="space-y-0.5">` édaphique), ajouter :
```tsx
                {crop.edaphic?.soilDepth && (
                  <div className="text-[12.5px] leading-snug">
                    Profondeur :{' '}
                    {crop.edaphic.soilDepth.min}–
                    <strong className="text-[#245c27]">{crop.edaphic.soilDepth.optimal}</strong>–
                    {crop.edaphic.soilDepth.max}{' '}
                    {crop.edaphic.soilDepth.unit}
                  </div>
                )}
                {(crop.edaphic?.drainage || crop.edaphic?.fertilityRequirement || crop.edaphic?.salinityTolerance) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {crop.edaphic?.drainage && (
                      <ToneBadge tone="neutral">Drainage : {labelOf(DRAINAGE_LABELS, crop.edaphic.drainage)}</ToneBadge>
                    )}
                    {crop.edaphic?.fertilityRequirement && (
                      <ToneBadge tone="neutral">Fertilité : {labelOf(FERTILITY_LABELS, crop.edaphic.fertilityRequirement)}</ToneBadge>
                    )}
                    {crop.edaphic?.salinityTolerance && (
                      <ToneBadge tone="neutral">Salinité : {labelOf(SALINITY_TOLERANCE_LABELS, crop.edaphic.salinityTolerance)}</ToneBadge>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Importer les libellés dans `FicheClientView.tsx`**

Dans l'import de `@/lib/labels` (ligne ~9), ajouter `PHOTOPERIOD_RESPONSE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SALINITY_TOLERANCE_LABELS`.

- [ ] **Step 5: Gardes + affichage (`FicheClientView.tsx`)**

Dans le calcul `has.exigences` (≈ lignes 121-123), remplacer :
```tsx
      crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity ||
      crop.edaphic?.ph || crop.edaphic?.texture
```
par :
```tsx
      crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity ||
      crop.climatic?.photoperiodResponse || crop.climatic?.criticalDayLength ||
      crop.edaphic?.ph || crop.edaphic?.texture ||
      crop.edaphic?.soilDepth || crop.edaphic?.drainage ||
      crop.edaphic?.fertilityRequirement || crop.edaphic?.salinityTolerance
```

Dans le bloc `Section`, étendre `hasClim` et `hasEdaph` :
```tsx
            const hasClim =
              crop.climatic?.temperature ||
              crop.climatic?.rainfall ||
              crop.climatic?.altitude ||
              crop.climatic?.waterNeed ||
              crop.climatic?.droughtSensitivity ||
              crop.climatic?.photoperiodResponse ||
              crop.climatic?.criticalDayLength;
            const hasEdaph = crop.edaphic?.ph || crop.edaphic?.texture ||
              crop.edaphic?.soilDepth || crop.edaphic?.drainage ||
              crop.edaphic?.fertilityRequirement || crop.edaphic?.salinityTolerance;
```

Après le `StatRange` du `pH du sol`, ajouter les 2 ranges :
```tsx
                {crop.climatic?.criticalDayLength && (
                  <StatRange
                    label="Jour critique"
                    min={crop.climatic.criticalDayLength.min}
                    optimal={crop.climatic.criticalDayLength.optimal}
                    max={crop.climatic.criticalDayLength.max}
                    unit={crop.climatic.criticalDayLength.unit}
                  />
                )}
                {crop.edaphic?.soilDepth && (
                  <StatRange
                    label="Profondeur de sol"
                    min={crop.edaphic.soilDepth.min}
                    optimal={crop.edaphic.soilDepth.optimal}
                    max={crop.edaphic.soilDepth.max}
                    unit={crop.edaphic.soilDepth.unit}
                  />
                )}
```

Dans la condition du bloc badges, remplacer :
```tsx
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity || crop.edaphic?.texture) && (
```
par :
```tsx
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity || crop.edaphic?.texture || crop.climatic?.photoperiodResponse || crop.edaphic?.drainage || crop.edaphic?.fertilityRequirement || crop.edaphic?.salinityTolerance) && (
```
et à l'intérieur, après le badge `texture`, ajouter :
```tsx
                    {crop.climatic?.photoperiodResponse && (
                      <ToneBadge tone="neutral">Photopériode : {labelOf(PHOTOPERIOD_RESPONSE_LABELS, crop.climatic.photoperiodResponse)}</ToneBadge>
                    )}
                    {crop.edaphic?.drainage && (
                      <ToneBadge tone="neutral">Drainage : {labelOf(DRAINAGE_LABELS, crop.edaphic.drainage)}</ToneBadge>
                    )}
                    {crop.edaphic?.fertilityRequirement && (
                      <ToneBadge tone="neutral">Fertilité : {labelOf(FERTILITY_LABELS, crop.edaphic.fertilityRequirement)}</ToneBadge>
                    )}
                    {crop.edaphic?.salinityTolerance && (
                      <ToneBadge tone="neutral">Salinité : {labelOf(SALINITY_TOLERANCE_LABELS, crop.edaphic.salinityTolerance)}</ToneBadge>
                    )}
```

- [ ] **Step 6: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune sortie (OK).

- [ ] **Step 7: Commit**

```bash
git add "apps/admin/src/app/crops/[id]/CropReadView.tsx" "apps/admin/src/app/crops/[id]/FicheClientView.tsx"
git commit -m "feat(admin): fiches lecture — affichage exigences ECOCROP (climat + sol)"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/api && npx tsc --noEmit` → OK
- [ ] `cd apps/api && npx jest climatic-requirements edaphic-requirements set-crop-requirements` → tout vert
- [ ] `cd apps/admin && npx tsc --noEmit` → OK
- [ ] Manuel : ouvrir une fiche Culture en admin → éditeur « exigences climat/sol » → saisir photopériode + jour critique + profondeur + drainage + fertilité + salinité → Enregistrer → vérifier l'affichage dans la vue admin (`CropReadView`) et la vue client (`FicheClientView`).

## Notes hors périmètre (rappel)

- Pas de migration Prisma (colonnes `Json?`).
- `crop-read-model.ts` `serializedText` : ajout des nouveaux champs **optionnel** (l'objet `climatic`/`edaphic` passe déjà en bloc ; `serializedText` est un sous-ensemble curé qui n'inclut même pas `texture`/`drainage` aujourd'hui). Non inclus dans ce plan.
- LGP sur la Zone : brique séparée ultérieure.
