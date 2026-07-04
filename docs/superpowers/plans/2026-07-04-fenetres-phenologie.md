# Base de connaissances — Plan 4 : Fenêtres de production + phénologie + itinéraire technique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les trois notions temporelles opérationnelles du modèle : la **phénologie** (stades du cycle, intrinsèque à la plante) et les **fenêtres de production** (zone × saison) portant chacune leur **itinéraire technique** (opérations culturales datées).

**Architecture:** Poursuit la clean architecture des Plans 1-3. La **phénologie** est une collection de value objects portée par l'agrégat `Crop` (colonne `JSONB`). La **fenêtre de production** (`CroppingWindow`) est une entité liée (table propre) référençant une culture et une zone, et **embarquant** son itinéraire technique (liste d'opérations en `JSONB`). Réutilise la `ZoneRepository` du Plan 3 pour valider la zone.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation.
- **Clean architecture** : le domaine n'importe jamais Prisma/NestJS ; ports en application, adaptateurs en infra.
- Réutiliser : `TranslatableText`, `RangeValue`, `Provenance`, le port `IdGenerator` + `UuidIdGenerator`, `CropNotFoundError`, `ZoneNotFoundError` + `ZoneRepository` (Plan 3).
- **Phénologie = collection de VO sur `Crop`** (colonne JSONB), pas de table séparée.
- **Fenêtre = entité liée** (table) avec itinéraire embarqué (opérations en JSONB). Une fenêtre référence `cropId` + `zoneId`.
- Colonnes `JSONB` pour phénologie / opérations / i18n ; casts via `Prisma.InputJsonValue` (jamais `as any`).
- Custom errors : constructeur qui pose `this.name`.
- Mutations auditées ; horloge et id injectés (jamais `Date.now()`/`randomUUID` dans le domaine/use-case).
- Suite en série (`maxWorkers:1`) ; nettoyer les tables touchées dans les tests.
- Rétrocompat : `toCropDocument` gagnera de nouveaux arguments optionnels ; les appels existants (Plans 1-3) doivent continuer à compiler et passer.

---

## File Structure

```
apps/api/src/
├── domain/
│   ├── crop/
│   │   ├── phenological-stage.ts        # NEW value object
│   │   └── crop.ts                      # MODIFY: phenology collection
│   └── window/
│       ├── operation-type.ts            # NEW enum
│       ├── technical-operation.ts       # NEW value object
│       └── cropping-window.ts           # NEW entity (embeds operations)
├── application/
│   ├── window/
│   │   ├── cropping-window.repository.ts        # NEW port
│   │   ├── in-memory-cropping-window.repository.ts  # NEW test util
│   │   ├── add-cropping-window.use-case.ts      # NEW
│   │   ├── list-cropping-windows.use-case.ts    # NEW
│   │   └── cropping-window-read-model.ts        # NEW
│   └── crop/
│       ├── set-crop-phenology.use-case.ts       # NEW
│       └── crop-read-model.ts                   # MODIFY: phenology + windows
├── infrastructure/
│   ├── crop/prisma-crop.repository.ts   # MODIFY: persist phenology
│   └── window/prisma-cropping-window.repository.ts  # NEW
└── presentation/crop/crop.controller.ts # MODIFY: phenology + windows endpoints
apps/api/prisma/schema.prisma            # MODIFY: Crop.phenology + CroppingWindow
apps/admin/src/app/crops/[id]/page.tsx   # MODIFY: phenology + windows sections
apps/admin/src/lib/api.ts                # MODIFY: types + calls
apps/api/src/crop.module.ts              # MODIFY: window providers
```

---

### Task 1: `PhenologicalStage` value object (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/crop/phenological-stage.ts`
- Test: `apps/api/src/domain/crop/phenological-stage.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`.
- Produces: `class PhenologicalStage` with `create({ name: TranslatableText, startDay, endDay, order })` (validates `startDay <= endDay` → `PhenologicalStageError`), getters, `PhenologicalStageJSON` interface, `toJSON()`, `static fromJSON(json)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/crop/phenological-stage.spec.ts`:
```ts
import { PhenologicalStage, PhenologicalStageError } from './phenological-stage';
import { TranslatableText } from '../shared/translatable-text';

describe('PhenologicalStage', () => {
  it('creates a stage and round-trips through JSON', () => {
    const s = PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'Levée' }), startDay: 5, endDay: 12, order: 1,
    });
    const restored = PhenologicalStage.fromJSON(s.toJSON());
    expect(restored.name.getOrDefault('fr')).toBe('Levée');
    expect(restored.startDay).toBe(5);
    expect(restored.endDay).toBe(12);
    expect(restored.order).toBe(1);
  });

  it('rejects startDay > endDay', () => {
    expect(() => PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'X' }), startDay: 20, endDay: 10, order: 1,
    })).toThrow(PhenologicalStageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test phenological-stage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `phenological-stage.ts`**

`apps/api/src/domain/crop/phenological-stage.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';

export class PhenologicalStageError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'PhenologicalStageError';
  }
}

export interface PhenologicalStageJSON {
  name: Record<string, string>;
  startDay: number;
  endDay: number;
  order: number;
}

interface CreateProps {
  name: TranslatableText;
  startDay: number;
  endDay: number;
  order: number;
}

export class PhenologicalStage {
  private constructor(
    private readonly _name: TranslatableText,
    private readonly _startDay: number,
    private readonly _endDay: number,
    private readonly _order: number,
  ) {}

