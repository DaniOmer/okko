# Base de connaissances — Plan 3 : Zones agro-écologiques + adéquation culture ↔ zone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire le **catalogue partagé** des zones agro-écologiques et la relation d'**adéquation** entre une culture et une zone (adapté / marginal / déconseillé), de bout en bout : domaine, persistance, API, admin.

**Architecture:** Poursuit la clean architecture des Plans 1-2. `AgroEcologicalZone` est un **agrégat de référence partagé** (table + repository propres), décrit une seule fois et réutilisé par toutes les cultures. `CropZoneSuitability` est une entité de liaison à **clé composite `(cropId, zoneId)`** portant le niveau d'adéquation + justification + provenance. Le read-model compose la fiche culture avec ses adéquations de zone.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation, pour toute logique de domaine et d'application.
- **Clean architecture** : le domaine n'importe jamais Prisma/NestJS ; ports en application, adaptateurs en infra.
- Réutiliser : `TranslatableText`, `RangeValue`, `Provenance` (avec `fromJSON`), le port `IdGenerator` + `UuidIdGenerator`, `CropNotFoundError`.
- **Catalogue partagé** : une zone est décrite une fois ; les cultures s'y rattachent via `CropZoneSuitability`.
- **Clé composite** `(cropId, zoneId)` pour l'adéquation — une culture a au plus une adéquation par zone ; `save` fait un upsert sur cette clé.
- Colonnes `JSONB` pour les textes i18n et `metadata` ; casts JSON via `Prisma.InputJsonValue` (jamais `as any`).
- Custom errors : constructeur qui pose `this.name`.
- Mutations auditées via `AuditLogRepository` ; horloge et id injectés (jamais `Date.now()`/`randomUUID` dans le domaine/use-case).
- Tests d'intégration/e2e : la suite tourne en série (`maxWorkers:1` déjà configuré) ; nettoyer les tables touchées.

---

## File Structure

```
apps/api/src/
├── domain/
│   ├── zone/
│   │   ├── suitability-rating.ts            # NEW enum
│   │   ├── agro-ecological-zone.ts          # NEW aggregate
│   │   └── crop-zone-suitability.ts         # NEW entity (composite key)
├── application/
│   ├── zone/
│   │   ├── zone.repository.ts               # NEW port
│   │   ├── crop-zone-suitability.repository.ts  # NEW port
│   │   ├── in-memory-zone.repository.ts     # NEW test util
│   │   ├── in-memory-crop-zone-suitability.repository.ts  # NEW test util
│   │   ├── create-zone.use-case.ts          # NEW
│   │   ├── list-zones.use-case.ts           # NEW
│   │   ├── set-crop-zone-suitability.use-case.ts  # NEW
│   │   ├── list-crop-zones.use-case.ts      # NEW
│   │   └── zone-read-model.ts               # NEW
│   └── crop/crop-read-model.ts              # MODIFY: add zones to CropDocument
├── infrastructure/
│   └── zone/
│       ├── prisma-zone.repository.ts        # NEW
│       └── prisma-crop-zone-suitability.repository.ts  # NEW
└── presentation/
    ├── zone/zone.controller.ts              # NEW (zone CRUD)
    └── crop/crop.controller.ts              # MODIFY: crop-zone endpoints + GET :id includes zones
apps/api/prisma/schema.prisma                # MODIFY: AgroEcologicalZone + CropZoneSuitability
apps/admin/src/app/zones/page.tsx            # NEW
apps/admin/src/app/zones/new/page.tsx        # NEW
apps/admin/src/app/crops/[id]/page.tsx       # MODIFY: zones section
apps/admin/src/lib/api.ts                    # MODIFY: zone + suitability calls
apps/api/src/crop.module.ts                  # MODIFY: register zone providers + controller
```

---

