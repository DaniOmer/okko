# Base de connaissances — Plan 5 : Ravageurs & maladies + lutte durable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire le **2e catalogue de référence partagé** — les ravageurs/maladies (`PestDisease`) — et la relation culture ↔ ravageur (`CropPestControl`) portant la sensibilité, les seuils et les **méthodes de lutte durable** (prévention → bio → intégrée → chimique en dernier recours).

**Architecture:** Poursuit la clean architecture des Plans 1-4. `PestDisease` est un **agrégat de référence partagé** (table + repository), décrit une fois et réutilisé par toutes les cultures — même patron que `AgroEcologicalZone` (Plan 3). `CropPestControl` est une entité de liaison à **clé composite `(cropId, pestId)`** qui **embarque** sa liste de méthodes de lutte. Le read-model compose la fiche culture avec ses ravageurs via l'objet d'options `toCropDocument`.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation.
- **Clean architecture** : le domaine n'importe jamais Prisma/NestJS ; ports en application, adaptateurs en infra.
- Réutiliser : `TranslatableText`, `Provenance` (+ `fromJSON`), `IdGenerator` (depuis **`../shared/id-generator`** — extrait en pré-work), `UuidIdGenerator`, `CropNotFoundError`.
- **`toCropDocument`** utilise désormais un **objet d'options** `ToCropDocumentOptions` (pré-work) — Plan 5 ajoute `pests?` à cet objet, PAS un argument positionnel.
- **Catalogue partagé** : un ravageur est décrit une fois ; les cultures s'y rattachent via `CropPestControl`.
- **Clé composite** `(cropId, pestId)` — upsert sur cette clé.
- **Provenance par défaut MANUAL** sur `SetCropPestControl` (leçon du Plan 3 : ne pas laisser tomber la provenance) ; provenance externe optionnelle acceptée par l'API.
- Colonnes `JSONB` pour i18n / méthodes de lutte / photos / metadata ; casts via `Prisma.InputJsonValue` (ou `as unknown as Prisma.InputJsonValue` pour les tableaux d'objets ; jamais `as any`).
- Custom errors : constructeur qui pose `this.name`.
- Mutations auditées ; horloge et id injectés.
- Suite en série (`maxWorkers:1`) ; nettoyer les tables touchées.

---

## File Structure

```
apps/api/src/
├── domain/pest/
│   ├── pest-type.ts                     # NEW enum
│   ├── pest-disease.ts                  # NEW aggregate
│   ├── control-category.ts              # NEW enum
│   ├── control-method.ts                # NEW value object
│   ├── susceptibility-level.ts          # NEW enum
│   └── crop-pest-control.ts             # NEW entity (composite key, embeds control methods)
├── application/pest/
│   ├── pest.repository.ts               # NEW port
│   ├── crop-pest-control.repository.ts  # NEW port
│   ├── in-memory-pest.repository.ts     # NEW test util
│   ├── in-memory-crop-pest-control.repository.ts  # NEW test util
│   ├── create-pest.use-case.ts          # NEW
│   ├── list-pests.use-case.ts           # NEW
│   ├── set-crop-pest-control.use-case.ts # NEW (PestNotFoundError; provenance default MANUAL)
│   ├── list-crop-pests.use-case.ts      # NEW (join with pest names)
│   └── pest-read-model.ts               # NEW
├── application/crop/crop-read-model.ts  # MODIFY: add pests to options + CropDocument
├── infrastructure/pest/
│   ├── prisma-pest.repository.ts        # NEW
│   └── prisma-crop-pest-control.repository.ts  # NEW
└── presentation/pest/pest.controller.ts # NEW (pest CRUD)
    presentation/crop/crop.controller.ts # MODIFY: crop-pest endpoints + GET :id includes pests
apps/api/prisma/schema.prisma            # MODIFY: PestDisease + CropPestControl
apps/admin/src/app/pests/{page,new/page}.tsx  # NEW
apps/admin/src/app/crops/[id]/page.tsx   # MODIFY: pests section
apps/admin/src/lib/api.ts                # MODIFY: pest types + calls
apps/api/src/crop.module.ts              # MODIFY: pest providers + controller
```

---

### Task 1: `PestType` enum + `PestDisease` aggregate (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/pest/pest-type.ts`, `apps/api/src/domain/pest/pest-disease.ts`
- Test: `apps/api/src/domain/pest/pest-disease.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`.
- Produces:
  - `enum PestType { INSECT, FUNGUS, BACTERIA, VIRUS, WEED, NEMATODE, OTHER }`.
  - `class PestDisease` with `create({ id, name: TranslatableText, type: PestType, scientificName?, symptoms?: TranslatableText, photos?, notes?, metadata? })`, getters (`photos` defaults `[]`, `metadata` defaults `{}`), `PestDiseaseSnapshot`, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/pest/pest-disease.spec.ts`:
```ts
import { PestDisease } from './pest-disease';
import { PestType } from './pest-type';
import { TranslatableText } from '../shared/translatable-text';

describe('PestDisease', () => {
  const base = () => PestDisease.create({
    id: 'pest-1',
    name: TranslatableText.create({ fr: 'Mouche des fruits' }),
    type: PestType.INSECT,
    scientificName: 'Bactrocera dorsalis',
    symptoms: TranslatableText.create({ fr: 'Piqûres et pourriture des fruits' }),
    photos: ['https://example/mouche.jpg'],
  });

  it('exposes its attributes', () => {
    const p = base();
    expect(p.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(p.type).toBe(PestType.INSECT);
    expect(p.scientificName).toBe('Bactrocera dorsalis');
    expect(p.photos).toEqual(['https://example/mouche.jpg']);
  });

  it('round-trips through snapshot', () => {
    const restored = PestDisease.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(restored.symptoms?.getOrDefault('fr')).toBe('Piqûres et pourriture des fruits');
    expect(restored.type).toBe(PestType.INSECT);
  });

  it('defaults photos to [] and metadata to {}', () => {
    const p = PestDisease.create({ id: 'p', name: TranslatableText.create({ fr: 'X' }), type: PestType.FUNGUS });
    expect(p.photos).toEqual([]);
    expect(p.metadata).toEqual({});
    expect(p.symptoms).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test pest-disease`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the enum and aggregate**

`apps/api/src/domain/pest/pest-type.ts`:
```ts
export enum PestType {
  INSECT = 'INSECT',
  FUNGUS = 'FUNGUS',
  BACTERIA = 'BACTERIA',
  VIRUS = 'VIRUS',
  WEED = 'WEED',
  NEMATODE = 'NEMATODE',
  OTHER = 'OTHER',
}
```

`apps/api/src/domain/pest/pest-disease.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

export interface PestDiseaseSnapshot {
  id: string;
  name: Record<string, string>;
  type: PestType;
  scientificName?: string;
  symptoms?: Record<string, string>;
  photos: string[];
  notes?: string;
  metadata: Record<string, unknown>;
}

interface CreateProps {
  id: string;
  name: TranslatableText;
  type: PestType;
  scientificName?: string;
  symptoms?: TranslatableText;
  photos?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class PestDisease {
  private constructor(
    private readonly _id: string,
    private readonly _name: TranslatableText,
    private readonly _type: PestType,
    private readonly _scientificName: string | undefined,
    private readonly _symptoms: TranslatableText | undefined,
    private readonly _photos: string[],
    private readonly _notes: string | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateProps): PestDisease {
    return new PestDisease(
      props.id, props.name, props.type, props.scientificName, props.symptoms,
      props.photos ?? [], props.notes, props.metadata ?? {},
    );
  }

  get id(): string { return this._id; }
  get name(): TranslatableText { return this._name; }
  get type(): PestType { return this._type; }
  get scientificName(): string | undefined { return this._scientificName; }
  get symptoms(): TranslatableText | undefined { return this._symptoms; }
  get photos(): string[] { return [...this._photos]; }
  get notes(): string | undefined { return this._notes; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  toSnapshot(): PestDiseaseSnapshot {
    return {
      id: this._id, name: this._name.toJSON(), type: this._type,
      scientificName: this._scientificName, symptoms: this._symptoms?.toJSON(),
      photos: [...this._photos], notes: this._notes, metadata: { ...this._metadata },
    };
  }

  static fromSnapshot(s: PestDiseaseSnapshot): PestDisease {
    return new PestDisease(
      s.id, TranslatableText.create(s.name), s.type, s.scientificName,
      s.symptoms ? TranslatableText.create(s.symptoms) : undefined,
      [...s.photos], s.notes, { ...s.metadata },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test pest-disease`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/pest/pest-type.ts apps/api/src/domain/pest/pest-disease.*
git commit -m "feat(domain): add PestType enum and PestDisease aggregate"
```

---

### Task 2: `ControlCategory` enum + `ControlMethod` value object (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/pest/control-category.ts`, `apps/api/src/domain/pest/control-method.ts`
- Test: `apps/api/src/domain/pest/control-method.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`.
- Produces:
  - `enum ControlCategory { PREVENTION, BIOLOGICAL, INTEGRATED, CHEMICAL }` (ordre = du plus durable au dernier recours).
  - `class ControlMethod` with `create({ category: ControlCategory, description: TranslatableText, inputs? })`, getters (`inputs` defaults `[]`), `ControlMethodJSON`, `toJSON()`, `static fromJSON(json)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/pest/control-method.spec.ts`:
```ts
import { ControlMethod } from './control-method';
import { ControlCategory } from './control-category';
import { TranslatableText } from '../shared/translatable-text';

describe('ControlMethod', () => {
  it('creates a method and round-trips through JSON', () => {
    const m = ControlMethod.create({
      category: ControlCategory.BIOLOGICAL,
      description: TranslatableText.create({ fr: 'Piégeage à phéromones' }),
      inputs: ['pièges', 'phéromone'],
    });
    const restored = ControlMethod.fromJSON(m.toJSON());
    expect(restored.category).toBe(ControlCategory.BIOLOGICAL);
    expect(restored.description.getOrDefault('fr')).toBe('Piégeage à phéromones');
    expect(restored.inputs).toEqual(['pièges', 'phéromone']);
  });

  it('defaults inputs to []', () => {
    const m = ControlMethod.create({ category: ControlCategory.PREVENTION, description: TranslatableText.create({ fr: 'Rotation' }) });
    expect(m.inputs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test control-method`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the enum and value object**

`apps/api/src/domain/pest/control-category.ts`:
```ts
export enum ControlCategory {
  PREVENTION = 'PREVENTION',
  BIOLOGICAL = 'BIOLOGICAL',
  INTEGRATED = 'INTEGRATED',
  CHEMICAL = 'CHEMICAL',
}
```

`apps/api/src/domain/pest/control-method.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { ControlCategory } from './control-category';

export interface ControlMethodJSON {
  category: ControlCategory;
  description: Record<string, string>;
  inputs: string[];
}

interface CreateProps {
  category: ControlCategory;
  description: TranslatableText;
  inputs?: string[];
}

export class ControlMethod {
  private constructor(
    private readonly _category: ControlCategory,
    private readonly _description: TranslatableText,
    private readonly _inputs: string[],
  ) {}

  static create(props: CreateProps): ControlMethod {
    return new ControlMethod(props.category, props.description, props.inputs ?? []);
  }

  get category(): ControlCategory { return this._category; }
  get description(): TranslatableText { return this._description; }
  get inputs(): string[] { return [...this._inputs]; }

  toJSON(): ControlMethodJSON {
    return { category: this._category, description: this._description.toJSON(), inputs: [...this._inputs] };
  }

  static fromJSON(json: ControlMethodJSON): ControlMethod {
    return new ControlMethod(json.category, TranslatableText.create(json.description), [...json.inputs]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test control-method`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/pest/control-category.ts apps/api/src/domain/pest/control-method.*
git commit -m "feat(domain): add ControlCategory enum and ControlMethod value object"
```

---

### Task 3: `SusceptibilityLevel` enum + `CropPestControl` entity (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/pest/susceptibility-level.ts`, `apps/api/src/domain/pest/crop-pest-control.ts`
- Test: `apps/api/src/domain/pest/crop-pest-control.spec.ts`

**Interfaces:**
- Consumes: `SusceptibilityLevel`, `ControlMethod`, `ControlMethodJSON`, `Provenance`.
- Produces:
  - `enum SusceptibilityLevel { LOW, MEDIUM, HIGH }`.
  - `class CropPestControl` with `create({ cropId, pestId, susceptibility: SusceptibilityLevel, sensitiveStages?, threshold?, controlMethods?: ControlMethod[], provenance? })`, getters (`sensitiveStages`/`controlMethods` default `[]`), `CropPestControlSnapshot`, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/pest/crop-pest-control.spec.ts`:
```ts
import { CropPestControl } from './crop-pest-control';
import { SusceptibilityLevel } from './susceptibility-level';
import { ControlMethod } from './control-method';
import { ControlCategory } from './control-category';
import { TranslatableText } from '../shared/translatable-text';
import { Provenance, ProvenanceSource } from '../shared/provenance';

describe('CropPestControl', () => {
  const base = () => CropPestControl.create({
    cropId: 'crop-1', pestId: 'pest-1',
    susceptibility: SusceptibilityLevel.HIGH,
    sensitiveStages: ['maturation des fruits'],
    threshold: '3 captures/piège/semaine',
    controlMethods: [
      ControlMethod.create({ category: ControlCategory.PREVENTION, description: TranslatableText.create({ fr: 'Ensachage' }) }),
    ],
    provenance: Provenance.external({ sourceRef: 'IITA', capturedAt: '2026-07-04' }),
  });

  it('exposes its attributes', () => {
    const c = base();
    expect(c.cropId).toBe('crop-1');
    expect(c.pestId).toBe('pest-1');
    expect(c.susceptibility).toBe(SusceptibilityLevel.HIGH);
    expect(c.sensitiveStages).toEqual(['maturation des fruits']);
    expect(c.threshold).toBe('3 captures/piège/semaine');
    expect(c.controlMethods).toHaveLength(1);
  });

  it('round-trips through snapshot including provenance and control methods', () => {
    const restored = CropPestControl.fromSnapshot(base().toSnapshot());
    expect(restored.controlMethods[0].description.getOrDefault('fr')).toBe('Ensachage');
    expect(restored.provenance?.source).toBe(ProvenanceSource.EXTERNAL);
  });

  it('defaults sensitiveStages and controlMethods to []', () => {
    const c = CropPestControl.create({ cropId: 'c', pestId: 'p', susceptibility: SusceptibilityLevel.LOW });
    expect(c.sensitiveStages).toEqual([]);
    expect(c.controlMethods).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop-pest-control`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the enum and entity**

`apps/api/src/domain/pest/susceptibility-level.ts`:
```ts
export enum SusceptibilityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
```

`apps/api/src/domain/pest/crop-pest-control.ts`:
```ts
import { SusceptibilityLevel } from './susceptibility-level';
import { ControlMethod, ControlMethodJSON } from './control-method';
import { Provenance } from '../shared/provenance';

export interface CropPestControlSnapshot {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages: string[];
  threshold?: string;
  controlMethods: ControlMethodJSON[];
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateProps {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages?: string[];
  threshold?: string;
  controlMethods?: ControlMethod[];
  provenance?: Provenance;
}

export class CropPestControl {
  private constructor(
    private readonly _cropId: string,
    private readonly _pestId: string,
    private readonly _susceptibility: SusceptibilityLevel,
    private readonly _sensitiveStages: string[],
    private readonly _threshold: string | undefined,
    private readonly _controlMethods: ControlMethod[],
    private readonly _provenance: Provenance | undefined,
  ) {}

  static create(props: CreateProps): CropPestControl {
    return new CropPestControl(
      props.cropId, props.pestId, props.susceptibility, props.sensitiveStages ?? [],
      props.threshold, props.controlMethods ?? [], props.provenance,
    );
  }

  get cropId(): string { return this._cropId; }
  get pestId(): string { return this._pestId; }
  get susceptibility(): SusceptibilityLevel { return this._susceptibility; }
  get sensitiveStages(): string[] { return [...this._sensitiveStages]; }
  get threshold(): string | undefined { return this._threshold; }
  get controlMethods(): ControlMethod[] { return [...this._controlMethods]; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): CropPestControlSnapshot {
    return {
      cropId: this._cropId, pestId: this._pestId, susceptibility: this._susceptibility,
      sensitiveStages: [...this._sensitiveStages], threshold: this._threshold,
      controlMethods: this._controlMethods.map((m) => m.toJSON()),
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: CropPestControlSnapshot): CropPestControl {
    return new CropPestControl(
      s.cropId, s.pestId, s.susceptibility, [...s.sensitiveStages], s.threshold,
      s.controlMethods.map((j) => ControlMethod.fromJSON(j)),
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop-pest-control`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/pest/susceptibility-level.ts apps/api/src/domain/pest/crop-pest-control.*
git commit -m "feat(domain): add SusceptibilityLevel enum and CropPestControl entity"
```

---

### Task 4: Prisma schema + migration (PestDisease + CropPestControl)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing.
- Produces: `PestDisease` table + `CropPestControl` table (composite PK `@@id([cropId, pestId])`, index on pestId).

- [ ] **Step 1: Extend the schema**

Add to `apps/api/prisma/schema.prisma`:
```prisma
model PestDisease {
  id             String   @id
  name           Json
  type           String
  scientificName String?
  symptoms       Json?
  photos         Json
  notes          String?
  metadata       Json
  createdAt      DateTime @default(now())
}

model CropPestControl {
  cropId         String
  pestId         String
  susceptibility String
  sensitiveStages Json
  threshold      String?
  controlMethods Json
  provenance     Json?
  createdAt      DateTime @default(now())

  @@id([cropId, pestId])
  @@index([pestId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:up && cd apps/api && pnpm exec prisma migrate dev --name add_pests_and_control && cd ../..`
Expected: migration adds both tables; Prisma client regenerated (now includes `pestDisease` and `cropPestControl` accessors, the latter with a `cropId_pestId` composite where-input).

- [ ] **Step 3: Verify the tables**

Run: `docker exec okko-db-1 psql -U okko -d okko -c '\d "CropPestControl"'`
Expected: composite primary key (cropId, pestId), index on pestId.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(infra): add PestDisease and CropPestControl tables"
```

---

### Task 5: Pest + control repositories (ports + Prisma impls, integration test)

**Files:**
- Create: `apps/api/src/application/pest/pest.repository.ts`, `apps/api/src/application/pest/crop-pest-control.repository.ts`
- Create: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`, `apps/api/src/infrastructure/pest/prisma-crop-pest-control.repository.ts`
- Test: `apps/api/test/prisma-pest.repository.int-spec.ts`

**Interfaces:**
- Consumes: `PestDiseaseSnapshot`, `CropPestControlSnapshot`, `PrismaService`, `Prisma`.
- Produces:
  - `interface PestRepository { save(p: PestDiseaseSnapshot): Promise<void>; findById(id: string): Promise<PestDiseaseSnapshot | null>; list(): Promise<PestDiseaseSnapshot[]>; }` + token `PEST_REPOSITORY`.
  - `interface CropPestControlRepository { save(c: CropPestControlSnapshot): Promise<void>; listByCrop(cropId: string): Promise<CropPestControlSnapshot[]>; listByPest(pestId: string): Promise<CropPestControlSnapshot[]>; }` + token `CROP_PEST_CONTROL_REPOSITORY`.
  - Prisma implementations of both.

- [ ] **Step 1: Define the ports**

`apps/api/src/application/pest/pest.repository.ts`:
```ts
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';

export const PEST_REPOSITORY = Symbol('PEST_REPOSITORY');

export interface PestRepository {
  save(p: PestDiseaseSnapshot): Promise<void>;
  findById(id: string): Promise<PestDiseaseSnapshot | null>;
  list(): Promise<PestDiseaseSnapshot[]>;
}
```

`apps/api/src/application/pest/crop-pest-control.repository.ts`:
```ts
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';

export const CROP_PEST_CONTROL_REPOSITORY = Symbol('CROP_PEST_CONTROL_REPOSITORY');

export interface CropPestControlRepository {
  save(c: CropPestControlSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CropPestControlSnapshot[]>;
  listByPest(pestId: string): Promise<CropPestControlSnapshot[]>;
}
```

- [ ] **Step 2: Write the failing integration test**

`apps/api/test/prisma-pest.repository.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaPestRepository } from '../src/infrastructure/pest/prisma-pest.repository';
import { PrismaCropPestControlRepository } from '../src/infrastructure/pest/prisma-crop-pest-control.repository';
import { PestType } from '../src/domain/pest/pest-type';
import { SusceptibilityLevel } from '../src/domain/pest/susceptibility-level';
import { ControlCategory } from '../src/domain/pest/control-category';

describe('Prisma pest + control repositories (integration)', () => {
  const prisma = new PrismaService();
  const pests = new PrismaPestRepository(prisma);
  const controls = new PrismaCropPestControlRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => {
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.$disconnect();
  });

  it('saves/reads a pest and upserts a control by composite key', async () => {
    await pests.save({
      id: 'p-int-1', name: { fr: 'Mouche' }, type: PestType.INSECT,
      photos: ['x.jpg'], metadata: {},
    });
    const found = await pests.findById('p-int-1');
    expect(found?.name.fr).toBe('Mouche');
    expect(found?.photos).toEqual(['x.jpg']);

    await controls.save({
      cropId: 'c-int-1', pestId: 'p-int-1', susceptibility: SusceptibilityLevel.HIGH,
      sensitiveStages: ['fruit'], controlMethods: [{ category: ControlCategory.PREVENTION, description: { fr: 'Ensachage' }, inputs: [] }],
    });
    await controls.save({
      cropId: 'c-int-1', pestId: 'p-int-1', susceptibility: SusceptibilityLevel.MEDIUM,
      sensitiveStages: [], controlMethods: [],
    });
    const byCrop = await controls.listByCrop('c-int-1');
    expect(byCrop).toHaveLength(1);
    expect(byCrop[0].susceptibility).toBe(SusceptibilityLevel.MEDIUM);

    const byPest = await controls.listByPest('p-int-1');
    expect(byPest).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-pest.repository`
Expected: FAIL — repositories not found.

- [ ] **Step 4: Implement the Prisma repositories**

`apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PestDisease as PrismaPest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PestRepository } from '../../application/pest/pest.repository';
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestType } from '../../domain/pest/pest-type';

@Injectable()
export class PrismaPestRepository implements PestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PestDiseaseSnapshot): Promise<void> {
    await this.prisma.pestDisease.upsert({ where: { id: p.id }, create: this.toRow(p), update: this.toRow(p) });
  }

  async findById(id: string): Promise<PestDiseaseSnapshot | null> {
    const row = await this.prisma.pestDisease.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<PestDiseaseSnapshot[]> {
    const rows = await this.prisma.pestDisease.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(p: PestDiseaseSnapshot): Prisma.PestDiseaseCreateInput {
    return {
      id: p.id, name: p.name as Prisma.InputJsonValue, type: p.type,
      scientificName: p.scientificName ?? null,
      symptoms: (p.symptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      photos: p.photos as unknown as Prisma.InputJsonValue,
      notes: p.notes ?? null, metadata: p.metadata as Prisma.InputJsonValue,
    };
  }

  private toSnapshot(row: PrismaPest): PestDiseaseSnapshot {
    return {
      id: row.id, name: row.name as Record<string, string>, type: row.type as PestType,
      scientificName: row.scientificName ?? undefined,
      symptoms: (row.symptoms ?? undefined) as PestDiseaseSnapshot['symptoms'],
      photos: row.photos as unknown as string[],
      notes: row.notes ?? undefined, metadata: row.metadata as Record<string, unknown>,
    };
  }
}
```

`apps/api/src/infrastructure/pest/prisma-crop-pest-control.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CropPestControl as PrismaControl } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropPestControlRepository } from '../../application/pest/crop-pest-control.repository';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';

@Injectable()
export class PrismaCropPestControlRepository implements CropPestControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(c: CropPestControlSnapshot): Promise<void> {
    await this.prisma.cropPestControl.upsert({
      where: { cropId_pestId: { cropId: c.cropId, pestId: c.pestId } },
      create: this.toRow(c), update: this.toRow(c),
    });
  }

  async listByCrop(cropId: string): Promise<CropPestControlSnapshot[]> {
    const rows = await this.prisma.cropPestControl.findMany({ where: { cropId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByPest(pestId: string): Promise<CropPestControlSnapshot[]> {
    const rows = await this.prisma.cropPestControl.findMany({ where: { pestId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(c: CropPestControlSnapshot) {
    return {
      cropId: c.cropId, pestId: c.pestId, susceptibility: c.susceptibility,
      sensitiveStages: c.sensitiveStages as unknown as Prisma.InputJsonValue,
      threshold: c.threshold ?? null,
      controlMethods: c.controlMethods as unknown as Prisma.InputJsonValue,
      provenance: (c.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaControl): CropPestControlSnapshot {
    return {
      cropId: row.cropId, pestId: row.pestId, susceptibility: row.susceptibility as SusceptibilityLevel,
      sensitiveStages: row.sensitiveStages as unknown as string[],
      threshold: row.threshold ?? undefined,
      controlMethods: row.controlMethods as unknown as CropPestControlSnapshot['controlMethods'],
      provenance: (row.provenance ?? undefined) as CropPestControlSnapshot['provenance'],
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-pest.repository`
Expected: PASS. Then full suite — all green. Confirm no `as any`: `grep -rn "as any" apps/api/src` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/pest apps/api/src/infrastructure/pest apps/api/test/prisma-pest.repository.int-spec.ts
git commit -m "feat(infra): add Prisma pest and crop-pest-control repositories"
```

---

### Task 6: Use-cases `CreatePest` + `ListPests` (application, TDD)

**Files:**
- Create: `apps/api/src/application/pest/in-memory-pest.repository.ts`
- Create: `apps/api/src/application/pest/create-pest.use-case.ts`, `apps/api/src/application/pest/list-pests.use-case.ts`
- Test: `apps/api/src/application/pest/create-pest.use-case.spec.ts`

**Interfaces:**
- Consumes: `PestRepository`, `AuditLogRepository`, `Clock`, `IdGenerator` (from `../shared/id-generator`), domain objects.
- Produces:
  - `CreatePestUseCase.execute({ id?, name, type, scientificName?, symptoms?, photos?, notes?, actor })` → `PestDiseaseSnapshot`.
  - `ListPestsUseCase.execute()` → `PestDiseaseSnapshot[]`.

- [ ] **Step 1: In-memory pest repo (test util)**

`apps/api/src/application/pest/in-memory-pest.repository.ts`:
```ts
import { PestRepository } from './pest.repository';
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';

export class InMemoryPestRepository implements PestRepository {
  private store = new Map<string, PestDiseaseSnapshot>();
  async save(p: PestDiseaseSnapshot): Promise<void> { this.store.set(p.id, p); }
  async findById(id: string): Promise<PestDiseaseSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<PestDiseaseSnapshot[]> { return [...this.store.values()]; }
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/application/pest/create-pest.use-case.spec.ts`:
```ts
import { CreatePestUseCase } from './create-pest.use-case';
import { ListPestsUseCase } from './list-pests.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { PestType } from '../../domain/pest/pest-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `pest-${++seq}` };

describe('CreatePestUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('creates a pest, audits, and lists it', async () => {
    const repo = new InMemoryPestRepository();
    const audit = { record: jest.fn() };
    const out = await new CreatePestUseCase(repo, audit, clock, ids).execute({
      name: { fr: 'Mouche des fruits' }, type: PestType.INSECT, photos: ['x.jpg'], actor: 'a',
    });
    expect(out.id).toBe('pest-1');
    expect(out.name.fr).toBe('Mouche des fruits');
    expect(out.type).toBe(PestType.INSECT);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListPestsUseCase(repo).execute();
    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test create-pest`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/pest/create-pest.use-case.ts`:
```ts
import { PestDisease, PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestType } from '../../domain/pest/pest-type';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreatePestInput {
  id?: string;
  name: Record<string, string>;
  type: PestType;
  scientificName?: string;
  symptoms?: Record<string, string>;
  photos?: string[];
  notes?: string;
  actor: string;
}

export class CreatePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreatePestInput): Promise<PestDiseaseSnapshot> {
    const pest = PestDisease.create({
      id: input.id ?? this.ids.next(),
      name: TranslatableText.create(input.name),
      type: input.type,
      scientificName: input.scientificName,
      symptoms: input.symptoms ? TranslatableText.create(input.symptoms) : undefined,
      photos: input.photos,
      notes: input.notes,
    });
    const snap = pest.toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'PestDisease', entityId: pest.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/pest/list-pests.use-case.ts`:
```ts
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestRepository } from './pest.repository';

export class ListPestsUseCase {
  constructor(private readonly pests: PestRepository) {}
  async execute(): Promise<PestDiseaseSnapshot[]> { return this.pests.list(); }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @okko/api test create-pest`
Expected: PASS. Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/pest/in-memory-pest.repository.ts apps/api/src/application/pest/create-pest.use-case.ts apps/api/src/application/pest/list-pests.use-case.ts apps/api/src/application/pest/create-pest.use-case.spec.ts
git commit -m "feat(application): add create-pest and list-pests use-cases"
```

---

### Task 7: Use-cases `SetCropPestControl` + `ListCropPests` (application, TDD)

**Files:**
- Create: `apps/api/src/application/pest/in-memory-crop-pest-control.repository.ts`
- Create: `apps/api/src/application/pest/set-crop-pest-control.use-case.ts`, `apps/api/src/application/pest/list-crop-pests.use-case.ts`
- Test: `apps/api/src/application/pest/set-crop-pest-control.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `PestRepository`, `CropPestControlRepository`, `AuditLogRepository`, `Clock`, `CropNotFoundError`, domain objects, `Provenance`, `ProvenanceProps`.
- Produces:
  - `PestNotFoundError` (exported, sets `this.name`).
  - `SetCropPestControlUseCase.execute({ cropId, pestId, susceptibility, sensitiveStages?, threshold?, controlMethods?: ControlMethodJSON[], provenance?: ProvenanceProps, actor })` → `CropPestControlSnapshot` (verifies crop AND pest exist; provenance defaults to `Provenance.manual(actor, clock.nowIso())`).
  - `ListCropPestsUseCase.execute({ cropId })` → `Array<{ pestId, pestName, type, susceptibility, controlMethods }>` (joins with pest catalog).

- [ ] **Step 1: In-memory control repo (test util)**

`apps/api/src/application/pest/in-memory-crop-pest-control.repository.ts`:
```ts
import { CropPestControlRepository } from './crop-pest-control.repository';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';

export class InMemoryCropPestControlRepository implements CropPestControlRepository {
  private store: CropPestControlSnapshot[] = [];
  async save(c: CropPestControlSnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.cropId === c.cropId && x.pestId === c.pestId)).concat(c);
  }
  async listByCrop(cropId: string): Promise<CropPestControlSnapshot[]> {
    return this.store.filter((c) => c.cropId === cropId);
  }
  async listByPest(pestId: string): Promise<CropPestControlSnapshot[]> {
    return this.store.filter((c) => c.pestId === pestId);
  }
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/application/pest/set-crop-pest-control.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreatePestUseCase } from './create-pest.use-case';
import { SetCropPestControlUseCase, PestNotFoundError } from './set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from './list-crop-pests.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { InMemoryCropPestControlRepository } from './in-memory-crop-pest-control.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { ProvenanceSource } from '../../domain/shared/provenance';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

async function setup() {
  const crops = new InMemoryCropRepository();
  const pests = new InMemoryPestRepository();
  const controls = new InMemoryCropPestControlRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica',
    family: 'Anacardiaceae', cycleType: CycleType.PERENNIAL_WOODY_FRUIT, actor: 'a',
  });
  const pest = await new CreatePestUseCase(pests, audit, clock, { next: () => 'p1' }).execute({
    name: { fr: 'Mouche des fruits' }, type: PestType.INSECT, actor: 'a',
  });
  return { crops, pests, controls, audit, pestId: pest.id };
}

describe('SetCropPestControlUseCase', () => {
  it('sets control (crop+pest exist), defaults provenance to MANUAL, audits, and lists with pest name', async () => {
    const { crops, pests, controls, audit, pestId } = await setup();
    const uc = new SetCropPestControlUseCase(crops, pests, controls, audit, clock);
    const out = await uc.execute({ cropId: 'c1', pestId, susceptibility: SusceptibilityLevel.HIGH, actor: 'a' });
    expect(out.susceptibility).toBe(SusceptibilityLevel.HIGH);
    expect(out.provenance?.source).toBe(ProvenanceSource.MANUAL);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropPestsUseCase(controls, pests).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].pestName.fr).toBe('Mouche des fruits');
    expect(list[0].type).toBe(PestType.INSECT);
  });

  it('throws CropNotFoundError / PestNotFoundError', async () => {
    const { crops, pests, controls, audit, pestId } = await setup();
    const uc = new SetCropPestControlUseCase(crops, pests, controls, audit, clock);
    await expect(uc.execute({ cropId: 'nope', pestId, susceptibility: SusceptibilityLevel.LOW, actor: 'a' })).rejects.toThrow(CropNotFoundError);
    await expect(uc.execute({ cropId: 'c1', pestId: 'nope', susceptibility: SusceptibilityLevel.LOW, actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test set-crop-pest-control`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/pest/set-crop-pest-control.use-case.ts`:
```ts
import { CropPestControl, CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { ControlMethod, ControlMethodJSON } from '../../domain/pest/control-method';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { Provenance, ProvenanceProps } from '../../domain/shared/provenance';
import { CropRepository } from '../crop/crop.repository';
import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class PestNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'PestNotFoundError';
  }
}

export interface SetCropPestControlInput {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages?: string[];
  threshold?: string;
  controlMethods?: ControlMethodJSON[];
  provenance?: ProvenanceProps;
  actor: string;
}

export class SetCropPestControlUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly pests: PestRepository,
    private readonly controls: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropPestControlInput): Promise<CropPestControlSnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    if (!(await this.pests.findById(input.pestId))) throw new PestNotFoundError(input.pestId);
    const provenance = input.provenance
      ? Provenance.fromJSON(input.provenance)
      : Provenance.manual(input.actor, this.clock.nowIso());
    const control = CropPestControl.create({
      cropId: input.cropId, pestId: input.pestId, susceptibility: input.susceptibility,
      sensitiveStages: input.sensitiveStages, threshold: input.threshold,
      controlMethods: (input.controlMethods ?? []).map((j) => ControlMethod.fromJSON(j)),
      provenance,
    });
    const snap = control.toSnapshot();
    await this.controls.save(snap);
    await this.audit.record({
      entityType: 'CropPestControl', entityId: `${input.cropId}:${input.pestId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { set: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/pest/list-crop-pests.use-case.ts`:
```ts
import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';

export interface CropPestView {
  pestId: string;
  pestName: Record<string, string>;
  type: PestType;
  susceptibility: SusceptibilityLevel;
  controlMethods: CropPestControlSnapshot['controlMethods'];
}

export class ListCropPestsUseCase {
  constructor(
    private readonly controls: CropPestControlRepository,
    private readonly pests: PestRepository,
  ) {}

  async execute(input: { cropId: string }): Promise<CropPestView[]> {
    const controls = await this.controls.listByCrop(input.cropId);
    const views: CropPestView[] = [];
    for (const c of controls) {
      const pest = await this.pests.findById(c.pestId);
      views.push({
        pestId: c.pestId,
        pestName: pest ? pest.name : { fr: c.pestId },
        type: pest ? pest.type : PestType.OTHER,
        susceptibility: c.susceptibility,
        controlMethods: c.controlMethods,
      });
    }
    return views;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @okko/api test set-crop-pest-control`
Expected: PASS (2 tests). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/pest/in-memory-crop-pest-control.repository.ts apps/api/src/application/pest/set-crop-pest-control.use-case.ts apps/api/src/application/pest/list-crop-pests.use-case.ts apps/api/src/application/pest/set-crop-pest-control.use-case.spec.ts
git commit -m "feat(application): add set-crop-pest-control and list-crop-pests use-cases"
```

---

### Task 8: Read-models — pest document + crop document pests (application, TDD)

**Files:**
- Create: `apps/api/src/application/pest/pest-read-model.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts`, add cases to `crop-read-model.spec.ts`

**Interfaces:**
- Consumes: `PestDiseaseSnapshot`, `CropPestView`, `CropSnapshot`.
- Produces:
  - `toPestDocument(p, locale?): PestDocument` (flat + serializedText).
  - `ToCropDocumentOptions` gains `pests?: CropPestView[]`; `CropDocument` gains `pests: CropPestView[]`; `toCropDocument` reads `opts.pests ?? []`; serializedText includes a pests line.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/application/pest/pest-read-model.spec.ts`:
```ts
import { toPestDocument } from './pest-read-model';
import { PestType } from '../../domain/pest/pest-type';

const snap = {
  id: 'p1', name: { fr: 'Mouche des fruits', en: 'Fruit fly' }, type: PestType.INSECT,
  scientificName: 'Bactrocera dorsalis', photos: ['x.jpg'], metadata: {},
};

describe('toPestDocument', () => {
  it('resolves the name for the locale and serializes', () => {
    const doc = toPestDocument(snap, 'en');
    expect(doc.name).toBe('Fruit fly');
    expect(doc.type).toBe(PestType.INSECT);
    expect(doc.serializedText).toContain('Fruit fly');
    expect(doc.serializedText).toContain('Bactrocera dorsalis');
  });

  it('falls back to fr', () => {
    expect(toPestDocument(snap, 'wo').name).toBe('Mouche des fruits');
  });
});
```

Append to `apps/api/src/application/crop/crop-read-model.spec.ts`:
```ts
import { CropPestView } from '../pest/list-crop-pests.use-case';
import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';

describe('toCropDocument with pests', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica', family: 'Anacardiaceae',
    cycleType: CycleType.PERENNIAL_WOODY_FRUIT, status: CropStatus.PUBLISHED, version: 7, metadata: {},
  };
  const pests: CropPestView[] = [
    { pestId: 'p1', pestName: { fr: 'Mouche des fruits' }, type: PestType.INSECT, susceptibility: SusceptibilityLevel.HIGH, controlMethods: [] },
  ];

  it('includes pests in the document and serialized text', () => {
    const doc = toCropDocument(snap, { pests });
    expect(doc.pests).toHaveLength(1);
    expect(doc.serializedText).toContain('Mouche des fruits');
  });

  it('defaults pests to an empty array', () => {
    expect(toCropDocument(snap).pests).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test pest-read-model crop-read-model`
Expected: FAIL — `toPestDocument` missing; `pests` not on document/options.

- [ ] **Step 3: Implement `pest-read-model.ts`**

`apps/api/src/application/pest/pest-read-model.ts`:
```ts
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestType } from '../../domain/pest/pest-type';

export interface PestDocument {
  id: string;
  name: string;
  type: PestType;
  scientificName?: string;
  symptoms?: PestDiseaseSnapshot['symptoms'];
  photos: string[];
  notes?: string;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toPestDocument(p: PestDiseaseSnapshot, locale = 'fr'): PestDocument {
  const name = p.name[locale] ?? p.name['fr'];
  const lines = [`# ${name} (${p.type})`];
  if (p.scientificName) lines.push(`Nom scientifique : ${p.scientificName}`);
  if (p.symptoms) lines.push(`Symptômes : ${p.symptoms[locale] ?? p.symptoms['fr']}`);
  return {
    id: p.id, name, type: p.type, scientificName: p.scientificName,
    symptoms: p.symptoms, photos: p.photos, notes: p.notes,
    metadata: p.metadata, serializedText: lines.join('\n'),
  };
}
```

- [ ] **Step 4: Extend `crop-read-model.ts`**

In `apps/api/src/application/crop/crop-read-model.ts`:
- Add import: `import { CropPestView } from '../pest/list-crop-pests.use-case';`
- Add `pests?: CropPestView[];` to `ToCropDocumentOptions`.
- Add `pests: CropPestView[];` to `CropDocument`.
- Resolve `const pests = opts.pests ?? [];`.
- After the windows block in `serializedText`, add:
```ts
  if (pests.length > 0) {
    lines.push(`Ravageurs : ${pests.map((p) => `${p.pestName[locale] ?? p.pestName['fr']} (${p.susceptibility})`).join(', ')}`);
  }
```
- Add `pests,` to the returned object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test pest-read-model crop-read-model`
Expected: PASS (all existing + new). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/pest/pest-read-model.* apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add pest read-model and crop-document pests"
```

---

### Task 9: Controllers + module wiring (e2e)

**Files:**
- Create: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Test: `apps/api/test/pest.e2e-spec.ts`

**Interfaces:**
- Consumes: the pest use-cases + repositories + read-models.
- Produces endpoints: `POST /pests`, `GET /pests`, `GET /pests/:id`; `PUT /crops/:id/pests/:pestId`, `GET /crops/:id/pests`. `GET /crops/:id` now includes `pests`.

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/pest.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Pests e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('creates a pest, sets crop control, and exposes it on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica', family: 'Anacardiaceae', cycleType: 'PERENNIAL_WOODY_FRUIT' })
      .expect(201);
    const pest = await request(app.getHttpServer()).post('/pests')
      .send({ name: { fr: 'Mouche des fruits' }, type: 'INSECT', scientificName: 'Bactrocera dorsalis' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/pests/${pest.body.id}`)
      .send({ susceptibility: 'HIGH', sensitiveStages: ['fruit'],
              controlMethods: [{ category: 'PREVENTION', description: { fr: 'Ensachage' }, inputs: [] }] })
      .expect(200);

    const list = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/pests`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].pestName.fr).toBe('Mouche des fruits');

    const doc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(doc.body.pests).toHaveLength(1);
    expect(doc.body.pests[0].susceptibility).toBe('HIGH');

    const all = await request(app.getHttpServer()).get('/pests').expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 setting control for an unknown pest', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/pests/does-not-exist`)
      .send({ susceptibility: 'LOW' })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test pest.e2e`
Expected: FAIL — routes not wired.

- [ ] **Step 3: Implement the pest controller**

`apps/api/src/presentation/pest/pest.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, NotFoundException, Inject } from '@nestjs/common';
import { CreatePestUseCase } from '../../application/pest/create-pest.use-case';
import { ListPestsUseCase } from '../../application/pest/list-pests.use-case';
import { PEST_REPOSITORY, PestRepository } from '../../application/pest/pest.repository';
import { toPestDocument } from '../../application/pest/pest-read-model';
import { PestType } from '../../domain/pest/pest-type';

const ACTOR = 'admin';

@Controller('pests')
export class PestController {
  constructor(
    private readonly createPest: CreatePestUseCase,
    private readonly listPests: ListPestsUseCase,
    @Inject(PEST_REPOSITORY) private readonly pests: PestRepository,
  ) {}

  @Post()
  async create(@Body() body: {
    name: Record<string, string>; type: PestType; scientificName?: string;
    symptoms?: Record<string, string>; photos?: string[]; notes?: string;
  }) {
    const snap = await this.createPest.execute({ actor: ACTOR, ...body });
    return toPestDocument(snap);
  }

  @Get()
  async list() {
    return (await this.listPests.execute()).map((p) => toPestDocument(p));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.pests.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toPestDocument(snap);
  }
}
```

- [ ] **Step 4: Extend the crop controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add imports:
```ts
import { SetCropPestControlUseCase, PestNotFoundError } from '../../application/pest/set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from '../../application/pest/list-crop-pests.use-case';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { ControlMethodJSON } from '../../domain/pest/control-method';
import { ProvenanceProps } from '../../domain/shared/provenance';
```
- Inject into the constructor:
```ts
    private readonly setPestControl: SetCropPestControlUseCase,
    private readonly listCropPests: ListCropPestsUseCase,
```
- Update `GET /crops/:id` to fetch pests and pass them in the options object:
```ts
  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    const varieties = await this.varieties.listByCrop(id);
    const zones = await this.listCropZones.execute({ cropId: id });
    const windows = await this.listWindows.execute({ cropId: id });
    const pests = await this.listCropPests.execute({ cropId: id });
    return toCropDocument(snap, { varieties, zones, windows, pests });
  }
```
(Match the existing variable names used in your `get` handler; the key point is adding `pests` to the options object.)
- Add the handlers:
```ts
  @Put(':id/pests/:pestId')
  async setPest(
    @Param('id') id: string,
    @Param('pestId') pestId: string,
    @Body() body: { susceptibility: SusceptibilityLevel; sensitiveStages?: string[]; threshold?: string; controlMethods?: ControlMethodJSON[]; provenance?: ProvenanceProps },
  ) {
    try {
      return await this.setPestControl.execute({ cropId: id, pestId, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof PestNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/pests')
  async getPests(@Param('id') id: string) {
    return this.listCropPests.execute({ cropId: id });
  }
```
(`Put` is already imported from Plan 3.)

- [ ] **Step 5: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `PestController`, `PrismaPestRepository`, `PrismaCropPestControlRepository`, tokens `PEST_REPOSITORY`/`CROP_PEST_CONTROL_REPOSITORY`, and the four use-cases.
- Register `PestController` in `controllers`.
- Add providers:
```ts
    { provide: PEST_REPOSITORY, useClass: PrismaPestRepository },
    { provide: CROP_PEST_CONTROL_REPOSITORY, useClass: PrismaCropPestControlRepository },
    {
      provide: CreatePestUseCase,
      useFactory: (p, a, c, ids) => new CreatePestUseCase(p, a, c, ids),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListPestsUseCase,
      useFactory: (p) => new ListPestsUseCase(p),
      inject: [PEST_REPOSITORY],
    },
    {
      provide: SetCropPestControlUseCase,
      useFactory: (cr, p, ctrl, a, c) => new SetCropPestControlUseCase(cr, p, ctrl, a, c),
      inject: [CROP_REPOSITORY, PEST_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListCropPestsUseCase,
      useFactory: (ctrl, p) => new ListCropPestsUseCase(ctrl, p),
      inject: [CROP_PEST_CONTROL_REPOSITORY, PEST_REPOSITORY],
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test pest.e2e`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/presentation/pest apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/pest.e2e-spec.ts
git commit -m "feat(api): wire pest endpoints and crop-pest control with e2e"
```

---

### Task 10: Admin — pests pages + crop detail pests section

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/app/pests/page.tsx`, `apps/admin/src/app/pests/new/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: the Task 9 API.
- Produces: pests list + create page, and a pests section on the crop detail page.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`, add types + functions:
```ts
export interface Pest { id: string; name: string; type: string; scientificName?: string; }
export interface CropPest {
  pestId: string; pestName: Record<string, string>; type: string; susceptibility: string;
  controlMethods: { category: string; description: Record<string, string>; inputs: string[] }[];
}

export async function listPests(): Promise<Pest[]> {
  const res = await fetch(`${BASE}/pests`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
export async function createPest(input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await fetch(`${BASE}/pests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```
Also extend `CropDetail` (from earlier plans) to add `pests: CropPest[]`.

- [ ] **Step 2: Pests list page**

`apps/admin/src/app/pests/page.tsx`:
```tsx
import Link from 'next/link';
import { listPests } from '../../lib/api';

export default async function PestsPage() {
  const pests = await listPests();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ravageurs & maladies</h1>
        <Link href="/pests/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouveau</Link>
      </div>
      <ul className="divide-y">
        {pests.map((p) => (
          <li key={p.id} className="py-3">{p.name} — {p.type}{p.scientificName ? ` · ${p.scientificName}` : ''}</li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Pest create page**

`apps/admin/src/app/pests/new/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPest } from '../../../lib/api';

const TYPES = ['INSECT', 'FUNGUS', 'BACTERIA', 'VIRUS', 'WEED', 'NEMATODE', 'OTHER'];

export default function NewPestPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [scientificName, setSci] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPest({ name: { fr }, type, scientificName: scientificName || undefined });
      router.push('/pests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouveau ravageur / maladie</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <select className="w-full border p-2" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="w-full border p-2" placeholder="Nom scientifique (optionnel)" value={scientificName} onChange={(e) => setSci(e.target.value)} />
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Add a pests section to the crop detail page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add after the windows section:
```tsx
      <section>
        <h2 className="font-semibold mb-2">Ravageurs & maladies ({crop.pests.length})</h2>
        {crop.pests.map((p) => (
          <div key={p.pestId} className="mb-3">
            <p className="font-medium">{p.pestName.fr} — <strong>{p.susceptibility}</strong> ({p.type})</p>
            <ul className="list-disc pl-5 text-sm">
              {p.controlMethods.map((m, i) => (
                <li key={i}>{m.category} : {m.description.fr}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
```

- [ ] **Step 5: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; routes `/pests`, `/pests/new`, `/crops/[id]` compile.

- [ ] **Step 6: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): pests pages and crop-detail pests section"
```

---

## Self-Review

**1. Spec coverage (Plan 5 scope, catégorie 10 phytosanitaire):**
- Catalogue partagé `PestDisease` (type, symptômes, photos) → Tasks 1, 4, 5, 6, 9, 10. ✅
- Relation culture ↔ ravageur (sensibilité, stades sensibles, seuils) → Tasks 3, 4, 5, 7, 9, 10. ✅
- Méthodes de lutte durable (prévention → bio → intégrée → chimique) → Tasks 2, 3, 7, 8, 9, 10. ✅
- Requêtable dans les deux sens → `listByCrop`/`listByPest` (Task 5). ✅
- Photos (utiles au futur diagnostic IA) → Task 1. ✅
- Provenance (défaut MANUAL, leçon Plan 3) → Task 7. ✅
- Read-model enrichi (AI-ready) → Task 8. ✅
- Audit sur mutations → Tasks 6, 7. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues. ✅

**3. Type consistency:** `PestDiseaseSnapshot` (Task 1) → port + repo (Task 5), use-cases (Task 6), read-model (Task 8). `ControlMethodJSON` (Task 2) → CropPestControl (Task 3), use-case (Task 7), controller (Task 9). `CropPestControlSnapshot` (Task 3) → port + repo (Task 5), use-cases (Task 7). `CropPestView` (Task 7) → read-model (Task 8) + controller (Task 9) + admin (Task 10). `IdGenerator` importé de `../shared/id-generator`. `toCropDocument` via **objet d'options** (`{ pests }`) — pas d'argument positionnel. `PestNotFoundError` définie une fois (Task 7). ✅

---

## Notes de conception
- **2e catalogue partagé** (`PestDisease`) : même patron que `AgroEcologicalZone` (Plan 3). Un ravageur décrit une fois, relié à N cultures avec info spécifique par culture (sensibilité, seuils, lutte).
- **Clé composite `(cropId, pestId)`** + méthodes de lutte **embarquées** dans la liaison (comme l'itinéraire dans la fenêtre, Plan 4).
- **`ControlCategory` ordonné** (prévention → bio → intégré → chimique) : encode le principe de lutte durable du spec.
- **Provenance MANUAL par défaut** dès le use-case : on applique directement la correction issue de la revue finale du Plan 3, pour éviter de re-perdre la provenance.
- **`pests` via l'objet d'options** de `toCropDocument` (refactoré en pré-work) : plus de risque d'erreur d'ordre d'arguments.
```