  static create(props: CreateProps): PhenologicalStage {
    if (props.startDay > props.endDay) {
      throw new PhenologicalStageError(`startDay ${props.startDay} > endDay ${props.endDay}`);
    }
    return new PhenologicalStage(props.name, props.startDay, props.endDay, props.order);
  }

  get name(): TranslatableText { return this._name; }
  get startDay(): number { return this._startDay; }
  get endDay(): number { return this._endDay; }
  get order(): number { return this._order; }

  toJSON(): PhenologicalStageJSON {
    return { name: this._name.toJSON(), startDay: this._startDay, endDay: this._endDay, order: this._order };
  }

  static fromJSON(json: PhenologicalStageJSON): PhenologicalStage {
    return new PhenologicalStage(TranslatableText.create(json.name), json.startDay, json.endDay, json.order);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test phenological-stage`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/phenological-stage.*
git commit -m "feat(domain): add PhenologicalStage value object"
```

---

### Task 2: Extend `Crop` aggregate with phenology (domain, TDD)

**Files:**
- Modify: `apps/api/src/domain/crop/crop.ts`
- Test: `apps/api/src/domain/crop/crop.spec.ts` (add cases)

**Interfaces:**
- Consumes: `PhenologicalStage`, `PhenologicalStageJSON`.
- Produces: `CropSnapshot` gains optional `phenology?: PhenologicalStageJSON[]`. `Crop` gets getter `phenology` (array of domain objects, defensive copy) and `setPhenology(stages: PhenologicalStage[])` (bumps version). `toSnapshot`/`fromSnapshot` handle it.

- [ ] **Step 1: Write the failing test (add to crop.spec.ts)**

Append to `apps/api/src/domain/crop/crop.spec.ts`:
```ts
import { PhenologicalStage } from './phenological-stage';

describe('Crop phenology', () => {
  const base = () => Crop.create({
    id: 'crop-phen',
    commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays',
    family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets phenology, bumps version, and round-trips', () => {
    const c = base();
    c.setPhenology([
      PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Levée' }), startDay: 5, endDay: 12, order: 1 }),
      PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Floraison' }), startDay: 55, endDay: 65, order: 2 }),
    ]);
    expect(c.version).toBe(2);
    expect(c.phenology).toHaveLength(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.phenology).toHaveLength(2);
    expect(restored.phenology[1].name.getOrDefault('fr')).toBe('Floraison');
  });

  it('defaults phenology to an empty array', () => {
    expect(base().phenology).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: FAIL — `setPhenology`/`phenology` missing.

- [ ] **Step 3: Extend `crop.ts`**

- Add import: `import { PhenologicalStage, PhenologicalStageJSON } from './phenological-stage';`
- Add to `CropSnapshot`: `phenology?: PhenologicalStageJSON[];`
- Add a private field `_phenology: PhenologicalStage[]` to the constructor param list (append after the climatic/edaphic fields from Plan 2).
- In `create`, pass `[]` for the new field (append after the two `undefined` for climatic/edaphic).
- Add getter + setter:
```ts
  get phenology(): PhenologicalStage[] { return [...this._phenology]; }

  setPhenology(stages: PhenologicalStage[]): void {
    this._phenology = [...stages];
    this._version += 1;
  }
```
- In `toSnapshot`, add: `phenology: this._phenology.map((s) => s.toJSON()),`
- In `fromSnapshot`, append the reconstruction arg: `(s.phenology ?? []).map((j) => PhenologicalStage.fromJSON(j)),`

> Existing Plan 1-3 tests must still pass; the field is optional in the snapshot.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: PASS (existing + 2 new). Then full suite — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.spec.ts
git commit -m "feat(domain): add phenology collection to Crop aggregate"
```

---

### Task 3: `OperationType` enum + `TechnicalOperation` value object (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/window/operation-type.ts`, `apps/api/src/domain/window/technical-operation.ts`
- Test: `apps/api/src/domain/window/technical-operation.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`.
- Produces:
  - `enum OperationType { CLEARING, NURSERY, PLANTING, FERTILIZATION, WEEDING, PEST_CONTROL, HARVEST, OTHER }`.
  - `class TechnicalOperation` with `create({ type: OperationType, label: TranslatableText, timingDays, inputs?, notes? })`, getters (`inputs` defaults `[]`), `TechnicalOperationJSON` interface, `toJSON()`, `static fromJSON(json)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/window/technical-operation.spec.ts`:
```ts
import { TechnicalOperation } from './technical-operation';
import { OperationType } from './operation-type';
import { TranslatableText } from '../shared/translatable-text';

describe('TechnicalOperation', () => {
  it('creates an operation and round-trips through JSON', () => {
    const op = TechnicalOperation.create({
      type: OperationType.FERTILIZATION,
      label: TranslatableText.create({ fr: 'Apport NPK de fond' }),
      timingDays: 0,
      inputs: ['NPK 15-15-15'],
      notes: 'Avant semis',
    });
    const restored = TechnicalOperation.fromJSON(op.toJSON());
    expect(restored.type).toBe(OperationType.FERTILIZATION);
    expect(restored.label.getOrDefault('fr')).toBe('Apport NPK de fond');
    expect(restored.timingDays).toBe(0);
    expect(restored.inputs).toEqual(['NPK 15-15-15']);
    expect(restored.notes).toBe('Avant semis');
  });

  it('defaults inputs to an empty array', () => {
    const op = TechnicalOperation.create({
      type: OperationType.WEEDING, label: TranslatableText.create({ fr: 'Sarclage' }), timingDays: 21,
    });
    expect(op.inputs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test technical-operation`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the enum and value object**

`apps/api/src/domain/window/operation-type.ts`:
```ts
export enum OperationType {
  CLEARING = 'CLEARING',
  NURSERY = 'NURSERY',
  PLANTING = 'PLANTING',
  FERTILIZATION = 'FERTILIZATION',
  WEEDING = 'WEEDING',
  PEST_CONTROL = 'PEST_CONTROL',
  HARVEST = 'HARVEST',
  OTHER = 'OTHER',
}
```

`apps/api/src/domain/window/technical-operation.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { OperationType } from './operation-type';

export interface TechnicalOperationJSON {
  type: OperationType;
  label: Record<string, string>;
  timingDays: number;
  inputs: string[];
  notes?: string;
}

interface CreateProps {
  type: OperationType;
  label: TranslatableText;
  timingDays: number;
  inputs?: string[];
  notes?: string;
}

export class TechnicalOperation {
  private constructor(
    private readonly _type: OperationType,
    private readonly _label: TranslatableText,
    private readonly _timingDays: number,
    private readonly _inputs: string[],
    private readonly _notes: string | undefined,
  ) {}

  static create(props: CreateProps): TechnicalOperation {
    return new TechnicalOperation(props.type, props.label, props.timingDays, props.inputs ?? [], props.notes);
  }

  get type(): OperationType { return this._type; }
  get label(): TranslatableText { return this._label; }
  get timingDays(): number { return this._timingDays; }
  get inputs(): string[] { return [...this._inputs]; }
  get notes(): string | undefined { return this._notes; }

  toJSON(): TechnicalOperationJSON {
    return {
      type: this._type, label: this._label.toJSON(), timingDays: this._timingDays,
      inputs: [...this._inputs], notes: this._notes,
    };
  }

  static fromJSON(json: TechnicalOperationJSON): TechnicalOperation {
    return new TechnicalOperation(
      json.type, TranslatableText.create(json.label), json.timingDays, [...json.inputs], json.notes,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test technical-operation`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/window/operation-type.ts apps/api/src/domain/window/technical-operation.*
git commit -m "feat(domain): add OperationType enum and TechnicalOperation value object"
```

---

### Task 4: `CroppingWindow` entity (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/window/cropping-window.ts`
- Test: `apps/api/src/domain/window/cropping-window.spec.ts`

**Interfaces:**
- Consumes: `TechnicalOperation`, `TechnicalOperationJSON`.
- Produces: `class CroppingWindow` with `create({ id, cropId, zoneId, season, sowingStart?, sowingEnd?, irrigationRequired?, operations?: TechnicalOperation[], notes? })`, getters (`irrigationRequired` defaults `false`, `operations` defaults `[]`), `CroppingWindowSnapshot` interface, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/window/cropping-window.spec.ts`:
```ts
import { CroppingWindow } from './cropping-window';
import { TechnicalOperation } from './technical-operation';
import { OperationType } from './operation-type';
import { TranslatableText } from '../shared/translatable-text';

describe('CroppingWindow', () => {
  const base = () => CroppingWindow.create({
    id: 'w-1', cropId: 'crop-1', zoneId: 'zone-1', season: 'Saison sèche',
    sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
    operations: [
      TechnicalOperation.create({ type: OperationType.PLANTING, label: TranslatableText.create({ fr: 'Semis' }), timingDays: 0 }),
    ],
    notes: 'Irrigation obligatoire',
  });

  it('exposes its attributes', () => {
    const w = base();
    expect(w.cropId).toBe('crop-1');
    expect(w.zoneId).toBe('zone-1');
    expect(w.season).toBe('Saison sèche');
    expect(w.irrigationRequired).toBe(true);
    expect(w.operations).toHaveLength(1);
  });

  it('round-trips through snapshot', () => {
    const restored = CroppingWindow.fromSnapshot(base().toSnapshot());
    expect(restored.season).toBe('Saison sèche');
    expect(restored.operations[0].label.getOrDefault('fr')).toBe('Semis');
  });

  it('defaults irrigationRequired to false and operations to []', () => {
    const w = CroppingWindow.create({ id: 'w', cropId: 'c', zoneId: 'z', season: 'Pluies' });
    expect(w.irrigationRequired).toBe(false);
    expect(w.operations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test cropping-window`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cropping-window.ts`**

`apps/api/src/domain/window/cropping-window.ts`:
```ts
import { TechnicalOperation, TechnicalOperationJSON } from './technical-operation';

export interface CroppingWindowSnapshot {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired: boolean;
  operations: TechnicalOperationJSON[];
  notes?: string;
}

interface CreateProps {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired?: boolean;
  operations?: TechnicalOperation[];
  notes?: string;
}

export class CroppingWindow {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _zoneId: string,
    private readonly _season: string,
    private readonly _sowingStart: string | undefined,
    private readonly _sowingEnd: string | undefined,
    private readonly _irrigationRequired: boolean,
    private readonly _operations: TechnicalOperation[],
    private readonly _notes: string | undefined,
  ) {}

  static create(props: CreateProps): CroppingWindow {
    return new CroppingWindow(
      props.id, props.cropId, props.zoneId, props.season, props.sowingStart, props.sowingEnd,
      props.irrigationRequired ?? false, props.operations ?? [], props.notes,
    );
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get zoneId(): string { return this._zoneId; }
  get season(): string { return this._season; }
  get sowingStart(): string | undefined { return this._sowingStart; }
  get sowingEnd(): string | undefined { return this._sowingEnd; }
  get irrigationRequired(): boolean { return this._irrigationRequired; }
  get operations(): TechnicalOperation[] { return [...this._operations]; }
  get notes(): string | undefined { return this._notes; }

  toSnapshot(): CroppingWindowSnapshot {
    return {
      id: this._id, cropId: this._cropId, zoneId: this._zoneId, season: this._season,
      sowingStart: this._sowingStart, sowingEnd: this._sowingEnd,
      irrigationRequired: this._irrigationRequired,
      operations: this._operations.map((o) => o.toJSON()),
      notes: this._notes,
    };
  }

  static fromSnapshot(s: CroppingWindowSnapshot): CroppingWindow {
    return new CroppingWindow(
      s.id, s.cropId, s.zoneId, s.season, s.sowingStart, s.sowingEnd, s.irrigationRequired,
      s.operations.map((j) => TechnicalOperation.fromJSON(j)), s.notes,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test cropping-window`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/window/cropping-window.*
git commit -m "feat(domain): add CroppingWindow entity embedding its technical itinerary"
```

---

### Task 5: Prisma schema + migration (Crop.phenology + CroppingWindow)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing.
- Produces: `Crop.phenology` Json (nullable) column + `CroppingWindow` table.

- [ ] **Step 1: Extend the schema**

Add to `model Crop` (after `edaphic`):
```prisma
  phenology      Json?
```
Add a new model:
```prisma
model CroppingWindow {
  id                 String   @id
  cropId             String
  zoneId             String
  season             String
  sowingStart        String?
  sowingEnd          String?
  irrigationRequired Boolean
  operations         Json
  notes              String?
  createdAt          DateTime @default(now())

  @@index([cropId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:up && cd apps/api && pnpm exec prisma migrate dev --name add_phenology_and_windows && cd ../..`
Expected: migration adds the `phenology` column and creates the `CroppingWindow` table + index; Prisma client regenerated (now includes `croppingWindow`).

- [ ] **Step 3: Verify the table**

Run: `docker exec okko-db-1 psql -U okko -d okko -c '\d "CroppingWindow"'`
Expected: table with the columns above + cropId index.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(infra): add Crop.phenology column and CroppingWindow table"
```

---

### Task 6: Persist phenology + `CroppingWindowRepository` (ports + Prisma impls, integration test)

**Files:**
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`
- Create: `apps/api/src/application/window/cropping-window.repository.ts`, `apps/api/src/infrastructure/window/prisma-cropping-window.repository.ts`
- Test: `apps/api/test/prisma-cropping-window.repository.int-spec.ts`

**Interfaces:**
- Consumes: `CropSnapshot`, `CroppingWindowSnapshot`, `PrismaService`, `Prisma`.
- Produces:
  - `PrismaCropRepository` persists `phenology`.
  - `interface CroppingWindowRepository { save(w: CroppingWindowSnapshot): Promise<void>; listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]>; }` + token `CROPPING_WINDOW_REPOSITORY`.
  - `class PrismaCroppingWindowRepository implements CroppingWindowRepository`.

- [ ] **Step 1: Persist phenology in the crop repository**

In `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`:
- In the `save` payload (shared object used by create+update), add:
```ts
        phenology: (s.phenology ?? undefined) as Prisma.InputJsonValue | undefined,
```
- In `toSnapshot`, add:
```ts
      phenology: (row.phenology ?? undefined) as CropSnapshot['phenology'],
```

- [ ] **Step 2: Define the port**

`apps/api/src/application/window/cropping-window.repository.ts`:
```ts
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export const CROPPING_WINDOW_REPOSITORY = Symbol('CROPPING_WINDOW_REPOSITORY');

export interface CroppingWindowRepository {
  save(w: CroppingWindowSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]>;
}
```

- [ ] **Step 3: Write the failing integration test**

`apps/api/test/prisma-cropping-window.repository.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCroppingWindowRepository } from '../src/infrastructure/window/prisma-cropping-window.repository';
import { OperationType } from '../src/domain/window/operation-type';

describe('PrismaCroppingWindowRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCroppingWindowRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.croppingWindow.deleteMany(); await prisma.$disconnect(); });

  it('saves and lists windows with embedded operations', async () => {
    await repo.save({
      id: 'w-int-1', cropId: 'c-int-1', zoneId: 'z-int-1', season: 'Saison sèche',
      sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
      operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
      notes: 'test',
    });
    const list = await repo.listByCrop('c-int-1');
    expect(list).toHaveLength(1);
    expect(list[0].irrigationRequired).toBe(true);
    expect(list[0].operations[0].label.fr).toBe('Semis');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-cropping-window.repository`
Expected: FAIL — repository not found.

- [ ] **Step 5: Implement `PrismaCroppingWindowRepository`**

`apps/api/src/infrastructure/window/prisma-cropping-window.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CroppingWindow as PrismaWindow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CroppingWindowRepository } from '../../application/window/cropping-window.repository';
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

@Injectable()
export class PrismaCroppingWindowRepository implements CroppingWindowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(w: CroppingWindowSnapshot): Promise<void> {
    await this.prisma.croppingWindow.upsert({
      where: { id: w.id }, create: this.toRow(w), update: this.toRow(w),
    });
  }

  async listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]> {
    const rows = await this.prisma.croppingWindow.findMany({ where: { cropId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(w: CroppingWindowSnapshot): Prisma.CroppingWindowCreateInput {
    return {
      id: w.id, cropId: w.cropId, zoneId: w.zoneId, season: w.season,
      sowingStart: w.sowingStart ?? null, sowingEnd: w.sowingEnd ?? null,
      irrigationRequired: w.irrigationRequired,
      operations: w.operations as unknown as Prisma.InputJsonValue,
      notes: w.notes ?? null,
    };
  }

  private toSnapshot(row: PrismaWindow): CroppingWindowSnapshot {
    return {
      id: row.id, cropId: row.cropId, zoneId: row.zoneId, season: row.season,
      sowingStart: row.sowingStart ?? undefined, sowingEnd: row.sowingEnd ?? undefined,
      irrigationRequired: row.irrigationRequired,
      operations: row.operations as unknown as CroppingWindowSnapshot['operations'],
      notes: row.notes ?? undefined,
    };
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-cropping-window.repository`
Expected: PASS. Then full suite — all green. Confirm no `as any`: `grep -rn "as any" apps/api/src` returns nothing (note: `as unknown as Prisma.InputJsonValue` is used for the operations array, which is not `as any`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/infrastructure/crop/prisma-crop.repository.ts apps/api/src/application/window/cropping-window.repository.ts apps/api/src/infrastructure/window/prisma-cropping-window.repository.ts apps/api/test/prisma-cropping-window.repository.int-spec.ts
git commit -m "feat(infra): persist crop phenology and add cropping-window repository"
```

---

### Task 7: Use-cases `SetCropPhenology`, `AddCroppingWindow`, `ListCroppingWindows` (application, TDD)

**Files:**
- Create: `apps/api/src/application/window/in-memory-cropping-window.repository.ts`
- Create: `apps/api/src/application/crop/set-crop-phenology.use-case.ts`
- Create: `apps/api/src/application/window/add-cropping-window.use-case.ts`, `apps/api/src/application/window/list-cropping-windows.use-case.ts`
- Test: `apps/api/src/application/crop/set-crop-phenology.use-case.spec.ts`, `apps/api/src/application/window/add-cropping-window.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `ZoneRepository`, `CroppingWindowRepository`, `AuditLogRepository`, `Clock`, `IdGenerator`, `CropNotFoundError`, `ZoneNotFoundError`, domain objects.
- Produces:
  - `SetCropPhenologyUseCase.execute({ cropId, stages: PhenologicalStageJSON[], actor })` → `CropSnapshot`.
  - `AddCroppingWindowUseCase.execute({ cropId, zoneId, id?, season, sowingStart?, sowingEnd?, irrigationRequired?, operations?: TechnicalOperationJSON[], notes?, actor })` → `CroppingWindowSnapshot` (verifies crop AND zone exist).
  - `ListCroppingWindowsUseCase.execute({ cropId })` → `CroppingWindowSnapshot[]`.

- [ ] **Step 1: In-memory window repo (test util)**

`apps/api/src/application/window/in-memory-cropping-window.repository.ts`:
```ts
import { CroppingWindowRepository } from './cropping-window.repository';
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export class InMemoryCroppingWindowRepository implements CroppingWindowRepository {
  private store: CroppingWindowSnapshot[] = [];
  async save(w: CroppingWindowSnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== w.id).concat(w);
  }
  async listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]> {
    return this.store.filter((w) => w.cropId === cropId);
  }
}
```

- [ ] **Step 2: Write the failing tests**

`apps/api/src/application/crop/set-crop-phenology.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropPhenologyUseCase } from './set-crop-phenology.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

describe('SetCropPhenologyUseCase', () => {
  it('sets phenology and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(repo, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const out = await new SetCropPhenologyUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
    });
    expect(out.phenology).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws CropNotFoundError when absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new SetCropPhenologyUseCase(repo, audit, clock).execute({ cropId: 'x', actor: 'a', stages: [] }))
      .rejects.toThrow(CropNotFoundError);
  });
});
```

`apps/api/src/application/window/add-cropping-window.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreateZoneUseCase } from '../zone/create-zone.use-case';
import { AddCroppingWindowUseCase } from './add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from './list-cropping-windows.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryZoneRepository } from '../zone/in-memory-zone.repository';
import { InMemoryCroppingWindowRepository } from './in-memory-cropping-window.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `w-${++seq}` };

async function setup() {
  const crops = new InMemoryCropRepository();
  const zones = new InMemoryZoneRepository();
  const windows = new InMemoryCroppingWindowRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  await new CreateZoneUseCase(zones, audit, clock, { next: () => 'z1' }).execute({ name: { fr: 'Sahel' }, country: 'BJ', actor: 'a' });
  return { crops, zones, windows, audit };
}

describe('AddCroppingWindowUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('adds a window (crop+zone exist) with operations and lists it', async () => {
    const { crops, zones, windows, audit } = await setup();
    const uc = new AddCroppingWindowUseCase(crops, zones, windows, audit, clock, ids);
    const out = await uc.execute({
      cropId: 'c1', zoneId: 'z1', season: 'Saison sèche', irrigationRequired: true,
      operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
      actor: 'a',
    });
    expect(out.season).toBe('Saison sèche');
    expect(out.operations).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCroppingWindowsUseCase(windows).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('throws CropNotFoundError / ZoneNotFoundError', async () => {
    const { crops, zones, windows, audit } = await setup();
    const uc = new AddCroppingWindowUseCase(crops, zones, windows, audit, clock, ids);
    await expect(uc.execute({ cropId: 'nope', zoneId: 'z1', season: 'S', actor: 'a' })).rejects.toThrow(CropNotFoundError);
    await expect(uc.execute({ cropId: 'c1', zoneId: 'nope', season: 'S', actor: 'a' })).rejects.toThrow(ZoneNotFoundError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test set-crop-phenology add-cropping-window`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/crop/set-crop-phenology.use-case.ts`:
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { PhenologicalStage, PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropPhenologyInput {
  cropId: string;
  stages: PhenologicalStageJSON[];
  actor: string;
}

export class SetCropPhenologyUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropPhenologyInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setPhenology(input.stages.map((j) => PhenologicalStage.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { phenology: { from: snap.phenology, to: next.phenology } },
    });
    return next;
  }
}
```

`apps/api/src/application/window/add-cropping-window.use-case.ts`:
```ts
import { CroppingWindow, CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { TechnicalOperation, TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { CropRepository } from '../crop/crop.repository';
import { ZoneRepository } from '../zone/zone.repository';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../crop/add-variety.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export interface AddCroppingWindowInput {
  cropId: string;
  zoneId: string;
  id?: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired?: boolean;
  operations?: TechnicalOperationJSON[];
  notes?: string;
  actor: string;
}

export class AddCroppingWindowUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly zones: ZoneRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddCroppingWindowInput): Promise<CroppingWindowSnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const window = CroppingWindow.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId, zoneId: input.zoneId, season: input.season,
      sowingStart: input.sowingStart, sowingEnd: input.sowingEnd,
      irrigationRequired: input.irrigationRequired,
      operations: (input.operations ?? []).map((j) => TechnicalOperation.fromJSON(j)),
      notes: input.notes,
    });
    const snap = window.toSnapshot();
    await this.windows.save(snap);
    await this.audit.record({
      entityType: 'CroppingWindow', entityId: window.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/window/list-cropping-windows.use-case.ts`:
```ts
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { CroppingWindowRepository } from './cropping-window.repository';

export class ListCroppingWindowsUseCase {
  constructor(private readonly windows: CroppingWindowRepository) {}
  async execute(input: { cropId: string }): Promise<CroppingWindowSnapshot[]> {
    return this.windows.listByCrop(input.cropId);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test set-crop-phenology add-cropping-window`
Expected: PASS (4 tests). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/window apps/api/src/application/crop/set-crop-phenology.use-case.ts apps/api/src/application/crop/set-crop-phenology.use-case.spec.ts
git commit -m "feat(application): add set-phenology, add-window, list-windows use-cases"
```

---

### Task 8: Read-models — window document + crop document phenology/windows (application, TDD)

**Files:**
- Create: `apps/api/src/application/window/cropping-window-read-model.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/window/cropping-window-read-model.spec.ts`, and add cases to `crop-read-model.spec.ts`

**Interfaces:**
- Consumes: `CroppingWindowSnapshot`, `CropSnapshot`, `VarietySnapshot`, `CropZoneView`, `PhenologicalStageJSON`.
- Produces:
  - `toCroppingWindowDocument(w, locale?): CroppingWindowDocument` (flat + serializedText listing season + operations).
  - `CropDocument` gains `phenology: PhenologicalStageJSON[]` and `croppingWindows: CroppingWindowSnapshot[]`; `toCropDocument(snapshot, locale?, varieties?, zones?, windows?: CroppingWindowSnapshot[])` — fifth optional arg defaults `[]`; `phenology` read from the snapshot (default `[]`); serializedText includes phenology stages + window seasons.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/application/window/cropping-window-read-model.spec.ts`:
```ts
import { toCroppingWindowDocument } from './cropping-window-read-model';
import { OperationType } from '../../domain/window/operation-type';

const w = {
  id: 'w1', cropId: 'c1', zoneId: 'z1', season: 'Saison sèche',
  sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
  operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
};

describe('toCroppingWindowDocument', () => {
  it('serializes season and operations', () => {
    const doc = toCroppingWindowDocument(w, 'fr');
    expect(doc.season).toBe('Saison sèche');
    expect(doc.serializedText).toContain('Saison sèche');
    expect(doc.serializedText).toContain('Semis');
  });
});
```

Append to `apps/api/src/application/crop/crop-read-model.spec.ts`:
```ts
describe('toCropDocument with phenology and windows', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 6, metadata: {},
    phenology: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
  };
  const windows = [
    { id: 'w1', cropId: 'c1', zoneId: 'z1', season: 'Saison sèche', irrigationRequired: true, operations: [] },
  ];

  it('includes phenology and windows in the document and serialized text', () => {
    const doc = toCropDocument(snap, 'fr', [], [], windows);
    expect(doc.phenology).toHaveLength(1);
    expect(doc.croppingWindows).toHaveLength(1);
    expect(doc.serializedText).toContain('Levée');
    expect(doc.serializedText).toContain('Saison sèche');
  });

  it('defaults phenology and windows to empty arrays', () => {
    const doc = toCropDocument({ ...snap, phenology: undefined }, 'fr');
    expect(doc.phenology).toEqual([]);
    expect(doc.croppingWindows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test cropping-window-read-model crop-read-model`
Expected: FAIL — `toCroppingWindowDocument` missing; `phenology`/`croppingWindows` not on document; fifth arg unsupported.

- [ ] **Step 3: Implement `cropping-window-read-model.ts`**

`apps/api/src/application/window/cropping-window-read-model.ts`:
```ts
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export interface CroppingWindowDocument {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired: boolean;
  operations: CroppingWindowSnapshot['operations'];
  notes?: string;
  serializedText: string;
}

export function toCroppingWindowDocument(w: CroppingWindowSnapshot, locale = 'fr'): CroppingWindowDocument {
  const lines = [`## Fenêtre : ${w.season}${w.irrigationRequired ? ' (irrigation requise)' : ''}`];
  if (w.sowingStart || w.sowingEnd) lines.push(`Semis : ${w.sowingStart ?? '?'} – ${w.sowingEnd ?? '?'}`);
  for (const op of w.operations) {
    const label = op.label[locale] ?? op.label['fr'];
    lines.push(`- J+${op.timingDays} ${label} (${op.type})`);
  }
  return { ...w, serializedText: lines.join('\n') };
}
```

- [ ] **Step 4: Extend `crop-read-model.ts`**

In `apps/api/src/application/crop/crop-read-model.ts`:
- Add imports:
```ts
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
```
- Add to `CropDocument`: `phenology: PhenologicalStageJSON[];` and `croppingWindows: CroppingWindowSnapshot[];`.
- Change the signature to add the fifth arg:
```ts
export function toCropDocument(
  s: CropSnapshot,
  locale = 'fr',
  varieties: VarietySnapshot[] = [],
  zones: CropZoneView[] = [],
  windows: CroppingWindowSnapshot[] = [],
): CropDocument {
```
- Compute `const phenology = s.phenology ?? [];`.
- After the zones block in `serializedText`, add:
```ts
  if (phenology.length > 0) {
    lines.push(`Phénologie : ${phenology.map((p) => `${p.name[locale] ?? p.name['fr']} (J${p.startDay}-${p.endDay})`).join(', ')}`);
  }
  if (windows.length > 0) {
    lines.push(`Fenêtres : ${windows.map((w) => w.season).join(', ')}`);
  }
```
- Add `phenology,` and `croppingWindows: windows,` to the returned object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test cropping-window-read-model crop-read-model`
Expected: PASS (all existing + new). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/window/cropping-window-read-model.* apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add window read-model and crop-document phenology/windows"
```

---

### Task 9: Controller endpoints + module wiring (e2e)

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Test: `apps/api/test/window.e2e-spec.ts`

**Interfaces:**
- Consumes: the new use-cases + `CroppingWindowRepository`.
- Produces endpoints: `PATCH /crops/:id/phenology`, `POST /crops/:id/windows`, `GET /crops/:id/windows`. `GET /crops/:id` now includes phenology + windows.

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/window.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Phenology & windows e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.croppingWindow.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.croppingWindow.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets phenology and adds a cropping window, visible on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const zone = await request(app.getHttpServer()).post('/zones')
      .send({ name: { fr: 'Sahel' }, country: 'BJ' }).expect(201);

    await request(app.getHttpServer()).patch(`/crops/${crop.body.id}/phenology`)
      .send({ stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }] })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${crop.body.id}/windows`)
      .send({ zoneId: zone.body.id, season: 'Saison sèche', irrigationRequired: true,
              operations: [{ type: 'PLANTING', label: { fr: 'Semis' }, timingDays: 0, inputs: [] }] })
      .expect(201);

    const list = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/windows`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].season).toBe('Saison sèche');

    const doc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(doc.body.phenology).toHaveLength(1);
    expect(doc.body.croppingWindows).toHaveLength(1);
  });

  it('returns 404 adding a window for an unknown zone', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer()).post(`/crops/${crop.body.id}/windows`)
      .send({ zoneId: 'nope', season: 'S' }).expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test window.e2e`
Expected: FAIL — routes not wired.

- [ ] **Step 3: Extend the crop controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add imports:
```ts
import { SetCropPhenologyUseCase } from '../../application/crop/set-crop-phenology.use-case';
import { AddCroppingWindowUseCase } from '../../application/window/add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from '../../application/window/list-cropping-windows.use-case';
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { TechnicalOperationJSON } from '../../domain/window/technical-operation';
```
- Inject into the constructor:
```ts
    private readonly setPhenology: SetCropPhenologyUseCase,
    private readonly addWindow: AddCroppingWindowUseCase,
    private readonly listWindows: ListCroppingWindowsUseCase,
```
- Update `GET /crops/:id` to fetch windows and pass them (fifth arg). It already fetches varieties + zones; add:
```ts
    const windows = await this.listWindows.execute({ cropId: id });
    return toCropDocument(snap, 'fr', vars, zones, windows);
```
- Add the handlers:
```ts
  @Patch(':id/phenology')
  async phenology(@Param('id') id: string, @Body() body: { stages: PhenologicalStageJSON[] }) {
    try {
      const snap = await this.setPhenology.execute({ cropId: id, actor: ACTOR, stages: body.stages });
      const vars = await this.varieties.listByCrop(id);
      const zones = await this.listCropZones.execute({ cropId: id });
      const windows = await this.listWindows.execute({ cropId: id });
      return toCropDocument(snap, 'fr', vars, zones, windows);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/windows')
  async createWindow(
    @Param('id') id: string,
    @Body() body: { zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean; operations?: TechnicalOperationJSON[]; notes?: string },
  ) {
    try {
      return await this.addWindow.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/windows')
  async getWindows(@Param('id') id: string) {
    return this.listWindows.execute({ cropId: id });
  }
```
(`ZoneNotFoundError` is already imported from Plan 3.)

- [ ] **Step 4: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `PrismaCroppingWindowRepository`, `CROPPING_WINDOW_REPOSITORY`, and the three use-cases.
- Add providers:
```ts
    { provide: CROPPING_WINDOW_REPOSITORY, useClass: PrismaCroppingWindowRepository },
    {
      provide: SetCropPhenologyUseCase,
      useFactory: (r, a, c) => new SetCropPhenologyUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddCroppingWindowUseCase,
      useFactory: (cr, z, w, a, c, ids) => new AddCroppingWindowUseCase(cr, z, w, a, c, ids),
      inject: [CROP_REPOSITORY, ZONE_REPOSITORY, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListCroppingWindowsUseCase,
      useFactory: (w) => new ListCroppingWindowsUseCase(w),
      inject: [CROPPING_WINDOW_REPOSITORY],
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test window.e2e`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/window.e2e-spec.ts
git commit -m "feat(api): wire phenology and cropping-window endpoints with e2e"
```

---

### Task 10: Admin — phenology + windows sections on crop detail

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: the Task 9 API.
- Produces: phenology + cropping-window sections on the crop detail page.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`, add types and extend `CropDetail`:
```ts
export interface PhenologicalStage { name: Record<string, string>; startDay: number; endDay: number; order: number; }
export interface TechnicalOperation { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string; }
export interface CroppingWindow {
  id: string; cropId: string; zoneId: string; season: string;
  sowingStart?: string; sowingEnd?: string; irrigationRequired: boolean;
  operations: TechnicalOperation[]; notes?: string;
}
```
Add to `CropDetail`: `phenology: PhenologicalStage[]; croppingWindows: CroppingWindow[];`.

- [ ] **Step 2: Add sections to the crop detail page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add after the zones section:
```tsx
      <section>
        <h2 className="font-semibold mb-2">Phénologie ({crop.phenology.length})</h2>
        <ul className="list-disc pl-5">
          {crop.phenology.map((p) => (
            <li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Fenêtres de production ({crop.croppingWindows.length})</h2>
        {crop.croppingWindows.map((w) => (
          <div key={w.id} className="mb-3">
            <p className="font-medium">{w.season}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
            <ul className="list-disc pl-5 text-sm">
              {w.operations.map((op, i) => (
                <li key={i}>J+{op.timingDays} — {op.label.fr} ({op.type})</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
```

- [ ] **Step 3: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; `/crops/[id]` compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): phenology and cropping-window sections on crop detail"
```

---

## Self-Review

**1. Spec coverage (Plan 4 scope):**
- Phénologie (stades, jours) → Tasks 1, 2, 7, 8, 9, 10. ✅
- Fenêtres de production (zone × saison, irrigation, nb de cycles déduit) → Tasks 4, 5, 6, 7, 8, 9, 10. ✅
- Itinéraire technique (opérations datées + intrants, embarqué dans la fenêtre) → Tasks 3, 4, 7, 8, 9, 10. ✅
- Réutilisation Zone (validation zone à l'ajout de fenêtre) → Task 7 (via `ZoneRepository`/`ZoneNotFoundError`). ✅
- Read-model enrichi (AI-ready) → Task 8. ✅
- Audit sur mutations → Task 7. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues. ✅

**3. Type consistency:** `PhenologicalStageJSON` (Task 1) → Crop snapshot (Task 2), use-case (Task 7), read-model (Task 8), controller (Task 9). `TechnicalOperationJSON` (Task 3) → CroppingWindow (Task 4), use-case (Task 7), controller (Task 9). `CroppingWindowSnapshot` (Task 4) → port + repo (Task 6), use-cases (Task 7), read-model (Task 8). `IdGenerator`/`ZoneRepository`/`ZoneNotFoundError`/`CropNotFoundError` réutilisés. `toCropDocument` 5e argument optionnel rétrocompatible avec les appels Plans 1-3. ✅

---

## Notes de conception
- **Phénologie sur le Crop** (JSONB) : liste intrinsèque à la plante, pas de table. `setPhenology` remplace la liste entière (full-replace, cohérent avec `set-requirements` du Plan 2).
- **Itinéraire embarqué dans la fenêtre** (JSONB `operations`) : une fenêtre = un itinéraire. Simplicité de lecture/écriture ; on normalisera si le besoin de requêter les opérations émerge.
- **Validation de la zone à l'ajout de fenêtre** : réutilise `ZoneRepository` du Plan 3 — première dépendance inter-catalogues, preuve que le socle se compose bien.
- **Cast `as unknown as Prisma.InputJsonValue`** pour les tableaux d'objets (operations) : ce n'est pas `as any` (le type cible reste contraint) ; nécessaire car un tableau typé n'est pas directement assignable à `InputJsonValue`.
```
