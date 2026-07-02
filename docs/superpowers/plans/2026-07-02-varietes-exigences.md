# Base de connaissances — Plan 2 : Variétés + exigences climatiques & édaphiques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir l'agrégat `Crop` avec ses exigences climatiques et édaphiques (au format `RangeValue` + provenance), et ajouter les **variétés** comme entité liée — de bout en bout : domaine, persistance, API et admin.

**Architecture:** Poursuit la clean architecture du Plan 1. Les exigences climatiques/édaphiques sont des **value objects** portés par l'agrégat `Crop` et persistés en colonnes `JSONB`. Les **variétés** sont une entité distincte (`Variety`) avec sa propre table et son repository, référencée par `cropId`. Le read-model compose la fiche + ses variétés.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation, pour toute logique de domaine et d'application.
- **Clean architecture** : le domaine (`src/domain`) n'importe jamais Prisma/NestJS. Dépendances vers l'intérieur.
- Réutiliser les value objects existants : **`RangeValue`** (`{min,optimal,max,unit}`, invariant `min ≤ optimal ≤ max`), **`TranslatableText`**, **`Provenance`**.
- **Provenance au niveau du bloc** (groupe de valeurs), pas par champ individuel — un `Provenance` optionnel par bloc d'exigences et par variété. Décision assumée pour rester simple ; le spec autorise « par valeur ou par groupe ».
- Colonnes `JSONB` pour les exigences ; nouvelle table pour les variétés.
- Custom errors : constructeur qui pose `this.name` (convention établie au Plan 1 cleanup).
- Versionnement : toute mutation de `Crop` incrémente `version` ; audit via `AuditLogRepository`.
- `capturedAt`/horloge : injectés, jamais `Date.now()` dans le domaine.

---

## File Structure

```
apps/api/src/
├── domain/
│   ├── shared/
│   │   ├── provenance.ts               # MODIFY: add Provenance.fromJSON
│   │   ├── climatic-requirements.ts    # NEW
│   │   └── edaphic-requirements.ts     # NEW
│   └── crop/
│       ├── crop.ts                     # MODIFY: climatic/edaphic + extend CropSnapshot
│       └── variety.ts                  # NEW (entity)
├── application/
│   └── crop/
│       ├── variety.repository.ts       # NEW (port)
│       ├── set-crop-requirements.use-case.ts  # NEW
│       ├── add-variety.use-case.ts     # NEW
│       ├── list-varieties.use-case.ts  # NEW
│       ├── in-memory-variety.repository.ts    # NEW (test util)
│       └── crop-read-model.ts          # MODIFY: requirements + varieties
├── infrastructure/
│   └── crop/
│       ├── prisma-crop.repository.ts   # MODIFY: persist climatic/edaphic
│       └── prisma-variety.repository.ts # NEW
└── presentation/
    └── crop/crop.controller.ts         # MODIFY: requirements + varieties endpoints
apps/api/prisma/schema.prisma           # MODIFY: Crop climatic/edaphic + Variety model
apps/admin/src/app/crops/[id]/page.tsx  # NEW (crop detail)
```

---

### Task 1: `Provenance.fromJSON` + value object `ClimaticRequirements` (domain, TDD)

**Files:**
- Modify: `apps/api/src/domain/shared/provenance.ts`
- Create: `apps/api/src/domain/shared/climatic-requirements.ts`
- Test: `apps/api/src/domain/shared/climatic-requirements.spec.ts`

**Interfaces:**
- Consumes: `RangeValue`, `Provenance`.
- Produces:
  - `Provenance.fromJSON(props): Provenance` reconstructing from a plain object.
  - `class ClimaticRequirements` with `create({ temperature?, rainfall?, provenance?, notes? })`, getters, `toJSON()`, `static fromJSON(json)`. `temperature`/`rainfall` are `RangeValue`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/shared/climatic-requirements.spec.ts`:
```ts
import { ClimaticRequirements } from './climatic-requirements';
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

describe('ClimaticRequirements', () => {
  it('holds temperature and rainfall ranges and round-trips through JSON', () => {
    const c = ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 15, optimal: 22, max: 30, unit: '°C' }),
      rainfall: RangeValue.create({ min: 400, optimal: 700, max: 1100, unit: 'mm' }),
      provenance: Provenance.external({ sourceRef: 'ECOCROP', capturedAt: '2026-07-02', confidence: 'medium' }),
      notes: 'Sensible au gel',
    });
    const restored = ClimaticRequirements.fromJSON(c.toJSON());
    expect(restored.temperature?.optimal).toBe(22);
    expect(restored.rainfall?.max).toBe(1100);
    expect(restored.notes).toBe('Sensible au gel');
    expect(restored.provenance?.sourceRef).toBe('ECOCROP');
  });

  it('allows a partial requirement (only temperature)', () => {
    const c = ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 10, optimal: 18, max: 25, unit: '°C' }),
    });
    expect(c.rainfall).toBeUndefined();
    expect(c.toJSON().rainfall).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test climatic-requirements`
Expected: FAIL — module not found.

- [ ] **Step 3: Add `Provenance.fromJSON`**

In `apps/api/src/domain/shared/provenance.ts`, add a static method (keep the existing `manual`/`external`):
```ts
  static fromJSON(props: ProvenanceProps): Provenance {
    return new Provenance({ ...props });
  }