### Task 1: `SuitabilityRating` enum + `AgroEcologicalZone` aggregate (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/zone/suitability-rating.ts`, `apps/api/src/domain/zone/agro-ecological-zone.ts`
- Test: `apps/api/src/domain/zone/agro-ecological-zone.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`, `RangeValue`.
- Produces:
  - `enum SuitabilityRating { SUITABLE, MARGINAL, UNSUITABLE }`.
  - `class AgroEcologicalZone` with `create({ id, name: TranslatableText, country, koppen?, altitude?: RangeValue, annualRainfall?: RangeValue, notes?, metadata? })`, getters, `ZoneSnapshot` interface, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/zone/agro-ecological-zone.spec.ts`:
```ts
import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone', () => {
  const base = () => AgroEcologicalZone.create({
    id: 'zone-1',
    name: TranslatableText.create({ fr: 'Zone soudano-sahélienne' }),
    country: 'BJ',
    koppen: 'BSh',
    annualRainfall: RangeValue.create({ min: 600, optimal: 900, max: 1200, unit: 'mm' }),
    notes: 'Saison des pluies unimodale',
  });

  it('exposes its attributes', () => {
    const z = base();
    expect(z.id).toBe('zone-1');
    expect(z.name.getOrDefault('fr')).toBe('Zone soudano-sahélienne');
    expect(z.country).toBe('BJ');
    expect(z.koppen).toBe('BSh');
    expect(z.annualRainfall?.optimal).toBe(900);
  });

  it('round-trips through snapshot', () => {
    const restored = AgroEcologicalZone.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Zone soudano-sahélienne');
    expect(restored.annualRainfall?.max).toBe(1200);
    expect(restored.notes).toBe('Saison des pluies unimodale');
  });

  it('defaults metadata to an empty object', () => {
    const z = AgroEcologicalZone.create({ id: 'z', name: TranslatableText.create({ fr: 'X' }), country: 'BJ' });
    expect(z.metadata).toEqual({});
    expect(z.altitude).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test agro-ecological-zone`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the enum and aggregate**

`apps/api/src/domain/zone/suitability-rating.ts`:
```ts
export enum SuitabilityRating {
  SUITABLE = 'SUITABLE',
  MARGINAL = 'MARGINAL',
  UNSUITABLE = 'UNSUITABLE',
}
```

`apps/api/src/domain/zone/agro-ecological-zone.ts`:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

export interface ZoneSnapshot {
  id: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  notes?: string;
  metadata: Record<string, unknown>;
}

interface CreateZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class AgroEcologicalZone {
  private constructor(
    private readonly _id: string,
    private readonly _name: TranslatableText,
    private readonly _country: string,
    private readonly _koppen: string | undefined,
    private readonly _altitude: RangeValue | undefined,
    private readonly _annualRainfall: RangeValue | undefined,
    private readonly _notes: string | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateZoneProps): AgroEcologicalZone {
    return new AgroEcologicalZone(
      props.id, props.name, props.country, props.koppen, props.altitude,
      props.annualRainfall, props.notes, props.metadata ?? {},
    );
  }

  get id(): string { return this._id; }
  get name(): TranslatableText { return this._name; }
  get country(): string { return this._country; }
  get koppen(): string | undefined { return this._koppen; }
  get altitude(): RangeValue | undefined { return this._altitude; }
  get annualRainfall(): RangeValue | undefined { return this._annualRainfall; }
  get notes(): string | undefined { return this._notes; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  toSnapshot(): ZoneSnapshot {
    return {
      id: this._id,
      name: this._name.toJSON(),
      country: this._country,
      koppen: this._koppen,
      altitude: this._altitude?.toJSON(),
      annualRainfall: this._annualRainfall?.toJSON(),
      notes: this._notes,
      metadata: { ...this._metadata },
    };
  }

  static fromSnapshot(s: ZoneSnapshot): AgroEcologicalZone {
    return new AgroEcologicalZone(
      s.id, TranslatableText.create(s.name), s.country, s.koppen,
      s.altitude ? RangeValue.create(s.altitude) : undefined,
      s.annualRainfall ? RangeValue.create(s.annualRainfall) : undefined,
      s.notes, { ...s.metadata },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test agro-ecological-zone`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/zone/suitability-rating.ts apps/api/src/domain/zone/agro-ecological-zone.*
git commit -m "feat(domain): add SuitabilityRating enum and AgroEcologicalZone aggregate"
```

---

### Task 2: `CropZoneSuitability` entity (domain, TDD)

**Files:**
- Create: `apps/api/src/domain/zone/crop-zone-suitability.ts`
- Test: `apps/api/src/domain/zone/crop-zone-suitability.spec.ts`

**Interfaces:**
- Consumes: `SuitabilityRating`, `Provenance`.
- Produces: `class CropZoneSuitability` with `create({ cropId, zoneId, rating: SuitabilityRating, justification?, provenance? })`, getters, `CropZoneSuitabilitySnapshot` interface, `toSnapshot()`, `static fromSnapshot(s)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/domain/zone/crop-zone-suitability.spec.ts`:
```ts
import { CropZoneSuitability } from './crop-zone-suitability';
import { SuitabilityRating } from './suitability-rating';

describe('CropZoneSuitability', () => {
  const base = () => CropZoneSuitability.create({
    cropId: 'crop-1',
    zoneId: 'zone-1',
    rating: SuitabilityRating.SUITABLE,
    justification: 'Pluviométrie et sol adaptés',
  });

  it('exposes its attributes', () => {
    const s = base();
    expect(s.cropId).toBe('crop-1');
    expect(s.zoneId).toBe('zone-1');
    expect(s.rating).toBe(SuitabilityRating.SUITABLE);
    expect(s.justification).toBe('Pluviométrie et sol adaptés');
  });

  it('round-trips through snapshot', () => {
    const restored = CropZoneSuitability.fromSnapshot(base().toSnapshot());
    expect(restored.rating).toBe(SuitabilityRating.SUITABLE);
    expect(restored.justification).toBe('Pluviométrie et sol adaptés');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test crop-zone-suitability`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `crop-zone-suitability.ts`**

`apps/api/src/domain/zone/crop-zone-suitability.ts`:
```ts
import { SuitabilityRating } from './suitability-rating';
import { Provenance } from '../shared/provenance';

export interface CropZoneSuitabilitySnapshot {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateProps {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  provenance?: Provenance;
}

export class CropZoneSuitability {
  private constructor(
    private readonly _cropId: string,
    private readonly _zoneId: string,
    private readonly _rating: SuitabilityRating,
    private readonly _justification: string | undefined,
    private readonly _provenance: Provenance | undefined,
  ) {}

  static create(props: CreateProps): CropZoneSuitability {
    return new CropZoneSuitability(
      props.cropId, props.zoneId, props.rating, props.justification, props.provenance,
    );
  }

  get cropId(): string { return this._cropId; }
  get zoneId(): string { return this._zoneId; }
  get rating(): SuitabilityRating { return this._rating; }
  get justification(): string | undefined { return this._justification; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): CropZoneSuitabilitySnapshot {
    return {
      cropId: this._cropId,
      zoneId: this._zoneId,
      rating: this._rating,
      justification: this._justification,
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: CropZoneSuitabilitySnapshot): CropZoneSuitability {
    return new CropZoneSuitability(
      s.cropId, s.zoneId, s.rating, s.justification,
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test crop-zone-suitability`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/zone/crop-zone-suitability.*
git commit -m "feat(domain): add CropZoneSuitability entity"
```

---

### Task 3: Prisma schema + migration (Zone + CropZoneSuitability)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing.
- Produces: `AgroEcologicalZone` table + `CropZoneSuitability` table with composite primary key `@@id([cropId, zoneId])`.

- [ ] **Step 1: Extend the schema**

Add to `apps/api/prisma/schema.prisma`:
```prisma
model AgroEcologicalZone {
  id             String   @id
  name           Json
  country        String
  koppen         String?
  altitude       Json?
  annualRainfall Json?
  notes          String?
  metadata       Json
  createdAt      DateTime @default(now())
}

model CropZoneSuitability {
  cropId        String
  zoneId        String
  rating        String
  justification String?
  provenance    Json?
  createdAt     DateTime @default(now())

  @@id([cropId, zoneId])
  @@index([zoneId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:up && cd apps/api && pnpm exec prisma migrate dev --name add_zones_and_suitability && cd ../..`
Expected: migration created adding both tables; Prisma client regenerated (now includes `agroEcologicalZone` and `cropZoneSuitability` accessors).

- [ ] **Step 3: Verify the tables**

Run: `docker exec okko-db-1 psql -U okko -d okko -c '\d "CropZoneSuitability"'`
Expected: composite primary key on (cropId, zoneId), index on zoneId.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(infra): add AgroEcologicalZone and CropZoneSuitability tables"
```

---

### Task 4: Zone + suitability repositories (ports + Prisma impls, integration test)

**Files:**
- Create: `apps/api/src/application/zone/zone.repository.ts`, `apps/api/src/application/zone/crop-zone-suitability.repository.ts`
- Create: `apps/api/src/infrastructure/zone/prisma-zone.repository.ts`, `apps/api/src/infrastructure/zone/prisma-crop-zone-suitability.repository.ts`
- Test: `apps/api/test/prisma-zone.repository.int-spec.ts`

**Interfaces:**
- Consumes: `ZoneSnapshot`, `CropZoneSuitabilitySnapshot`, `PrismaService`, `Prisma`.
- Produces:
  - `interface ZoneRepository { save(z: ZoneSnapshot): Promise<void>; findById(id: string): Promise<ZoneSnapshot | null>; list(): Promise<ZoneSnapshot[]>; }` + token `ZONE_REPOSITORY`.
  - `interface CropZoneSuitabilityRepository { save(s: CropZoneSuitabilitySnapshot): Promise<void>; listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]>; listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]>; }` + token `CROP_ZONE_SUITABILITY_REPOSITORY`.
  - Prisma implementations of both.

- [ ] **Step 1: Define the ports**

`apps/api/src/application/zone/zone.repository.ts`:
```ts
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export const ZONE_REPOSITORY = Symbol('ZONE_REPOSITORY');

export interface ZoneRepository {
  save(z: ZoneSnapshot): Promise<void>;
  findById(id: string): Promise<ZoneSnapshot | null>;
  list(): Promise<ZoneSnapshot[]>;
}
```

`apps/api/src/application/zone/crop-zone-suitability.repository.ts`:
```ts
import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';

export const CROP_ZONE_SUITABILITY_REPOSITORY = Symbol('CROP_ZONE_SUITABILITY_REPOSITORY');

export interface CropZoneSuitabilityRepository {
  save(s: CropZoneSuitabilitySnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]>;
  listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]>;
}
```

- [ ] **Step 2: Write the failing integration test**

`apps/api/test/prisma-zone.repository.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaZoneRepository } from '../src/infrastructure/zone/prisma-zone.repository';
import { PrismaCropZoneSuitabilityRepository } from '../src/infrastructure/zone/prisma-crop-zone-suitability.repository';
import { SuitabilityRating } from '../src/domain/zone/suitability-rating';

describe('Prisma zone + suitability repositories (integration)', () => {
  const prisma = new PrismaService();
  const zones = new PrismaZoneRepository(prisma);
  const suit = new PrismaCropZoneSuitabilityRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.$disconnect();
  });

  it('saves/reads a zone and upserts a suitability by composite key', async () => {
    await zones.save({
      id: 'z-int-1', name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh',
      annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' },
      metadata: {},
    });
    const found = await zones.findById('z-int-1');
    expect(found?.name.fr).toBe('Sahel');
    expect(found?.annualRainfall?.optimal).toBe(900);

    await suit.save({ cropId: 'c-int-1', zoneId: 'z-int-1', rating: SuitabilityRating.SUITABLE, justification: 'ok' });
    // upsert on the same composite key must update, not duplicate
    await suit.save({ cropId: 'c-int-1', zoneId: 'z-int-1', rating: SuitabilityRating.MARGINAL });
    const byCrop = await suit.listByCrop('c-int-1');
    expect(byCrop).toHaveLength(1);
    expect(byCrop[0].rating).toBe(SuitabilityRating.MARGINAL);

    const byZone = await suit.listByZone('z-int-1');
    expect(byZone).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-zone.repository`
Expected: FAIL — repositories not found.

- [ ] **Step 4: Implement the Prisma repositories**

`apps/api/src/infrastructure/zone/prisma-zone.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgroEcologicalZone as PrismaZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ZoneRepository } from '../../application/zone/zone.repository';
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

@Injectable()
export class PrismaZoneRepository implements ZoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(z: ZoneSnapshot): Promise<void> {
    await this.prisma.agroEcologicalZone.upsert({
      where: { id: z.id }, create: this.toRow(z), update: this.toRow(z),
    });
  }

  async findById(id: string): Promise<ZoneSnapshot | null> {
    const row = await this.prisma.agroEcologicalZone.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<ZoneSnapshot[]> {
    const rows = await this.prisma.agroEcologicalZone.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(z: ZoneSnapshot) {
    return {
      id: z.id,
      name: z.name as Prisma.InputJsonValue,
      country: z.country,
      koppen: z.koppen ?? null,
      altitude: (z.altitude ?? undefined) as Prisma.InputJsonValue | undefined,
      annualRainfall: (z.annualRainfall ?? undefined) as Prisma.InputJsonValue | undefined,
      notes: z.notes ?? null,
      metadata: z.metadata as Prisma.InputJsonValue,
    };
  }

  private toSnapshot(row: PrismaZone): ZoneSnapshot {
    return {
      id: row.id,
      name: row.name as Record<string, string>,
      country: row.country,
      koppen: row.koppen ?? undefined,
      altitude: (row.altitude ?? undefined) as ZoneSnapshot['altitude'],
      annualRainfall: (row.annualRainfall ?? undefined) as ZoneSnapshot['annualRainfall'],
      notes: row.notes ?? undefined,
      metadata: row.metadata as Record<string, unknown>,
    };
  }
}
```

`apps/api/src/infrastructure/zone/prisma-crop-zone-suitability.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CropZoneSuitability as PrismaSuit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropZoneSuitabilityRepository } from '../../application/zone/crop-zone-suitability.repository';
import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';

@Injectable()
export class PrismaCropZoneSuitabilityRepository implements CropZoneSuitabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(s: CropZoneSuitabilitySnapshot): Promise<void> {
    await this.prisma.cropZoneSuitability.upsert({
      where: { cropId_zoneId: { cropId: s.cropId, zoneId: s.zoneId } },
      create: this.toRow(s), update: this.toRow(s),
    });
  }

  async listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    const rows = await this.prisma.cropZoneSuitability.findMany({ where: { cropId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    const rows = await this.prisma.cropZoneSuitability.findMany({ where: { zoneId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(s: CropZoneSuitabilitySnapshot) {
    return {
      cropId: s.cropId,
      zoneId: s.zoneId,
      rating: s.rating,
      justification: s.justification ?? null,
      provenance: (s.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaSuit): CropZoneSuitabilitySnapshot {
    return {
      cropId: row.cropId,
      zoneId: row.zoneId,
      rating: row.rating as SuitabilityRating,
      justification: row.justification ?? undefined,
      provenance: (row.provenance ?? undefined) as CropZoneSuitabilitySnapshot['provenance'],
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-zone.repository`
Expected: PASS. Then full suite: `pnpm --filter @okko/api test` — all green. Confirm no `as any`: `grep -rn "as any" apps/api/src` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/zone apps/api/src/infrastructure/zone apps/api/test/prisma-zone.repository.int-spec.ts
git commit -m "feat(infra): add Prisma zone and crop-zone-suitability repositories"
```

---

### Task 5: Use-cases `CreateZone` + `ListZones` (application, TDD)

**Files:**
- Create: `apps/api/src/application/zone/in-memory-zone.repository.ts`
- Create: `apps/api/src/application/zone/create-zone.use-case.ts`, `apps/api/src/application/zone/list-zones.use-case.ts`
- Test: `apps/api/src/application/zone/create-zone.use-case.spec.ts`

**Interfaces:**
- Consumes: `ZoneRepository`, `AuditLogRepository`, `Clock`, `IdGenerator`, domain objects.
- Produces:
  - `CreateZoneUseCase.execute({ id?, name, country, koppen?, altitude?, annualRainfall?, notes?, actor })` → `ZoneSnapshot`.
  - `ListZonesUseCase.execute()` → `ZoneSnapshot[]`.

- [ ] **Step 1: In-memory zone repo (test util)**

`apps/api/src/application/zone/in-memory-zone.repository.ts`:
```ts
import { ZoneRepository } from './zone.repository';
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export class InMemoryZoneRepository implements ZoneRepository {
  private store = new Map<string, ZoneSnapshot>();
  async save(z: ZoneSnapshot): Promise<void> { this.store.set(z.id, z); }
  async findById(id: string): Promise<ZoneSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<ZoneSnapshot[]> { return [...this.store.values()]; }
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/application/zone/create-zone.use-case.spec.ts`:
```ts
import { CreateZoneUseCase } from './create-zone.use-case';
import { ListZonesUseCase } from './list-zones.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `zone-${++seq}` };

describe('CreateZoneUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('creates a zone, audits, and lists it', async () => {
    const repo = new InMemoryZoneRepository();
    const audit = { record: jest.fn() };
    const out = await new CreateZoneUseCase(repo, audit, clock, ids).execute({
      name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh',
      annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' }, actor: 'a',
    });
    expect(out.id).toBe('zone-1');
    expect(out.name.fr).toBe('Sahel');
    expect(out.annualRainfall?.optimal).toBe(900);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListZonesUseCase(repo).execute();
    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test create-zone`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/zone/create-zone.use-case.ts`:
```ts
import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../crop/add-variety.use-case';

export interface CreateZoneInput {
  id?: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  notes?: string;
  actor: string;
}

export class CreateZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateZoneInput): Promise<ZoneSnapshot> {
    const zone = AgroEcologicalZone.create({
      id: input.id ?? this.ids.next(),
      name: TranslatableText.create(input.name),
      country: input.country,
      koppen: input.koppen,
      altitude: input.altitude ? RangeValue.create(input.altitude) : undefined,
      annualRainfall: input.annualRainfall ? RangeValue.create(input.annualRainfall) : undefined,
      notes: input.notes,
    });
    const snap = zone.toSnapshot();
    await this.zones.save(snap);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: zone.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/zone/list-zones.use-case.ts`:
```ts
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { ZoneRepository } from './zone.repository';

export class ListZonesUseCase {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(): Promise<ZoneSnapshot[]> { return this.zones.list(); }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @okko/api test create-zone`
Expected: PASS. Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/zone/in-memory-zone.repository.ts apps/api/src/application/zone/create-zone.use-case.ts apps/api/src/application/zone/list-zones.use-case.ts apps/api/src/application/zone/create-zone.use-case.spec.ts
git commit -m "feat(application): add create-zone and list-zones use-cases"
```

---

### Task 6: Use-cases `SetCropZoneSuitability` + `ListCropZones` (application, TDD)

**Files:**
- Create: `apps/api/src/application/zone/in-memory-crop-zone-suitability.repository.ts`
- Create: `apps/api/src/application/zone/set-crop-zone-suitability.use-case.ts`, `apps/api/src/application/zone/list-crop-zones.use-case.ts`
- Test: `apps/api/src/application/zone/set-crop-zone-suitability.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `ZoneRepository`, `CropZoneSuitabilityRepository`, `AuditLogRepository`, `Clock`, `CropNotFoundError`, domain objects.
- Produces:
  - `ZoneNotFoundError` (exported from `set-crop-zone-suitability.use-case.ts`).
  - `SetCropZoneSuitabilityUseCase.execute({ cropId, zoneId, rating, justification?, actor })` → `CropZoneSuitabilitySnapshot` (verifies crop AND zone exist, upserts, audits).
  - `ListCropZonesUseCase.execute({ cropId })` → `Array<{ zoneId, zoneName: Record<string,string>, rating, justification? }>` (joins suitabilities with zone names).

- [ ] **Step 1: In-memory suitability repo (test util)**

`apps/api/src/application/zone/in-memory-crop-zone-suitability.repository.ts`:
```ts
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';

export class InMemoryCropZoneSuitabilityRepository implements CropZoneSuitabilityRepository {
  private store: CropZoneSuitabilitySnapshot[] = [];
  async save(s: CropZoneSuitabilitySnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.cropId === s.cropId && x.zoneId === s.zoneId)).concat(s);
  }
  async listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    return this.store.filter((s) => s.cropId === cropId);
  }
  async listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    return this.store.filter((s) => s.zoneId === zoneId);
  }
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/application/zone/set-crop-zone-suitability.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreateZoneUseCase } from './create-zone.use-case';
import { SetCropZoneSuitabilityUseCase, ZoneNotFoundError } from './set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from './list-crop-zones.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { InMemoryCropZoneSuitabilityRepository } from './in-memory-crop-zone-suitability.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `zone-${++seq}` };

async function setup() {
  const crops = new InMemoryCropRepository();
  const zones = new InMemoryZoneRepository();
  const suit = new InMemoryCropZoneSuitabilityRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  const zone = await new CreateZoneUseCase(zones, audit, clock, ids).execute({ name: { fr: 'Sahel' }, country: 'BJ', actor: 'a' });
  return { crops, zones, suit, audit, zoneId: zone.id };
}

describe('SetCropZoneSuitabilityUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('sets suitability (crop+zone exist), audits, and lists with zone name', async () => {
    const { crops, zones, suit, audit, zoneId } = await setup();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    const out = await uc.execute({ cropId: 'c1', zoneId, rating: SuitabilityRating.SUITABLE, justification: 'ok', actor: 'a' });
    expect(out.rating).toBe(SuitabilityRating.SUITABLE);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropZonesUseCase(suit, zones).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].zoneName.fr).toBe('Sahel');
    expect(list[0].rating).toBe(SuitabilityRating.SUITABLE);
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const { zones, suit, audit, zoneId } = await setup();
    const crops = new InMemoryCropRepository();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    await expect(uc.execute({ cropId: 'nope', zoneId, rating: SuitabilityRating.SUITABLE, actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });

  it('throws ZoneNotFoundError when the zone is absent', async () => {
    const { crops, zones, suit, audit } = await setup();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    await expect(uc.execute({ cropId: 'c1', zoneId: 'nope', rating: SuitabilityRating.SUITABLE, actor: 'a' }))
      .rejects.toThrow(ZoneNotFoundError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @okko/api test set-crop-zone-suitability`
Expected: FAIL — use-cases not found.

- [ ] **Step 4: Implement the use-cases**

`apps/api/src/application/zone/set-crop-zone-suitability.use-case.ts`:
```ts
import { CropZoneSuitability, CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { CropRepository } from '../crop/crop.repository';
import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class ZoneNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ZoneNotFoundError';
  }
}

export interface SetCropZoneSuitabilityInput {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  actor: string;
}

export class SetCropZoneSuitabilityUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly zones: ZoneRepository,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropZoneSuitabilityInput): Promise<CropZoneSuitabilitySnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const suitability = CropZoneSuitability.create({
      cropId: input.cropId, zoneId: input.zoneId, rating: input.rating, justification: input.justification,
    });
    const snap = suitability.toSnapshot();
    await this.suitabilities.save(snap);
    await this.audit.record({
      entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { set: snap },
    });
    return snap;
  }
}
```

`apps/api/src/application/zone/list-crop-zones.use-case.ts`:
```ts
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';

export interface CropZoneView {
  zoneId: string;
  zoneName: Record<string, string>;
  rating: SuitabilityRating;
  justification?: string;
}

export class ListCropZonesUseCase {
  constructor(
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly zones: ZoneRepository,
  ) {}

  async execute(input: { cropId: string }): Promise<CropZoneView[]> {
    const suits = await this.suitabilities.listByCrop(input.cropId);
    const views: CropZoneView[] = [];
    for (const s of suits) {
      const zone = await this.zones.findById(s.zoneId);
      views.push({
        zoneId: s.zoneId,
        zoneName: zone ? zone.name : { fr: s.zoneId },
        rating: s.rating,
        justification: s.justification,
      });
    }
    return views;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @okko/api test set-crop-zone-suitability`
Expected: PASS (3 tests). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/zone/in-memory-crop-zone-suitability.repository.ts apps/api/src/application/zone/set-crop-zone-suitability.use-case.ts apps/api/src/application/zone/list-crop-zones.use-case.ts apps/api/src/application/zone/set-crop-zone-suitability.use-case.spec.ts
git commit -m "feat(application): add set-crop-zone-suitability and list-crop-zones use-cases"
```

---

### Task 7: Read-models — `zone-read-model` + crop document zones (application, TDD)

**Files:**
- Create: `apps/api/src/application/zone/zone-read-model.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/zone/zone-read-model.spec.ts`, and add cases to `apps/api/src/application/crop/crop-read-model.spec.ts`

**Interfaces:**
- Consumes: `ZoneSnapshot`, `CropZoneView`, `CropSnapshot`, `VarietySnapshot`.
- Produces:
  - `toZoneDocument(z: ZoneSnapshot, locale?): ZoneDocument` (flat, localized name + serializedText).
  - `CropDocument` gains `zones: CropZoneView[]`; `toCropDocument(snapshot, locale?, varieties?, zones?: CropZoneView[])` — fourth optional arg defaults to `[]`; serializedText includes a zones line.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/application/zone/zone-read-model.spec.ts`:
```ts
import { toZoneDocument } from './zone-read-model';

const snap = {
  id: 'z1', name: { fr: 'Sahel', en: 'Sahel zone' }, country: 'BJ', koppen: 'BSh',
  annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' }, metadata: {},
};

describe('toZoneDocument', () => {
  it('resolves the name for the locale and serializes', () => {
    const doc = toZoneDocument(snap, 'en');
    expect(doc.name).toBe('Sahel zone');
    expect(doc.country).toBe('BJ');
    expect(doc.serializedText).toContain('Sahel zone');
    expect(doc.serializedText).toContain('900');
  });

  it('falls back to fr', () => {
    expect(toZoneDocument(snap, 'wo').name).toBe('Sahel');
  });
});
```

Append to `apps/api/src/application/crop/crop-read-model.spec.ts`:
```ts
import { CropZoneView } from '../zone/list-crop-zones.use-case';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';

describe('toCropDocument with zones', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 5, metadata: {},
  };
  const zones: CropZoneView[] = [
    { zoneId: 'z1', zoneName: { fr: 'Sahel' }, rating: SuitabilityRating.SUITABLE },
  ];

  it('includes zones and mentions them in serialized text', () => {
    const doc = toCropDocument(snap, 'fr', [], zones);
    expect(doc.zones).toHaveLength(1);
    expect(doc.serializedText).toContain('Sahel');
  });

  it('defaults zones to an empty array', () => {
    expect(toCropDocument(snap, 'fr').zones).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test zone-read-model crop-read-model`
Expected: FAIL — `toZoneDocument` missing; `zones` not on CropDocument; fourth arg unsupported.

- [ ] **Step 3: Implement `zone-read-model.ts`**

`apps/api/src/application/zone/zone-read-model.ts`:
```ts
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export interface ZoneDocument {
  id: string;
  name: string;
  country: string;
  koppen?: string;
  annualRainfall?: ZoneSnapshot['annualRainfall'];
  altitude?: ZoneSnapshot['altitude'];
  notes?: string;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toZoneDocument(z: ZoneSnapshot, locale = 'fr'): ZoneDocument {
  const name = z.name[locale] ?? z.name['fr'];
  const lines = [`# ${name} (${z.country})`];
  if (z.koppen) lines.push(`Köppen : ${z.koppen}`);
  if (z.annualRainfall) {
    const r = z.annualRainfall;
    lines.push(`Pluviométrie annuelle : ${r.min}–${r.optimal}–${r.max} ${r.unit}`);
  }
  if (z.notes) lines.push(z.notes);
  return {
    id: z.id, name, country: z.country, koppen: z.koppen,
    annualRainfall: z.annualRainfall, altitude: z.altitude, notes: z.notes,
    metadata: z.metadata, serializedText: lines.join('\n'),
  };
}
```

- [ ] **Step 4: Extend `crop-read-model.ts`**

In `apps/api/src/application/crop/crop-read-model.ts`:
- Add import: `import { CropZoneView } from '../zone/list-crop-zones.use-case';`
- Add `zones: CropZoneView[];` to the `CropDocument` interface.
- Change the signature to `export function toCropDocument(s: CropSnapshot, locale = 'fr', varieties: VarietySnapshot[] = [], zones: CropZoneView[] = []): CropDocument {`.
- After the varieties block in `serializedText`, add:
```ts
  if (zones.length > 0) {
    lines.push(`Zones : ${zones.map((z) => `${z.zoneName[locale] ?? z.zoneName['fr']} (${z.rating})`).join(', ')}`);
  }
```
- Add `zones,` to the returned object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test zone-read-model crop-read-model`
Expected: PASS (all existing + new). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/zone/zone-read-model.* apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add zone read-model and crop-document zones"
```

---

### Task 8: Controllers + module wiring (e2e)

**Files:**
- Create: `apps/api/src/presentation/zone/zone.controller.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Test: `apps/api/test/zone.e2e-spec.ts`

**Interfaces:**
- Consumes: the zone use-cases + repositories + read-models.
- Produces endpoints: `POST /zones`, `GET /zones`, `GET /zones/:id`; `PUT /crops/:id/zones/:zoneId`, `GET /crops/:id/zones`. `GET /crops/:id` now includes `zones`.

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/zone.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Zones e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('creates a zone, sets crop suitability, and exposes it on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const zone = await request(app.getHttpServer()).post('/zones')
      .send({ name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/zones/${zone.body.id}`)
      .send({ rating: 'SUITABLE', justification: 'ok' })
      .expect(200);

    const zonesList = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/zones`).expect(200);
    expect(zonesList.body).toHaveLength(1);
    expect(zonesList.body[0].zoneName.fr).toBe('Sahel');

    const cropDoc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(cropDoc.body.zones).toHaveLength(1);
    expect(cropDoc.body.zones[0].rating).toBe('SUITABLE');

    const allZones = await request(app.getHttpServer()).get('/zones').expect(200);
    expect(allZones.body.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 setting suitability for an unknown zone', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/zones/does-not-exist`)
      .send({ rating: 'MARGINAL' })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test zone.e2e`
Expected: FAIL — routes not wired.

- [ ] **Step 3: Implement the zone controller**

`apps/api/src/presentation/zone/zone.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, NotFoundException, Inject } from '@nestjs/common';
import { CreateZoneUseCase } from '../../application/zone/create-zone.use-case';
import { ListZonesUseCase } from '../../application/zone/list-zones.use-case';
import { ZONE_REPOSITORY, ZoneRepository } from '../../application/zone/zone.repository';
import { toZoneDocument } from '../../application/zone/zone-read-model';
import { RangeValue } from '../../domain/shared/range-value';

const ACTOR = 'admin';

@Controller('zones')
export class ZoneController {
  constructor(
    private readonly createZone: CreateZoneUseCase,
    private readonly listZones: ListZonesUseCase,
    @Inject(ZONE_REPOSITORY) private readonly zones: ZoneRepository,
  ) {}

  @Post()
  async create(@Body() body: {
    name: Record<string, string>; country: string; koppen?: string;
    altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>; notes?: string;
  }) {
    const snap = await this.createZone.execute({ actor: ACTOR, ...body });
    return toZoneDocument(snap);
  }

  @Get()
  async list() {
    return (await this.listZones.execute()).map((z) => toZoneDocument(z));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.zones.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toZoneDocument(snap);
  }
}
```

- [ ] **Step 4: Extend the crop controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add imports:
```ts
import { Put } from '@nestjs/common';
import { SetCropZoneSuitabilityUseCase, ZoneNotFoundError } from '../../application/zone/set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from '../../application/zone/list-crop-zones.use-case';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
```
- Inject into the constructor:
```ts
    private readonly setSuitability: SetCropZoneSuitabilityUseCase,
    private readonly listCropZones: ListCropZonesUseCase,
```
- Update `GET /crops/:id` to also fetch zones and pass them (fourth arg):
```ts
  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    const vars = await this.varieties.listByCrop(id);
    const zones = await this.listCropZones.execute({ cropId: id });
    return toCropDocument(snap, 'fr', vars, zones);
  }
```
- Add the two handlers:
```ts
  @Put(':id/zones/:zoneId')
  async setZone(
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Body() body: { rating: SuitabilityRating; justification?: string },
  ) {
    try {
      return await this.setSuitability.execute({ cropId: id, zoneId, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/zones')
  async getZones(@Param('id') id: string) {
    return this.listCropZones.execute({ cropId: id });
  }
```
Note: `@Put` returns 200 by default in Nest — the e2e expects 200.

- [ ] **Step 5: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `ZoneController`, `PrismaZoneRepository`, `PrismaCropZoneSuitabilityRepository`, tokens `ZONE_REPOSITORY`/`CROP_ZONE_SUITABILITY_REPOSITORY`, and the four use-cases.
- Register `ZoneController` in `controllers`.
- Add providers:
```ts
    { provide: ZONE_REPOSITORY, useClass: PrismaZoneRepository },
    { provide: CROP_ZONE_SUITABILITY_REPOSITORY, useClass: PrismaCropZoneSuitabilityRepository },
    {
      provide: CreateZoneUseCase,
      useFactory: (z, a, c, ids) => new CreateZoneUseCase(z, a, c, ids),
      inject: [ZONE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListZonesUseCase,
      useFactory: (z) => new ListZonesUseCase(z),
      inject: [ZONE_REPOSITORY],
    },
    {
      provide: SetCropZoneSuitabilityUseCase,
      useFactory: (cr, z, s, a, c) => new SetCropZoneSuitabilityUseCase(cr, z, s, a, c),
      inject: [CROP_REPOSITORY, ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListCropZonesUseCase,
      useFactory: (s, z) => new ListCropZonesUseCase(s, z),
      inject: [CROP_ZONE_SUITABILITY_REPOSITORY, ZONE_REPOSITORY],
    },
```
(`UuidIdGenerator` is already a provider from Plan 2.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test zone.e2e`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/presentation/zone apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/zone.e2e-spec.ts
git commit -m "feat(api): wire zone endpoints and crop-zone suitability with e2e"
```

---

### Task 9: Admin — zones pages + crop detail zones section

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/app/zones/page.tsx`, `apps/admin/src/app/zones/new/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: the Task 8 API.
- Produces: a zones list + create page, and a zones-suitability section on the crop detail page.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`, add types + functions:
```ts
export interface Zone {
  id: string; name: string; country: string; koppen?: string;
}
export interface CropZone {
  zoneId: string; zoneName: Record<string, string>; rating: string; justification?: string;
}

export async function listZones(): Promise<Zone[]> {
  const res = await fetch(`${BASE}/zones`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
export async function createZone(input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await fetch(`${BASE}/zones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```
Also extend the `CropDetail` interface (from Plan 2) to add `zones: CropZone[]`.

- [ ] **Step 2: Zones list page**

`apps/admin/src/app/zones/page.tsx`:
```tsx
import Link from 'next/link';
import { listZones } from '../../lib/api';

export default async function ZonesPage() {
  const zones = await listZones();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zones agro-écologiques</h1>
        <Link href="/zones/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouvelle zone</Link>
      </div>
      <ul className="divide-y">
        {zones.map((z) => (
          <li key={z.id} className="py-3">{z.name} — {z.country}{z.koppen ? ` · ${z.koppen}` : ''}</li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Zone create page**

`apps/admin/src/app/zones/new/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createZone } from '../../../lib/api';

export default function NewZonePage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [country, setCountry] = useState('');
  const [koppen, setKoppen] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createZone({ name: { fr }, country, koppen: koppen || undefined });
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouvelle zone</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Pays (ex. BJ)" value={country} onChange={(e) => setCountry(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Köppen (optionnel)" value={koppen} onChange={(e) => setKoppen(e.target.value)} />
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Add a zones section to the crop detail page**

In `apps/admin/src/app/crops/[id]/page.tsx`, add after the varieties section:
```tsx
      <section>
        <h2 className="font-semibold mb-2">Zones ({crop.zones.length})</h2>
        <ul className="list-disc pl-5">
          {crop.zones.map((z) => (
            <li key={z.zoneId}>{z.zoneName.fr} — <strong>{z.rating}</strong>{z.justification ? ` (${z.justification})` : ''}</li>
          ))}
        </ul>
      </section>
```
(The `CropDetail` type now includes `zones`; no other change needed.)

- [ ] **Step 5: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; routes `/zones`, `/zones/new`, `/crops/[id]` compile.

- [ ] **Step 6: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): zones pages and crop-detail zones section"
```

---

## Self-Review

**1. Spec coverage (Plan 3 scope):**
- Catalogue partagé `AgroEcologicalZone` → Tasks 1, 3, 4, 5, 8, 9. ✅
- Relation d'adéquation culture ↔ zone (adapté/marginal/déconseillé + justification) → Tasks 2, 3, 4, 6, 8, 9. ✅
- Requêtable dans les deux sens (par culture / par zone) → `listByCrop`/`listByZone` (Task 4). ✅
- Provenance sur l'adéquation → Task 2 (via `Provenance`). ✅
- Read-model enrichi (AI-ready) → Task 7. ✅
- Audit sur mutations → Tasks 5, 6. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues. ✅

**3. Type consistency:** `ZoneSnapshot` (Task 1) réutilisé par le port + repo (Task 4), use-cases (Task 5), read-model (Task 7). `CropZoneSuitabilitySnapshot` (Task 2) → port + repo (Task 4), use-cases (Task 6). `CropZoneView` (Task 6) → read-model (Task 7) + controller (Task 8) + admin (Task 9). `SuitabilityRating` (Task 1) cohérent partout. `IdGenerator`/`UuidIdGenerator` réutilisés du Plan 2. `ZoneNotFoundError` définie une fois (Task 6). `toCropDocument` 4e argument optionnel rétrocompatible avec les appels Plans 1-2. ✅

---

## Notes de conception
- **Clé composite `(cropId, zoneId)`** pour l'adéquation — pas d'id synthétique ; `save` upsert sur la clé. Une culture a au plus une adéquation par zone.
- **`ListCropZones` fait le join** en application (suitabilities + noms de zones) plutôt qu'au niveau SQL — cohérent avec l'architecture (le repo reste simple ; le use-case compose). Pour un gros volume on optimisera plus tard.
- **Zone = agrégat de référence partagé**, comme prévu au spec pour les catalogues (zones, ravageurs). Le même patron servira au Plan 5 (ravageurs/maladies).
```
