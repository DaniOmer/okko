# Base de connaissances — Plan 6 : Nutrition, rendement & prix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compléter la fiche culture avec la **nutrition/fertilisation** (besoins par élément), le **rendement de référence** (par niveau d'intrants) et les **prix de marché** (série temporelle append-only).

**Architecture:** Poursuit la clean architecture des Plans 1-5. La **nutrition** et les **rendements** sont des collections de value objects portées par l'agrégat `Crop` (colonnes `JSONB`, comme la phénologie). Les **prix** forment une **série append-only** modélisée en entité `PricePoint` (table propre + repository), référençant une culture. Le read-model compose la fiche via l'objet d'options `toCropDocument`.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation.
- **Clean architecture** : le domaine n'importe jamais Prisma/NestJS ; ports en application, adaptateurs en infra.
- Réutiliser : `IdGenerator` (depuis `../shared/id-generator`), `UuidIdGenerator`, `CropNotFoundError`, l'objet d'options `ToCropDocumentOptions`.
- **Nutrition & rendements = collections de VO sur `Crop`** (colonnes JSONB). **Prix = entité `PricePoint`** (table, append-only).
- **Ordre des tâches** : la **migration (Task 4) précède l'extension de l'agrégat (Task 5)** — car `toSnapshot` émet toujours les tableaux ; la colonne doit exister avant que le repo persiste (leçon du Plan 4).
- Colonnes `JSONB` pour les collections ; casts via `Prisma.InputJsonValue` / `as unknown as Prisma.InputJsonValue` (jamais `as any`).
- Custom errors : constructeur qui pose `this.name`.
- Mutations auditées ; horloge et id injectés.
- Suite en série (`maxWorkers:1`) ; nettoyer les tables touchées.
- Rétrocompat : `toCropDocument` gagne des clés optionnelles dans son objet d'options ; les appels existants restent valides.

---

## File Structure

```
apps/api/src/
├── domain/
│   ├── crop/
│   │   ├── nutrient-requirement.ts      # NEW value object (+ NutrientBasis enum)
│   │   ├── yield-reference.ts           # NEW value object (+ InputLevel enum)
│   │   └── crop.ts                      # MODIFY: nutrition + yields collections
│   └── price/
│       └── price-point.ts               # NEW entity
├── application/
│   ├── price/
│   │   ├── price-point.repository.ts    # NEW port
│   │   ├── in-memory-price-point.repository.ts # NEW test util
│   │   ├── add-price-point.use-case.ts  # NEW
│   │   └── list-crop-prices.use-case.ts # NEW
│   ├── crop/
│   │   ├── set-crop-nutrition.use-case.ts # NEW
│   │   ├── set-crop-yields.use-case.ts    # NEW
│   │   └── crop-read-model.ts             # MODIFY: nutrition + yields + prices
├── infrastructure/
│   ├── crop/prisma-crop.repository.ts   # MODIFY: persist nutrition + yields
│   └── price/prisma-price-point.repository.ts # NEW
└── presentation/crop/crop.controller.ts # MODIFY: nutrition/yields/prices endpoints
apps/api/prisma/schema.prisma            # MODIFY: Crop.nutrition + Crop.yields + PricePoint
apps/admin/src/app/crops/[id]/page.tsx   # MODIFY: nutrition/yields/prices sections
apps/admin/src/lib/api.ts                # MODIFY: types + calls
apps/api/src/crop.module.ts              # MODIFY: price providers + use-cases
```

---

### Task 1: `NutrientBasis` enum + `NutrientRequirement` value object (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/crop/nutrient-requirement.ts`
- Test: `apps/api/src/domain/crop/nutrient-requirement.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `enum NutrientBasis { PER_HECTARE, PER_TONNE }`.
  - `class NutrientRequirement` with `create({ nutrient, amount, unit, basis, stage? })`, getters, `NutrientRequirementJSON`, `toJSON()`, `static fromJSON(json)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/crop/nutrient-requirement.spec.ts`:
```ts
import { NutrientRequirement, NutrientBasis } from './nutrient-requirement';

