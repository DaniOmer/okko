# Ravageurs — Brique 3 (Dégâts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la section Dégâts (organes attaqués, types de dégâts, symptômes, niveau de nuisibilité) à l'entité `Pest` et à sa fiche.

**Architecture:** Mirroir de la Brique 2 (Biologie). Champs intrinsèques stockés en colonnes Prisma. Méthode domaine `setDamage()` en remplacement complet. Endpoint de section `PATCH /pests/:id/damage`. Admin : composant générique `ChipMultiSelect`, `PestDamageEditor` via `EditorShell`, section Dégâts sur la fiche.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migration additive uniquement** : `ADD COLUMN`, inspecter le SQL, appliquer. La base a 1 ligne `Pest` à préserver (nullable → sûr). Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Remplacement complet** à l'enregistrement des dégâts (pas de préservation `??`).
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- Le constructeur `Pest` est POSITIONNEL (11 params, `_biology` en dernier). Ce plan ajoute UN param `_damage` (12ᵉ, dernier). TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `fromSnapshot`) doivent passer 12 args dans le bon ordre — un décalage corrompt silencieusement des champs.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert avant chaque commit. Commit après chaque tâche.
- Codes enum stockés en string (pas d'enum TS côté domaine, cohérent avec `activityPeriods`).

---

### Task 1: Domaine `Pest` — champs dégâts + `setDamage()`

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.damage.spec.ts` (create)

**Interfaces:**
- Produces (added to `pest.ts`):
  ```ts
  export interface DamageSnapshot { attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; }
  // PestSnapshot += attackedOrgans?, damageTypes?, harmfulnessLevel?
  // Pest: get damage(): DamageSnapshot ; setDamage(d: { symptoms?: TranslatableText; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string }): Pest
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.damage.spec.ts`:
```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } });

describe('Pest.setDamage', () => {
  it('remplace en bloc et préserve identité + biologie', () => {
    const p = base().setDamage({
      symptoms: TranslatableText.create({ fr: 'Feuilles trouées' }),
      attackedOrgans: ['LEAVES', 'FRUITS'],
      damageTypes: ['BITES', 'PERFORATIONS'],
      harmfulnessLevel: 'MAJOR',
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.symptoms).toEqual({ fr: 'Feuilles trouées' });
    expect(s.attackedOrgans).toEqual(['LEAVES', 'FRUITS']);
    expect(s.damageTypes).toEqual(['BITES', 'PERFORATIONS']);
    expect(s.harmfulnessLevel).toBe('MAJOR');
  });

  it('efface les champs dégâts + symptômes quand le payload est vide', () => {
    const withDamage = base().setDamage({ symptoms: TranslatableText.create({ fr: 'X' }), attackedOrgans: ['ROOTS'], harmfulnessLevel: 'MINOR' });
    const cleared = withDamage.setDamage({});
    const s = cleared.toSnapshot();
    expect(s.symptoms).toBeUndefined();
    expect(s.attackedOrgans).toBeUndefined();
    expect(s.harmfulnessLevel).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.damage.spec.ts` → FAIL (`setDamage` inexistant).

- [ ] **Step 3: Implement domaine**

In `apps/api/src/domain/pest/pest.ts`:

3a. Add exported type (after `BiologySnapshot`, before `PestSnapshot`):
```ts
export interface DamageSnapshot { attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; }
```

3b. Extend `PestSnapshot` — add after `favorableConditions?: FavorableConditionsJSON;`:
```ts
  attackedOrgans?: string[];
  damageTypes?: string[];
  harmfulnessLevel?: string;
```

3c. Add constructor param (after `_biology`):
```ts
    private readonly _damage: DamageSnapshot,
```

3d. `create()` — add `{}` as the last arg (after the biology `{}`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {},
```

3e. Add getter (after `get biology()`):
```ts
  get damage(): DamageSnapshot { return { ...this._damage }; }
```

3f. `toSnapshot()` — spread damage after biology:
```ts
      ...this._biology,
      ...this._damage,
```

3g. `update()` — add `this._damage` as the last arg (after `this._biology`):
```ts
      this._biology,
      this._damage,
```

3h. `setBiology()` — add `this._damage` as the last arg of its `new Pest(...)`:
```ts
      this._symptoms, this._images, this._notes, this._metadata, biology, this._damage,
```

3i. Add the `setDamage` method (after `setBiology`):
```ts
  setDamage(d: { symptoms?: TranslatableText; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string }): Pest {
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      d.symptoms,
      this._images, this._notes, this._metadata, this._biology,
      { attackedOrgans: d.attackedOrgans, damageTypes: d.damageTypes, harmfulnessLevel: d.harmfulnessLevel },
    );
  }
```

3j. `fromSnapshot()` — add a damage object as the last arg (after the biology object):
```ts
      {
        lifeCycle: s.lifeCycle,
        cycleDurationDays: s.cycleDurationDays,
        developmentStages: s.developmentStages,
        generationsPerYear: s.generationsPerYear,
        activityPeriods: s.activityPeriods,
        favorableConditions: s.favorableConditions,
      },
      { attackedOrgans: s.attackedOrgans, damageTypes: s.damageTypes, harmfulnessLevel: s.harmfulnessLevel },
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (biology + damage + existing pest specs; `create`/`update`/`setBiology` now pass the extra arg).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.damage.spec.ts
git commit -m "feat(pest): champs dégâts + setDamage (remplacement complet, préserve identité/biologie)"
```

---

### Task 2: Migration + repo + read-model

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_damage/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`

**Interfaces:**
- Consumes: `PestSnapshot` damage fields (Task 1).
- Produces: `PestDocument` gains `attackedOrgans?`, `damageTypes?`, `harmfulnessLevel?`.

- [ ] **Step 1: Prisma schema — 3 colonnes additives**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `favorableConditions Json?`:
```prisma
  attackedOrgans   Json?
  damageTypes      Json?
  harmfulnessLevel String?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_damage
```
Inspect the generated `migration.sql` — must be `ADD COLUMN` only (2 JSONB + 1 TEXT, all nullable). Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
Expected: applied; client regenerated; existing row preserved. If Prisma asks to reset/drop, STOP and report BLOCKED.

- [ ] **Step 3: Verify row preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Expected: `1`.

- [ ] **Step 4: Repo — persist/read the 3 columns**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:

`toRow` — add before the closing brace of the returned object:
```ts
      attackedOrgans: (p.attackedOrgans ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      damageTypes: (p.damageTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      harmfulnessLevel: p.harmfulnessLevel ?? null,
```

`toSnapshot` — add before the closing brace:
```ts
      attackedOrgans: (row.attackedOrgans ?? undefined) as string[] | undefined,
      damageTypes: (row.damageTypes ?? undefined) as string[] | undefined,
      harmfulnessLevel: row.harmfulnessLevel ?? undefined,
```

- [ ] **Step 5: Read-model — expose the 3 fields**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface:
```ts
  attackedOrgans?: string[];
  damageTypes?: string[];
  harmfulnessLevel?: string;
```

In `toPestDocument`, enrich the indexed text (after the existing `symptoms` line):
```ts
  if (p.attackedOrgans?.length) lines.push(`Organes attaqués : ${p.attackedOrgans.join(', ')}`);
  if (p.damageTypes?.length) lines.push(`Types de dégâts : ${p.damageTypes.join(', ')}`);
  if (p.harmfulnessLevel) lines.push(`Nuisibilité : ${p.harmfulnessLevel}`);
```
And add to the returned object:
```ts
    attackedOrgans: p.attackedOrgans, damageTypes: p.damageTypes, harmfulnessLevel: p.harmfulnessLevel,
```

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts
git commit -m "feat(pest): persistance + read-model dégâts (migration additive)"
```

---

### Task 3: Use-case `SetPestDamage` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-damage.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-damage.use-case.spec.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest`, `PestSnapshot` (Task 1) ; `PestRepository`, `PestNotFoundError` (from `update-pest.use-case.ts`) ; `TranslatableText`.
- Produces:
  ```ts
  export interface SetPestDamageInput { id: string; actor: string; symptoms?: Record<string,string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; }
  export class SetPestDamageUseCase { execute(input): Promise<PestSnapshot> }
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/application/pest/set-pest-damage.use-case.spec.ts`:
```ts
import { SetPestDamageUseCase } from './set-pest-damage.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-23T00:00:00.000Z' };

describe('SetPestDamageUseCase', () => {
  it('applique les dégâts et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestDamageUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', symptoms: { fr: 'Trous' }, attackedOrgans: ['LEAVES'], damageTypes: ['BITES'], harmfulnessLevel: 'MAJOR' });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.symptoms).toEqual({ fr: 'Trous' });
    expect(out.attackedOrgans).toEqual(['LEAVES']);
    expect(out.harmfulnessLevel).toBe('MAJOR');
  });
  it('efface les dégâts quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setDamage({ attackedOrgans: ['ROOTS'] }).toSnapshot());
    const uc = new SetPestDamageUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.attackedOrgans).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestDamageUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-damage.use-case.spec.ts` → FAIL.

- [ ] **Step 3: Implement use-case**

Create `apps/api/src/application/pest/set-pest-damage.use-case.ts`:
```ts
import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDamageInput {
  id: string; actor: string;
  symptoms?: Record<string, string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string;
}

export class SetPestDamageUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDamageInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDamage({
      symptoms: input.symptoms ? TranslatableText.create(input.symptoms) : undefined,
      attackedOrgans: input.attackedOrgans,
      damageTypes: input.damageTypes,
      harmfulnessLevel: input.harmfulnessLevel,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { damage: { symptoms: input.symptoms, attackedOrgans: input.attackedOrgans, damageTypes: input.damageTypes, harmfulnessLevel: input.harmfulnessLevel } },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-damage.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/presentation/pest/pest.controller.ts`:

Import the use-case:
```ts
import { SetPestDamageUseCase } from '../../application/pest/set-pest-damage.use-case';
```
Add to the constructor params (after `setPestBiology`):
```ts
    private readonly setPestDamage: SetPestDamageUseCase,
```
Add the endpoint (after the `biology` endpoint):
```ts
  @Patch(':id/damage')
  async damage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    symptoms?: Record<string, string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string;
  }) {
    try {
      const snap = await this.setPestDamage.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module registration**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestDamageUseCase } from './application/pest/set-pest-damage.use-case';`
- Add a provider next to the other pest use-case providers (near `SetPestBiologyUseCase`):
```ts
    {
      provide: SetPestDamageUseCase,
      useFactory: (p, a, c) => new SetPestDamageUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-damage.use-case.ts apps/api/src/application/pest/set-pest-damage.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): PATCH /pests/:id/damage (SetPestDamageUseCase)"
```

---

### Task 4: Admin — plumbing + `ChipMultiSelect`

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/labels.ts`
- Create: `apps/admin/src/components/ChipMultiSelect.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api.ts
  export interface PestDamage { symptoms?: Record<string,string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; }
  // Pest interface += symptoms?, attackedOrgans?, damageTypes?, harmfulnessLevel?
  // actions.ts
  export async function setPestDamage(id: string, damage: PestDamage): Promise<Pest>
  // labels.ts: ATTACKED_ORGAN_LABELS, DAMAGE_TYPE_LABELS, HARMFULNESS_LABELS
  // components
  export function ChipMultiSelect({ options, value, onChange }): ...
  ```

- [ ] **Step 1: `api.ts` types**

In `apps/admin/src/lib/api.ts`, add near the other pest types:
```ts
export interface PestDamage { symptoms?: Record<string, string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; }
```
Extend the `Pest` interface — add `symptoms?: Record<string, string>;` and the three damage fields (`attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string;`). Since `Pest` already `extends PestBiology`, add these directly to its body (or make it also `extends PestDamage`):
```ts
export interface Pest extends PestBiology, PestDamage {
  id: string; name: string; type: string; scientificName?: string;
  family?: string; description?: Record<string, string>; images: ImageRef[]; updatedAt?: string;
}
```

- [ ] **Step 2: `actions.ts` — `setPestDamage`**

In `apps/admin/src/lib/actions.ts`, add after `setPestBiology`:
```ts
export async function setPestDamage(id: string, damage: import('./api').PestDamage): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/damage`, jsonInit('PATCH', damage));
  return res.json();
}
```

- [ ] **Step 3: `labels.ts`**

Add to `apps/admin/src/lib/labels.ts`:
```ts
export const ATTACKED_ORGAN_LABELS: Record<string, string> = {
  ROOTS: 'Racines', STEMS: 'Tiges', LEAVES: 'Feuilles', FLOWERS: 'Fleurs', FRUITS: 'Fruits', SEEDS: 'Graines',
};
export const DAMAGE_TYPE_LABELS: Record<string, string> = {
  BITES: 'Morsures', MINES: 'Mines', GALLERIES: 'Galeries', SUCKING: 'Succion',
  DEFOLIATION: 'Défoliation', PERFORATIONS: 'Perforations', DISEASE_TRANSMISSION: 'Transmission de maladies',
};
export const HARMFULNESS_LABELS: Record<string, string> = { MINOR: 'Mineur', MODERATE: 'Modéré', MAJOR: 'Majeur' };
```

- [ ] **Step 4: `ChipMultiSelect`**

Create `apps/admin/src/components/ChipMultiSelect.tsx`:
```tsx
'use client';

export function ChipMultiSelect({ options, value, onChange }: { options: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  const order = Object.keys(options);
  const toggle = (code: string) => {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    onChange(order.filter((c) => next.includes(c)));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((code) => (
        <button key={code} type="button" onClick={() => toggle(code)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${value.includes(code) ? 'bg-[#245c27] text-white' : 'bg-[#f3f4f6] text-[#475569] hover:bg-[#eaf3ea]'}`}>
          {options[code]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/ChipMultiSelect.tsx
git commit -m "feat(admin): ChipMultiSelect + types/action/libellés dégâts"
```

---

### Task 5: `PestDamageEditor` + section fiche + page

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestDamageEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `ChipMultiSelect`, `setPestDamage`, `Pest`, `ATTACKED_ORGAN_LABELS`, `DAMAGE_TYPE_LABELS`, `HARMFULNESS_LABELS`, `labelOf`.

- [ ] **Step 1: `PestDamageEditor`**

Create `apps/admin/src/app/pests/[id]/editors/PestDamageEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ATTACKED_ORGAN_LABELS, DAMAGE_TYPE_LABELS, HARMFULNESS_LABELS } from '@/lib/labels';
import { setPestDamage } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDamageEditor({ pest }: { pest: Pest }) {
  const [symptoms, setSymptoms] = useState(pest.symptoms?.fr ?? '');
  const [organs, setOrgans] = useState<string[]>(pest.attackedOrgans ?? []);
  const [types, setTypes] = useState<string[]>(pest.damageTypes ?? []);
  const [harmfulness, setHarmfulness] = useState(pest.harmfulnessLevel ?? '');

  return (
    <EditorShell label="Modifier les dégâts">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Organes attaqués</Label><ChipMultiSelect options={ATTACKED_ORGAN_LABELS} value={organs} onChange={setOrgans} /></div>
          <div className="space-y-1"><Label>Types de dégâts</Label><ChipMultiSelect options={DAMAGE_TYPE_LABELS} value={types} onChange={setTypes} /></div>
          <div className="space-y-1">
            <Label>Niveau de nuisibilité</Label>
            <Select value={harmfulness} onValueChange={setHarmfulness}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(HARMFULNESS_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Symptômes caractéristiques</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDamage(pest.id, {
                symptoms: symptoms ? { fr: symptoms } : undefined,
                attackedOrgans: organs,
                damageTypes: types,
                harmfulnessLevel: harmfulness || undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Section Dégâts (lecture) dans `PestFicheView`**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Add imports (extend the existing labels import + lucide icon):
```ts
import { ATTACKED_ORGAN_LABELS, DAMAGE_TYPE_LABELS, HARMFULNESS_LABELS } from '@/lib/labels';
import { Bug } from 'lucide-react';
```
(Keep the existing `labelOf`, `PEST_TYPE_LABELS`, `PEST_PHOTO_CATEGORY_LABELS`, `MONTH_LABELS` imports.)

2b. After the `hasBiology` computation, add:
```ts
  const hasDamage = !!((b.attackedOrgans?.length) || (b.damageTypes?.length) || b.harmfulnessLevel || b.symptoms?.fr);
```

2c. Insert the Dégâts section INSIDE the `<div className="px-6">`, immediately AFTER the closing `</section>` of the Biologie block and BEFORE the `{photos.length > 0 && (` Photos block:
```tsx
        {hasDamage && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f6efe6] text-[#8a5a2c]"><Bug className="h-4 w-4" /></span>
              Dégâts
              {b.harmfulnessLevel && (
                <span className="ml-1 rounded-full bg-[#f6efe6] px-2 py-0.5 text-xs font-medium text-[#8a5a2c]">
                  {labelOf(HARMFULNESS_LABELS, b.harmfulnessLevel)}
                </span>
              )}
            </h2>
            <div className="space-y-2 text-sm">
              {(b.attackedOrgans?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Organes attaqués : </span>
                  {b.attackedOrgans!.map((o) => <span key={o} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(ATTACKED_ORGAN_LABELS, o)}</span>)}
                </div>
              )}
              {(b.damageTypes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Types de dégâts : </span>
                  {b.damageTypes!.map((t) => <span key={t} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(DAMAGE_TYPE_LABELS, t)}</span>)}
                </div>
              )}
              {b.symptoms?.fr && <p><span className="text-muted-foreground">Symptômes : </span>{b.symptoms.fr}</p>}
            </div>
          </section>
        )}
```

- [ ] **Step 3: Monter l'éditeur sur la page `/pests/[id]`**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Add import: `import { PestDamageEditor } from './editors/PestDamageEditor';`
- Replace the admin panel block (currently the `<div className="mt-6 ...">` holding the back-link and `<PestBiologyEditor />`) with:
```tsx
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Link href="/pests" className="text-xs text-muted-foreground hover:underline">← Retour à la liste</Link>
        <div className="flex gap-2">
          <PestBiologyEditor pest={pest} />
          <PestDamageEditor pest={pest} />
        </div>
      </div>
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]"
git commit -m "feat(admin): section Dégâts sur la fiche ravageur + PestDamageEditor"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. Sur `/pests/<id>` : « Modifier les dégâts » ouvre l'éditeur (organes, types, nuisibilité, symptômes) ; enregistrer ; la section Dégâts s'affiche (masquée si tout vide, badge nuisibilité) ; recharger confirme la persistance ; vérifier que la section Biologie n'a pas été affectée.

---

## Notes de fin

- **`setDamage` remplace `symptoms`** (payload plein depuis l'éditeur) — un `symptoms` vidé est effacé. Cohérent avec le remplacement complet.
- **Réutilisation `ChipMultiSelect`** : `MonthMultiSelect` (Biologie) n'est pas refactoré pour limiter le churn ; duplication mineure assumée.
- **Briques suivantes** (Répartition, Gestion, Sources) suivront le même pattern (setX + endpoint + éditeur + section).
