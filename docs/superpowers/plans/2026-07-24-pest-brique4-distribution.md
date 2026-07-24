# Ravageurs — Brique 4 (Répartition) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la section Répartition (zones géographiques, climat favorable, présence connue) à l'entité `Pest` et à sa fiche.

**Architecture:** Mirroir des Briques 2/3. Champs intrinsèques stockés en colonnes JSON Prisma. Méthode domaine `setDistribution()` en remplacement complet. Endpoint de section `PATCH /pests/:id/distribution`. Admin : nouveau composant `TagListInput` (tags texte libre), `PestDistributionEditor` via `EditorShell`, section Répartition sur la fiche.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migration additive uniquement** : `ADD COLUMN`, inspecter le SQL, appliquer. La base a 1 ligne `Pest` à préserver (nullable → sûr). Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Remplacement complet** à l'enregistrement de la répartition (pas de préservation `??`).
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- Le constructeur `Pest` est POSITIONNEL (12 params, `_damage` en dernier). Ce plan ajoute UN param `_distribution` (13ᵉ, dernier). TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `fromSnapshot`) doivent passer 13 args dans le bon ordre — un décalage corrompt silencieusement des champs.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine `Pest` — champs répartition + `setDistribution()`

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.distribution.spec.ts` (create)

**Interfaces:**
- Produces (added to `pest.ts`):
  ```ts
  export interface DistributionSnapshot { geographicAreas?: string[]; favorableClimate?: Record<string,string>; knownPresence?: Record<string,string>; }
  // PestSnapshot += geographicAreas?, favorableClimate?, knownPresence?
  // Pest: get distribution(): DistributionSnapshot ; setDistribution(d: { geographicAreas?: string[]; favorableClimate?: TranslatableText; knownPresence?: TranslatableText }): Pest
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.distribution.spec.ts`:
```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } }).setDamage({ attackedOrgans: ['LEAVES'] });