describe('NutrientRequirement', () => {
  it('creates a requirement and round-trips through JSON', () => {
    const r = NutrientRequirement.create({
      nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE, stage: 'couverture',
    });
    const restored = NutrientRequirement.fromJSON(r.toJSON());
    expect(restored.nutrient).toBe('N');
    expect(restored.amount).toBe(120);
    expect(restored.unit).toBe('kg/ha');
    expect(restored.basis).toBe(NutrientBasis.PER_HECTARE);
    expect(restored.stage).toBe('couverture');
  });

  it('allows an omitted stage', () => {
    const r = NutrientRequirement.create({ nutrient: 'K2O', amount: 60, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE });
    expect(r.stage).toBeUndefined();
    expect(r.toJSON().stage).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test nutrient-requirement`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `nutrient-requirement.ts`**

`apps/api/src/domain/crop/nutrient-requirement.ts`:
```ts
export enum NutrientBasis {
  PER_HECTARE = 'PER_HECTARE',
  PER_TONNE = 'PER_TONNE',
}

export interface NutrientRequirementJSON {
  nutrient: string;
  amount: number;
  unit: string;
  basis: NutrientBasis;
  stage?: string;
}

interface CreateProps {
  nutrient: string;
  amount: number;
  unit: string;
  basis: NutrientBasis;
  stage?: string;
}

export class NutrientRequirement {
  private constructor(
    private readonly _nutrient: string,
    private readonly _amount: number,
    private readonly _unit: string,
    private readonly _basis: NutrientBasis,
    private readonly _stage: string | undefined,
  ) {}

  static create(props: CreateProps): NutrientRequirement {
    return new NutrientRequirement(props.nutrient, props.amount, props.unit, props.basis, props.stage);
  }

  get nutrient(): string { return this._nutrient; }
  get amount(): number { return this._amount; }
  get unit(): string { return this._unit; }
  get basis(): NutrientBasis { return this._basis; }
  get stage(): string | undefined { return this._stage; }

  toJSON(): NutrientRequirementJSON {
    return { nutrient: this._nutrient, amount: this._amount, unit: this._unit, basis: this._basis, stage: this._stage };
  }

  static fromJSON(json: NutrientRequirementJSON): NutrientRequirement {
    return new NutrientRequirement(json.nutrient, json.amount, json.unit, json.basis, json.stage);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test nutrient-requirement`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/nutrient-requirement.*
git commit -m "feat(domain): add NutrientBasis enum and NutrientRequirement value object"
```

---

### Task 2: `InputLevel` enum + `YieldReference` value object (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/crop/yield-reference.ts`
- Test: `apps/api/src/domain/crop/yield-reference.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `enum InputLevel { LOW, MEDIUM, HIGH }`.
  - `class YieldReference` with `create({ inputLevel, min, average, potential, unit, zoneId? })` (validates `min <= average <= potential` → `YieldReferenceError`), getters, `YieldReferenceJSON`, `toJSON()`, `static fromJSON(json)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/crop/yield-reference.spec.ts`:
```ts
import { YieldReference, InputLevel, YieldReferenceError } from './yield-reference';

describe('YieldReference', () => {
  it('creates a yield reference and round-trips through JSON', () => {
    const y = YieldReference.create({
      inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha', zoneId: 'zone-1',
    });
    const restored = YieldReference.fromJSON(y.toJSON());
    expect(restored.inputLevel).toBe(InputLevel.MEDIUM);
    expect(restored.min).toBe(2);
    expect(restored.average).toBe(4);
    expect(restored.potential).toBe(6);
    expect(restored.unit).toBe('t/ha');
    expect(restored.zoneId).toBe('zone-1');
  });

  it('rejects min > average', () => {
    expect(() => YieldReference.create({ inputLevel: InputLevel.LOW, min: 5, average: 3, potential: 6, unit: 't/ha' }))
      .toThrow(YieldReferenceError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test yield-reference`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `yield-reference.ts`**

`apps/api/src/domain/crop/yield-reference.ts`:
```ts
export enum InputLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class YieldReferenceError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'YieldReferenceError';
  }
}

export interface YieldReferenceJSON {
  inputLevel: InputLevel;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

interface CreateProps {
  inputLevel: InputLevel;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

export class YieldReference {
  private constructor(
    private readonly _inputLevel: InputLevel,
    private readonly _min: number,
    private readonly _average: number,
    private readonly _potential: number,
    private readonly _unit: string,
    private readonly _zoneId: string | undefined,
  ) {}

  static create(props: CreateProps): YieldReference {
    if (!(props.min <= props.average && props.average <= props.potential)) {
      throw new YieldReferenceError(`Invalid yield: expected min <= average <= potential, got ${props.min}/${props.average}/${props.potential}`);
    }
    return new YieldReference(props.inputLevel, props.min, props.average, props.potential, props.unit, props.zoneId);
  }

  get inputLevel(): InputLevel { return this._inputLevel; }
  get min(): number { return this._min; }
  get average(): number { return this._average; }
  get potential(): number { return this._potential; }
  get unit(): string { return this._unit; }
  get zoneId(): string | undefined { return this._zoneId; }

  toJSON(): YieldReferenceJSON {
    return {
      inputLevel: this._inputLevel, min: this._min, average: this._average,
      potential: this._potential, unit: this._unit, zoneId: this._zoneId,
    };
  }

  static fromJSON(json: YieldReferenceJSON): YieldReference {
    return new YieldReference(json.inputLevel, json.min, json.average, json.potential, json.unit, json.zoneId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test yield-reference`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/yield-reference.*
git commit -m "feat(domain): add InputLevel enum and YieldReference value object"
```

---

### Task 3: `PricePoint` entity (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/price/price-point.ts`
- Test: `apps/api/src/domain/price/price-point.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class PricePoint` with `create({ id, cropId, market, date, price, unit, currency })`, getters, `PricePointSnapshot`, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/price/price-point.spec.ts`:
```ts
import { PricePoint } from './price-point';

describe('PricePoint', () => {
  const base = () => PricePoint.create({
    id: 'pp-1', cropId: 'crop-1', market: 'Dantokpa', date: '2026-06-15',
    price: 350, unit: 'FCFA/kg', currency: 'XOF',
  });

  it('exposes its attributes', () => {
    const p = base();
    expect(p.cropId).toBe('crop-1');
    expect(p.market).toBe('Dantokpa');
    expect(p.date).toBe('2026-06-15');
    expect(p.price).toBe(350);
    expect(p.unit).toBe('FCFA/kg');
    expect(p.currency).toBe('XOF');
  });

  it('round-trips through snapshot', () => {
    const restored = PricePoint.fromSnapshot(base().toSnapshot());
    expect(restored.market).toBe('Dantokpa');
    expect(restored.price).toBe(350);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test price-point`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `price-point.ts`**

`apps/api/src/domain/price/price-point.ts`:
```ts
export interface PricePointSnapshot {
  id: string;
  cropId: string;
  market: string;
  date: string;
  price: number;
  unit: string;
  currency: string;
}

interface CreateProps {
  id: string;
  cropId: string;
  market: string;
  date: string;
  price: number;
  unit: string;
  currency: string;
}

export class PricePoint {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _market: string,
    private readonly _date: string,
    private readonly _price: number,
    private readonly _unit: string,
    private readonly _currency: string,
  ) {}

  static create(props: CreateProps): PricePoint {
    return new PricePoint(props.id, props.cropId, props.market, props.date, props.price, props.unit, props.currency);
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get market(): string { return this._market; }
  get date(): string { return this._date; }
  get price(): number { return this._price; }
  get unit(): string { return this._unit; }
  get currency(): string { return this._currency; }

  toSnapshot(): PricePointSnapshot {
    return {
      id: this._id, cropId: this._cropId, market: this._market, date: this._date,
      price: this._price, unit: this._unit, currency: this._currency,
    };
  }

  static fromSnapshot(s: PricePointSnapshot): PricePoint {
    return new PricePoint(s.id, s.cropId, s.market, s.date, s.price, s.unit, s.currency);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test price-point`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/price/price-point.*
git commit -m "feat(domain): add PricePoint entity"
```

---

### Task 4: Prisma schema + migration (Crop.nutrition + Crop.yields + PricePoint)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing.
- Produces: `Crop.nutrition` + `Crop.yields` Json (nullable) columns + `PricePoint` table.

- [ ] **Step 1: Extend the schema**

Add to `model Crop` (after `phenology`):
```prisma
  nutrition      Json?
  yields         Json?
```
Add a new model:
```prisma
model PricePoint {
  id        String   @id
  cropId    String
  market    String
  date      String
  price     Float
  unit      String
  currency  String
  createdAt DateTime @default(now())

  @@index([cropId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:up && cd apps/api && pnpm exec prisma migrate dev --name add_nutrition_yields_prices && cd ../..`
Expected: migration adds the two `Crop` columns and creates the `PricePoint` table + index; Prisma client regenerated (now includes `pricePoint`).

- [ ] **Step 3: Verify the table**

Run: `docker exec okko-db-1 psql -U okko -d okko -c '\d "PricePoint"'`
Expected: table with the columns above + cropId index.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(infra): add Crop nutrition/yields columns and PricePoint table"
```

---

### Task 5: Extend `Crop` aggregate (nutrition + yields) + persist in crop repo (domain + infra, TDD)

**Files:**
- Modify: `apps/api/src/domain/crop/crop.ts`
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`
- Test: `apps/api/src/domain/crop/crop.spec.ts` (add cases)

**Interfaces:**
- Consumes: `NutrientRequirement`, `NutrientRequirementJSON`, `YieldReference`, `YieldReferenceJSON`.
- Produces: `CropSnapshot` gains optional `nutrition?: NutrientRequirementJSON[]` and `yields?: YieldReferenceJSON[]`. `Crop` gains getters `nutrition`/`yields` (defensive copies) + `setNutrition(list)` / `setYields(list)` (bump version). `toSnapshot`/`fromSnapshot` handle them. `PrismaCropRepository` persists + maps them (the columns exist from Task 4).

- [ ] **Step 1: Write the failing test (add to crop.spec.ts)**

Append to `apps/api/src/domain/crop/crop.spec.ts`:
```ts
import { NutrientRequirement, NutrientBasis } from './nutrient-requirement';
import { YieldReference, InputLevel } from './yield-reference';

describe('Crop nutrition and yields', () => {
  const base = () => Crop.create({
    id: 'crop-nut', commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets nutrition, bumps version, and round-trips', () => {
    const c = base();
    c.setNutrition([NutrientRequirement.create({ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE })]);
    expect(c.version).toBe(2);
    expect(c.nutrition).toHaveLength(1);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.nutrition[0].nutrient).toBe('N');
  });

  it('sets yields and round-trips', () => {
    const c = base();
    c.setYields([YieldReference.create({ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' })]);
    expect(c.version).toBe(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.yields[0].average).toBe(4);
  });

  it('defaults nutrition and yields to empty arrays', () => {
    const c = base();
    expect(c.nutrition).toEqual([]);
    expect(c.yields).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: FAIL — `setNutrition`/`setYields`/`nutrition`/`yields` missing.

- [ ] **Step 3: Extend `crop.ts`**

First READ the current `crop.ts` to find the exact constructor signature (it already has `_climatic`, `_edaphic`, `_phenology` as the last params). Then:
- Add imports:
```ts
import { NutrientRequirement, NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReference, YieldReferenceJSON } from './yield-reference';
```
- Add to `CropSnapshot`: `nutrition?: NutrientRequirementJSON[];` and `yields?: YieldReferenceJSON[];`.
- Append two private fields to the constructor param list AFTER `_phenology`: `_nutrition: NutrientRequirement[]`, `_yields: YieldReference[]`.
- In `create`, append `[]`, `[]` as the two last constructor args (after the `[]` for phenology).
- Add getters + setters:
```ts
  get nutrition(): NutrientRequirement[] { return [...this._nutrition]; }
  get yields(): YieldReference[] { return [...this._yields]; }

  setNutrition(list: NutrientRequirement[]): void {
    this._nutrition = [...list];
    this._version += 1;
  }

  setYields(list: YieldReference[]): void {
    this._yields = [...list];
    this._version += 1;
  }
```
- In `toSnapshot`, add:
```ts
      nutrition: this._nutrition.map((n) => n.toJSON()),
      yields: this._yields.map((y) => y.toJSON()),
```
- In `fromSnapshot`, append the two reconstruction args (LAST):
```ts
      (s.nutrition ?? []).map((j) => NutrientRequirement.fromJSON(j)),
      (s.yields ?? []).map((j) => YieldReference.fromJSON(j)),
```

- [ ] **Step 4: Persist in the crop repository**

In `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`:
- In the `save` payload, add:
```ts
        nutrition: (s.nutrition ?? []) as unknown as Prisma.InputJsonValue,
        yields: (s.yields ?? []) as unknown as Prisma.InputJsonValue,
```
- In `toSnapshot`, add:
```ts
      nutrition: (row.nutrition ?? []) as unknown as CropSnapshot['nutrition'],
      yields: (row.yields ?? []) as unknown as CropSnapshot['yields'],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: PASS (existing + 3 new). Then the FULL suite (needs DB up for the crop integration test): `pnpm db:up && pnpm --filter @okko/api test` — all green. Confirm no `as any`: `grep -rn "as any" apps/api/src` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.spec.ts apps/api/src/infrastructure/crop/prisma-crop.repository.ts
git commit -m "feat(domain): add nutrition and yields collections to Crop with persistence"
```

---

### Task 6: `PricePointRepository` (port + Prisma impl, integration test)

**Files:**
- Create: `apps/api/src/application/price/price-point.repository.ts`
- Create: `apps/api/src/infrastructure/price/prisma-price-point.repository.ts`
- Test: `apps/api/test/prisma-price-point.repository.int-spec.ts`

**Interfaces:**
- Consumes: `PricePointSnapshot`, `PrismaService`, `Prisma`.
- Produces:
  - `interface PricePointRepository { save(p: PricePointSnapshot): Promise<void>; listByCrop(cropId: string): Promise<PricePointSnapshot[]>; }` + token `PRICE_POINT_REPOSITORY`.
  - `class PrismaPricePointRepository implements PricePointRepository` (append-only; `listByCrop` ordered by `date` desc).

- [ ] **Step 1: Define the port**

`apps/api/src/application/price/price-point.repository.ts`:
```ts
import { PricePointSnapshot } from '../../domain/price/price-point';

export const PRICE_POINT_REPOSITORY = Symbol('PRICE_POINT_REPOSITORY');

export interface PricePointRepository {
  save(p: PricePointSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<PricePointSnapshot[]>;
}
```

- [ ] **Step 2: Write the failing integration test**

`apps/api/test/prisma-price-point.repository.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaPricePointRepository } from '../src/infrastructure/price/prisma-price-point.repository';

describe('PrismaPricePointRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaPricePointRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.pricePoint.deleteMany(); await prisma.$disconnect(); });

  it('appends price points and lists them by crop, most recent first', async () => {
    await repo.save({ id: 'pp-int-1', cropId: 'c-int-1', market: 'Dantokpa', date: '2026-05-01', price: 300, unit: 'FCFA/kg', currency: 'XOF' });
    await repo.save({ id: 'pp-int-2', cropId: 'c-int-1', market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' });
    const list = await repo.listByCrop('c-int-1');
    expect(list).toHaveLength(2);
    expect(list[0].date).toBe('2026-06-01'); // most recent first
    expect(list[0].price).toBe(350);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-price-point.repository`
Expected: FAIL — repository not found.

- [ ] **Step 4: Implement `PrismaPricePointRepository`**

`apps/api/src/infrastructure/price/prisma-price-point.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PricePoint as PrismaPrice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricePointRepository } from '../../application/price/price-point.repository';
import { PricePointSnapshot } from '../../domain/price/price-point';

@Injectable()
export class PrismaPricePointRepository implements PricePointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PricePointSnapshot): Promise<void> {
    await this.prisma.pricePoint.upsert({ where: { id: p.id }, create: this.toRow(p), update: this.toRow(p) });
  }

  async listByCrop(cropId: string): Promise<PricePointSnapshot[]> {
    const rows = await this.prisma.pricePoint.findMany({ where: { cropId }, orderBy: { date: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(p: PricePointSnapshot): Prisma.PricePointCreateInput {
    return {
      id: p.id, cropId: p.cropId, market: p.market, date: p.date,
      price: p.price, unit: p.unit, currency: p.currency,
    };
  }

  private toSnapshot(row: PrismaPrice): PricePointSnapshot {
    return {
      id: row.id, cropId: row.cropId, market: row.market, date: row.date,
      price: row.price, unit: row.unit, currency: row.currency,
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-price-point.repository`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/price/price-point.repository.ts apps/api/src/infrastructure/price/prisma-price-point.repository.ts apps/api/test/prisma-price-point.repository.int-spec.ts
git commit -m "feat(infra): add Prisma price-point repository"
```

---

### Task 7: Use-cases `SetCropNutrition`, `SetCropYields`, `AddPricePoint`, `ListCropPrices` (application, TDD)

**Files:**
- Create: `apps/api/src/application/price/in-memory-price-point.repository.ts`
- Create: `apps/api/src/application/crop/set-crop-nutrition.use-case.ts`, `apps/api/src/application/crop/set-crop-yields.use-case.ts`
- Create: `apps/api/src/application/price/add-price-point.use-case.ts`, `apps/api/src/application/price/list-crop-prices.use-case.ts`
- Test: `apps/api/src/application/crop/set-crop-nutrition.use-case.spec.ts`, `apps/api/src/application/price/add-price-point.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `PricePointRepository`, `AuditLogRepository`, `Clock`, `IdGenerator`, `CropNotFoundError`, domain objects.
- Produces:
  - `SetCropNutritionUseCase.execute({ cropId, requirements: NutrientRequirementJSON[], actor })` → `CropSnapshot`.
  - `SetCropYieldsUseCase.execute({ cropId, yields: YieldReferenceJSON[], actor })` → `CropSnapshot`.
  - `AddPricePointUseCase.execute({ cropId, id?, market, date, price, unit, currency, actor })` → `PricePointSnapshot` (verifies crop exists).
  - `ListCropPricesUseCase.execute({ cropId })` → `PricePointSnapshot[]`.

- [ ] **Step 1: In-memory price repo (test util)**

`apps/api/src/application/price/in-memory-price-point.repository.ts`:
```ts
import { PricePointRepository } from './price-point.repository';
import { PricePointSnapshot } from '../../domain/price/price-point';

export class InMemoryPricePointRepository implements PricePointRepository {
  private store: PricePointSnapshot[] = [];
  async save(p: PricePointSnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== p.id).concat(p);
  }
  async listByCrop(cropId: string): Promise<PricePointSnapshot[]> {
    return this.store
      .filter((p) => p.cropId === cropId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}
```

- [ ] **Step 2: Write the failing tests**

`apps/api/src/application/crop/set-crop-nutrition.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropNutritionUseCase } from './set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from './set-crop-yields.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputLevel } from '../../domain/crop/yield-reference';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

async function seed(repo: InMemoryCropRepository, audit: { record: jest.Mock }) {
  await new CreateCropUseCase(repo, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
}

describe('SetCropNutrition / SetCropYields', () => {
  it('sets nutrition and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(repo, audit);
    const out = await new SetCropNutritionUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }],
    });
    expect(out.nutrition).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('sets yields and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(repo, audit);
    const out = await new SetCropYieldsUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      yields: [{ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' }],
    });
    expect(out.yields).toHaveLength(1);
  });

  it('throws CropNotFoundError when absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new SetCropNutritionUseCase(repo, audit, clock).execute({ cropId: 'x', actor: 'a', requirements: [] }))
      .rejects.toThrow(CropNotFoundError);
  });
});
```

`apps/api/src/application/price/add-price-point.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { AddPricePointUseCase } from './add-price-point.use-case';
import { ListCropPricesUseCase } from './list-crop-prices.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryPricePointRepository } from './in-memory-price-point.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `pp-${++seq}` };

async function setup() {
  const crops = new InMemoryCropRepository();
  const prices = new InMemoryPricePointRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  return { crops, prices, audit };
}

describe('AddPricePointUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('adds a price point (crop exists) and lists it', async () => {
    const { crops, prices, audit } = await setup();
    const out = await new AddPricePointUseCase(crops, prices, audit, clock, ids).execute({
      cropId: 'c1', market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });
    expect(out.market).toBe('Dantokpa');
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropPricesUseCase(prices).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('throws CropNotFoundError when the crop does not exist', async () => {
    const { prices, audit } = await setup();
    const crops = new InMemoryCropRepository();
    const uc = new AddPricePointUseCase(crops, prices, audit, clock, ids);
    await expect(uc.execute({ cropId: 'nope', market: 'M', date: '2026-06-01', price: 1, unit: 'u', currency: 'XOF', actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test set-crop-nutrition add-price-point`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/crop/set-crop-nutrition.use-case.ts`:
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { NutrientRequirement, NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropNutritionInput {
  cropId: string;
  requirements: NutrientRequirementJSON[];
  actor: string;
}

export class SetCropNutritionUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropNutritionInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setNutrition(input.requirements.map((j) => NutrientRequirement.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { nutrition: { from: snap.nutrition, to: next.nutrition } },
    });
    return next;
  }
}
```

`apps/api/src/application/crop/set-crop-yields.use-case.ts`:
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { YieldReference, YieldReferenceJSON } from '../../domain/crop/yield-reference';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropYieldsInput {
  cropId: string;
  yields: YieldReferenceJSON[];
  actor: string;
}

export class SetCropYieldsUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropYieldsInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setYields(input.yields.map((j) => YieldReference.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { yields: { from: snap.yields, to: next.yields } },
    });
    return next;
  }
}
```

`apps/api/src/application/price/add-price-point.use-case.ts`:
```ts
import { PricePoint, PricePointSnapshot } from '../../domain/price/price-point';
import { CropRepository } from '../crop/crop.repository';
import { PricePointRepository } from './price-point.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export interface AddPricePointInput {
  cropId: string;
  id?: string;
  market: string;
  date: string;
  price: number;
  unit: string;
  currency: string;
  actor: string;
}

export class AddPricePointUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddPricePointInput): Promise<PricePointSnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    const point = PricePoint.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId, market: input.market, date: input.date,
      price: input.price, unit: input.unit, currency: input.currency,
    });
    const snap = point.toSnapshot();
    await this.prices.save(snap);
    await this.audit.record({
      entityType: 'PricePoint', entityId: point.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/price/list-crop-prices.use-case.ts`:
```ts
import { PricePointSnapshot } from '../../domain/price/price-point';
import { PricePointRepository } from './price-point.repository';

export class ListCropPricesUseCase {
  constructor(private readonly prices: PricePointRepository) {}
  async execute(input: { cropId: string }): Promise<PricePointSnapshot[]> {
    return this.prices.listByCrop(input.cropId);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test set-crop-nutrition add-price-point`
Expected: PASS (5 tests). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/price apps/api/src/application/crop/set-crop-nutrition.use-case.ts apps/api/src/application/crop/set-crop-yields.use-case.ts apps/api/src/application/crop/set-crop-nutrition.use-case.spec.ts
git commit -m "feat(application): add set-nutrition, set-yields, add-price, list-prices use-cases"
```

---

### Task 8: Read-model — crop document nutrition + yields + prices (application, TDD)

**Files:**
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/crop/crop-read-model.spec.ts` (add cases)

**Interfaces:**
- Consumes: `CropSnapshot`, `PricePointSnapshot`.
- Produces: `ToCropDocumentOptions` gains `prices?: PricePointSnapshot[]`; `CropDocument` gains `nutrition: NutrientRequirementJSON[]`, `yields: YieldReferenceJSON[]` (read from the snapshot, default `[]`), and `prices: PricePointSnapshot[]` (from options, default `[]`); serializedText includes nutrition, yields, and latest price lines.

- [ ] **Step 1: Write the failing test (add to crop-read-model.spec.ts)**

Append:
```ts
import { PricePointSnapshot } from '../../domain/price/price-point';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputLevel } from '../../domain/crop/yield-reference';

describe('toCropDocument with nutrition, yields and prices', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 8, metadata: {},
    nutrition: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }],
    yields: [{ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' }],
  };
  const prices: PricePointSnapshot[] = [
    { id: 'pp1', cropId: 'c1', market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' },
  ];

  it('includes nutrition, yields and prices in the document and serialized text', () => {
    const doc = toCropDocument(snap, { prices });
    expect(doc.nutrition).toHaveLength(1);
    expect(doc.yields).toHaveLength(1);
    expect(doc.prices).toHaveLength(1);
    expect(doc.serializedText).toContain('N');
    expect(doc.serializedText).toContain('Dantokpa');
  });

  it('defaults nutrition, yields and prices to empty arrays', () => {
    const doc = toCropDocument({ ...snap, nutrition: undefined, yields: undefined });
    expect(doc.nutrition).toEqual([]);
    expect(doc.yields).toEqual([]);
    expect(doc.prices).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: FAIL — `nutrition`/`yields`/`prices` not on document/options.

- [ ] **Step 3: Extend `crop-read-model.ts`**

In `apps/api/src/application/crop/crop-read-model.ts`:
- Add imports:
```ts
import { PricePointSnapshot } from '../../domain/price/price-point';
import { NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { YieldReferenceJSON } from '../../domain/crop/yield-reference';
```
- Add `prices?: PricePointSnapshot[];` to `ToCropDocumentOptions`.
- Add to `CropDocument`: `nutrition: NutrientRequirementJSON[];`, `yields: YieldReferenceJSON[];`, `prices: PricePointSnapshot[];`.
- Resolve: `const prices = opts.prices ?? [];`, `const nutrition = s.nutrition ?? [];`, `const yields = s.yields ?? [];`.
- After the pests block in `serializedText`, add:
```ts
  if (nutrition.length > 0) {
    lines.push(`Nutrition : ${nutrition.map((n) => `${n.nutrient} ${n.amount}${n.unit}`).join(', ')}`);
  }
  if (yields.length > 0) {
    lines.push(`Rendement : ${yields.map((y) => `${y.inputLevel} ${y.min}-${y.average}-${y.potential} ${y.unit}`).join(', ')}`);
  }
  if (prices.length > 0) {
    const latest = prices[0];
    lines.push(`Prix récent : ${latest.price} ${latest.unit} (${latest.market}, ${latest.date})`);
  }
```
- Add `nutrition,`, `yields,`, `prices,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: PASS (all existing + 2 new). Then full suite — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add nutrition, yields and prices to crop read-model"
```

---

### Task 9: Controller endpoints + module wiring (e2e)

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Test: `apps/api/test/nutrition-price.e2e-spec.ts`

**Interfaces:**
- Consumes: the new use-cases + `PricePointRepository`.
- Produces endpoints: `PATCH /crops/:id/nutrition`, `PATCH /crops/:id/yields`, `POST /crops/:id/prices`, `GET /crops/:id/prices`. `GET /crops/:id` now includes nutrition + yields (from snapshot) + prices.

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/nutrition-price.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Nutrition, yields & prices e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.pricePoint.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.pricePoint.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets nutrition + yields and adds a price, visible on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = crop.body.id;

    await request(app.getHttpServer()).patch(`/crops/${id}/nutrition`)
      .send({ requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: 'PER_HECTARE' }] })
      .expect(200);

    await request(app.getHttpServer()).patch(`/crops/${id}/yields`)
      .send({ yields: [{ inputLevel: 'MEDIUM', min: 2, average: 4, potential: 6, unit: 't/ha' }] })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${id}/prices`)
      .send({ market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' })
      .expect(201);

    const prices = await request(app.getHttpServer()).get(`/crops/${id}/prices`).expect(200);
    expect(prices.body).toHaveLength(1);
    expect(prices.body[0].market).toBe('Dantokpa');

    const doc = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(doc.body.nutrition).toHaveLength(1);
    expect(doc.body.yields).toHaveLength(1);
    expect(doc.body.prices).toHaveLength(1);
  });

  it('returns 404 adding a price for an unknown crop', async () => {
    await request(app.getHttpServer()).post('/crops/does-not-exist/prices')
      .send({ market: 'M', date: '2026-06-01', price: 1, unit: 'u', currency: 'XOF' })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test nutrition-price.e2e`
Expected: FAIL — routes not wired.

- [ ] **Step 3: Extend the crop controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add imports:
```ts
import { SetCropNutritionUseCase } from '../../application/crop/set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from '../../application/crop/set-crop-yields.use-case';
import { AddPricePointUseCase } from '../../application/price/add-price-point.use-case';
import { ListCropPricesUseCase } from '../../application/price/list-crop-prices.use-case';
import { NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { YieldReferenceJSON } from '../../domain/crop/yield-reference';
```
- Inject into the constructor:
```ts
    private readonly setNutrition: SetCropNutritionUseCase,
    private readonly setYields: SetCropYieldsUseCase,
    private readonly addPrice: AddPricePointUseCase,
    private readonly listPrices: ListCropPricesUseCase,
```
- Update `GET /crops/:id` to fetch prices and pass them in the options object (nutrition + yields ride on the snapshot; add `prices` to the existing `{ varieties, zones, windows, pests }` object):
```ts
    const prices = await this.listPrices.execute({ cropId: id });
    return toCropDocument(snap, { varieties, zones, windows, pests, prices });
```
- Add the handlers:
```ts
  @Patch(':id/nutrition')
  async nutrition(@Param('id') id: string, @Body() body: { requirements: NutrientRequirementJSON[] }) {
    try {
      const snap = await this.setNutrition.execute({ cropId: id, actor: ACTOR, requirements: body.requirements });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/yields')
  async yields(@Param('id') id: string, @Body() body: { yields: YieldReferenceJSON[] }) {
    try {
      const snap = await this.setYields.execute({ cropId: id, actor: ACTOR, yields: body.yields });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/prices')
  async createPrice(
    @Param('id') id: string,
    @Body() body: { market: string; date: string; price: number; unit: string; currency: string },
  ) {
    try {
      return await this.addPrice.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Get(':id/prices')
  async getPrices(@Param('id') id: string) {
    return this.listPrices.execute({ cropId: id });
  }
```
- Add a private helper to compose the full document (used by the two PATCH handlers and reusable by GET), to keep it DRY:
```ts
  private async composeCropDocument(id: string, snap: CropSnapshot) {
    const varieties = await this.varieties.listByCrop(id);
    const zones = await this.listCropZones.execute({ cropId: id });
    const windows = await this.listWindows.execute({ cropId: id });
    const pests = await this.listCropPests.execute({ cropId: id });
    const prices = await this.listPrices.execute({ cropId: id });
    return toCropDocument(snap, { varieties, zones, windows, pests, prices });
  }
```
(Import `CropSnapshot` from `../../domain/crop/crop` if not already imported. You MAY refactor the existing `GET /crops/:id` to reuse `composeCropDocument` — that is a welcome DRY improvement, but keep its behavior identical.)

- [ ] **Step 4: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `PrismaPricePointRepository`, `PRICE_POINT_REPOSITORY`, and the four use-cases.
- Add providers:
```ts
    { provide: PRICE_POINT_REPOSITORY, useClass: PrismaPricePointRepository },
    {
      provide: SetCropNutritionUseCase,
      useFactory: (r, a, c) => new SetCropNutritionUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: SetCropYieldsUseCase,
      useFactory: (r, a, c) => new SetCropYieldsUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddPricePointUseCase,
      useFactory: (cr, pr, a, c, ids) => new AddPricePointUseCase(cr, pr, a, c, ids),
      inject: [CROP_REPOSITORY, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListCropPricesUseCase,
      useFactory: (pr) => new ListCropPricesUseCase(pr),
      inject: [PRICE_POINT_REPOSITORY],
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test nutrition-price.e2e`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/nutrition-price.e2e-spec.ts
git commit -m "feat(api): wire nutrition, yields and price endpoints with e2e"
```

---

### Task 10: Admin — nutrition + yields + prices sections on crop detail

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: the Task 9 API.
- Produces: nutrition, yields, and prices sections on the crop detail page.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`, add types and extend `CropDetail`:
```ts
export interface NutrientRequirement { nutrient: string; amount: number; unit: string; basis: string; stage?: string; }
export interface YieldReference { inputLevel: string; min: number; average: number; potential: number; unit: string; zoneId?: string; }
export interface PricePoint { id: string; cropId: string; market: string; date: string; price: number; unit: string; currency: string; }
```
Add to `CropDetail`: `nutrition: NutrientRequirement[]; yields: YieldReference[]; prices: PricePoint[];`.

- [ ] **Step 2: Add sections to the crop detail page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add after the pests section:
```tsx
      <section>
        <h2 className="font-semibold mb-2">Nutrition ({crop.nutrition.length})</h2>
        <ul className="list-disc pl-5">
          {crop.nutrition.map((n, i) => (
            <li key={i}>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${n.stage})` : ''}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Rendement ({crop.yields.length})</h2>
        <ul className="list-disc pl-5">
          {crop.yields.map((y, i) => (
            <li key={i}>{y.inputLevel} : {y.min}–{y.average}–{y.potential} {y.unit}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Prix ({crop.prices.length})</h2>
        <ul className="list-disc pl-5">
          {crop.prices.map((p) => (
            <li key={p.id}>{p.date} — {p.price} {p.unit} @ {p.market}</li>
          ))}
        </ul>
      </section>
```

- [ ] **Step 3: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; `/crops/[id]` compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): nutrition, yields and prices sections on crop detail"
```

---

## Self-Review

**1. Spec coverage (Plan 6 scope):**
- Nutrition & fertilisation (besoins par élément, par stade, par hectare/tonne) → Tasks 1, 5, 7, 8, 9, 10. ✅
- Rendement de référence (min/moyen/potentiel par niveau d'intrants, par zone) → Tasks 2, 5, 7, 8, 9, 10. ✅
- Prix de marché (série temporelle append-only, par marché/date) → Tasks 3, 4, 6, 7, 8, 9, 10. ✅
- Read-model enrichi (AI-ready) → Task 8. ✅
- Audit sur mutations → Tasks 5, 7. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues. ✅

**3. Type consistency:** `NutrientRequirementJSON` (Task 1) → Crop snapshot (Task 5), use-case (Task 7), read-model (Task 8), controller (Task 9). `YieldReferenceJSON` (Task 2) → idem. `PricePointSnapshot` (Task 3) → port + repo (Task 6), use-cases (Task 7), read-model (Task 8), controller (Task 9). `IdGenerator` de `../shared/id-generator`. `toCropDocument` via objet d'options (`{ prices }`). ✅

---

## Notes de conception
- **Migration avant agrégat** (Task 4 avant Task 5) : évite le forward-pull surprise du Plan 4 — la colonne existe avant que le repo persiste les collections toujours-présentes.
- **Nutrition & rendements sur le Crop** (JSONB) : collections intrinsèques à la culture, remplacement complet (`setNutrition`/`setYields`, cohérent avec `set-requirements`/`set-phenology`).
- **Prix = entité append-only** (`PricePoint`, table) : série temporelle qui grandit ; `listByCrop` trié par date décroissante. Le read-model expose le prix le plus récent + la liste.
- **Rendement par zone** : `YieldReference.zoneId` optionnel — permet un rendement de référence par zone agro-écologique (lien avec le Plan 3) sans imposer de FK.
```
