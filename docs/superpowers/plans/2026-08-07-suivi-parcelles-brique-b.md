# Module 2 / Brique B « Bénéficiaires & Parcelles » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux organisations clientes deux entités de suivi — bénéficiaires (agriculteurs sans compte) et parcelles (conteneur), scopées à leur tenant — avec CRUD API + surface admin.

**Architecture:** Deux entités snapshot (pas d'event-sourcing) sur le pattern zone/pest, mais **scopées par `organizationId`** (comme les invitations de la brique A). Nouveau `SuiviModule`. Contrôleurs `@UseGuards(AuthGuard, RolesGuard)` : lecture = 4 rôles tenant, écriture = ORG_ADMIN/AGRONOMIST/FIELD_AGENT. La liste `GET /zones` est ouverte en lecture aux tenants pour le sélecteur de zone. Admin : CRUD calqué sur les zones.

**Tech Stack:** NestJS + Prisma + Jest (API) ; Next.js App Router + shadcn (admin).

## Global Constraints

- **Isolation tenant** : `organizationId` vient TOUJOURS de `@CurrentUser().organizationId` (JWT), jamais du body ; 403 s'il est absent. Toute lecture/écriture filtrée dessus.
- **Rôles** — lecture : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')` ; écriture (POST/PATCH/DELETE) : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT')`.
- **Cross-org** : `update`/`delete`/`findById` d'une entité d'une autre org → `*NotFoundError` (traité 404, ne révèle pas l'existence).
- `RolesGuard` = match exact ; `@Roles()` method-level override le class-level ; gardes **par contrôleur** (`@UseGuards(AuthGuard, RolesGuard)`), pas d'`APP_GUARD`.
- **Parcelle agnostique** : pas de culture/variété/saison (→ brique C).
- Value objects **allégés** : snapshots simples construits par les use-cases (entités sans invariant) — pas de classe value-object lourde façon `AgroEcologicalZone`.
- Gate de fin de tâche : `cd apps/api && npx tsc --noEmit` + jest concerné vert ; `cd apps/admin && npx tsc --noEmit` vert.

---

### Task 1: API — Bénéficiaire : domaine, repo, use-cases

**Files:**
- Create: `apps/api/src/domain/parcel/beneficiary.ts`
- Create: `apps/api/src/application/parcel/beneficiary.repository.ts`
- Create: `apps/api/src/application/parcel/in-memory-beneficiary.repository.ts`
- Create: `apps/api/src/application/parcel/beneficiary.use-cases.ts`
- Create: `apps/api/src/application/parcel/errors.ts`
- Create test: `apps/api/src/application/parcel/beneficiary.use-cases.spec.ts`

**Interfaces:**
- Produces: `BeneficiarySnapshot` ; `BENEFICIARY_REPOSITORY` + `BeneficiaryRepository` ; `CreateBeneficiaryUseCase`/`ListBeneficiariesUseCase`/`UpdateBeneficiaryUseCase`/`DeleteBeneficiaryUseCase` ; `BeneficiaryNotFoundError`.

- [ ] **Step 1: Écrire le test qui échoue** — `beneficiary.use-cases.spec.ts` :

```ts
import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from './beneficiary.use-cases';
import { BeneficiaryNotFoundError } from './errors';
import { InMemoryBeneficiaryRepository } from './in-memory-beneficiary.repository';

const clock = { nowIso: () => '2026-08-07T00:00:00.000Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const repo = new InMemoryBeneficiaryRepository();
  return {
    repo,
    create: new CreateBeneficiaryUseCase(repo, clock, ids),
    list: new ListBeneficiariesUseCase(repo),
    update: new UpdateBeneficiaryUseCase(repo),
    del: new DeleteBeneficiaryUseCase(repo),
  };
}