```
(`ProvenanceProps` is already defined in that file; `Provenance`'s constructor is private but `fromJSON` is a static member so it can call it.)

- [ ] **Step 4: Implement `ClimaticRequirements`**

`apps/api/src/domain/shared/climatic-requirements.ts`:
```ts
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

interface ClimaticProps {
  temperature?: RangeValue;
  rainfall?: RangeValue;
  provenance?: Provenance;
  notes?: string;
}

export interface ClimaticRequirementsJSON {
  temperature?: ReturnType<RangeValue['toJSON']>;
  rainfall?: ReturnType<RangeValue['toJSON']>;
  provenance?: ReturnType<Provenance['toJSON']>;
  notes?: string;
}

export class ClimaticRequirements {
  private constructor(private readonly props: ClimaticProps) {}

  static create(props: ClimaticProps): ClimaticRequirements {
    return new ClimaticRequirements({ ...props });
  }

  get temperature(): RangeValue | undefined { return this.props.temperature; }
  get rainfall(): RangeValue | undefined { return this.props.rainfall; }
  get provenance(): Provenance | undefined { return this.props.provenance; }
  get notes(): string | undefined { return this.props.notes; }

  toJSON(): ClimaticRequirementsJSON {
    return {
      temperature: this.props.temperature?.toJSON(),
      rainfall: this.props.rainfall?.toJSON(),
      provenance: this.props.provenance?.toJSON(),
      notes: this.props.notes,
    };
  }