describe('Pest.setDistribution', () => {
  it('remplace en bloc et préserve identité + biologie + dégâts', () => {
    const p = base().setDistribution({
      geographicAreas: ['Afrique de l\'Ouest', 'Asie'],
      favorableClimate: TranslatableText.create({ fr: 'Tropical humide' }),
      knownPresence: TranslatableText.create({ fr: 'Endémique en zone soudanienne' }),
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.attackedOrgans).toEqual(['LEAVES']);                // dégâts préservés
    expect(s.geographicAreas).toEqual(['Afrique de l\'Ouest', 'Asie']);
    expect(s.favorableClimate).toEqual({ fr: 'Tropical humide' });
    expect(s.knownPresence).toEqual({ fr: 'Endémique en zone soudanienne' });
  });

  it('efface les champs répartition quand le payload est vide', () => {
    const withDist = base().setDistribution({ geographicAreas: ['Afrique'], favorableClimate: TranslatableText.create({ fr: 'X' }) });
    const cleared = withDist.setDistribution({});
    const s = cleared.toSnapshot();
    expect(s.geographicAreas).toBeUndefined();
    expect(s.favorableClimate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.distribution.spec.ts` → FAIL (`setDistribution` inexistant).

- [ ] **Step 3: Implement domaine**

In `apps/api/src/domain/pest/pest.ts`:

3a. Add exported type (after `DamageSnapshot`, before `PestSnapshot`):
```ts
export interface DistributionSnapshot { geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>; }
```

3b. Extend `PestSnapshot` — add after `harmfulnessLevel?: string;`:
```ts
  geographicAreas?: string[];
  favorableClimate?: Record<string, string>;
  knownPresence?: Record<string, string>;
```

3c. Add constructor param (after `_damage`):
```ts
    private readonly _distribution: DistributionSnapshot,
```

3d. `create()` — add `{}` as the last arg (after the damage `{}`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {}, {},
```

3e. Add getter (after `get damage()`):
```ts
  get distribution(): DistributionSnapshot { return { ...this._distribution }; }
```

3f. `toSnapshot()` — spread distribution after damage:
```ts
      ...this._damage,
      ...this._distribution,
```

3g. `update()` — add `this._distribution` as the last arg (after `this._damage`):
```ts
      this._damage,
      this._distribution,
```

3h. `setBiology()` — add `this._distribution` as the last arg of its `new Pest(...)` (after `this._damage`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, biology, this._damage, this._distribution,
```

3i. `setDamage()` — add `this._distribution` as the last arg of its `new Pest(...)` (after the damage object):
```ts
      this._biology,
      { attackedOrgans: d.attackedOrgans, damageTypes: d.damageTypes, harmfulnessLevel: d.harmfulnessLevel },
      this._distribution,
```

3j. Add the `setDistribution` method (after `setDamage`):
```ts
  setDistribution(d: { geographicAreas?: string[]; favorableClimate?: TranslatableText; knownPresence?: TranslatableText }): Pest {
    const distribution: DistributionSnapshot = {
      geographicAreas: d.geographicAreas,
      favorableClimate: d.favorableClimate?.toJSON(),
      knownPresence: d.knownPresence?.toJSON(),
    };
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, distribution,
    );
  }
```

3k. `fromSnapshot()` — add a distribution object as the last arg (after the damage object):
```ts
      { attackedOrgans: s.attackedOrgans, damageTypes: s.damageTypes, harmfulnessLevel: s.harmfulnessLevel },
      { geographicAreas: s.geographicAreas, favorableClimate: s.favorableClimate, knownPresence: s.knownPresence },
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (distribution + damage + biology + identity specs; `create`/`update`/`setBiology`/`setDamage` now pass the extra arg).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.distribution.spec.ts
git commit -m "feat(pest): champs répartition + setDistribution (remplacement complet, préserve identité/biologie/dégâts)"
```

---

### Task 2: Migration + repo + read-model (+ test read-model)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_distribution/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot` distribution fields (Task 1).
- Produces: `PestDocument` gains `geographicAreas?`, `favorableClimate?`, `knownPresence?`.

- [ ] **Step 1: Prisma schema — 3 colonnes additives**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `harmfulnessLevel String?`:
```prisma
  geographicAreas  Json?
  favorableClimate Json?
  knownPresence    Json?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_distribution
```
Inspect the generated `migration.sql` — must be `ADD COLUMN` only (3 nullable JSONB). Then apply:
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
      geographicAreas: (p.geographicAreas ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      favorableClimate: (p.favorableClimate ?? undefined) as Prisma.InputJsonValue | undefined,
      knownPresence: (p.knownPresence ?? undefined) as Prisma.InputJsonValue | undefined,
```

`toSnapshot` — add before the closing brace:
```ts
      geographicAreas: (row.geographicAreas ?? undefined) as string[] | undefined,
      favorableClimate: (row.favorableClimate ?? undefined) as Record<string, string> | undefined,
      knownPresence: (row.knownPresence ?? undefined) as Record<string, string> | undefined,
```

- [ ] **Step 5: Read-model — expose the 3 fields**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface:
```ts
  geographicAreas?: string[];
  favorableClimate?: Record<string, string>;
  knownPresence?: Record<string, string>;
```

In `toPestDocument`, enrich the indexed text (after the existing `harmfulnessLevel`/`Nuisibilité` line):
```ts
  if (p.geographicAreas?.length) lines.push(`Zones : ${p.geographicAreas.join(', ')}`);
  if (p.favorableClimate) lines.push(`Climat favorable : ${p.favorableClimate[locale] ?? p.favorableClimate['fr']}`);
  if (p.knownPresence) lines.push(`Présence connue : ${p.knownPresence[locale] ?? p.knownPresence['fr']}`);
```
And add to the returned object:
```ts
    geographicAreas: p.geographicAreas, favorableClimate: p.favorableClimate, knownPresence: p.knownPresence,
```

- [ ] **Step 6: Read-model test**

Open `apps/api/src/application/pest/pest-read-model.spec.ts`, READ the existing biology/damage test cases to match style, then add one `it(...)`:
```ts
  it('expose la répartition et enrichit le texte indexé', () => {
    const doc = toPestDocument({
      id: 'p1', name: { fr: 'Chenille' }, type: PestType.INSECT, images: [], metadata: {},
      geographicAreas: ['Afrique', 'Asie'],
      favorableClimate: { fr: 'Tropical humide' },
      knownPresence: { fr: 'Endémique zone soudanienne' },
    } as never);
    expect(doc.geographicAreas).toEqual(['Afrique', 'Asie']);
    expect(doc.favorableClimate).toEqual({ fr: 'Tropical humide' });
    expect(doc.knownPresence).toEqual({ fr: 'Endémique zone soudanienne' });
    expect(doc.serializedText).toContain('Zones : Afrique, Asie');
    expect(doc.serializedText).toContain('Climat favorable : Tropical humide');
    expect(doc.serializedText).toContain('Présence connue : Endémique zone soudanienne');
  });
```
(If the existing spec builds the snapshot differently, follow its exact style — `PestType` should already be imported there.)

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance + read-model répartition (migration additive + test)"
```

---

### Task 3: Use-case `SetPestDistribution` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-distribution.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-distribution.use-case.spec.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest`, `PestSnapshot` (Task 1) ; `PestRepository`, `PestNotFoundError` (from `update-pest.use-case.ts`) ; `TranslatableText`.
- Produces:
  ```ts
  export interface SetPestDistributionInput { id: string; actor: string; geographicAreas?: string[]; favorableClimate?: Record<string,string>; knownPresence?: Record<string,string>; }
  export class SetPestDistributionUseCase { execute(input): Promise<PestSnapshot> }
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/application/pest/set-pest-distribution.use-case.spec.ts`:
```ts
import { SetPestDistributionUseCase } from './set-pest-distribution.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-24T00:00:00.000Z' };

describe('SetPestDistributionUseCase', () => {
  it('applique la répartition et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestDistributionUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', geographicAreas: ['Afrique'], favorableClimate: { fr: 'Tropical' }, knownPresence: { fr: 'Signalé' } });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.geographicAreas).toEqual(['Afrique']);
    expect(out.favorableClimate).toEqual({ fr: 'Tropical' });
    expect(out.knownPresence).toEqual({ fr: 'Signalé' });
  });
  it('efface la répartition quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setDistribution({ geographicAreas: ['Afrique'] }).toSnapshot());
    const uc = new SetPestDistributionUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.geographicAreas).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestDistributionUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-distribution.use-case.spec.ts` → FAIL.

- [ ] **Step 3: Implement use-case**

Create `apps/api/src/application/pest/set-pest-distribution.use-case.ts`:
```ts
import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDistributionInput {
  id: string; actor: string;
  geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>;
}

export class SetPestDistributionUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDistributionInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDistribution({
      geographicAreas: input.geographicAreas,
      favorableClimate: input.favorableClimate ? TranslatableText.create(input.favorableClimate) : undefined,
      knownPresence: input.knownPresence ? TranslatableText.create(input.knownPresence) : undefined,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { distribution: { geographicAreas: input.geographicAreas, favorableClimate: input.favorableClimate, knownPresence: input.knownPresence } },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-distribution.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/presentation/pest/pest.controller.ts`:

Import the use-case:
```ts
import { SetPestDistributionUseCase } from '../../application/pest/set-pest-distribution.use-case';
```
Add to the constructor params (after `setPestDamage`):
```ts
    private readonly setPestDistribution: SetPestDistributionUseCase,
```
Add the endpoint (after the `damage` endpoint):
```ts
  @Patch(':id/distribution')
  async distribution(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>;
  }) {
    try {
      const snap = await this.setPestDistribution.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module registration**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestDistributionUseCase } from './application/pest/set-pest-distribution.use-case';`
- Add a provider next to the other pest use-case providers (near `SetPestDamageUseCase`):
```ts
    {
      provide: SetPestDistributionUseCase,
      useFactory: (p, a, c) => new SetPestDistributionUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-distribution.use-case.ts apps/api/src/application/pest/set-pest-distribution.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): PATCH /pests/:id/distribution (SetPestDistributionUseCase)"
```

---

### Task 4: Admin — `TagListInput` + plumbing

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/components/TagListInput.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api.ts
  export interface PestDistribution { geographicAreas?: string[]; favorableClimate?: Record<string,string>; knownPresence?: Record<string,string>; }
  // Pest += extends PestDistribution
  // actions.ts
  export async function setPestDistribution(id: string, distribution: PestDistribution): Promise<Pest>
  // components
  export function TagListInput({ value, onChange, placeholder }): ...
  ```

- [ ] **Step 1: `api.ts` types**

In `apps/admin/src/lib/api.ts`, add near the other pest types:
```ts
export interface PestDistribution { geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>; }
```
Extend the `Pest` interface — add `PestDistribution` to its `extends` list:
```ts
export interface Pest extends PestBiology, PestDamage, PestDistribution {
  id: string; name: string; type: string; scientificName?: string;
  family?: string; description?: Record<string, string>; images: ImageRef[]; updatedAt?: string;
}
```

- [ ] **Step 2: `actions.ts` — `setPestDistribution`**

In `apps/admin/src/lib/actions.ts`, add after `setPestDamage`:
```ts
export async function setPestDistribution(id: string, distribution: import('./api').PestDistribution): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/distribution`, jsonInit('PATCH', distribution));
  return res.json();
}
```

- [ ] **Step 3: `TagListInput`**

Create `apps/admin/src/components/TagListInput.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function TagListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) { setDraft(''); return; }
    onChange([...value, t]);
    setDraft('');
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ea] px-2.5 py-1 text-xs text-[#245c27]">
              {t}
              <button type="button" aria-label={`Retirer ${t}`} className="text-[#245c27]/60 hover:text-[#245c27]" onClick={() => remove(i)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8"
          placeholder={placeholder ?? 'Ajouter…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>Ajouter</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/TagListInput.tsx
git commit -m "feat(admin): TagListInput (tags texte libre) + types/action répartition"
```

---

### Task 5: `PestDistributionEditor` + section fiche + page

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestDistributionEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `TagListInput`, `setPestDistribution`, `Pest`.

- [ ] **Step 1: `PestDistributionEditor`**

Create `apps/admin/src/app/pests/[id]/editors/PestDistributionEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { TagListInput } from '@/components/TagListInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestDistribution } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDistributionEditor({ pest }: { pest: Pest }) {
  const [areas, setAreas] = useState<string[]>(pest.geographicAreas ?? []);
  const [climate, setClimate] = useState(pest.favorableClimate?.fr ?? '');
  const [presence, setPresence] = useState(pest.knownPresence?.fr ?? '');

  return (
    <EditorShell label="Modifier la répartition">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Zones géographiques</Label><TagListInput value={areas} onChange={setAreas} placeholder="ex. Afrique de l'Ouest" /></div>
          <div className="space-y-1">
            <Label>Climat favorable</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={climate} onChange={(e) => setClimate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Présence connue</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={presence} onChange={(e) => setPresence(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDistribution(pest.id, {
                geographicAreas: areas,
                favorableClimate: climate ? { fr: climate } : undefined,
                knownPresence: presence ? { fr: presence } : undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Section Répartition (lecture) dans `PestFicheView`**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Add the icon import (keep all existing imports):
```ts
import { MapPin } from 'lucide-react';
```

2b. After the existing `hasDamage` computation, add:
```ts
  const hasDistribution = !!((b.geographicAreas?.length) || b.favorableClimate?.fr || b.knownPresence?.fr);
```

2c. Insert the Répartition section INSIDE the `<div className="px-6">`, immediately AFTER the closing `</section>` of the Dégâts block and BEFORE the `{photos.length > 0 && (` Photos block:
```tsx
        {hasDistribution && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><MapPin className="h-4 w-4" /></span>
              Répartition
            </h2>
            <div className="space-y-2 text-sm">
              {(b.geographicAreas?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Zones : </span>
                  {b.geographicAreas!.map((a) => <span key={a} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{a}</span>)}
                </div>
              )}
              {b.favorableClimate?.fr && <p><span className="text-muted-foreground">Climat favorable : </span>{b.favorableClimate.fr}</p>}
              {b.knownPresence?.fr && <p><span className="text-muted-foreground">Présence connue : </span>{b.knownPresence.fr}</p>}
            </div>
          </section>
        )}
```

- [ ] **Step 3: Monter l'éditeur sur la page `/pests/[id]`**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Add import: `import { PestDistributionEditor } from './editors/PestDistributionEditor';`
- In the admin panel's editor `<div className="flex gap-2">` (which already holds `PestBiologyEditor` and `PestDamageEditor`), add after `PestDamageEditor`:
```tsx
          <PestDistributionEditor pest={pest} />
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]"
git commit -m "feat(admin): section Répartition sur la fiche ravageur + PestDistributionEditor"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. Sur `/pests/<id>` : « Modifier la répartition » ouvre l'éditeur (tags zones, climat, présence) ; ajouter des tags (Entrée ou bouton), enregistrer ; la section Répartition s'affiche (masquée si tout vide) ; recharger confirme la persistance ; vérifier que Biologie et Dégâts ne sont pas affectés.

---

## Notes de fin

- **`setDistribution` remplace en bloc** — un champ vidé est effacé (cohérent avec `setBiology`/`setDamage`).
- **`TagListInput`** ignore les doublons et les valeurs vides ; ajout par Entrée ou bouton.
- **Briques suivantes** (Gestion, Sources) suivront le même pattern.
