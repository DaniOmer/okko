# Ravageurs — Brique 2 (Biologie) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la section Biologie (structurée) à l'entité `Pest` et à sa fiche, et introduire l'édition par section sur `/pests/[id]`.

**Architecture:** Entité CRUD `Pest` (non event-sourcée), domaine immuable + snapshot. Nouveau VO `MinMaxRange`. Champs biologie stockés en colonnes JSON Prisma. Endpoint de section dédié `PATCH /pests/:id/biology` (comme les sections de culture). Admin : composants réutilisables (plage min–max, multi-select mois, éditeur de stades) + `PestBiologyEditor` via `EditorShell` (promu partagé).

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement des specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migrations Prisma additives uniquement** : générer, inspecter le SQL (`ADD COLUMN` seulement), appliquer. La base a 1 ligne `Pest` à préserver (tout nullable → sûr). Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Remplacement complet** à l'enregistrement de la biologie (pas de préservation `??` masquée) — cohérent avec le fix Brique 1.
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- UI **française**, composants **shadcn** (`Select`, `Input`, `Label`, `Dialog`) ; pas d'`<select>` natif.
- `npx tsc --noEmit` vert dans l'app concernée avant chaque commit. Commit après chaque tâche.
- Codes de mois : `JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC`.

---

### Task 1: VO `MinMaxRange`

**Files:**
- Create: `apps/api/src/domain/shared/min-max-range.ts`
- Test: `apps/api/src/domain/shared/min-max-range.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }
  export class MinMaxRange {
    static create(props: MinMaxRangeJSON): MinMaxRange   // throws MinMaxRangeError if min > max
    get min: number; get max: number; get unit: string | undefined;
    toJSON(): MinMaxRangeJSON;
    static fromJSON(json: MinMaxRangeJSON): MinMaxRange;
  }
  export class MinMaxRangeError extends Error {}
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/shared/min-max-range.spec.ts`:
```ts
import { MinMaxRange, MinMaxRangeError } from './min-max-range';

describe('MinMaxRange', () => {
  it('crée et round-trip avec unité', () => {
    const r = MinMaxRange.create({ min: 10, max: 30, unit: 'j' });
    expect(r.min).toBe(10); expect(r.max).toBe(30); expect(r.unit).toBe('j');
    expect(r.toJSON()).toEqual({ min: 10, max: 30, unit: 'j' });
  });
  it('accepte min == max et omet unit absente', () => {
    expect(MinMaxRange.create({ min: 5, max: 5 }).toJSON()).toEqual({ min: 5, max: 5 });
  });
  it('rejette min > max', () => {
    expect(() => MinMaxRange.create({ min: 30, max: 10 })).toThrow(MinMaxRangeError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/shared/min-max-range.spec.ts` → FAIL (module introuvable).

- [ ] **Step 3: Implement**

Create `apps/api/src/domain/shared/min-max-range.ts`:
```ts
export class MinMaxRangeError extends Error {
  constructor(message?: string) { super(message); this.name = 'MinMaxRangeError'; }
}

export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }

export class MinMaxRange {
  private constructor(private readonly props: MinMaxRangeJSON) {}

  static create(props: MinMaxRangeJSON): MinMaxRange {
    if (!(props.min <= props.max)) {
      throw new MinMaxRangeError(`Invalid range: expected min <= max, got ${props.min}/${props.max}`);
    }
    return new MinMaxRange({ min: props.min, max: props.max, ...(props.unit ? { unit: props.unit } : {}) });
  }

  get min(): number { return this.props.min; }
  get max(): number { return this.props.max; }
  get unit(): string | undefined { return this.props.unit; }

  toJSON(): MinMaxRangeJSON { return { ...this.props }; }
  static fromJSON(json: MinMaxRangeJSON): MinMaxRange { return MinMaxRange.create(json); }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/shared/min-max-range.spec.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/domain/shared/min-max-range.ts apps/api/src/domain/shared/min-max-range.spec.ts
git commit -m "feat(shared): VO MinMaxRange (min<=max, unit optionnelle)"
```

---