  static fromJSON(json: ClimaticRequirementsJSON): ClimaticRequirements {
    return new ClimaticRequirements({
      temperature: json.temperature ? RangeValue.create(json.temperature) : undefined,
      rainfall: json.rainfall ? RangeValue.create(json.rainfall) : undefined,
      provenance: json.provenance ? Provenance.fromJSON(json.provenance) : undefined,
      notes: json.notes,
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @okko/api test climatic-requirements`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/shared/provenance.ts apps/api/src/domain/shared/climatic-requirements.*
git commit -m "feat(domain): add ClimaticRequirements value object and Provenance.fromJSON"
```

---

### Task 2: Value object `EdaphicRequirements` (soil) (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/shared/edaphic-requirements.ts`
- Test: `apps/api/src/domain/shared/edaphic-requirements.spec.ts`

**Interfaces:**
- Consumes: `RangeValue`, `Provenance`.
- Produces: `class EdaphicRequirements` with `create({ ph?, texture?, drainage?, provenance?, notes? })`, getters, `toJSON()`, `static fromJSON(json)`. `ph` is `RangeValue`; `texture`/`drainage` are strings.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/shared/edaphic-requirements.spec.ts`:
```ts
import { EdaphicRequirements } from './edaphic-requirements';
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

describe('EdaphicRequirements', () => {
  it('holds pH range, texture, drainage and round-trips through JSON', () => {
    const e = EdaphicRequirements.create({
      ph: RangeValue.create({ min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }),
      texture: 'limono-sableux',
      drainage: 'bon',
      provenance: Provenance.external({ sourceRef: 'iSDAsoil', capturedAt: '2026-07-02' }),
      notes: 'Craint l’engorgement',
    });
    const restored = EdaphicRequirements.fromJSON(e.toJSON());
    expect(restored.ph?.optimal).toBe(6.5);
    expect(restored.texture).toBe('limono-sableux');
    expect(restored.drainage).toBe('bon');
    expect(restored.provenance?.sourceRef).toBe('iSDAsoil');
    expect(restored.notes).toBe('Craint l’engorgement');
  });

  it('allows an empty requirement', () => {
    const e = EdaphicRequirements.create({});
    expect(e.ph).toBeUndefined();
    expect(e.toJSON().ph).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test edaphic-requirements`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `EdaphicRequirements`**

`apps/api/src/domain/shared/edaphic-requirements.ts`:
```ts
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

interface EdaphicProps {
  ph?: RangeValue;
  texture?: string;
  drainage?: string;
  provenance?: Provenance;
  notes?: string;
}

export interface EdaphicRequirementsJSON {
  ph?: ReturnType<RangeValue['toJSON']>;
  texture?: string;
  drainage?: string;
  provenance?: ReturnType<Provenance['toJSON']>;
  notes?: string;
}

export class EdaphicRequirements {
  private constructor(private readonly props: EdaphicProps) {}

  static create(props: EdaphicProps): EdaphicRequirements {
    return new EdaphicRequirements({ ...props });
  }

  get ph(): RangeValue | undefined { return this.props.ph; }
  get texture(): string | undefined { return this.props.texture; }
  get drainage(): string | undefined { return this.props.drainage; }
  get provenance(): Provenance | undefined { return this.props.provenance; }
  get notes(): string | undefined { return this.props.notes; }

  toJSON(): EdaphicRequirementsJSON {
    return {
      ph: this.props.ph?.toJSON(),
      texture: this.props.texture,
      drainage: this.props.drainage,
      provenance: this.props.provenance?.toJSON(),
      notes: this.props.notes,
    };
  }

  static fromJSON(json: EdaphicRequirementsJSON): EdaphicRequirements {
    return new EdaphicRequirements({
      ph: json.ph ? RangeValue.create(json.ph) : undefined,
      texture: json.texture,
      drainage: json.drainage,
      provenance: json.provenance ? Provenance.fromJSON(json.provenance) : undefined,
      notes: json.notes,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test edaphic-requirements`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/shared/edaphic-requirements.*
git commit -m "feat(domain): add EdaphicRequirements value object"
```

---

### Task 3: Extend `Crop` aggregate with requirements + extend `CropSnapshot` (domain, TDD)

**Files:**
- Modify: `apps/api/src/domain/crop/crop.ts`
- Test: `apps/api/src/domain/crop/crop.spec.ts` (add cases)

**Interfaces:**
- Consumes: `ClimaticRequirements`, `EdaphicRequirements`.
- Produces: `CropSnapshot` gains optional `climatic?: ClimaticRequirementsJSON` and `edaphic?: EdaphicRequirementsJSON`. `Crop` gains getters `climatic`/`edaphic` (domain objects) and `setClimaticRequirements(c)`, `setEdaphicRequirements(e)` (bump version). `toSnapshot`/`fromSnapshot` handle the new fields.

- [ ] **Step 1: Write the failing test (add to crop.spec.ts)**

Append to `apps/api/src/domain/crop/crop.spec.ts`:
```ts
import { ClimaticRequirements } from '../shared/climatic-requirements';
import { EdaphicRequirements } from '../shared/edaphic-requirements';
import { RangeValue } from '../shared/range-value';

describe('Crop requirements', () => {
  const base = () => Crop.create({
    id: 'crop-req',
    commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays',
    family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets climatic requirements, bumps version, and survives snapshot round-trip', () => {
    const c = base();
    c.setClimaticRequirements(ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 18, optimal: 25, max: 32, unit: '°C' }),
    }));
    expect(c.version).toBe(2);
    expect(c.climatic?.temperature?.optimal).toBe(25);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.climatic?.temperature?.optimal).toBe(25);
  });

  it('sets edaphic requirements and round-trips', () => {
    const c = base();
    c.setEdaphicRequirements(EdaphicRequirements.create({
      ph: RangeValue.create({ min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }),
      texture: 'argilo-limoneux',
    }));
    expect(c.version).toBe(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.edaphic?.ph?.optimal).toBe(6.5);
    expect(restored.edaphic?.texture).toBe('argilo-limoneux');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: FAIL — `setClimaticRequirements` not a function / `climatic` undefined.

- [ ] **Step 3: Extend `crop.ts`**

Add imports at the top of `apps/api/src/domain/crop/crop.ts`:
```ts
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
```
Extend `CropSnapshot` (add two optional fields):
```ts
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
```
Add private fields to the constructor parameter list and internal state. The cleanest minimal change: add two optional private fields with defaults and thread them through `create`, `toSnapshot`, `fromSnapshot`. Concretely:

In `create`, initialize them as `undefined` (leave the constructor call adding `undefined, undefined` for the two new fields).

Add private fields + getters + setters:
```ts
  // add to constructor params (after _metadata):
  //   private _climatic: ClimaticRequirements | undefined,
  //   private _edaphic: EdaphicRequirements | undefined,

  get climatic(): ClimaticRequirements | undefined { return this._climatic; }
  get edaphic(): EdaphicRequirements | undefined { return this._edaphic; }

  setClimaticRequirements(c: ClimaticRequirements): void {
    this._climatic = c;
    this._version += 1;
  }

  setEdaphicRequirements(e: EdaphicRequirements): void {
    this._edaphic = e;
    this._version += 1;
  }
```
Update `create` to pass `undefined, undefined` for the two new constructor args.
Update `toSnapshot` to add:
```ts
      climatic: this._climatic?.toJSON(),
      edaphic: this._edaphic?.toJSON(),
```
Update `fromSnapshot` to pass:
```ts
      s.climatic ? ClimaticRequirements.fromJSON(s.climatic) : undefined,
      s.edaphic ? EdaphicRequirements.fromJSON(s.edaphic) : undefined,
```

> The existing broadened tests (rename/setMetadata assertions) must still pass — do not change existing behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Run the full suite to check for snapshot-shape regressions**

Run: `pnpm --filter @okko/api test`
Expected: all green (the read-model and repository tests still pass because the new fields are optional).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.spec.ts
git commit -m "feat(domain): add climatic/edaphic requirements to Crop aggregate and snapshot"
```

---

### Task 4: `Variety` entity (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/crop/variety.ts`
- Test: `apps/api/src/domain/crop/variety.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`, `RangeValue`, `Provenance`.
- Produces: `class Variety` with `create({ id, cropId, name: TranslatableText, maturityDays?, yieldPotential?: RangeValue, traits?: string[], provenance? })`, getters, `VarietySnapshot` interface, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/crop/variety.spec.ts`:
```ts
import { Variety } from './variety';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('Variety', () => {
  const base = () => Variety.create({
    id: 'var-1',
    cropId: 'crop-1',
    name: TranslatableText.create({ fr: 'Obatanpa' }),
    maturityDays: 120,
    yieldPotential: RangeValue.create({ min: 2, optimal: 4, max: 6, unit: 't/ha' }),
    traits: ['tolérante à la sécheresse'],
  });

  it('exposes its attributes', () => {
    const v = base();
    expect(v.cropId).toBe('crop-1');
    expect(v.name.getOrDefault('fr')).toBe('Obatanpa');
    expect(v.maturityDays).toBe(120);
    expect(v.yieldPotential?.optimal).toBe(4);
    expect(v.traits).toEqual(['tolérante à la sécheresse']);
  });

  it('round-trips through snapshot', () => {
    const restored = Variety.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Obatanpa');
    expect(restored.yieldPotential?.max).toBe(6);
    expect(restored.traits).toEqual(['tolérante à la sécheresse']);
  });

  it('defaults traits to an empty array', () => {
    const v = Variety.create({ id: 'v', cropId: 'c', name: TranslatableText.create({ fr: 'X' }) });
    expect(v.traits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test variety.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `variety.ts`**

`apps/api/src/domain/crop/variety.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { Provenance } from '../shared/provenance';

export interface VarietySnapshot {
  id: string;
  cropId: string;
  name: Record<string, string>;
  maturityDays?: number;
  yieldPotential?: ReturnType<RangeValue['toJSON']>;
  traits: string[];
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateVarietyProps {
  id: string;
  cropId: string;
  name: TranslatableText;
  maturityDays?: number;
  yieldPotential?: RangeValue;
  traits?: string[];
  provenance?: Provenance;
}

export class Variety {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _name: TranslatableText,
    private readonly _maturityDays: number | undefined,
    private readonly _yieldPotential: RangeValue | undefined,
    private readonly _traits: string[],
    private readonly _provenance: Provenance | undefined,
  ) {}

  static create(props: CreateVarietyProps): Variety {
    return new Variety(
      props.id, props.cropId, props.name, props.maturityDays,
      props.yieldPotential, props.traits ?? [], props.provenance,
    );
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get name(): TranslatableText { return this._name; }
  get maturityDays(): number | undefined { return this._maturityDays; }
  get yieldPotential(): RangeValue | undefined { return this._yieldPotential; }
  get traits(): string[] { return [...this._traits]; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): VarietySnapshot {
    return {
      id: this._id,
      cropId: this._cropId,
      name: this._name.toJSON(),
      maturityDays: this._maturityDays,
      yieldPotential: this._yieldPotential?.toJSON(),
      traits: [...this._traits],
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: VarietySnapshot): Variety {
    return new Variety(
      s.id, s.cropId, TranslatableText.create(s.name), s.maturityDays,
      s.yieldPotential ? RangeValue.create(s.yieldPotential) : undefined,
      [...s.traits],
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test variety.spec`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/variety.*
git commit -m "feat(domain): add Variety entity with snapshot round-trip"
```

---

### Task 5: Prisma schema + migration (Crop columns + Variety table)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing.
- Produces: `Crop.climatic`/`Crop.edaphic` Json (nullable) columns; new `Variety` model.

- [ ] **Step 1: Extend the schema**

In `apps/api/prisma/schema.prisma`, add to `model Crop` (after `metadata`):
```prisma
  climatic       Json?
  edaphic        Json?
```
Add a new model:
```prisma
model Variety {
  id             String   @id
  cropId         String
  name           Json
  maturityDays   Int?
  yieldPotential Json?
  traits         Json
  provenance     Json?
  createdAt      DateTime @default(now())

  @@index([cropId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:up && cd apps/api && pnpm exec prisma migrate dev --name add_requirements_and_variety && cd ../..`
Expected: migration created adding `climatic`/`edaphic` columns to `Crop` and creating the `Variety` table + index; Prisma client regenerated (now includes `variety` accessor).

- [ ] **Step 3: Verify the tables**

Run: `docker exec okko-db-1 psql -U okko -d okko -c "\d \"Variety\""`
Expected: the `Variety` table exists with the columns above.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(infra): add Crop climatic/edaphic columns and Variety table migration"
```

---

### Task 6: Persist requirements + `VarietyRepository` (port + Prisma impl, integration test)

**Files:**
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`
- Create: `apps/api/src/application/crop/variety.repository.ts` (port)
- Create: `apps/api/src/infrastructure/crop/prisma-variety.repository.ts`
- Test: `apps/api/test/prisma-variety.repository.int-spec.ts`

**Interfaces:**
- Consumes: `CropSnapshot`, `VarietySnapshot`, `PrismaService`, `Prisma`.
- Produces:
  - `PrismaCropRepository` now persists `climatic`/`edaphic` (save + toSnapshot mapper).
  - `interface VarietyRepository { save(v: VarietySnapshot): Promise<void>; listByCrop(cropId: string): Promise<VarietySnapshot[]>; }` + token `VARIETY_REPOSITORY`.
  - `class PrismaVarietyRepository implements VarietyRepository`.

- [ ] **Step 1: Update the crop repository to persist requirements**

In `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`:
- In `save`, add to both `create` and `update` payloads:
```ts
        climatic: (s.climatic ?? undefined) as Prisma.InputJsonValue | undefined,
        edaphic: (s.edaphic ?? undefined) as Prisma.InputJsonValue | undefined,
```
(Prisma accepts `undefined` to mean "leave unset"; a nullable Json column stores it as NULL when omitted.)
- In `toSnapshot(row)`, add:
```ts
      climatic: (row.climatic ?? undefined) as CropSnapshot['climatic'],
      edaphic: (row.edaphic ?? undefined) as CropSnapshot['edaphic'],
```

- [ ] **Step 2: Define the `VarietyRepository` port**

`apps/api/src/application/crop/variety.repository.ts`:
```ts
import { VarietySnapshot } from '../../domain/crop/variety';

export const VARIETY_REPOSITORY = Symbol('VARIETY_REPOSITORY');

export interface VarietyRepository {
  save(v: VarietySnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<VarietySnapshot[]>;
}
```

- [ ] **Step 3: Write the failing integration test**

`apps/api/test/prisma-variety.repository.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaVarietyRepository } from '../src/infrastructure/crop/prisma-variety.repository';

describe('PrismaVarietyRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaVarietyRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.variety.deleteMany(); await prisma.$disconnect(); });

  it('saves and lists varieties by crop', async () => {
    await repo.save({
      id: 'v-int-1', cropId: 'crop-int-1', name: { fr: 'Obatanpa' },
      maturityDays: 120, yieldPotential: { min: 2, optimal: 4, max: 6, unit: 't/ha' },
      traits: ['précoce'], provenance: undefined,
    });
    const list = await repo.listByCrop('crop-int-1');
    expect(list).toHaveLength(1);
    expect(list[0].name.fr).toBe('Obatanpa');
    expect(list[0].traits).toEqual(['précoce']);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-variety.repository`
Expected: FAIL — `PrismaVarietyRepository` not found.

- [ ] **Step 5: Implement `PrismaVarietyRepository`**

`apps/api/src/infrastructure/crop/prisma-variety.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Variety as PrismaVariety } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VarietyRepository } from '../../application/crop/variety.repository';
import { VarietySnapshot } from '../../domain/crop/variety';

@Injectable()
export class PrismaVarietyRepository implements VarietyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(v: VarietySnapshot): Promise<void> {
    await this.prisma.variety.upsert({
      where: { id: v.id },
      create: this.toRow(v),
      update: this.toRow(v),
    });
  }

  async listByCrop(cropId: string): Promise<VarietySnapshot[]> {
    const rows = await this.prisma.variety.findMany({
      where: { cropId }, orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(v: VarietySnapshot) {
    return {
      id: v.id,
      cropId: v.cropId,
      name: v.name as Prisma.InputJsonValue,
      maturityDays: v.maturityDays ?? null,
      yieldPotential: (v.yieldPotential ?? undefined) as Prisma.InputJsonValue | undefined,
      traits: v.traits as Prisma.InputJsonValue,
      provenance: (v.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaVariety): VarietySnapshot {
    return {
      id: row.id,
      cropId: row.cropId,
      name: row.name as Record<string, string>,
      maturityDays: row.maturityDays ?? undefined,
      yieldPotential: (row.yieldPotential ?? undefined) as VarietySnapshot['yieldPotential'],
      traits: row.traits as string[],
      provenance: (row.provenance ?? undefined) as VarietySnapshot['provenance'],
    };
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-variety.repository`
Expected: PASS. Then `pnpm --filter @okko/api test` — full suite green (crop repo integration still passes with new optional columns).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/infrastructure/crop apps/api/src/application/crop/variety.repository.ts apps/api/test/prisma-variety.repository.int-spec.ts
git commit -m "feat(infra): persist crop requirements and add Prisma variety repository"
```

---

### Task 7: Use-cases `SetCropRequirements`, `AddVariety`, `ListVarieties` (application, TDD)

**Files:**
- Create: `apps/api/src/application/crop/in-memory-variety.repository.ts`
- Create: `apps/api/src/application/crop/set-crop-requirements.use-case.ts`
- Create: `apps/api/src/application/crop/add-variety.use-case.ts`
- Create: `apps/api/src/application/crop/list-varieties.use-case.ts`
- Test: `apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts`, `add-variety.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `VarietyRepository`, `AuditLogRepository`, `Clock`, `CropNotFoundError`, domain objects.
- Produces:
  - `SetCropRequirementsUseCase.execute({ id, climatic?: ClimaticRequirementsJSON, edaphic?: EdaphicRequirementsJSON, actor })` → updated `CropSnapshot` (loads crop, applies requirements, saves, audits; throws `CropNotFoundError` if absent).
  - `AddVarietyUseCase.execute({ cropId, id?, name, maturityDays?, yieldPotential?, traits?, actor })` → `VarietySnapshot` (verifies the crop exists, creates Variety, saves, audits).
  - `ListVarietiesUseCase.execute({ cropId })` → `VarietySnapshot[]`.

- [ ] **Step 1: In-memory variety repo (test util)**

`apps/api/src/application/crop/in-memory-variety.repository.ts`:
```ts
import { VarietyRepository } from './variety.repository';
import { VarietySnapshot } from '../../domain/crop/variety';

export class InMemoryVarietyRepository implements VarietyRepository {
  private store: VarietySnapshot[] = [];
  async save(v: VarietySnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== v.id).concat(v);
  }
  async listByCrop(cropId: string): Promise<VarietySnapshot[]> {
    return this.store.filter((v) => v.cropId === cropId);
  }
}
```

- [ ] **Step 2: Write the failing tests**

`apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropRequirementsUseCase } from './set-crop-requirements.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

async function seed(repo: InMemoryCropRepository, audit: { record: jest.Mock }) {
  await new CreateCropUseCase(repo, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
}

describe('SetCropRequirementsUseCase', () => {
  it('applies climatic + edaphic requirements and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(repo, audit);
    const uc = new SetCropRequirementsUseCase(repo, audit, clock);
    const out = await uc.execute({
      id: 'c1', actor: 'a',
      climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
      edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }, texture: 'limoneux' },
    });
    expect(out.climatic?.temperature?.optimal).toBe(25);
    expect(out.edaphic?.ph?.optimal).toBe(6.5);
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const uc = new SetCropRequirementsUseCase(repo, audit, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a', climatic: {} })).rejects.toThrow(CropNotFoundError);
  });
});
```

`apps/api/src/application/crop/add-variety.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('AddVarietyUseCase', () => {
  it('adds a variety to an existing crop and lists it', async () => {
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const add = new AddVarietyUseCase(crops, varieties, audit, clock, ids);
    const v = await add.execute({ cropId: 'c1', name: { fr: 'Obatanpa' }, maturityDays: 120, traits: ['précoce'], actor: 'a' });
    expect(v.cropId).toBe('c1');
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListVarietiesUseCase(varieties).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].name.fr).toBe('Obatanpa');
  });

  it('throws CropNotFoundError when the crop does not exist', async () => {
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };
    const add = new AddVarietyUseCase(crops, varieties, audit, clock, ids);
    await expect(add.execute({ cropId: 'nope', name: { fr: 'X' }, actor: 'a' })).rejects.toThrow(CropNotFoundError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test set-crop-requirements add-variety`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/crop/set-crop-requirements.use-case.ts`:
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropRequirementsInput {
  id: string;
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
  actor: string;
}

export class SetCropRequirementsUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropRequirementsInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    if (input.climatic) crop.setClimaticRequirements(ClimaticRequirements.fromJSON(input.climatic));
    if (input.edaphic) crop.setEdaphicRequirements(EdaphicRequirements.fromJSON(input.edaphic));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { climatic: input.climatic, edaphic: input.edaphic },
    });
    return next;
  }
}
```

`apps/api/src/application/crop/add-variety.use-case.ts`:
```ts
import { Variety, VarietySnapshot } from '../../domain/crop/variety';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { CropRepository } from './crop.repository';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface IdGenerator { next(): string; }

export interface AddVarietyInput {
  cropId: string;
  id?: string;
  name: Record<string, string>;
  maturityDays?: number;
  yieldPotential?: ReturnType<RangeValue['toJSON']>;
  traits?: string[];
  actor: string;
}

export class AddVarietyUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddVarietyInput): Promise<VarietySnapshot> {
    const crop = await this.crops.findById(input.cropId);
    if (!crop) throw new CropNotFoundError(input.cropId);
    const variety = Variety.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId,
      name: TranslatableText.create(input.name),
      maturityDays: input.maturityDays,
      yieldPotential: input.yieldPotential ? RangeValue.create(input.yieldPotential) : undefined,
      traits: input.traits,
    });
    const snap = variety.toSnapshot();
    await this.varieties.save(snap);
    await this.audit.record({
      entityType: 'Variety', entityId: variety.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/crop/list-varieties.use-case.ts`:
```ts
import { VarietySnapshot } from '../../domain/crop/variety';
import { VarietyRepository } from './variety.repository';

export class ListVarietiesUseCase {
  constructor(private readonly varieties: VarietyRepository) {}

  async execute(input: { cropId: string }): Promise<VarietySnapshot[]> {
    return this.varieties.listByCrop(input.cropId);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test set-crop-requirements add-variety`
Expected: PASS (4 tests). Then run the full suite: `pnpm --filter @okko/api test` — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/crop
git commit -m "feat(application): add set-requirements, add-variety, list-varieties use-cases"
```

---

### Task 8: Extend read-model with requirements + varieties (application, TDD)

**Files:**
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/crop/crop-read-model.spec.ts` (add cases)

**Interfaces:**
- Consumes: `CropSnapshot`, `VarietySnapshot`.
- Produces: `CropDocument` gains `climatic?`, `edaphic?`, `varieties: VarietySnapshot[]`. `toCropDocument(snapshot, locale?, varieties?: VarietySnapshot[])` — third optional arg defaults to `[]`. `serializedText` includes requirements and variety names.

- [ ] **Step 1: Write the failing test (add to crop-read-model.spec.ts)**

Append:
```ts
import { VarietySnapshot } from '../../domain/crop/variety';

describe('toCropDocument with requirements and varieties', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 4, metadata: {},
    climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
    edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } },
  };
  const varieties: VarietySnapshot[] = [
    { id: 'v1', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] },
  ];

  it('includes requirements and varieties in the document and serialized text', () => {
    const doc = toCropDocument(snap, 'fr', varieties);
    expect(doc.climatic?.temperature?.optimal).toBe(25);
    expect(doc.edaphic?.ph?.optimal).toBe(6.5);
    expect(doc.varieties).toHaveLength(1);
    expect(doc.serializedText).toContain('Obatanpa');
    expect(doc.serializedText).toContain('25');
    expect(doc.serializedText).toContain('6.5');
  });

  it('defaults varieties to an empty array', () => {
    const doc = toCropDocument(snap, 'fr');
    expect(doc.varieties).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: FAIL — `varieties`/`climatic` not on document; third arg unsupported.

- [ ] **Step 3: Extend `crop-read-model.ts`**

Replace the file contents with:
```ts
import { CropSnapshot } from '../../domain/crop/crop';
import { VarietySnapshot } from '../../domain/crop/variety';

export interface CropDocument {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  cycleType: string;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  climatic?: CropSnapshot['climatic'];
  edaphic?: CropSnapshot['edaphic'];
  varieties: VarietySnapshot[];
  serializedText: string;
}

export function toCropDocument(
  s: CropSnapshot,
  locale = 'fr',
  varieties: VarietySnapshot[] = [],
): CropDocument {
  const name = s.commonNames[locale] ?? s.commonNames['fr'];
  const lines = [
    `# ${name} (${s.scientificName})`,
    `Famille : ${s.family}`,
    `Type de cycle : ${s.cycleType}`,
    `Statut : ${s.status} (version ${s.version})`,
  ];
  if (s.climatic?.temperature) {
    const t = s.climatic.temperature;
    lines.push(`Température : ${t.min}–${t.optimal}–${t.max} ${t.unit}`);
  }
  if (s.climatic?.rainfall) {
    const r = s.climatic.rainfall;
    lines.push(`Pluviométrie : ${r.min}–${r.optimal}–${r.max} ${r.unit}`);
  }
  if (s.edaphic?.ph) {
    const p = s.edaphic.ph;
    lines.push(`pH du sol : ${p.min}–${p.optimal}–${p.max}`);
  }
  if (varieties.length > 0) {
    lines.push(`Variétés : ${varieties.map((v) => v.name[locale] ?? v.name['fr']).join(', ')}`);
  }
  return {
    id: s.id, name, scientificName: s.scientificName, family: s.family,
    cycleType: s.cycleType, status: s.status, version: s.version,
    metadata: s.metadata, climatic: s.climatic, edaphic: s.edaphic,
    varieties, serializedText: lines.join('\n'),
  };
}
```

> Note: existing callers passing two args still compile (third arg defaults to `[]`; `varieties` defaults to `[]`). The controller (Task 9) will pass varieties where relevant.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): extend crop read-model with requirements and varieties"
```

---

### Task 9: Controller endpoints + module wiring (e2e)

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Create: `apps/api/src/infrastructure/uuid-id-generator.ts`
- Test: `apps/api/test/variety-requirements.e2e-spec.ts`

**Interfaces:**
- Consumes: the new use-cases, `VarietyRepository`, `VARIETY_REPOSITORY`, read-model.
- Produces endpoints: `PATCH /crops/:id/requirements`, `POST /crops/:id/varieties`, `GET /crops/:id/varieties`. `GET /crops/:id` now includes the crop's varieties.

- [ ] **Step 1: Id generator (infrastructure)**

`apps/api/src/infrastructure/uuid-id-generator.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdGenerator } from '../application/crop/add-variety.use-case';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  next(): string { return randomUUID(); }
}
```

- [ ] **Step 2: Write the failing e2e test**

`apps/api/test/variety-requirements.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Requirements & varieties e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets requirements and adds a variety, visible on the crop', async () => {
    const created = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = created.body.id;

    await request(app.getHttpServer()).patch(`/crops/${id}/requirements`)
      .send({ climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
              edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } } })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Obatanpa' }, maturityDays: 120, traits: ['précoce'] })
      .expect(201);

    const list = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name.fr).toBe('Obatanpa');

    const crop = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(crop.body.climatic.temperature.optimal).toBe(25);
    expect(crop.body.varieties).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test variety-requirements.e2e`
Expected: FAIL — routes not wired.

- [ ] **Step 4: Extend the controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add imports:
```ts
import { SetCropRequirementsUseCase } from '../../application/crop/set-crop-requirements.use-case';
import { AddVarietyUseCase } from '../../application/crop/add-variety.use-case';
import { ListVarietiesUseCase } from '../../application/crop/list-varieties.use-case';
import { VARIETY_REPOSITORY, VarietyRepository } from '../../application/crop/variety.repository';
import { ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { RangeValue } from '../../domain/shared/range-value';
```
- Inject the new dependencies in the constructor (add params):
```ts
    private readonly setRequirements: SetCropRequirementsUseCase,
    private readonly addVariety: AddVarietyUseCase,
    private readonly listVarieties: ListVarietiesUseCase,
    @Inject(VARIETY_REPOSITORY) private readonly varieties: VarietyRepository,
```
- Update `GET /crops/:id` to include varieties:
```ts
  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    const vars = await this.varieties.listByCrop(id);
    return toCropDocument(snap, 'fr', vars);
  }
```
- Add the new handlers:
```ts
  @Patch(':id/requirements')
  async requirements(
    @Param('id') id: string,
    @Body() body: { climatic?: ClimaticRequirementsJSON; edaphic?: EdaphicRequirementsJSON },
  ) {
    try {
      const snap = await this.setRequirements.execute({ id, actor: ACTOR, ...body });
      const vars = await this.varieties.listByCrop(id);
      return toCropDocument(snap, 'fr', vars);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/varieties')
  async createVariety(
    @Param('id') id: string,
    @Body() body: { name: Record<string, string>; maturityDays?: number; yieldPotential?: ReturnType<RangeValue['toJSON']>; traits?: string[] },
  ) {
    try {
      return await this.addVariety.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Get(':id/varieties')
  async getVarieties(@Param('id') id: string) {
    return this.listVarieties.execute({ cropId: id });
  }
```
Keep the existing `CropNotFoundError` import.

- [ ] **Step 5: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `PrismaVarietyRepository`, `UuidIdGenerator`, `VARIETY_REPOSITORY`, and the three use-cases.
- Add providers:
```ts
    { provide: VARIETY_REPOSITORY, useClass: PrismaVarietyRepository },
    UuidIdGenerator,
    {
      provide: SetCropRequirementsUseCase,
      useFactory: (r, a, c) => new SetCropRequirementsUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddVarietyUseCase,
      useFactory: (cr, vr, a, c, ids) => new AddVarietyUseCase(cr, vr, a, c, ids),
      inject: [CROP_REPOSITORY, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListVarietiesUseCase,
      useFactory: (vr) => new ListVarietiesUseCase(vr),
      inject: [VARIETY_REPOSITORY],
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test variety-requirements.e2e`
Expected: PASS. Then full suite: `pnpm --filter @okko/api test` — all green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/presentation apps/api/src/crop.module.ts apps/api/src/infrastructure/uuid-id-generator.ts apps/api/test/variety-requirements.e2e-spec.ts
git commit -m "feat(api): wire requirements and variety endpoints with e2e"
```

---

### Task 10: Admin crop detail page (requirements + varieties)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/app/crops/[id]/page.tsx`
- Modify: `apps/admin/src/app/crops/page.tsx` (link each crop to its detail page)

**Interfaces:**
- Consumes: the API from Task 9.
- Produces: a crop detail page showing climatic/edaphic requirements and the variety list, with a form to add a variety.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`, extend `CropDocument` and add functions:
```ts
export interface Variety {
  id: string; cropId: string; name: Record<string, string>;
  maturityDays?: number; traits: string[];
}

export interface CropDetail extends CropDocument {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string };
  varieties: Variety[];
}

export async function getCrop(id: string): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function addVariety(cropId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[] }): Promise<Variety> {
  const res = await fetch(`${BASE}/crops/${cropId}/varieties`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```

- [ ] **Step 2: Crop detail page**

`apps/admin/src/app/crops/[id]/page.tsx`:
```tsx
import { getCrop } from '../../../lib/api';

export default async function CropDetailPage({ params }: { params: { id: string } }) {
  const crop = await getCrop(params.id);
  return (
    <main className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{crop.name} <em className="text-base text-gray-500">{crop.scientificName}</em></h1>
      <p className="text-sm">{crop.cycleType} · {crop.status} (v{crop.version})</p>

      <section>
        <h2 className="font-semibold mb-2">Exigences climatiques</h2>
        {crop.climatic?.temperature
          ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
          : <p className="text-gray-400">Non renseignées</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Exigences édaphiques</h2>
        {crop.edaphic?.ph
          ? <p>pH : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>
          : <p className="text-gray-400">Non renseignées</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Variétés ({crop.varieties.length})</h2>
        <ul className="list-disc pl-5">
          {crop.varieties.map((v) => (
            <li key={v.id}>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Link the list to detail pages**

In `apps/admin/src/app/crops/page.tsx`, wrap each crop name in a link to `/crops/${c.id}`:
```tsx
import Link from 'next/link';
// inside the <li>:
<Link href={`/crops/${c.id}`} className="text-green-800 underline">{c.name}</Link>
```
(Keep the rest of the list markup.)

- [ ] **Step 4: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; routes `/crops`, `/crops/new`, `/crops/[id]` compile.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): crop detail page with requirements and varieties"
```

---

## Self-Review

**1. Spec coverage (Plan 2 scope):**
- Variétés (catégorie 3) → Tasks 4, 6, 7, 9, 10. ✅
- Exigences climatiques (catégorie 4) → Tasks 1, 3, 7, 8, 9. ✅
- Exigences édaphiques (catégorie 5) → Tasks 2, 3, 7, 8, 9. ✅
- `RangeValue` réutilisé pour température/pluie/pH/rendement → Tasks 1, 2, 4. ✅
- Provenance par bloc → Tasks 1, 2, 4 (via `Provenance.fromJSON`). ✅
- Read-model enrichi (AI-ready) → Task 8. ✅
- Versionnement + audit sur mutations → Tasks 3, 7. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues fournies. ✅

**3. Type consistency:** `ClimaticRequirementsJSON`/`EdaphicRequirementsJSON` définis en Task 1/2 et réutilisés dans `CropSnapshot` (Task 3), les use-cases (Task 7) et le contrôleur (Task 9) ; `VarietySnapshot` défini en Task 4 et utilisé par le port (Task 6), les use-cases (Task 7), le read-model (Task 8) ; `IdGenerator` défini dans `add-variety.use-case.ts` (Task 7) et implémenté par `UuidIdGenerator` (Task 9) ; `toCropDocument` 3e argument optionnel rétrocompatible avec les appels du Plan 1. ✅

---

## Notes de conception (à valider)
- **Provenance au niveau du bloc** (un `Provenance` par bloc d'exigences / par variété), pas par champ. Simplification assumée ; on pourra descendre à la granularité par champ dans un plan ultérieur si besoin.
- **Variétés = entité séparée** (table + repository propres), pas incluses dans `CropSnapshot`. Le read-model les compose à la lecture. Garde `CropSnapshot` léger.
- **Exigences = JSONB sur `Crop`** (pas de tables normalisées) — cohérent avec la philosophie JSONB du spec et la réutilisation de `RangeValue`.
```