describe('Beneficiary use-cases — isolation par organisation', () => {
  beforeEach(() => { n = 0; });

  it('create pose organizationId et se relit via listByOrganization', async () => {
    const { create, list } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'Awa', phone: '+229...' });
    expect(b.organizationId).toBe('o1');
    expect(b.name).toBe('Awa');
    const rows = await list.execute({ organizationId: 'o1' });
    expect(rows.map((r) => r.id)).toEqual([b.id]);
  });

  it('listByOrganization ne renvoie que l’org demandée', async () => {
    const { create, list } = make();
    await create.execute({ organizationId: 'o1', name: 'A' });
    await create.execute({ organizationId: 'o2', name: 'B' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(1);
    expect(await list.execute({ organizationId: 'o2' })).toHaveLength(1);
  });

  it('update/delete d’une autre org → BeneficiaryNotFoundError', async () => {
    const { create, update, del } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'A' });
    await expect(update.execute({ id: b.id, organizationId: 'o2', name: 'X' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
    await expect(del.execute({ id: b.id, organizationId: 'o2' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
  });

  it('update applique les champs ; delete retire', async () => {
    const { create, update, del, list } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'A' });
    const up = await update.execute({ id: b.id, organizationId: 'o1', name: 'A2', phone: '123' });
    expect(up.name).toBe('A2'); expect(up.phone).toBe('123');
    await del.execute({ id: b.id, organizationId: 'o1' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest beneficiary.use-cases` → FAIL (modules absents).

- [ ] **Step 3: Domaine** — `apps/api/src/domain/parcel/beneficiary.ts` :
```ts
export interface BeneficiarySnapshot {
  id: string;
  organizationId: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}
```

- [ ] **Step 4: Repo interface + in-memory** —
`apps/api/src/application/parcel/beneficiary.repository.ts` :
```ts
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

export const BENEFICIARY_REPOSITORY = Symbol('BENEFICIARY_REPOSITORY');

export interface BeneficiaryRepository {
  save(b: BeneficiarySnapshot): Promise<void>;
  findById(id: string): Promise<BeneficiarySnapshot | null>;
  listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]>;
  delete(id: string): Promise<void>;
}
```
`apps/api/src/application/parcel/in-memory-beneficiary.repository.ts` :
```ts
import { BeneficiaryRepository } from './beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

export class InMemoryBeneficiaryRepository implements BeneficiaryRepository {
  private store = new Map<string, BeneficiarySnapshot>();
  async save(b: BeneficiarySnapshot): Promise<void> { this.store.set(b.id, b); }
  async findById(id: string): Promise<BeneficiarySnapshot | null> { return this.store.get(id) ?? null; }
  async listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]> {
    return [...this.store.values()].filter((b) => b.organizationId === organizationId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
```

- [ ] **Step 5: Erreurs** — `apps/api/src/application/parcel/errors.ts` :
```ts
export class BeneficiaryNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Beneficiary ${id} not found`); this.name = 'BeneficiaryNotFoundError'; }
}
export class ParcelNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Parcel ${id} not found`); this.name = 'ParcelNotFoundError'; }
}
```

- [ ] **Step 6: Use-cases** — `apps/api/src/application/parcel/beneficiary.use-cases.ts` :
```ts
import { BeneficiaryRepository } from './beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';
import { BeneficiaryNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateBeneficiaryInput { organizationId: string; name: string; phone?: string; notes?: string; }
export interface UpdateBeneficiaryInput { id: string; organizationId: string; name?: string; phone?: string; notes?: string; }

export class CreateBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateBeneficiaryInput): Promise<BeneficiarySnapshot> {
    const snap: BeneficiarySnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, name: input.name,
      phone: input.phone, notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListBeneficiariesUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  execute(input: { organizationId: string }): Promise<BeneficiarySnapshot[]> {
    return this.repo.listByOrganization(input.organizationId);
  }
}

export class UpdateBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  async execute(input: UpdateBeneficiaryInput): Promise<BeneficiarySnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.id);
    const snap: BeneficiarySnapshot = {
      ...existing,
      name: input.name ?? existing.name,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
```

- [ ] **Step 7: Vérifier le succès** — Run: `cd apps/api && npx jest beneficiary.use-cases` → PASS (4 tests).

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/domain/parcel apps/api/src/application/parcel
git commit -m "feat(suivi): Bénéficiaire — domaine, repo, use-cases (scopés org)"
```

---

### Task 2: API — Bénéficiaire : persistance, contrôleur, SuiviModule

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Beneficiary`)
- Create: `apps/api/prisma/migrations/20260807100000_beneficiary/migration.sql`
- Create: `apps/api/src/infrastructure/parcel/prisma-beneficiary.repository.ts`
- Create: `apps/api/src/presentation/parcel/beneficiary.controller.ts`
- Create: `apps/api/src/suivi.module.ts`
- Modify: `apps/api/src/app.module.ts` (importer `SuiviModule`)
- Create test: `apps/api/src/presentation/parcel/beneficiary-roles.spec.ts`

**Interfaces:**
- Consumes: use-cases + `BENEFICIARY_REPOSITORY` (Task 1) ; `AuthGuard`/`RolesGuard`/`CurrentUser` (auth).
- Produces: endpoints `GET/POST/PATCH/DELETE /beneficiaries` ; `SuiviModule`.

- [ ] **Step 1: Écrire le test qui échoue** (métadonnées `@Roles` via Reflector) — `beneficiary-roles.spec.ts` :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { BeneficiaryController } from './beneficiary.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('BeneficiaryController — rôles', () => {
  it('lecture = 4 rôles tenant', () => {
    expect(reflector.get<string[]>(ROLES_KEY, BeneficiaryController.prototype.list)).toEqual(READ);
  });
  it('écriture = 3 rôles (pas VIEWER)', () => {
    for (const m of [BeneficiaryController.prototype.create, BeneficiaryController.prototype.update, BeneficiaryController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest beneficiary-roles` → FAIL (contrôleur absent).

- [ ] **Step 3: Schéma + migration** — dans `apps/api/prisma/schema.prisma`, ajouter :
```prisma
model Beneficiary {
  id             String   @id
  organizationId String
  name           String
  phone          String?
  notes          String?
  createdAt      DateTime @default(now())

  @@index([organizationId])
}
```
`apps/api/prisma/migrations/20260807100000_beneficiary/migration.sql` :
```sql
CREATE TABLE "Beneficiary" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Beneficiary_organizationId_idx" ON "Beneficiary"("organizationId");
```
Puis Run: `cd apps/api && npx prisma generate`.

- [ ] **Step 4: Repo Prisma** — `apps/api/src/infrastructure/parcel/prisma-beneficiary.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BeneficiaryRepository } from '../../application/parcel/beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

@Injectable()
export class PrismaBeneficiaryRepository implements BeneficiaryRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: { id: string; organizationId: string; name: string; phone: string | null; notes: string | null; createdAt: Date }): BeneficiarySnapshot {
    return { id: r.id, organizationId: r.organizationId, name: r.name, phone: r.phone ?? undefined, notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString() };
  }
  async save(b: BeneficiarySnapshot): Promise<void> {
    const data = { id: b.id, organizationId: b.organizationId, name: b.name, phone: b.phone ?? null, notes: b.notes ?? null };
    await this.prisma.beneficiary.upsert({ where: { id: b.id }, create: data, update: data });
  }
  async findById(id: string): Promise<BeneficiarySnapshot | null> {
    const r = await this.prisma.beneficiary.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]> {
    const rows = await this.prisma.beneficiary.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.beneficiary.delete({ where: { id } }); }
}
```

- [ ] **Step 5: Contrôleur** — `apps/api/src/presentation/parcel/beneficiary.controller.ts` :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException, NotFoundException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from '../../application/parcel/beneficiary.use-cases';
import { BeneficiaryNotFoundError } from '../../application/parcel/errors';

@Controller('beneficiaries')
@UseGuards(AuthGuard, RolesGuard)
export class BeneficiaryController {
  constructor(
    private readonly listUC: ListBeneficiariesUseCase,
    private readonly createUC: CreateBeneficiaryUseCase,
    private readonly updateUC: UpdateBeneficiaryUseCase,
    private readonly deleteUC: DeleteBeneficiaryUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser) { return this.listUC.execute({ organizationId: this.org(user) }); }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: { name: string; phone?: string; notes?: string }) {
    return this.createUC.execute({ organizationId: this.org(user), name: body.name, phone: body.phone, notes: body.notes });
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { name?: string; phone?: string; notes?: string }) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), name: body.name, phone: body.phone, notes: body.notes }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new NotFoundException(); throw e; }
  }
}
```

- [ ] **Step 6: SuiviModule + app.module** — `apps/api/src/suivi.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { CLOCK } from './application/shared/clock';
import { BENEFICIARY_REPOSITORY } from './application/parcel/beneficiary.repository';
import { PrismaBeneficiaryRepository } from './infrastructure/parcel/prisma-beneficiary.repository';
import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from './application/parcel/beneficiary.use-cases';
import { BeneficiaryController } from './presentation/parcel/beneficiary.controller';

@Module({
  imports: [AuthModule],
  controllers: [BeneficiaryController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    UuidIdGenerator,
    { provide: BENEFICIARY_REPOSITORY, useClass: PrismaBeneficiaryRepository },
    { provide: CreateBeneficiaryUseCase, useFactory: (r, c, ids) => new CreateBeneficiaryUseCase(r, c, ids), inject: [BENEFICIARY_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListBeneficiariesUseCase, useFactory: (r) => new ListBeneficiariesUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
    { provide: UpdateBeneficiaryUseCase, useFactory: (r) => new UpdateBeneficiaryUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
    { provide: DeleteBeneficiaryUseCase, useFactory: (r) => new DeleteBeneficiaryUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
  ],
})
export class SuiviModule {}
```
Dans `apps/api/src/app.module.ts`, ajouter `SuiviModule` aux imports :
```ts
import { SuiviModule } from './suivi.module';
@Module({ imports: [AuthModule, CropModule, SuiviModule] })
export class AppModule {}
```
(Vérifier le chemin d'import de `PrismaService`, `SystemClock`, `UuidIdGenerator`, `AuthGuard`, `RolesGuard`, `decorators` en s'alignant sur ceux utilisés dans `crop.module.ts` / `crop.controller.ts` — ajuster si l'arborescence diffère.)

- [ ] **Step 7: Vérifier** — Run: `cd apps/api && npx jest beneficiary-roles && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 8: Commit**
```bash
git add apps/api/prisma apps/api/src/infrastructure/parcel apps/api/src/presentation/parcel apps/api/src/suivi.module.ts apps/api/src/app.module.ts
git commit -m "feat(suivi): Bénéficiaire — persistance, contrôleur (rôles), SuiviModule"
```

---

### Task 3: API — Parcelle : domaine, repo, use-cases

**Files:**
- Create: `apps/api/src/domain/parcel/parcel.ts`
- Create: `apps/api/src/application/parcel/parcel.repository.ts`
- Create: `apps/api/src/application/parcel/in-memory-parcel.repository.ts`
- Create: `apps/api/src/application/parcel/parcel.use-cases.ts`
- Modify: `apps/api/src/application/parcel/errors.ts` (déjà `ParcelNotFoundError` de Task 1 — ajouter `BeneficiaryOtherOrgError` si besoin ci-dessous)
- Create test: `apps/api/src/application/parcel/parcel.use-cases.spec.ts`

**Interfaces:**
- Consumes: `BeneficiaryRepository` (pour vérifier l'appartenance du bénéficiaire).
- Produces: `ParcelSnapshot` ; `PARCEL_REPOSITORY` + `ParcelRepository` ; `CreateParcelUseCase`/`ListParcelsUseCase`/`UpdateParcelUseCase`/`DeleteParcelUseCase`.

- [ ] **Step 1: Écrire le test qui échoue** — `parcel.use-cases.spec.ts` :
```ts
import { CreateParcelUseCase, ListParcelsUseCase, UpdateParcelUseCase, DeleteParcelUseCase } from './parcel.use-cases';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from './errors';
import { InMemoryParcelRepository } from './in-memory-parcel.repository';
import { InMemoryBeneficiaryRepository } from './in-memory-beneficiary.repository';

const clock = { nowIso: () => '2026-08-07T00:00:00.000Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const repo = new InMemoryParcelRepository();
  const bene = new InMemoryBeneficiaryRepository();
  return {
    repo, bene,
    create: new CreateParcelUseCase(repo, bene, clock, ids),
    list: new ListParcelsUseCase(repo),
    update: new UpdateParcelUseCase(repo),
    del: new DeleteParcelUseCase(repo),
  };
}

describe('Parcel use-cases — isolation par organisation', () => {
  beforeEach(() => { n = 0; });

  it('create pose organizationId et se relit ; champs optionnels préservés', async () => {
    const { create, list } = make();
    const p = await create.execute({ organizationId: 'o1', name: 'Champ nord', zoneId: 'z1', areaHectares: 1.5 });
    expect(p.organizationId).toBe('o1');
    expect(p.zoneId).toBe('z1'); expect(p.areaHectares).toBe(1.5);
    expect((await list.execute({ organizationId: 'o1' })).map((r) => r.id)).toEqual([p.id]);
  });

  it('listByOrganization ne renvoie que l’org demandée', async () => {
    const { create, list } = make();
    await create.execute({ organizationId: 'o1', name: 'A' });
    await create.execute({ organizationId: 'o2', name: 'B' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(1);
  });

  it('update/delete d’une autre org → ParcelNotFoundError', async () => {
    const { create, update, del } = make();
    const p = await create.execute({ organizationId: 'o1', name: 'A' });
    await expect(update.execute({ id: p.id, organizationId: 'o2', name: 'X' })).rejects.toBeInstanceOf(ParcelNotFoundError);
    await expect(del.execute({ id: p.id, organizationId: 'o2' })).rejects.toBeInstanceOf(ParcelNotFoundError);
  });

  it('create avec beneficiaryId d’une autre org → BeneficiaryNotFoundError', async () => {
    const { create, bene } = make();
    const other = { id: 'b-other', organizationId: 'o2', name: 'Autre', createdAt: clock.nowIso() };
    await bene.save(other);
    await expect(create.execute({ organizationId: 'o1', name: 'P', beneficiaryId: 'b-other' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
  });

  it('create avec beneficiaryId de la même org → OK', async () => {
    const { create, bene } = make();
    await bene.save({ id: 'b1', organizationId: 'o1', name: 'Awa', createdAt: clock.nowIso() });
    const p = await create.execute({ organizationId: 'o1', name: 'P', beneficiaryId: 'b1' });
    expect(p.beneficiaryId).toBe('b1');
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest parcel.use-cases` → FAIL.

- [ ] **Step 3: Domaine** — `apps/api/src/domain/parcel/parcel.ts` :
```ts
export interface ParcelSnapshot {
  id: string;
  organizationId: string;
  name: string;
  beneficiaryId?: string;
  zoneId?: string;
  gpsLat?: number;
  gpsLng?: number;
  locality?: string;
  areaHectares?: number;
  notes?: string;
  createdAt: string;
}
```

- [ ] **Step 4: Repo interface + in-memory** —
`apps/api/src/application/parcel/parcel.repository.ts` :
```ts
import { ParcelSnapshot } from '../../domain/parcel/parcel';

export const PARCEL_REPOSITORY = Symbol('PARCEL_REPOSITORY');

export interface ParcelRepository {
  save(p: ParcelSnapshot): Promise<void>;
  findById(id: string): Promise<ParcelSnapshot | null>;
  listByOrganization(organizationId: string): Promise<ParcelSnapshot[]>;
  delete(id: string): Promise<void>;
}
```
`apps/api/src/application/parcel/in-memory-parcel.repository.ts` :
```ts
import { ParcelRepository } from './parcel.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';

export class InMemoryParcelRepository implements ParcelRepository {
  private store = new Map<string, ParcelSnapshot>();
  async save(p: ParcelSnapshot): Promise<void> { this.store.set(p.id, p); }
  async findById(id: string): Promise<ParcelSnapshot | null> { return this.store.get(id) ?? null; }
  async listByOrganization(organizationId: string): Promise<ParcelSnapshot[]> {
    return [...this.store.values()].filter((p) => p.organizationId === organizationId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
```

- [ ] **Step 5: Use-cases** — `apps/api/src/application/parcel/parcel.use-cases.ts` :
```ts
import { ParcelRepository } from './parcel.repository';
import { BeneficiaryRepository } from './beneficiary.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateParcelInput {
  organizationId: string; name: string; beneficiaryId?: string; zoneId?: string;
  gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string;
}
export interface UpdateParcelInput extends Partial<CreateParcelInput> { id: string; organizationId: string; }

export class CreateParcelUseCase {
  constructor(private readonly repo: ParcelRepository, private readonly beneficiaries: BeneficiaryRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateParcelInput): Promise<ParcelSnapshot> {
    if (input.beneficiaryId) {
      const b = await this.beneficiaries.findById(input.beneficiaryId);
      if (!b || b.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.beneficiaryId);
    }
    const snap: ParcelSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, name: input.name,
      beneficiaryId: input.beneficiaryId, zoneId: input.zoneId, gpsLat: input.gpsLat, gpsLng: input.gpsLng,
      locality: input.locality, areaHectares: input.areaHectares, notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListParcelsUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  execute(input: { organizationId: string }): Promise<ParcelSnapshot[]> { return this.repo.listByOrganization(input.organizationId); }
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class UpdateParcelUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  async execute(input: UpdateParcelInput): Promise<ParcelSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.id);
    const snap: ParcelSnapshot = {
      ...existing,
      name: input.name ?? existing.name,
      beneficiaryId: keep(input.beneficiaryId, existing.beneficiaryId),
      zoneId: keep(input.zoneId, existing.zoneId),
      gpsLat: keep(input.gpsLat, existing.gpsLat),
      gpsLng: keep(input.gpsLng, existing.gpsLng),
      locality: keep(input.locality, existing.locality),
      areaHectares: keep(input.areaHectares, existing.areaHectares),
      notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteParcelUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
```

- [ ] **Step 6: Vérifier le succès** — Run: `cd apps/api && npx jest parcel.use-cases` → PASS (5 tests).

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/domain/parcel/parcel.ts apps/api/src/application/parcel
git commit -m "feat(suivi): Parcelle — domaine, repo, use-cases (scopés org + garde bénéficiaire)"
```

---

### Task 4: API — Parcelle : persistance, contrôleur

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Parcel`)
- Create: `apps/api/prisma/migrations/20260807110000_parcel/migration.sql`
- Create: `apps/api/src/infrastructure/parcel/prisma-parcel.repository.ts`
- Create: `apps/api/src/presentation/parcel/parcel.controller.ts`
- Modify: `apps/api/src/suivi.module.ts` (ajouter repo/use-cases/contrôleur Parcel)
- Create test: `apps/api/src/presentation/parcel/parcel-roles.spec.ts`

**Interfaces:**
- Consumes: use-cases Parcelle (Task 3), `BENEFICIARY_REPOSITORY` (déjà dans le module).
- Produces: endpoints `GET/POST/PATCH/DELETE /parcels`.

- [ ] **Step 1: Écrire le test qui échoue** — `parcel-roles.spec.ts` (mirror T2 roles test) :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { ParcelController } from './parcel.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('ParcelController — rôles', () => {
  it('lecture = 4 rôles tenant', () => {
    expect(reflector.get<string[]>(ROLES_KEY, ParcelController.prototype.list)).toEqual(READ);
  });
  it('écriture = 3 rôles (pas VIEWER)', () => {
    for (const m of [ParcelController.prototype.create, ParcelController.prototype.update, ParcelController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest parcel-roles` → FAIL.

- [ ] **Step 3: Schéma + migration** — dans `schema.prisma`, ajouter :
```prisma
model Parcel {
  id             String   @id
  organizationId String
  name           String
  beneficiaryId  String?
  zoneId         String?
  gpsLat         Float?
  gpsLng         Float?
  locality       String?
  areaHectares   Float?
  notes          String?
  createdAt      DateTime @default(now())

  @@index([organizationId])
}
```
`apps/api/prisma/migrations/20260807110000_parcel/migration.sql` :
```sql
CREATE TABLE "Parcel" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "beneficiaryId" TEXT,
  "zoneId" TEXT,
  "gpsLat" DOUBLE PRECISION,
  "gpsLng" DOUBLE PRECISION,
  "locality" TEXT,
  "areaHectares" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Parcel_organizationId_idx" ON "Parcel"("organizationId");
```
Puis Run: `cd apps/api && npx prisma generate`.

- [ ] **Step 4: Repo Prisma** — `apps/api/src/infrastructure/parcel/prisma-parcel.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParcelRepository } from '../../application/parcel/parcel.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';

type Row = { id: string; organizationId: string; name: string; beneficiaryId: string | null; zoneId: string | null; gpsLat: number | null; gpsLng: number | null; locality: string | null; areaHectares: number | null; notes: string | null; createdAt: Date };

@Injectable()
export class PrismaParcelRepository implements ParcelRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): ParcelSnapshot {
    return {
      id: r.id, organizationId: r.organizationId, name: r.name,
      beneficiaryId: r.beneficiaryId ?? undefined, zoneId: r.zoneId ?? undefined,
      gpsLat: r.gpsLat ?? undefined, gpsLng: r.gpsLng ?? undefined, locality: r.locality ?? undefined,
      areaHectares: r.areaHectares ?? undefined, notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString(),
    };
  }
  async save(p: ParcelSnapshot): Promise<void> {
    const data = { id: p.id, organizationId: p.organizationId, name: p.name, beneficiaryId: p.beneficiaryId ?? null, zoneId: p.zoneId ?? null, gpsLat: p.gpsLat ?? null, gpsLng: p.gpsLng ?? null, locality: p.locality ?? null, areaHectares: p.areaHectares ?? null, notes: p.notes ?? null };
    await this.prisma.parcel.upsert({ where: { id: p.id }, create: data, update: data });
  }
  async findById(id: string): Promise<ParcelSnapshot | null> {
    const r = await this.prisma.parcel.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<ParcelSnapshot[]> {
    const rows = await this.prisma.parcel.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.parcel.delete({ where: { id } }); }
}
```

- [ ] **Step 5: Contrôleur** — `apps/api/src/presentation/parcel/parcel.controller.ts` :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateParcelUseCase, ListParcelsUseCase, UpdateParcelUseCase, DeleteParcelUseCase } from '../../application/parcel/parcel.use-cases';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from '../../application/parcel/errors';

type ParcelBody = { name: string; beneficiaryId?: string; zoneId?: string; gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string };

@Controller('parcels')
@UseGuards(AuthGuard, RolesGuard)
export class ParcelController {
  constructor(
    private readonly listUC: ListParcelsUseCase,
    private readonly createUC: CreateParcelUseCase,
    private readonly updateUC: UpdateParcelUseCase,
    private readonly deleteUC: DeleteParcelUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser) { return this.listUC.execute({ organizationId: this.org(user) }); }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: ParcelBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new BadRequestException('bénéficiaire invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<ParcelBody>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new NotFoundException(); throw e; }
  }
}
```

- [ ] **Step 6: Câbler dans SuiviModule** — dans `apps/api/src/suivi.module.ts` : importer les 4 use-cases Parcelle, `PrismaParcelRepository`, `PARCEL_REPOSITORY`, `ParcelController` ; ajouter `ParcelController` à `controllers`, et aux `providers` :
```ts
    { provide: PARCEL_REPOSITORY, useClass: PrismaParcelRepository },
    { provide: CreateParcelUseCase, useFactory: (r, b, c, ids) => new CreateParcelUseCase(r, b, c, ids), inject: [PARCEL_REPOSITORY, BENEFICIARY_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListParcelsUseCase, useFactory: (r) => new ListParcelsUseCase(r), inject: [PARCEL_REPOSITORY] },
    { provide: UpdateParcelUseCase, useFactory: (r) => new UpdateParcelUseCase(r), inject: [PARCEL_REPOSITORY] },
    { provide: DeleteParcelUseCase, useFactory: (r) => new DeleteParcelUseCase(r), inject: [PARCEL_REPOSITORY] },
```

- [ ] **Step 7: Vérifier** — Run: `cd apps/api && npx jest parcel-roles beneficiary-roles && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 8: Commit**
```bash
git add apps/api/prisma apps/api/src/infrastructure/parcel/prisma-parcel.repository.ts apps/api/src/presentation/parcel/parcel.controller.ts apps/api/src/suivi.module.ts
git commit -m "feat(suivi): Parcelle — persistance, contrôleur (rôles), câblage module"
```

---

### Task 5: API — Ouvrir la liste des zones aux tenants

**Files:**
- Modify: `apps/api/src/presentation/zone/zone.controller.ts`
- Create test: `apps/api/src/presentation/zone/zone-tenant-read.spec.ts`

**Interfaces:**
- Produces: `GET /zones` (liste) accessible aux 4 rôles tenant + plateforme ; écritures zone inchangées (`superadmin`).

- [ ] **Step 1: Écrire le test qui échoue** — `zone-tenant-read.spec.ts` :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { ZoneController } from './zone.controller';

const reflector = new Reflector();

describe('ZoneController — liste ouverte aux tenants', () => {
  it('GET /zones (list) autorise les rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, ZoneController.prototype.list);
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('VIEWER');
    expect(roles).toContain('superadmin');
  });
  it("l'écriture (create) n'a pas de @Roles method-level (reste superadmin de la classe)", () => {
    expect(reflector.get<string[]>(ROLES_KEY, ZoneController.prototype.create)).toBeUndefined();
  });
});
```
(Adapter le nom de la méthode liste si ce n'est pas `list` — l'ouvrir dans le fichier ; le handler `@Get()` sans param.)

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest zone-tenant-read` → FAIL.

- [ ] **Step 3: Ouvrir la liste** — dans `zone.controller.ts`, sur le handler `@Get()` (liste, sans param — probablement `list()`), ajouter au-dessus :
```ts
  @Roles('superadmin', 'admin', 'editor', 'ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
```
Ne PAS ajouter de `@Roles` sur les autres handlers (create/update/delete/get-by-id restent `superadmin` via la classe). Vérifier qu'aucun `@Public()` n'est présent.

- [ ] **Step 4: Vérifier** — Run: `cd apps/api && npx jest zone-tenant-read && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/presentation/zone/zone.controller.ts apps/api/src/presentation/zone/zone-tenant-read.spec.ts
git commit -m "feat(zone): liste GET /zones ouverte en lecture aux rôles tenant (sélecteur parcelle)"
```

---

### Task 6: Admin — clients API + server actions

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (types + clients list)
- Create: `apps/admin/src/lib/suivi-actions.ts` (create/update/delete)

**Interfaces:**
- Consumes: endpoints `/beneficiaries`, `/parcels` (Tasks 2, 4), `listZones` existant (ouvert en Task 5).
- Produces: `Beneficiary`/`Parcel` types ; `listBeneficiaries`/`listParcels` ; `create*/update*/delete*` actions.

- [ ] **Step 1: Types + clients (api.ts)** — dans `apps/admin/src/lib/api.ts`, ajouter :
```ts
export interface Beneficiary { id: string; organizationId: string; name: string; phone?: string; notes?: string; createdAt: string; }
export interface Parcel { id: string; organizationId: string; name: string; beneficiaryId?: string; zoneId?: string; gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string; createdAt: string; }

export async function listBeneficiaries(): Promise<Beneficiary[]> {
  const res = await authFetch('/beneficiaries', { cache: 'no-store' });
  return res.json();
}
export async function listParcels(): Promise<Parcel[]> {
  const res = await authFetch('/parcels', { cache: 'no-store' });
  return res.json();
}
```

- [ ] **Step 2: Server actions** — `apps/admin/src/lib/suivi-actions.ts` :
```ts
'use server';
import { authFetch, jsonInit } from './http';
import type { Beneficiary, Parcel } from './api';

export type BeneficiaryPayload = { name: string; phone?: string; notes?: string };
export type ParcelPayload = { name: string; beneficiaryId?: string; zoneId?: string; gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string };

export async function createBeneficiary(input: BeneficiaryPayload): Promise<Beneficiary> {
  const res = await authFetch('/beneficiaries', jsonInit('POST', input));
  return res.json();
}
export async function updateBeneficiary(id: string, input: BeneficiaryPayload): Promise<Beneficiary> {
  const res = await authFetch(`/beneficiaries/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteBeneficiary(id: string): Promise<void> {
  await authFetch(`/beneficiaries/${id}`, { method: 'DELETE' });
}

export async function createParcel(input: ParcelPayload): Promise<Parcel> {
  const res = await authFetch('/parcels', jsonInit('POST', input));
  return res.json();
}
export async function updateParcel(id: string, input: ParcelPayload): Promise<Parcel> {
  const res = await authFetch(`/parcels/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteParcel(id: string): Promise<void> {
  await authFetch(`/parcels/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/lib/api.ts" "apps/admin/src/lib/suivi-actions.ts"
git commit -m "feat(admin): clients API + actions bénéficiaires & parcelles"
```

---

### Task 7: Admin — surface Bénéficiaires

**Files:**
- Create: `apps/admin/src/app/beneficiaires/page.tsx`
- Create: `apps/admin/src/app/beneficiaires/BeneficiaireForm.tsx`
- Create: `apps/admin/src/app/beneficiaires/BeneficiaireRowActions.tsx`

**Interfaces:**
- Consumes: `listBeneficiaries` (Task 6), `create/update/deleteBeneficiary`, `getSession` (rôle → gating écriture).

- [ ] **Step 1: Formulaire partagé** — `BeneficiaireForm.tsx` :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BeneficiaireFormValue { name: string; phone: string; notes: string; }
export const emptyBeneficiaire = (): BeneficiaireFormValue => ({ name: '', phone: '', notes: '' });
export const beneficiaireToPayload = (v: BeneficiaireFormValue) => ({ name: v.name, phone: v.phone || undefined, notes: v.notes || undefined });

export function BeneficiaireFields({ value, onChange }: { value: BeneficiaireFormValue; onChange: (v: BeneficiaireFormValue) => void }) {
  const set = <K extends keyof BeneficiaireFormValue>(k: K, val: BeneficiaireFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Nom *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
      <div className="space-y-1"><Label>Téléphone</Label><Input value={value.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 2: Row actions (édition + suppression)** — `BeneficiaireRowActions.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateBeneficiary, deleteBeneficiary } from '@/lib/suivi-actions';
import { BeneficiaireFields, beneficiaireToPayload, type BeneficiaireFormValue } from './BeneficiaireForm';
import type { Beneficiary } from '@/lib/api';

export function BeneficiaireRowActions({ b }: { b: Beneficiary }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [form, setForm] = useState<BeneficiaireFormValue>({ name: b.name, phone: b.phone ?? '', notes: b.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onOk(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="outline" size="sm">Modifier</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le bénéficiaire</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <BeneficiaireFields value={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateBeneficiary(b.id, beneficiaireToPayload(form)), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer «&nbsp;{b.name}&nbsp;» ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deleteBeneficiary(b.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Page liste + création (gating écriture)** — `beneficiaires/page.tsx` :
```tsx
import { listBeneficiaries } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { BeneficiaireCreate } from './BeneficiaireForm.client';
import { BeneficiaireRowActions } from './BeneficiaireRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function BeneficiairesPage() {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const rows = await listBeneficiaries().catch(() => []);
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bénéficiaires</h1>
          <p className="text-sm text-muted-foreground">Les agriculteurs suivis par votre organisation.</p>
        </div>
        {canWrite && <BeneficiaireCreate />}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun bénéficiaire.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Téléphone</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.phone ?? '—'}</TableCell>
                {canWrite && <TableCell className="text-right"><BeneficiaireRowActions b={b} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Bouton de création (dialog)** — `beneficiaires/BeneficiaireForm.client.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createBeneficiary } from '@/lib/suivi-actions';
import { BeneficiaireFields, emptyBeneficiaire, beneficiaireToPayload, type BeneficiaireFormValue } from './BeneficiaireForm';

export function BeneficiaireCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BeneficiaireFormValue>(emptyBeneficiaire());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try { await createBeneficiary(beneficiaireToPayload(form)); setOpen(false); setForm(emptyBeneficiaire()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button>Nouveau bénéficiaire</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau bénéficiaire</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <BeneficiaireFields value={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/app/beneficiaires"
git commit -m "feat(admin): surface Bénéficiaires (liste + créer/éditer/supprimer, gating écriture)"
```

---

### Task 8: Admin — surface Parcelles

**Files:**
- Create: `apps/admin/src/app/parcelles/page.tsx`
- Create: `apps/admin/src/app/parcelles/ParcelleForm.tsx`
- Create: `apps/admin/src/app/parcelles/ParcelleForm.client.tsx`
- Create: `apps/admin/src/app/parcelles/ParcelleRowActions.tsx`

**Interfaces:**
- Consumes: `listParcels`/`listBeneficiaries`/`listZones` (Task 6/existant), `create/update/deleteParcel`, `getSession`.
- Le formulaire reçoit `beneficiaries` et `zones` (listes) en props pour les sélecteurs.

- [ ] **Step 1: Formulaire partagé** — `parcelles/ParcelleForm.tsx` :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Beneficiary, Zone } from '@/lib/api';

export interface ParcelleFormValue { name: string; beneficiaryId: string; zoneId: string; gpsLat: string; gpsLng: string; locality: string; areaHectares: string; notes: string; }
export const emptyParcelle = (): ParcelleFormValue => ({ name: '', beneficiaryId: '', zoneId: '', gpsLat: '', gpsLng: '', locality: '', areaHectares: '', notes: '' });
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
export const parcelleToPayload = (v: ParcelleFormValue) => ({
  name: v.name,
  beneficiaryId: v.beneficiaryId || undefined,
  zoneId: v.zoneId || undefined,
  gpsLat: num(v.gpsLat), gpsLng: num(v.gpsLng),
  locality: v.locality || undefined,
  areaHectares: num(v.areaHectares),
  notes: v.notes || undefined,
});

export function ParcelleFields({ value, onChange, beneficiaries, zones }: {
  value: ParcelleFormValue; onChange: (v: ParcelleFormValue) => void;
  beneficiaries: Beneficiary[]; zones: Zone[];
}) {
  const set = <K extends keyof ParcelleFormValue>(k: K, val: ParcelleFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Nom de la parcelle *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
      <div className="space-y-1">
        <Label>Bénéficiaire</Label>
        <Select value={value.beneficiaryId} onValueChange={(v) => set('beneficiaryId', v)}>
          <SelectTrigger><SelectValue placeholder="— aucun —" /></SelectTrigger>
          <SelectContent>{beneficiaries.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Zone</Label>
        <Select value={value.zoneId} onValueChange={(v) => set('zoneId', v)}>
          <SelectTrigger><SelectValue placeholder="— aucune —" /></SelectTrigger>
          <SelectContent>{zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Surface (ha)</Label><Input type="number" className="w-40" value={value.areaHectares} onChange={(e) => set('areaHectares', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>GPS latitude</Label><Input type="number" value={value.gpsLat} onChange={(e) => set('gpsLat', e.target.value)} /></div>
        <div className="space-y-1"><Label>GPS longitude</Label><Input type="number" value={value.gpsLng} onChange={(e) => set('gpsLng', e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label>Localité</Label><Input value={value.locality} onChange={(e) => set('locality', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 2: Création (dialog client)** — `parcelles/ParcelleForm.client.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createParcel } from '@/lib/suivi-actions';
import { ParcelleFields, emptyParcelle, parcelleToPayload, type ParcelleFormValue } from './ParcelleForm';
import type { Beneficiary, Zone } from '@/lib/api';

export function ParcelleCreate({ beneficiaries, zones }: { beneficiaries: Beneficiary[]; zones: Zone[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ParcelleFormValue>(emptyParcelle());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try { await createParcel(parcelleToPayload(form)); setOpen(false); setForm(emptyParcelle()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button>Nouvelle parcelle</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle parcelle</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ParcelleFields value={form} onChange={setForm} beneficiaries={beneficiaries} zones={zones} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Row actions (édition + suppression)** — `parcelles/ParcelleRowActions.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateParcel, deleteParcel } from '@/lib/suivi-actions';
import { ParcelleFields, parcelleToPayload, type ParcelleFormValue } from './ParcelleForm';
import type { Parcel, Beneficiary, Zone } from '@/lib/api';

export function ParcelleRowActions({ p, beneficiaries, zones }: { p: Parcel; beneficiaries: Beneficiary[]; zones: Zone[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [form, setForm] = useState<ParcelleFormValue>({
    name: p.name, beneficiaryId: p.beneficiaryId ?? '', zoneId: p.zoneId ?? '',
    gpsLat: p.gpsLat != null ? String(p.gpsLat) : '', gpsLng: p.gpsLng != null ? String(p.gpsLng) : '',
    locality: p.locality ?? '', areaHectares: p.areaHectares != null ? String(p.areaHectares) : '', notes: p.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onOk(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="outline" size="sm">Modifier</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la parcelle</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ParcelleFields value={form} onChange={setForm} beneficiaries={beneficiaries} zones={zones} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateParcel(p.id, parcelleToPayload(form)), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer «&nbsp;{p.name}&nbsp;» ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deleteParcel(p.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Page liste** — `parcelles/page.tsx` :
```tsx
import { listParcels, listBeneficiaries, listZones } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ParcelleCreate } from './ParcelleForm.client';
import { ParcelleRowActions } from './ParcelleRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function ParcellesPage() {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [parcels, beneficiaries, zones] = await Promise.all([
    listParcels().catch(() => []), listBeneficiaries().catch(() => []), listZones().catch(() => []),
  ]);
  const beneName = Object.fromEntries(beneficiaries.map((b) => [b.id, b.name]));
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parcelles</h1>
          <p className="text-sm text-muted-foreground">Les parcelles suivies par votre organisation.</p>
        </div>
        {canWrite && <ParcelleCreate beneficiaries={beneficiaries} zones={zones} />}
      </div>
      {parcels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune parcelle.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Bénéficiaire</TableHead><TableHead>Zone</TableHead><TableHead>Surface (ha)</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {parcels.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.beneficiaryId ? (beneName[p.beneficiaryId] ?? '—') : '—'}</TableCell>
                <TableCell>{p.zoneId ? (zoneName[p.zoneId] ?? '—') : '—'}</TableCell>
                <TableCell>{p.areaHectares ?? '—'}</TableCell>
                {canWrite && <TableCell className="text-right"><ParcelleRowActions p={p} beneficiaries={beneficiaries} zones={zones} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/app/parcelles"
git commit -m "feat(admin): surface Parcelles (liste + formulaire avec sélecteurs bénéficiaire/zone, gating écriture)"
```

---

### Task 9: Admin — navigation & middleware

**Files:**
- Modify: `apps/admin/src/components/sidebar.tsx`
- Modify: `apps/admin/src/middleware.ts`

**Interfaces:**
- Consumes: `TENANT_ROLES` (déjà exporté de `jwt.ts`).

- [ ] **Step 1: Sidebar — groupe Suivi** — dans `apps/admin/src/components/sidebar.tsx`, importer une icône (`Users` est déjà importé ; ajouter `Sprout` s'il ne l'est pas, et `MapPin`). Remplacer le groupe tenant « Suivi » (celui pointant vers `/bientot`) par :
```ts
  { title: 'Suivi', roles: TENANT_ROLES, items: [
    { href: '/beneficiaires', label: 'Bénéficiaires', icon: Users },
    { href: '/parcelles', label: 'Parcelles', icon: MapPin },
  ] },
```
(Ajouter `MapPin` à l'import `lucide-react`. Conserver le groupe « Fiches » tel quel.)

- [ ] **Step 2: Middleware — zones tenant** — dans `apps/admin/src/middleware.ts`, dans la table `ZONES`, remplacer l'entrée `{ prefixes: ['/fiches'], allow: TENANT_ROLES }` par :
```ts
  { prefixes: ['/fiches', '/beneficiaires', '/parcelles'], allow: TENANT_ROLES },
```

- [ ] **Step 3: Type-check** — Run: `cd apps/admin && npx tsc --noEmit` → OK.

- [ ] **Step 4: Commit**
```bash
git add "apps/admin/src/components/sidebar.tsx" "apps/admin/src/middleware.ts"
git commit -m "feat(admin): navigation Suivi (Bénéficiaires/Parcelles) + middleware"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/api && npx tsc --noEmit` → OK
- [ ] `cd apps/api && npx jest beneficiary parcel zone-tenant-read` → tout vert
- [ ] `cd apps/admin && npx tsc --noEmit` → OK
- [ ] **Migrations** : `cd apps/api && npx prisma migrate deploy` (DB up) → tables `Beneficiary` + `Parcel`.
- [ ] Manuel (DB + API :3001 + admin, compte tenant) : créer un bénéficiaire, créer une parcelle (sélecteurs bénéficiaire + zone), éditer/supprimer ; un `VIEWER` ne voit pas les boutons ; une autre org ne voit pas ces données.

## Notes hors périmètre (rappel)

- Campagne (culture/variété/saison), Journal, Recommandations → briques C, D.
- Pas d'audit sur ces entités (YAGNI ; ajout possible plus tard).
- Value objects allégés (snapshots) — divergence assumée du pattern value-object de zone/pest, justifiée par l'absence d'invariant.