### Task 2: Domaine `Pest` — champs biologie + `setBiology()`

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.biology.spec.ts` (create)

**Interfaces:**
- Consumes: `MinMaxRange`, `MinMaxRangeJSON` (Task 1).
- Produces (added to `apps/api/src/domain/pest/pest.ts`):
  ```ts
  export interface DevelopmentStageJSON { name: Record<string,string>; durationDays?: MinMaxRangeJSON; }
  export interface FavorableConditionsJSON { temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; notes?: Record<string,string>; }
  export interface BiologySnapshot {
    lifeCycle?: Record<string,string>;
    cycleDurationDays?: MinMaxRangeJSON;
    developmentStages?: DevelopmentStageJSON[];
    generationsPerYear?: MinMaxRangeJSON;
    activityPeriods?: string[];
    favorableConditions?: FavorableConditionsJSON;
  }
  // PestSnapshot extends with the 6 BiologySnapshot fields (flat).
  // Pest gains: get biology(): BiologySnapshot ; setBiology(b: BiologySnapshot): Pest  (validates ranges, full-replace, preserves identity/images)
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.biology.spec.ts`:
```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT,
  scientificName: 'Spodoptera', family: 'Noctuidae',
});

describe('Pest.setBiology', () => {
  it('remplace en bloc et préserve identité + valide les plages', () => {
    const p = base().setBiology({
      lifeCycle: { fr: 'Holométabole' },
      cycleDurationDays: { min: 20, max: 40, unit: 'j' },
      developmentStages: [{ name: { fr: 'Œuf' }, durationDays: { min: 3, max: 5, unit: 'j' } }, { name: { fr: 'Larve' } }],
      generationsPerYear: { min: 3, max: 6 },
      activityPeriods: ['JUN', 'JUL', 'AUG'],
      favorableConditions: { temperature: { min: 20, max: 30, unit: '°C' }, humidity: { min: 60, max: 90, unit: '%' }, notes: { fr: 'Humidité élevée' } },
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');        // identité préservée
    expect(s.family).toBe('Noctuidae');
    expect(s.lifeCycle).toEqual({ fr: 'Holométabole' });
    expect(s.cycleDurationDays).toEqual({ min: 20, max: 40, unit: 'j' });
    expect(s.developmentStages?.[0]).toEqual({ name: { fr: 'Œuf' }, durationDays: { min: 3, max: 5, unit: 'j' } });
    expect(s.activityPeriods).toEqual(['JUN', 'JUL', 'AUG']);
    expect(s.favorableConditions?.temperature).toEqual({ min: 20, max: 30, unit: '°C' });
  });

  it('rejette une plage invalide (min > max)', () => {
    expect(() => base().setBiology({ cycleDurationDays: { min: 40, max: 20 } })).toThrow();
  });

  it('efface les champs biologie absents du payload (remplacement complet)', () => {
    const withBio = base().setBiology({ lifeCycle: { fr: 'X' }, generationsPerYear: { min: 1, max: 2 } });
    const cleared = withBio.setBiology({});
    const s = cleared.toSnapshot();
    expect(s.lifeCycle).toBeUndefined();
    expect(s.generationsPerYear).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.biology.spec.ts` → FAIL (`setBiology` inexistant).

- [ ] **Step 3: Implement domaine**

In `apps/api/src/domain/pest/pest.ts`:

3a. Add imports at top:
```ts
import { MinMaxRange, MinMaxRangeJSON } from '../shared/min-max-range';
```

3b. Add exported types (after imports, before `PestSnapshot`):
```ts
export interface DevelopmentStageJSON { name: Record<string, string>; durationDays?: MinMaxRangeJSON; }
export interface FavorableConditionsJSON {
  temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; notes?: Record<string, string>;
}
export interface BiologySnapshot {
  lifeCycle?: Record<string, string>;
  cycleDurationDays?: MinMaxRangeJSON;
  developmentStages?: DevelopmentStageJSON[];
  generationsPerYear?: MinMaxRangeJSON;
  activityPeriods?: string[];
  favorableConditions?: FavorableConditionsJSON;
}
```

3c. Extend `PestSnapshot` — add the 6 biology fields (after `metadata`):
```ts
  lifeCycle?: Record<string, string>;
  cycleDurationDays?: MinMaxRangeJSON;
  developmentStages?: DevelopmentStageJSON[];
  generationsPerYear?: MinMaxRangeJSON;
  activityPeriods?: string[];
  favorableConditions?: FavorableConditionsJSON;
```

3d. Add a private field to the constructor (last param):
```ts
    private readonly _biology: BiologySnapshot,
```

3e. In `create()`, pass an empty biology as the last arg:
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {},
```

3f. Add getter (after `metadata` getter):
```ts
  get biology(): BiologySnapshot { return { ...this._biology }; }
```

3g. In `toSnapshot()`, spread biology into the returned object (before the closing brace of the object):
```ts
      notes: this._notes, metadata: { ...this._metadata },
      ...this._biology,
```

3h. In `update()` (identity update), pass `this._biology` as the last arg so biology is preserved on identity edits:
```ts
      this._notes,
      this._metadata,
      this._biology,
```

3i. Add the `setBiology` method (validates ranges via MinMaxRange, full-replace, preserves everything else):
```ts
  setBiology(b: BiologySnapshot): Pest {
    const range = (r?: MinMaxRangeJSON) => (r ? MinMaxRange.create(r).toJSON() : undefined);
    const biology: BiologySnapshot = {
      lifeCycle: b.lifeCycle,
      cycleDurationDays: range(b.cycleDurationDays),
      developmentStages: b.developmentStages?.map((s) => ({ name: s.name, durationDays: range(s.durationDays) })),
      generationsPerYear: range(b.generationsPerYear),
      activityPeriods: b.activityPeriods,
      favorableConditions: b.favorableConditions
        ? {
            temperature: range(b.favorableConditions.temperature),
            humidity: range(b.favorableConditions.humidity),
            rainfall: range(b.favorableConditions.rainfall),
            notes: b.favorableConditions.notes,
          }
        : undefined,
    };
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, biology,
    );
  }
```

3j. In `fromSnapshot()`, pass a biology object built from the snapshot's 6 fields as the last arg:
```ts
      (s.images ?? []).map(MediaImage.fromJSON), s.notes, { ...s.metadata },
      {
        lifeCycle: s.lifeCycle,
        cycleDurationDays: s.cycleDurationDays,
        developmentStages: s.developmentStages,
        generationsPerYear: s.generationsPerYear,
        activityPeriods: s.activityPeriods,
        favorableConditions: s.favorableConditions,
      },
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.biology.spec.ts src/domain/pest/pest.spec.ts src/domain/pest/pest.update.spec.ts` → all PASS (existing pest specs must still pass — `create`/`update` now pass the extra biology arg).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.biology.spec.ts
git commit -m "feat(pest): champs biologie + setBiology (remplacement complet, plages validées)"
```

---

### Task 3: Migration + repo + read-model

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_biology/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`

**Interfaces:**
- Consumes: `BiologySnapshot` fields on `PestSnapshot` (Task 2).
- Produces: `PestDocument` gains the 6 biology fields (same JSON shapes).

- [ ] **Step 1: Prisma schema — 6 colonnes additives**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `metadata Json` (before `createdAt`):
```prisma
  lifeCycle           Json?
  cycleDurationDays   Json?
  developmentStages   Json?
  generationsPerYear  Json?
  activityPeriods     Json?
  favorableConditions Json?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_biology
```
Inspect the generated `migration.sql` — it must be `ADD COLUMN` only (6 nullable JSONB). Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
Expected: applied; client regenerated; existing row preserved.

- [ ] **Step 3: Verify row preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Expected: `1`.

- [ ] **Step 4: Repo — persist/read the 6 columns**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:

`toRow` — add before the closing brace of the returned object:
```ts
      lifeCycle: (p.lifeCycle ?? undefined) as Prisma.InputJsonValue | undefined,
      cycleDurationDays: (p.cycleDurationDays ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      developmentStages: (p.developmentStages ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      generationsPerYear: (p.generationsPerYear ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      activityPeriods: (p.activityPeriods ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      favorableConditions: (p.favorableConditions ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
```

`toSnapshot` — add before the closing brace:
```ts
      lifeCycle: (row.lifeCycle ?? undefined) as Record<string, string> | undefined,
      cycleDurationDays: (row.cycleDurationDays ?? undefined) as PestSnapshot['cycleDurationDays'],
      developmentStages: (row.developmentStages ?? undefined) as PestSnapshot['developmentStages'],
      generationsPerYear: (row.generationsPerYear ?? undefined) as PestSnapshot['generationsPerYear'],
      activityPeriods: (row.activityPeriods ?? undefined) as string[] | undefined,
      favorableConditions: (row.favorableConditions ?? undefined) as PestSnapshot['favorableConditions'],
```

- [ ] **Step 5: Read-model — expose the 6 fields**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface:
```ts
  lifeCycle?: Record<string, string>;
  cycleDurationDays?: PestSnapshot['cycleDurationDays'];
  developmentStages?: PestSnapshot['developmentStages'];
  generationsPerYear?: PestSnapshot['generationsPerYear'];
  activityPeriods?: string[];
  favorableConditions?: PestSnapshot['favorableConditions'];
```

In `toPestDocument`, enrich the indexed text (after the `symptoms` line):
```ts
  if (p.lifeCycle) lines.push(`Cycle de vie : ${p.lifeCycle[locale] ?? p.lifeCycle['fr']}`);
  if (p.cycleDurationDays) lines.push(`Durée du cycle : ${p.cycleDurationDays.min}–${p.cycleDurationDays.max} j`);
  if (p.generationsPerYear) lines.push(`Générations/an : ${p.generationsPerYear.min}–${p.generationsPerYear.max}`);
```
And add the 6 fields to the returned object:
```ts
    lifeCycle: p.lifeCycle, cycleDurationDays: p.cycleDurationDays,
    developmentStages: p.developmentStages, generationsPerYear: p.generationsPerYear,
    activityPeriods: p.activityPeriods, favorableConditions: p.favorableConditions,
```

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts
git commit -m "feat(pest): persistance + read-model biologie (migration additive)"
```

---

### Task 4: Use-case `SetPestBiology` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-biology.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-biology.use-case.spec.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest`, `PestSnapshot`, `BiologySnapshot` (Task 2) ; `PestRepository`, `PestNotFoundError` (from `update-pest.use-case.ts`).
- Produces:
  ```ts
  export interface SetPestBiologyInput { id: string; actor: string; biology: BiologySnapshot; }
  export class SetPestBiologyUseCase { execute(input): Promise<PestSnapshot> }  // throws PestNotFoundError
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/application/pest/set-pest-biology.use-case.spec.ts`:
```ts
import { SetPestBiologyUseCase } from './set-pest-biology.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-22T00:00:00.000Z' };

describe('SetPestBiologyUseCase', () => {
  it('applique la biologie et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestBiologyUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', biology: { generationsPerYear: { min: 2, max: 4 }, activityPeriods: ['JUN'] } });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.generationsPerYear).toEqual({ min: 2, max: 4 });
    expect(out.activityPeriods).toEqual(['JUN']);
  });
  it('efface la biologie quand le payload est vide (remplacement complet)', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setBiology({ generationsPerYear: { min: 1, max: 2 } }).toSnapshot());
    const uc = new SetPestBiologyUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', biology: {} });
    expect(out.generationsPerYear).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestBiologyUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a', biology: {} })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-biology.use-case.spec.ts` → FAIL.

- [ ] **Step 3: Implement use-case**

Create `apps/api/src/application/pest/set-pest-biology.use-case.ts`:
```ts
import { Pest, PestSnapshot, BiologySnapshot } from '../../domain/pest/pest';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestBiologyInput { id: string; actor: string; biology: BiologySnapshot; }

export class SetPestBiologyUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestBiologyInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setBiology(input.biology).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { biology: input.biology },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-biology.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/presentation/pest/pest.controller.ts`:

Import the use-case and the biology types:
```ts
import { SetPestBiologyUseCase } from '../../application/pest/set-pest-biology.use-case';
import { BiologySnapshot } from '../../domain/pest/pest';
```
Add to the constructor params (after `deletePest`):
```ts
    private readonly setPestBiology: SetPestBiologyUseCase,
```
Add the endpoint (after `update`, before `remove`):
```ts
  @Patch(':id/biology')
  async biology(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: BiologySnapshot) {
    try {
      const snap = await this.setPestBiology.execute({ id, actor: user.email, biology: body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module registration**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestBiologyUseCase } from './application/pest/set-pest-biology.use-case';`
- Add a provider (next to the other pest use-case providers, ~line 192):
```ts
    {
      provide: SetPestBiologyUseCase,
      useFactory: (p, a, c) => new SetPestBiologyUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-biology.use-case.ts apps/api/src/application/pest/set-pest-biology.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): PATCH /pests/:id/biology (SetPestBiologyUseCase)"
```

---

### Task 5: Admin — plumbing + composants réutilisables

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (types biologie sur `Pest` + `MinMaxRangeJSON`)
- Modify: `apps/admin/src/lib/actions.ts` (`setPestBiology`)
- Modify: `apps/admin/src/lib/labels.ts` (`MONTH_LABELS`)
- Create: `apps/admin/src/components/EditorShell.tsx` (partagé)
- Modify: `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx` (ré-export)
- Create: `apps/admin/src/components/MinMaxRangeInput.tsx`
- Create: `apps/admin/src/components/MonthMultiSelect.tsx`
- Create: `apps/admin/src/components/DevelopmentStagesEditor.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api.ts
  export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }
  export interface DevelopmentStage { name: Record<string,string>; durationDays?: MinMaxRangeJSON; }
  export interface FavorableConditions { temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; notes?: Record<string,string>; }
  export interface PestBiology { lifeCycle?: Record<string,string>; cycleDurationDays?: MinMaxRangeJSON; developmentStages?: DevelopmentStage[]; generationsPerYear?: MinMaxRangeJSON; activityPeriods?: string[]; favorableConditions?: FavorableConditions; }
  // Pest interface extends with the PestBiology fields (flat).
  // actions.ts
  export async function setPestBiology(id: string, biology: PestBiology): Promise<Pest>
  // components
  export interface MinMax { min: number; max: number; unit?: string }
  export function MinMaxRangeInput({label, unit, value, onChange}): ...
  export function MonthMultiSelect({value, onChange}): ...
  export function DevelopmentStagesEditor({value, onChange}): ...
  export function EditorShell({label, children}): ...   // shared, same API as crops one
  ```

- [ ] **Step 1: `api.ts` types**

In `apps/admin/src/lib/api.ts`, add near `ImageRef` (top):
```ts
export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }
export interface DevelopmentStage { name: Record<string, string>; durationDays?: MinMaxRangeJSON; }
export interface FavorableConditions { temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; notes?: Record<string, string>; }
export interface PestBiology {
  lifeCycle?: Record<string, string>;
  cycleDurationDays?: MinMaxRangeJSON;
  developmentStages?: DevelopmentStage[];
  generationsPerYear?: MinMaxRangeJSON;
  activityPeriods?: string[];
  favorableConditions?: FavorableConditions;
}
```
And extend the `Pest` interface (currently ends `...updatedAt?: string;`) to include `PestBiology`:
```ts
export interface Pest extends PestBiology {
  id: string; name: string; type: string; scientificName?: string;
  family?: string; description?: Record<string, string>; images: ImageRef[]; updatedAt?: string;
}
```

- [ ] **Step 2: `actions.ts` — `setPestBiology`**

In `apps/admin/src/lib/actions.ts`, add after `deletePest`:
```ts
export async function setPestBiology(id: string, biology: import('./api').PestBiology): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/biology`, jsonInit('PATCH', biology));
  return res.json();
}
```

- [ ] **Step 3: `labels.ts` — `MONTH_LABELS`**

Add to `apps/admin/src/lib/labels.ts`:
```ts
export const MONTH_LABELS: Record<string, string> = {
  JAN: 'Janvier', FEB: 'Février', MAR: 'Mars', APR: 'Avril', MAY: 'Mai', JUN: 'Juin',
  JUL: 'Juillet', AUG: 'Août', SEP: 'Septembre', OCT: 'Octobre', NOV: 'Novembre', DEC: 'Décembre',
};
```

- [ ] **Step 4: Shared `EditorShell`**

Create `apps/admin/src/components/EditorShell.tsx` with the EXACT current content of `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx` (copy it verbatim — the `'use client'` component exporting `EditorShell({ label, children })`).

Then REPLACE `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx` with a one-line re-export:
```ts
export { EditorShell } from '@/components/EditorShell';
```

- [ ] **Step 5: `MinMaxRangeInput`**

Create `apps/admin/src/components/MinMaxRangeInput.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface MinMax { min: number; max: number; unit?: string; }

export function MinMaxRangeInput({ label, unit, value, onChange }: {
  label: string; unit?: string; value?: MinMax; onChange: (v: MinMax | undefined) => void;
}) {
  const [min, setMin] = useState(value?.min?.toString() ?? '');
  const [max, setMax] = useState(value?.max?.toString() ?? '');
  function emit(nextMin: string, nextMax: string) {
    if (nextMin.trim() === '' && nextMax.trim() === '') { onChange(undefined); return; }
    const mn = Number(nextMin), mx = Number(nextMax);
    if (Number.isFinite(mn) && Number.isFinite(mx) && nextMin !== '' && nextMax !== '') {
      onChange({ min: mn, max: mx, ...(unit ? { unit } : {}) });
    }
  }
  return (
    <div className="space-y-1">
      <Label>{label}{unit ? ` (${unit})` : ''}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" className="h-8 w-24" placeholder="min" value={min}
          onChange={(e) => { setMin(e.target.value); emit(e.target.value, max); }} />
        <span className="text-muted-foreground">–</span>
        <Input type="number" className="h-8 w-24" placeholder="max" value={max}
          onChange={(e) => { setMax(e.target.value); emit(min, e.target.value); }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `MonthMultiSelect`**

Create `apps/admin/src/components/MonthMultiSelect.tsx`:
```tsx
'use client';
import { MONTH_LABELS } from '@/lib/labels';

export function MonthMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const order = Object.keys(MONTH_LABELS);
  const toggle = (code: string) => {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    onChange(order.filter((c) => next.includes(c)));   // keep calendar order
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((code) => (
        <button key={code} type="button" onClick={() => toggle(code)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${value.includes(code) ? 'bg-[#245c27] text-white' : 'bg-[#f3f4f6] text-[#475569] hover:bg-[#eaf3ea]'}`}>
          {MONTH_LABELS[code].slice(0, 4)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: `DevelopmentStagesEditor`**

Create `apps/admin/src/components/DevelopmentStagesEditor.tsx`:
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MinMaxRangeInput, type MinMax } from './MinMaxRangeInput';

export interface DevStage { name: Record<string, string>; durationDays?: MinMax; }

export function DevelopmentStagesEditor({ value, onChange }: { value: DevStage[]; onChange: (v: DevStage[]) => void }) {
  const add = () => onChange([...value, { name: { fr: '' } }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const n = [...value]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  const setName = (i: number, fr: string) => onChange(value.map((s, k) => (k === i ? { ...s, name: { fr } } : s)));
  const setDur = (i: number, durationDays: MinMax | undefined) => onChange(value.map((s, k) => (k === i ? { ...s, durationDays } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="rounded-md border p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Input className="h-8" placeholder="Nom du stade (ex. Larve)" value={s.name.fr ?? ''} onChange={(e) => setName(i, e.target.value)} />
            <button type="button" aria-label="Monter" className="text-xs text-muted-foreground" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" aria-label="Descendre" className="text-xs text-muted-foreground" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button>
            <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
          </div>
          <MinMaxRangeInput label="Durée" unit="j" value={s.durationDays} onChange={(v) => setDur(i, v)} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter un stade</Button>
    </div>
  );
}
```

- [ ] **Step 8: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/EditorShell.tsx apps/admin/src/components/MinMaxRangeInput.tsx apps/admin/src/components/MonthMultiSelect.tsx apps/admin/src/components/DevelopmentStagesEditor.tsx "apps/admin/src/app/crops/[id]/editors/EditorShell.tsx"
git commit -m "feat(admin): primitives biologie (plage min–max, mois, stades) + EditorShell partagé + types/action"
```

---

### Task 6: `PestBiologyEditor` + affichage fiche + page

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx` (section Biologie lecture)
- Modify: `apps/admin/src/app/pests/[id]/page.tsx` (monte l'éditeur)

**Interfaces:**
- Consumes: `EditorShell`, `MinMaxRangeInput`, `MonthMultiSelect`, `DevelopmentStagesEditor` (Task 5) ; `setPestBiology` (Task 5) ; `Pest`, `PestBiology`, `MONTH_LABELS`.

- [ ] **Step 1: `PestBiologyEditor`**

Create `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { MonthMultiSelect } from '@/components/MonthMultiSelect';
import { DevelopmentStagesEditor, type DevStage } from '@/components/DevelopmentStagesEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestBiology } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestBiologyEditor({ pest }: { pest: Pest }) {
  const [lifeCycle, setLifeCycle] = useState(pest.lifeCycle?.fr ?? '');
  const [cycleDuration, setCycleDuration] = useState<MinMax | undefined>(pest.cycleDurationDays);
  const [stages, setStages] = useState<DevStage[]>(pest.developmentStages ?? []);
  const [generations, setGenerations] = useState<MinMax | undefined>(pest.generationsPerYear);
  const [months, setMonths] = useState<string[]>(pest.activityPeriods ?? []);
  const [temperature, setTemperature] = useState<MinMax | undefined>(pest.favorableConditions?.temperature);
  const [humidity, setHumidity] = useState<MinMax | undefined>(pest.favorableConditions?.humidity);
  const [rainfall, setRainfall] = useState<MinMax | undefined>(pest.favorableConditions?.rainfall);
  const [condNotes, setCondNotes] = useState(pest.favorableConditions?.notes?.fr ?? '');

  return (
    <EditorShell label="Modifier la biologie">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label>Cycle de vie</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={lifeCycle} onChange={(e) => setLifeCycle(e.target.value)} />
          </div>
          <MinMaxRangeInput label="Durée du cycle" unit="j" value={cycleDuration} onChange={setCycleDuration} />
          <div className="space-y-1"><Label>Stades de développement</Label><DevelopmentStagesEditor value={stages} onChange={setStages} /></div>
          <MinMaxRangeInput label="Générations par an" value={generations} onChange={setGenerations} />
          <div className="space-y-1"><Label>Périodes d&apos;activité</Label><MonthMultiSelect value={months} onChange={setMonths} /></div>
          <div className="space-y-2 rounded-md border p-2">
            <p className="text-sm font-medium">Conditions favorables</p>
            <MinMaxRangeInput label="Température" unit="°C" value={temperature} onChange={setTemperature} />
            <MinMaxRangeInput label="Humidité" unit="%" value={humidity} onChange={setHumidity} />
            <MinMaxRangeInput label="Pluie" unit="mm" value={rainfall} onChange={setRainfall} />
            <div className="space-y-1">
              <Label>Note</Label>
              <textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={condNotes} onChange={(e) => setCondNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestBiology(pest.id, {
                lifeCycle: lifeCycle ? { fr: lifeCycle } : undefined,
                cycleDurationDays: cycleDuration,
                developmentStages: stages.filter((s) => (s.name.fr ?? '').trim() !== ''),
                generationsPerYear: generations,
                activityPeriods: months,
                favorableConditions: {
                  temperature, humidity, rainfall,
                  notes: condNotes ? { fr: condNotes } : undefined,
                },
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Section Biologie (lecture) dans `PestFicheView`**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Add imports:
```ts
import { MONTH_LABELS } from '@/lib/labels';
import { Dna } from 'lucide-react';
```
2b. Compute a `hasBiology` flag inside the component (after `photos`):
```ts
  const b = pest;
  const monthOrder = Object.keys(MONTH_LABELS);
  const range = (r?: { min: number; max: number; unit?: string }) => (r ? `${r.min}–${r.max}${r.unit ? ' ' + r.unit : ''}` : null);
  const hasBiology = !!(b.lifeCycle?.fr || b.cycleDurationDays || (b.developmentStages?.length) || b.generationsPerYear || (b.activityPeriods?.length) ||
    b.favorableConditions?.temperature || b.favorableConditions?.humidity || b.favorableConditions?.rainfall || b.favorableConditions?.notes?.fr);
```
2c. Add the Biologie section INSIDE the sections area. Insert it just before the Photos block's wrapping `<div className="px-6">` — restructure so both Biologie and Photos live under one `<div className="px-6">`. Concretely, replace the Photos block (`{photos.length > 0 && ( <div className="px-6"> ... </div> )}`) with:
```tsx
      <div className="px-6">
        {hasBiology && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eef3f7] text-[#2c5a8a]"><Dna className="h-4 w-4" /></span>
              Biologie
            </h2>
            <div className="space-y-2 text-sm">
              {b.lifeCycle?.fr && <p><span className="text-muted-foreground">Cycle de vie : </span>{b.lifeCycle.fr}</p>}
              {range(b.cycleDurationDays) && <p><span className="text-muted-foreground">Durée du cycle : </span>{range(b.cycleDurationDays)}</p>}
              {range(b.generationsPerYear) && <p><span className="text-muted-foreground">Générations/an : </span>{range(b.generationsPerYear)}</p>}
              {(b.developmentStages?.length ?? 0) > 0 && (
                <div>
                  <span className="text-muted-foreground">Stades : </span>
                  {b.developmentStages!.map((s, i) => (
                    <span key={i}>{i > 0 ? ' → ' : ''}{s.name.fr}{range(s.durationDays) ? ` (${range(s.durationDays)})` : ''}</span>
                  ))}
                </div>
              )}
              {(b.activityPeriods?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Activité : </span>
                  {monthOrder.filter((m) => b.activityPeriods!.includes(m)).map((m) => (
                    <span key={m} className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{MONTH_LABELS[m].slice(0, 4)}</span>
                  ))}
                </div>
              )}
              {(range(b.favorableConditions?.temperature) || range(b.favorableConditions?.humidity) || range(b.favorableConditions?.rainfall) || b.favorableConditions?.notes?.fr) && (
                <div>
                  <span className="text-muted-foreground">Conditions favorables : </span>
                  {[range(b.favorableConditions?.temperature) && `T° ${range(b.favorableConditions?.temperature)}`,
                    range(b.favorableConditions?.humidity) && `Humidité ${range(b.favorableConditions?.humidity)}`,
                    range(b.favorableConditions?.rainfall) && `Pluie ${range(b.favorableConditions?.rainfall)}`].filter(Boolean).join(' · ')}
                  {b.favorableConditions?.notes?.fr && <span className="text-muted-foreground"> — {b.favorableConditions.notes.fr}</span>}
                </div>
              )}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section id="photos" className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f4e6e6] text-[#8a2c2c]"><Images className="h-4 w-4" /></span>
              Photos
              <span className="font-normal text-muted-foreground">({photos.length})</span>
            </h2>
            <PhotoCarousel images={photos} />
          </section>
        )}
      </div>
```

- [ ] **Step 3: Monter l'éditeur sur la page `/pests/[id]`**

In `apps/admin/src/app/pests/[id]/page.tsx`, import and mount the editor in a discreet admin panel below the fiche:
```tsx
import { PestBiologyEditor } from './editors/PestBiologyEditor';
```
Replace the `<Link ...>← Retour à la liste</Link>` block with:
```tsx
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <Link href="/pests" className="text-xs text-muted-foreground hover:underline">← Retour à la liste</Link>
        <PestBiologyEditor pest={pest} />
      </div>
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]"
git commit -m "feat(admin): section Biologie sur la fiche ravageur + PestBiologyEditor"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. Sur `/pests/<id>` : « Modifier la biologie » ouvre l'éditeur (cycle de vie, durée, stades, générations, mois, conditions favorables) ; enregistrer ; la section Biologie s'affiche (masquée si tout vide) ; recharger confirme la persistance.

---

## Notes de fin

- **`update()` (identité) préserve la biologie** (Task 2 step 3h passe `this._biology`), et `setBiology` préserve l'identité — les deux chemins d'édition (pop-up liste vs éditeur biologie) ne s'écrasent pas.
- Les plages invalides (`min > max`) sont rejetées côté domaine (`MinMaxRange`) → l'API renverra 500 ; l'UI contraint déjà min/max numériques mais n'empêche pas min>max — acceptable pour la Brique 2 (amélioration possible : validation côté éditeur).
- **Briques suivantes** (Dégâts, Répartition, Gestion, Sources) réutiliseront `EditorShell` partagé + les primitives et ajouteront des sections à `PestFicheView`.
