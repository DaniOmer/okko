# Module 2 / Brique C « Campagne & Journal » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur une parcelle, gérer des campagnes (culture × saison) et le journal d'opérations réelles datées (intrants structurés, coût, agent), scopés au tenant.

**Architecture:** Deux entités snapshot dans le bounded context `parcel`, sur le pattern EXACT de la brique B (Beneficiary/Parcel) : domaine → repo (+in-memory) → use-cases org-scopés → Prisma → contrôleur `@UseGuards(AuthGuard, RolesGuard)` → wiring dans `SuiviModule`. Validation croisée même-org : Campaign valide `parcelId` (via `PARCEL_REPOSITORY`), OperationLog valide `campaignId` (via `CAMPAIGN_REPOSITORY`). Le journal réutilise l'enum `OperationType`. Admin : détail parcelle (campagnes) + page journal (timeline d'opérations), calqués sur les surfaces B.

**Tech Stack:** NestJS + Prisma + Jest (API) ; Next.js App Router + shadcn (admin).

## Global Constraints

- **Isolation tenant** : `organizationId` vient TOUJOURS de `@CurrentUser().organizationId` (JWT), jamais du body ; 403 si absent. Listes filtrées par org + parent.
- **Rôles** — lecture : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')` ; écriture : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT')`.
- **Cross-org** : `create` avec `parcelId`/`campaignId` d'une autre org → `ParcelNotFoundError`/`CampaignNotFoundError` ; `update`/`delete` d'une entité d'une autre org → `CampaignNotFoundError`/`OperationLogNotFoundError` (mappés 404, sauf le parent invalide au create → 400).
- **`OperationType`** réutilisé depuis `apps/api/src/domain/window/operation-type.ts` (12 valeurs). Admin réutilise `OPERATION_TYPE_LABELS` (`apps/admin/src/lib/labels.ts`).
- `recordedByUserId` = `user.sub` (JWT), posé côté use-case via l'input, jamais du body.
- Value objects allégés (snapshots) ; gardes par contrôleur (`@UseGuards`), pas d'`APP_GUARD`.
- Pattern de référence à copier : la brique B, déjà dans `apps/api/src/{domain,application,infrastructure,presentation}/parcel/` et `apps/api/src/suivi.module.ts`.
- Gate de fin de tâche : `cd apps/api && npx tsc --noEmit` + jest concerné vert ; `cd apps/admin && npx tsc --noEmit` vert.

---

### Task 1: API — Campagne : domaine, repo, use-cases

**Files:**
- Create: `apps/api/src/domain/parcel/campaign.ts`
- Create: `apps/api/src/application/parcel/campaign.repository.ts`
- Create: `apps/api/src/application/parcel/in-memory-campaign.repository.ts`
- Create: `apps/api/src/application/parcel/campaign.use-cases.ts`
- Modify: `apps/api/src/application/parcel/errors.ts` (ajouter `CampaignNotFoundError`)
- Create test: `apps/api/src/application/parcel/campaign.use-cases.spec.ts`

**Interfaces:**
- Consumes: `ParcelRepository` + `InMemoryParcelRepository` (brique B) pour valider `parcelId`.
- Produces: `CampaignSnapshot` ; `CAMPAIGN_REPOSITORY` + `CampaignRepository` (avec `listByParcel(organizationId, parcelId)`) ; `Create/ListByParcel/Update/DeleteCampaignUseCase` ; `CampaignNotFoundError`.

- [ ] **Step 1: Écrire le test qui échoue** — `campaign.use-cases.spec.ts` :
```ts
import { CreateCampaignUseCase, ListCampaignsByParcelUseCase, UpdateCampaignUseCase, DeleteCampaignUseCase } from './campaign.use-cases';
import { CampaignNotFoundError, ParcelNotFoundError } from './errors';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { InMemoryParcelRepository } from './in-memory-parcel.repository';

const clock = { nowIso: () => '2026-08-11T00:00:00.000Z' };

function make() {
  let n = 0; const ids = { next: () => `id${++n}` };
  const repo = new InMemoryCampaignRepository();
  const parcels = new InMemoryParcelRepository();
  return {
    repo, parcels,
    create: new CreateCampaignUseCase(repo, parcels, clock, ids),
    list: new ListCampaignsByParcelUseCase(repo),
    update: new UpdateCampaignUseCase(repo),
    del: new DeleteCampaignUseCase(repo),
  };
}
async function seedParcel(parcels: InMemoryParcelRepository, organizationId: string, id = 'p1') {
  await parcels.save({ id, organizationId, name: 'Champ', createdAt: clock.nowIso() });
  return id;
}

describe('Campaign use-cases — isolation + validation parcelle', () => {
  it('create valide parcelId même-org, défaut status ACTIVE, se relit', async () => {
    const { create, list, parcels } = make();
    await seedParcel(parcels, 'o1');
    const c = await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'Pluies 2026' });
    expect(c.organizationId).toBe('o1');
    expect(c.status).toBe('ACTIVE');
    expect((await list.execute({ organizationId: 'o1', parcelId: 'p1' })).map((x) => x.id)).toEqual([c.id]);
  });

  it('create avec parcelId d’une autre org → ParcelNotFoundError', async () => {
    const { create, parcels } = make();
    await seedParcel(parcels, 'o2', 'p-other');
    await expect(create.execute({ organizationId: 'o1', parcelId: 'p-other', cropId: 'crop1', season: 'S' }))
      .rejects.toBeInstanceOf(ParcelNotFoundError);
  });

  it('listByParcel scope org+parcelle', async () => {
    const { create, list, parcels } = make();
    await seedParcel(parcels, 'o1', 'p1'); await seedParcel(parcels, 'o1', 'p2');
    await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'c', season: 'S' });
    await create.execute({ organizationId: 'o1', parcelId: 'p2', cropId: 'c', season: 'S' });
    expect(await list.execute({ organizationId: 'o1', parcelId: 'p1' })).toHaveLength(1);
  });

  it('update/delete d’une autre org → CampaignNotFoundError', async () => {
    const { create, update, del, parcels } = make();
    await seedParcel(parcels, 'o1');
    const c = await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'c', season: 'S' });
    await expect(update.execute({ id: c.id, organizationId: 'o2', season: 'X' })).rejects.toBeInstanceOf(CampaignNotFoundError);
    await expect(del.execute({ id: c.id, organizationId: 'o2' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest campaign.use-cases` → FAIL.

- [ ] **Step 3: Domaine** — `apps/api/src/domain/parcel/campaign.ts` :
```ts
export interface CampaignSnapshot {
  id: string;
  organizationId: string;
  parcelId: string;
  cropId: string;
  varietyId?: string;
  season: string;
  startDate?: string;
  status: 'ACTIVE' | 'CLOSED';
  notes?: string;
  createdAt: string;
}
```

- [ ] **Step 4: Repo interface + in-memory** —
`apps/api/src/application/parcel/campaign.repository.ts` :
```ts
import { CampaignSnapshot } from '../../domain/parcel/campaign';

export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');

export interface CampaignRepository {
  save(c: CampaignSnapshot): Promise<void>;
  findById(id: string): Promise<CampaignSnapshot | null>;
  listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]>;
  delete(id: string): Promise<void>;
}
```
`apps/api/src/application/parcel/in-memory-campaign.repository.ts` :
```ts
import { CampaignRepository } from './campaign.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';

export class InMemoryCampaignRepository implements CampaignRepository {
  private store = new Map<string, CampaignSnapshot>();
  async save(c: CampaignSnapshot): Promise<void> { this.store.set(c.id, c); }
  async findById(id: string): Promise<CampaignSnapshot | null> { return this.store.get(id) ?? null; }
  async listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]> {
    return [...this.store.values()].filter((c) => c.organizationId === organizationId && c.parcelId === parcelId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
```

- [ ] **Step 5: Erreur** — dans `apps/api/src/application/parcel/errors.ts`, ajouter (garder l'existant) :
```ts
export class CampaignNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Campaign ${id} not found`); this.name = 'CampaignNotFoundError'; }
}
```

- [ ] **Step 6: Use-cases** — `apps/api/src/application/parcel/campaign.use-cases.ts` :
```ts
import { CampaignRepository } from './campaign.repository';
import { ParcelRepository } from './parcel.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';
import { CampaignNotFoundError, ParcelNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateCampaignInput {
  organizationId: string; parcelId: string; cropId: string; varietyId?: string;
  season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}
export interface UpdateCampaignInput {
  id: string; organizationId: string; cropId?: string; varietyId?: string;
  season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class CreateCampaignUseCase {
  constructor(private readonly repo: CampaignRepository, private readonly parcels: ParcelRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateCampaignInput): Promise<CampaignSnapshot> {
    const parcel = await this.parcels.findById(input.parcelId);
    if (!parcel || parcel.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.parcelId);
    const snap: CampaignSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, parcelId: input.parcelId,
      cropId: input.cropId, varietyId: input.varietyId, season: input.season,
      startDate: input.startDate, status: input.status ?? 'ACTIVE', notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListCampaignsByParcelUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  execute(input: { organizationId: string; parcelId: string }): Promise<CampaignSnapshot[]> {
    return this.repo.listByParcel(input.organizationId, input.parcelId);
  }
}

export class UpdateCampaignUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  async execute(input: UpdateCampaignInput): Promise<CampaignSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.id);
    const snap: CampaignSnapshot = {
      ...existing,
      cropId: keep(input.cropId, existing.cropId), varietyId: keep(input.varietyId, existing.varietyId),
      season: keep(input.season, existing.season), startDate: keep(input.startDate, existing.startDate),
      status: keep(input.status, existing.status), notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteCampaignUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
```

- [ ] **Step 7: Vérifier le succès** — Run: `cd apps/api && npx jest campaign.use-cases` → PASS (4 tests).

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/domain/parcel/campaign.ts apps/api/src/application/parcel/campaign.repository.ts apps/api/src/application/parcel/in-memory-campaign.repository.ts apps/api/src/application/parcel/campaign.use-cases.ts apps/api/src/application/parcel/errors.ts apps/api/src/application/parcel/campaign.use-cases.spec.ts
git commit -m "feat(suivi): Campagne — domaine, repo, use-cases (scopés org + garde parcelle)"
```

---

### Task 2: API — Campagne : persistance, contrôleur, module

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Campaign`)
- Create: `apps/api/prisma/migrations/20260811100000_campaign/migration.sql`
- Create: `apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts`
- Create: `apps/api/src/presentation/parcel/campaign.controller.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Create test: `apps/api/src/presentation/parcel/campaign-roles.spec.ts`

**Interfaces:**
- Consumes: use-cases Campagne (Task 1), `PARCEL_REPOSITORY` (déjà dans le module).
- Produces: endpoints `GET /campaigns?parcelId=` , `POST/PATCH/DELETE /campaigns`.

- [ ] **Step 1: Écrire le test qui échoue** — `campaign-roles.spec.ts` :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CampaignController } from './campaign.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('CampaignController — rôles', () => {
  it('lecture = 4 rôles', () => { expect(reflector.get<string[]>(ROLES_KEY, CampaignController.prototype.list)).toEqual(READ); });
  it('écriture = 3 rôles', () => {
    for (const m of [CampaignController.prototype.create, CampaignController.prototype.update, CampaignController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest campaign-roles` → FAIL.

- [ ] **Step 3: Schéma + migration** — dans `schema.prisma`, ajouter :
```prisma
model Campaign {
  id             String   @id
  organizationId String
  parcelId       String
  cropId         String
  varietyId      String?
  season         String
  startDate      String?
  status         String   @default("ACTIVE")
  notes          String?
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([parcelId])
}
```
`apps/api/prisma/migrations/20260811100000_campaign/migration.sql` :
```sql
CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parcelId" TEXT NOT NULL,
  "cropId" TEXT NOT NULL,
  "varietyId" TEXT,
  "season" TEXT NOT NULL,
  "startDate" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");
CREATE INDEX "Campaign_parcelId_idx" ON "Campaign"("parcelId");
```
Puis Run: `cd apps/api && npx prisma generate`.

- [ ] **Step 4: Repo Prisma** — `apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignRepository } from '../../application/parcel/campaign.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';

type Row = { id: string; organizationId: string; parcelId: string; cropId: string; varietyId: string | null; season: string; startDate: string | null; status: string; notes: string | null; createdAt: Date };

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): CampaignSnapshot {
    return { id: r.id, organizationId: r.organizationId, parcelId: r.parcelId, cropId: r.cropId, varietyId: r.varietyId ?? undefined, season: r.season, startDate: r.startDate ?? undefined, status: r.status as CampaignSnapshot['status'], notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString() };
  }
  async save(c: CampaignSnapshot): Promise<void> {
    const data = { id: c.id, organizationId: c.organizationId, parcelId: c.parcelId, cropId: c.cropId, varietyId: c.varietyId ?? null, season: c.season, startDate: c.startDate ?? null, status: c.status, notes: c.notes ?? null };
    await this.prisma.campaign.upsert({ where: { id: c.id }, create: data, update: data });
  }
  async findById(id: string): Promise<CampaignSnapshot | null> {
    const r = await this.prisma.campaign.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]> {
    const rows = await this.prisma.campaign.findMany({ where: { organizationId, parcelId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.campaign.delete({ where: { id } }); }
}
```

- [ ] **Step 5: Contrôleur** — `apps/api/src/presentation/parcel/campaign.controller.ts` :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateCampaignUseCase, ListCampaignsByParcelUseCase, UpdateCampaignUseCase, DeleteCampaignUseCase } from '../../application/parcel/campaign.use-cases';
import { CampaignNotFoundError, ParcelNotFoundError } from '../../application/parcel/errors';

type CampaignBody = { parcelId: string; cropId: string; varietyId?: string; season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };

@Controller('campaigns')
@UseGuards(AuthGuard, RolesGuard)
export class CampaignController {
  constructor(
    private readonly listUC: ListCampaignsByParcelUseCase,
    private readonly createUC: CreateCampaignUseCase,
    private readonly updateUC: UpdateCampaignUseCase,
    private readonly deleteUC: DeleteCampaignUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('parcelId') parcelId: string) {
    if (!parcelId) throw new BadRequestException('parcelId requis');
    return this.listUC.execute({ organizationId: this.org(user), parcelId });
  }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: CampaignBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new BadRequestException('parcelle invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<Omit<CampaignBody, 'parcelId'>>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }
}
```

- [ ] **Step 6: Câbler dans SuiviModule** — dans `apps/api/src/suivi.module.ts` : importer les use-cases Campagne, `PrismaCampaignRepository`, `CAMPAIGN_REPOSITORY`, `CampaignController` ; ajouter `CampaignController` aux `controllers` et aux `providers` :
```ts
    { provide: CAMPAIGN_REPOSITORY, useClass: PrismaCampaignRepository },
    { provide: CreateCampaignUseCase, useFactory: (r, p, c, ids) => new CreateCampaignUseCase(r, p, c, ids), inject: [CAMPAIGN_REPOSITORY, PARCEL_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListCampaignsByParcelUseCase, useFactory: (r) => new ListCampaignsByParcelUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
    { provide: UpdateCampaignUseCase, useFactory: (r) => new UpdateCampaignUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
    { provide: DeleteCampaignUseCase, useFactory: (r) => new DeleteCampaignUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
```

- [ ] **Step 7: Vérifier** — Run: `cd apps/api && npx jest campaign-roles campaign.use-cases && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 8: Commit**
```bash
git add apps/api/prisma apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts apps/api/src/presentation/parcel/campaign.controller.ts apps/api/src/suivi.module.ts apps/api/src/presentation/parcel/campaign-roles.spec.ts
git commit -m "feat(suivi): Campagne — persistance, contrôleur (rôles), câblage module"
```

---

### Task 3: API — Journal (OperationLog) : domaine, repo, use-cases

**Files:**
- Create: `apps/api/src/domain/parcel/operation-log.ts`
- Create: `apps/api/src/application/parcel/operation-log.repository.ts`
- Create: `apps/api/src/application/parcel/in-memory-operation-log.repository.ts`
- Create: `apps/api/src/application/parcel/operation-log.use-cases.ts`
- Modify: `apps/api/src/application/parcel/errors.ts` (ajouter `OperationLogNotFoundError`)
- Create test: `apps/api/src/application/parcel/operation-log.use-cases.spec.ts`

**Interfaces:**
- Consumes: `CampaignRepository` + `InMemoryCampaignRepository` (Task 1) pour valider `campaignId` ; `OperationType` (`domain/window/operation-type`).
- Produces: `OperationLogSnapshot` + `OperationInput` ; `OPERATION_LOG_REPOSITORY` + `OperationLogRepository` (`listByCampaign(organizationId, campaignId)`) ; use-cases ; `OperationLogNotFoundError`.

- [ ] **Step 1: Écrire le test qui échoue** — `operation-log.use-cases.spec.ts` :
```ts
import { CreateOperationLogUseCase, ListOperationsByCampaignUseCase, UpdateOperationLogUseCase, DeleteOperationLogUseCase } from './operation-log.use-cases';
import { OperationLogNotFoundError, CampaignNotFoundError } from './errors';
import { InMemoryOperationLogRepository } from './in-memory-operation-log.repository';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-08-11T00:00:00.000Z' };

function make() {
  let n = 0; const ids = { next: () => `id${++n}` };
  const repo = new InMemoryOperationLogRepository();
  const campaigns = new InMemoryCampaignRepository();
  return {
    repo, campaigns,
    create: new CreateOperationLogUseCase(repo, campaigns, clock, ids),
    list: new ListOperationsByCampaignUseCase(repo),
    update: new UpdateOperationLogUseCase(repo),
    del: new DeleteOperationLogUseCase(repo),
  };
}
async function seedCampaign(campaigns: InMemoryCampaignRepository, organizationId: string, id = 'c1') {
  await campaigns.save({ id, organizationId, parcelId: 'p1', cropId: 'crop1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
  return id;
}

describe('OperationLog use-cases — isolation + validation campagne', () => {
  it('create valide campaignId même-org, pose recordedByUserId, inputs conservés', async () => {
    const { create, list, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.FERTILIZATION, date: '2026-05-12', recordedByUserId: 'u1', inputs: [{ product: 'Urée', quantity: 50, unit: 'kg' }], laborCost: 10 });
    expect(op.recordedByUserId).toBe('u1');
    expect(op.inputs).toEqual([{ product: 'Urée', quantity: 50, unit: 'kg' }]);
    expect((await list.execute({ organizationId: 'o1', campaignId: 'c1' })).map((x) => x.id)).toEqual([op.id]);
  });

  it('create avec campaignId d’une autre org → CampaignNotFoundError', async () => {
    const { create, campaigns } = make();
    await seedCampaign(campaigns, 'o2', 'c-other');
    await expect(create.execute({ organizationId: 'o1', campaignId: 'c-other', type: OperationType.WEEDING, date: '2026-05-01', recordedByUserId: 'u1' }))
      .rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it('update/delete d’une autre org → OperationLogNotFoundError', async () => {
    const { create, update, del, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.HARVEST, date: '2026-09-01', recordedByUserId: 'u1' });
    await expect(update.execute({ id: op.id, organizationId: 'o2', notes: 'x' })).rejects.toBeInstanceOf(OperationLogNotFoundError);
    await expect(del.execute({ id: op.id, organizationId: 'o2' })).rejects.toBeInstanceOf(OperationLogNotFoundError);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest operation-log.use-cases` → FAIL.

- [ ] **Step 3: Domaine** — `apps/api/src/domain/parcel/operation-log.ts` :
```ts
import { OperationType } from '../window/operation-type';

export interface OperationInput { product: string; quantity?: number; unit?: string; cost?: number; }

export interface OperationLogSnapshot {
  id: string;
  organizationId: string;
  campaignId: string;
  type: OperationType;
  date: string;
  inputs: OperationInput[];
  laborCost?: number;
  notes?: string;
  recordedByUserId: string;
  createdAt: string;
}
```

- [ ] **Step 4: Repo interface + in-memory** —
`apps/api/src/application/parcel/operation-log.repository.ts` :
```ts
import { OperationLogSnapshot } from '../../domain/parcel/operation-log';

export const OPERATION_LOG_REPOSITORY = Symbol('OPERATION_LOG_REPOSITORY');

export interface OperationLogRepository {
  save(o: OperationLogSnapshot): Promise<void>;
  findById(id: string): Promise<OperationLogSnapshot | null>;
  listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]>;
  delete(id: string): Promise<void>;
}
```
`apps/api/src/application/parcel/in-memory-operation-log.repository.ts` :
```ts
import { OperationLogRepository } from './operation-log.repository';
import { OperationLogSnapshot } from '../../domain/parcel/operation-log';

export class InMemoryOperationLogRepository implements OperationLogRepository {
  private store = new Map<string, OperationLogSnapshot>();
  async save(o: OperationLogSnapshot): Promise<void> { this.store.set(o.id, o); }
  async findById(id: string): Promise<OperationLogSnapshot | null> { return this.store.get(id) ?? null; }
  async listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]> {
    return [...this.store.values()].filter((o) => o.organizationId === organizationId && o.campaignId === campaignId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
```

- [ ] **Step 5: Erreur** — dans `errors.ts`, ajouter :
```ts
export class OperationLogNotFoundError extends Error {
  constructor(public readonly id: string) { super(`OperationLog ${id} not found`); this.name = 'OperationLogNotFoundError'; }
}
```

- [ ] **Step 6: Use-cases** — `apps/api/src/application/parcel/operation-log.use-cases.ts` :
```ts
import { OperationLogRepository } from './operation-log.repository';
import { CampaignRepository } from './campaign.repository';
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { OperationType } from '../../domain/window/operation-type';
import { OperationLogNotFoundError, CampaignNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateOperationLogInput {
  organizationId: string; campaignId: string; type: OperationType; date: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string; recordedByUserId: string;
}
export interface UpdateOperationLogInput {
  id: string; organizationId: string; type?: OperationType; date?: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string;
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class CreateOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository, private readonly campaigns: CampaignRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateOperationLogInput): Promise<OperationLogSnapshot> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    const snap: OperationLogSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, campaignId: input.campaignId,
      type: input.type, date: input.date, inputs: input.inputs ?? [], laborCost: input.laborCost,
      notes: input.notes, recordedByUserId: input.recordedByUserId, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListOperationsByCampaignUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  execute(input: { organizationId: string; campaignId: string }): Promise<OperationLogSnapshot[]> {
    return this.repo.listByCampaign(input.organizationId, input.campaignId);
  }
}

export class UpdateOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  async execute(input: UpdateOperationLogInput): Promise<OperationLogSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new OperationLogNotFoundError(input.id);
    const snap: OperationLogSnapshot = {
      ...existing,
      type: keep(input.type, existing.type), date: keep(input.date, existing.date),
      inputs: keep(input.inputs, existing.inputs), laborCost: keep(input.laborCost, existing.laborCost),
      notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new OperationLogNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
```

- [ ] **Step 7: Vérifier le succès** — Run: `cd apps/api && npx jest operation-log.use-cases` → PASS (3 tests).

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/domain/parcel/operation-log.ts apps/api/src/application/parcel/operation-log.repository.ts apps/api/src/application/parcel/in-memory-operation-log.repository.ts apps/api/src/application/parcel/operation-log.use-cases.ts apps/api/src/application/parcel/errors.ts apps/api/src/application/parcel/operation-log.use-cases.spec.ts
git commit -m "feat(suivi): Journal (OperationLog) — domaine, repo, use-cases (intrants, recordedBy, garde campagne)"
```

---

### Task 4: API — Journal : persistance, contrôleur, module

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `OperationLog`)
- Create: `apps/api/prisma/migrations/20260811110000_operation_log/migration.sql`
- Create: `apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts`
- Create: `apps/api/src/presentation/parcel/operation-log.controller.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Create test: `apps/api/src/presentation/parcel/operation-log-roles.spec.ts`

**Interfaces:**
- Consumes: use-cases Journal (Task 3), `CAMPAIGN_REPOSITORY` (déjà dans le module).
- Produces: endpoints `GET /operations?campaignId=` , `POST/PATCH/DELETE /operations`. `recordedByUserId` = `user.sub`.

- [ ] **Step 1: Écrire le test qui échoue** — `operation-log-roles.spec.ts` :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { OperationLogController } from './operation-log.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('OperationLogController — rôles', () => {
  it('lecture = 4 rôles', () => { expect(reflector.get<string[]>(ROLES_KEY, OperationLogController.prototype.list)).toEqual(READ); });
  it('écriture = 3 rôles', () => {
    for (const m of [OperationLogController.prototype.create, OperationLogController.prototype.update, OperationLogController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest operation-log-roles` → FAIL.

- [ ] **Step 3: Schéma + migration** — dans `schema.prisma`, ajouter :
```prisma
model OperationLog {
  id               String   @id
  organizationId   String
  campaignId       String
  type             String
  date             String
  inputs           Json
  laborCost        Float?
  notes            String?
  recordedByUserId String
  createdAt        DateTime @default(now())

  @@index([organizationId])
  @@index([campaignId])
}
```
`apps/api/prisma/migrations/20260811110000_operation_log/migration.sql` :
```sql
CREATE TABLE "OperationLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "inputs" JSONB NOT NULL,
  "laborCost" DOUBLE PRECISION,
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationLog_organizationId_idx" ON "OperationLog"("organizationId");
CREATE INDEX "OperationLog_campaignId_idx" ON "OperationLog"("campaignId");
```
Puis Run: `cd apps/api && npx prisma generate`.

- [ ] **Step 4: Repo Prisma** — `apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogRepository } from '../../application/parcel/operation-log.repository';
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { OperationType } from '../../domain/window/operation-type';

type Row = { id: string; organizationId: string; campaignId: string; type: string; date: string; inputs: Prisma.JsonValue; laborCost: number | null; notes: string | null; recordedByUserId: string; createdAt: Date };

@Injectable()
export class PrismaOperationLogRepository implements OperationLogRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): OperationLogSnapshot {
    return { id: r.id, organizationId: r.organizationId, campaignId: r.campaignId, type: r.type as OperationType, date: r.date, inputs: (r.inputs ?? []) as unknown as OperationInput[], laborCost: r.laborCost ?? undefined, notes: r.notes ?? undefined, recordedByUserId: r.recordedByUserId, createdAt: r.createdAt.toISOString() };
  }
  async save(o: OperationLogSnapshot): Promise<void> {
    const data = { id: o.id, organizationId: o.organizationId, campaignId: o.campaignId, type: o.type, date: o.date, inputs: (o.inputs ?? []) as unknown as Prisma.InputJsonValue, laborCost: o.laborCost ?? null, notes: o.notes ?? null, recordedByUserId: o.recordedByUserId };
    await this.prisma.operationLog.upsert({ where: { id: o.id }, create: data, update: data });
  }
  async findById(id: string): Promise<OperationLogSnapshot | null> {
    const r = await this.prisma.operationLog.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]> {
    const rows = await this.prisma.operationLog.findMany({ where: { organizationId, campaignId }, orderBy: { date: 'asc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.operationLog.delete({ where: { id } }); }
}
```

- [ ] **Step 5: Contrôleur** — `apps/api/src/presentation/parcel/operation-log.controller.ts` :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateOperationLogUseCase, ListOperationsByCampaignUseCase, UpdateOperationLogUseCase, DeleteOperationLogUseCase } from '../../application/parcel/operation-log.use-cases';
import { OperationLogNotFoundError, CampaignNotFoundError } from '../../application/parcel/errors';
import { OperationType } from '../../domain/window/operation-type';
import { OperationInput } from '../../domain/parcel/operation-log';

type OpBody = { campaignId: string; type: OperationType; date: string; inputs?: OperationInput[]; laborCost?: number; notes?: string };

@Controller('operations')
@UseGuards(AuthGuard, RolesGuard)
export class OperationLogController {
  constructor(
    private readonly listUC: ListOperationsByCampaignUseCase,
    private readonly createUC: CreateOperationLogUseCase,
    private readonly updateUC: UpdateOperationLogUseCase,
    private readonly deleteUC: DeleteOperationLogUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('campaignId') campaignId: string) {
    if (!campaignId) throw new BadRequestException('campaignId requis');
    return this.listUC.execute({ organizationId: this.org(user), campaignId });
  }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: OpBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), recordedByUserId: user.sub, ...body }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new BadRequestException('campagne invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<Omit<OpBody, 'campaignId'>>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof OperationLogNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof OperationLogNotFoundError) throw new NotFoundException(); throw e; }
  }
}
```

- [ ] **Step 6: Câbler dans SuiviModule** — importer les use-cases Journal, `PrismaOperationLogRepository`, `OPERATION_LOG_REPOSITORY`, `OperationLogController` ; ajouter `OperationLogController` aux `controllers` et aux `providers` :
```ts
    { provide: OPERATION_LOG_REPOSITORY, useClass: PrismaOperationLogRepository },
    { provide: CreateOperationLogUseCase, useFactory: (r, c, clk, ids) => new CreateOperationLogUseCase(r, c, clk, ids), inject: [OPERATION_LOG_REPOSITORY, CAMPAIGN_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListOperationsByCampaignUseCase, useFactory: (r) => new ListOperationsByCampaignUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: UpdateOperationLogUseCase, useFactory: (r) => new UpdateOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: DeleteOperationLogUseCase, useFactory: (r) => new DeleteOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
```

- [ ] **Step 7: Vérifier** — Run: `cd apps/api && npx jest operation-log campaign && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 8: Commit**
```bash
git add apps/api/prisma apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts apps/api/src/presentation/parcel/operation-log.controller.ts apps/api/src/suivi.module.ts apps/api/src/presentation/parcel/operation-log-roles.spec.ts
git commit -m "feat(suivi): Journal — persistance (inputs JSON), contrôleur (recordedBy JWT), câblage module"
```

---

### Task 5: Admin — clients API + server actions

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (types + listes)
- Modify: `apps/admin/src/lib/suivi-actions.ts` (create/update/delete campagne + opération)

**Interfaces:**
- Consumes: endpoints `/campaigns`, `/operations` (Tasks 2, 4).
- Produces: `Campaign`/`OperationLog`/`OperationInput` types ; `listCampaigns(parcelId)`/`listOperations(campaignId)` ; 6 actions.

- [ ] **Step 1: Types + listes (api.ts)** — ajouter dans `apps/admin/src/lib/api.ts` :
```ts
export interface OperationInput { product: string; quantity?: number; unit?: string; cost?: number; }
export interface Campaign { id: string; organizationId: string; parcelId: string; cropId: string; varietyId?: string; season: string; startDate?: string; status: 'ACTIVE' | 'CLOSED'; notes?: string; createdAt: string; }
export interface OperationLog { id: string; organizationId: string; campaignId: string; type: string; date: string; inputs: OperationInput[]; laborCost?: number; notes?: string; recordedByUserId: string; createdAt: string; }

export async function listCampaigns(parcelId: string): Promise<Campaign[]> {
  const res = await authFetch(`/campaigns?parcelId=${encodeURIComponent(parcelId)}`, { cache: 'no-store' });
  return res.json();
}
export async function listOperations(campaignId: string): Promise<OperationLog[]> {
  const res = await authFetch(`/operations?campaignId=${encodeURIComponent(campaignId)}`, { cache: 'no-store' });
  return res.json();
}
```

- [ ] **Step 2: Actions** — ajouter dans `apps/admin/src/lib/suivi-actions.ts` :
```ts
import type { Campaign, OperationLog, OperationInput } from './api';

export type CampaignPayload = { parcelId?: string; cropId?: string; varietyId?: string; season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };
export type OperationPayload = { campaignId?: string; type?: string; date?: string; inputs?: OperationInput[]; laborCost?: number; notes?: string };

export async function createCampaign(input: CampaignPayload): Promise<Campaign> {
  const res = await authFetch('/campaigns', jsonInit('POST', input));
  return res.json();
}
export async function updateCampaign(id: string, input: CampaignPayload): Promise<Campaign> {
  const res = await authFetch(`/campaigns/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteCampaign(id: string): Promise<void> {
  await authFetch(`/campaigns/${id}`, { method: 'DELETE' });
}
export async function createOperation(input: OperationPayload): Promise<OperationLog> {
  const res = await authFetch('/operations', jsonInit('POST', input));
  return res.json();
}
export async function updateOperation(id: string, input: OperationPayload): Promise<OperationLog> {
  const res = await authFetch(`/operations/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteOperation(id: string): Promise<void> {
  await authFetch(`/operations/${id}`, { method: 'DELETE' });
}
```
(La ligne `import { authFetch, jsonInit } from './http';` existe déjà en tête du fichier — ne pas la dupliquer ; ajouter seulement l'import de types si absent.)

- [ ] **Step 3: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/lib/api.ts" "apps/admin/src/lib/suivi-actions.ts"
git commit -m "feat(admin): clients API + actions campagnes & opérations"
```

---

### Task 6: Admin — détail parcelle & campagnes

**Files:**
- Create: `apps/admin/src/app/parcelles/[id]/page.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/CampaignForm.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/CampaignForm.client.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/CampaignRowActions.tsx`
- Modify: `apps/admin/src/app/parcelles/page.tsx` (lien « Voir » vers le détail)

**Interfaces:**
- Consumes: `listParcels`/`listCampaigns`/`listPublishedCrops`/`getCropPublished` ; `createCampaign`/`updateCampaign`/`deleteCampaign` ; `getSession` (gating écriture) ; `OPERATION`… (non — campagne only ici).

- [ ] **Step 1: Formulaire campagne** — `parcelles/[id]/CampaignForm.tsx` :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CropDocument, Variety } from '@/lib/api';

export interface CampaignFormValue { cropId: string; varietyId: string; season: string; startDate: string; status: 'ACTIVE' | 'CLOSED'; notes: string; }
export const emptyCampaign = (): CampaignFormValue => ({ cropId: '', varietyId: '', season: '', startDate: '', status: 'ACTIVE', notes: '' });
export const campaignToPayload = (v: CampaignFormValue) => ({
  cropId: v.cropId, varietyId: v.varietyId || undefined, season: v.season,
  startDate: v.startDate || undefined, status: v.status, notes: v.notes || undefined,
});

export function CampaignFields({ value, onChange, crops, varieties }: {
  value: CampaignFormValue; onChange: (v: CampaignFormValue) => void;
  crops: CropDocument[]; varieties: Variety[];
}) {
  const set = <K extends keyof CampaignFormValue>(k: K, val: CampaignFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Culture *</Label>
        <Select value={value.cropId} onValueChange={(v) => set('cropId', v)}>
          <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
          <SelectContent>{crops.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Variété</Label>
        <Select value={value.varietyId} onValueChange={(v) => set('varietyId', v)}>
          <SelectTrigger><SelectValue placeholder="— aucune —" /></SelectTrigger>
          <SelectContent>{varieties.map((vr) => <SelectItem key={vr.id} value={vr.id}>{vr.name.fr ?? vr.id}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Saison *</Label><Input value={value.season} onChange={(e) => set('season', e.target.value)} placeholder="ex. Saison des pluies 2026" required /></div>
      <div className="space-y-1"><Label>Date de début</Label><Input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
      <div className="space-y-1">
        <Label>Statut</Label>
        <Select value={value.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'CLOSED')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">En cours</SelectItem><SelectItem value="CLOSED">Terminée</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 2: Wrapper client (charge les variétés selon la culture)** — `parcelles/[id]/CampaignForm.client.tsx` :
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createCampaign, updateCampaign } from '@/lib/suivi-actions';
import { fetchCropVarieties } from './varieties-action';
import { CampaignFields, emptyCampaign, campaignToPayload, type CampaignFormValue } from './CampaignForm';
import type { CropDocument, Variety, Campaign } from '@/lib/api';

export function CampaignEditor({ parcelId, crops, initial, trigger }: {
  parcelId: string; crops: CropDocument[]; initial?: Campaign;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormValue>(initial
    ? { cropId: initial.cropId, varietyId: initial.varietyId ?? '', season: initial.season, startDate: initial.startDate ?? '', status: initial.status, notes: initial.notes ?? '' }
    : emptyCampaign());
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.cropId) { setVarieties([]); return; }
    fetchCropVarieties(form.cropId).then(setVarieties).catch(() => setVarieties([]));
  }, [form.cropId]);

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (initial) await updateCampaign(initial.id, campaignToPayload(form));
      else await createCampaign({ parcelId, ...campaignToPayload(form) });
      setOpen(false); if (!initial) setForm(emptyCampaign()); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <CampaignFields value={form} onChange={setForm} crops={crops} varieties={varieties} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Action de chargement des variétés** — `parcelles/[id]/varieties-action.ts` :
```ts
'use server';
import { getCropPublished } from '@/lib/api';
import type { Variety } from '@/lib/api';

export async function fetchCropVarieties(cropId: string): Promise<Variety[]> {
  const crop = await getCropPublished(cropId).catch(() => null);
  return crop?.varieties ?? [];
}
```

- [ ] **Step 4: Row actions (édition + suppression campagne)** — `parcelles/[id]/CampaignRowActions.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCampaign } from '@/lib/suivi-actions';
import { CampaignEditor } from './CampaignForm.client';
import type { Campaign, CropDocument } from '@/lib/api';

export function CampaignRowActions({ campaign, crops }: { campaign: Campaign; crops: CropDocument[] }) {
  const router = useRouter();
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function del() {
    setBusy(true); setError(null);
    try { await deleteCampaign(campaign.id); setDelOpen(false); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="flex justify-end gap-2">
      <CampaignEditor parcelId={campaign.parcelId} crops={crops} initial={campaign}
        trigger={<Button variant="outline" size="sm">Modifier</Button>} />
      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette campagne ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Supprime aussi son journal. Définitif.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={del}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Page détail parcelle** — `parcelles/[id]/page.tsx` :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listParcels, listCampaigns, listPublishedCrops } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CampaignEditor } from './CampaignForm.client';
import { CampaignRowActions } from './CampaignRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'En cours', CLOSED: 'Terminée' };

export default async function ParcelleDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [parcels, campaigns, crops] = await Promise.all([
    listParcels().catch(() => []), listCampaigns(params.id).catch(() => []), listPublishedCrops().catch(() => []),
  ]);
  const parcel = parcels.find((p) => p.id === params.id);
  if (!parcel) notFound();
  const cropName = Object.fromEntries(crops.map((c) => [c.id, c.name]));
  return (
    <main className="space-y-6">
      <div>
        <Link href="/parcelles" className="text-xs text-muted-foreground hover:underline">← Retour aux parcelles</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{parcel.name}</h1>
          {canWrite && <CampaignEditor parcelId={parcel.id} crops={crops} trigger={<Button>Nouvelle campagne</Button>} />}
        </div>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune campagne sur cette parcelle.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Culture</TableHead><TableHead>Saison</TableHead><TableHead>Statut</TableHead><TableHead>Journal</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{cropName[c.cropId] ?? c.cropId}</TableCell>
                <TableCell>{c.season}</TableCell>
                <TableCell>{STATUS_LABELS[c.status] ?? c.status}</TableCell>
                <TableCell><Link href={`/parcelles/${parcel.id}/campagnes/${c.id}`} className="text-primary hover:underline">Ouvrir</Link></TableCell>
                {canWrite && <TableCell className="text-right"><CampaignRowActions campaign={c} crops={crops} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Lien « Voir » sur la liste parcelles** — dans `apps/admin/src/app/parcelles/page.tsx`, dans la colonne Nom, remplacer la cellule `<TableCell className="font-medium">{p.name}</TableCell>` par :
```tsx
                <TableCell className="font-medium"><Link href={`/parcelles/${p.id}`} className="hover:underline">{p.name}</Link></TableCell>
```
et ajouter `import Link from 'next/link';` en tête si absent.

- [ ] **Step 7: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/app/parcelles"
git commit -m "feat(admin): détail parcelle + campagnes (culture/variété, gating écriture)"
```

---

### Task 7: Admin — journal de campagne (timeline d'opérations)

**Files:**
- Create: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationEditor.client.tsx`
- Create: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationRowActions.tsx`

**Interfaces:**
- Consumes: `listCampaigns`/`listOperations` ; `createOperation`/`updateOperation`/`deleteOperation` ; `OPERATION_TYPE_LABELS` ; `getSession`.

- [ ] **Step 1: Formulaire opération (avec intrants répétables)** — `.../OperationForm.tsx` :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { OPERATION_TYPE_LABELS } from '@/lib/labels';
import type { OperationInput } from '@/lib/api';

export interface OperationFormValue { type: string; date: string; inputs: OperationInput[]; laborCost: string; notes: string; }
export const emptyOperation = (): OperationFormValue => ({ type: 'PLANTING', date: '', inputs: [], laborCost: '', notes: '' });
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
export const operationToPayload = (v: OperationFormValue) => ({
  type: v.type, date: v.date,
  inputs: v.inputs.filter((i) => i.product.trim() !== ''),
  laborCost: num(v.laborCost),
  notes: v.notes || undefined,
});

export function OperationFields({ value, onChange }: { value: OperationFormValue; onChange: (v: OperationFormValue) => void }) {
  const set = <K extends keyof OperationFormValue>(k: K, val: OperationFormValue[K]) => onChange({ ...value, [k]: val });
  const setInput = (i: number, patch: Partial<OperationInput>) => set('inputs', value.inputs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Type d&apos;opération *</Label>
        <Select value={value.type} onValueChange={(v) => set('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Date *</Label><Input type="date" value={value.date} onChange={(e) => set('date', e.target.value)} required /></div>
      <div className="space-y-1">
        <Label>Intrants</Label>
        <div className="space-y-2">
          {value.inputs.map((inp, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input className="flex-1" placeholder="produit" value={inp.product} onChange={(e) => setInput(i, { product: e.target.value })} />
              <Input className="w-20" type="number" placeholder="qté" value={inp.quantity ?? ''} onChange={(e) => setInput(i, { quantity: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Input className="w-16" placeholder="unité" value={inp.unit ?? ''} onChange={(e) => setInput(i, { unit: e.target.value || undefined })} />
              <Input className="w-20" type="number" placeholder="coût" value={inp.cost ?? ''} onChange={(e) => setInput(i, { cost: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => set('inputs', value.inputs.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('inputs', [...value.inputs, { product: '' }])}>+ Ajouter un intrant</Button>
        </div>
      </div>
      <div className="space-y-1"><Label>Coût main d&apos;œuvre</Label><Input className="w-32" type="number" value={value.laborCost} onChange={(e) => set('laborCost', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 2: Éditeur (create/edit dialog)** — `.../OperationEditor.client.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createOperation, updateOperation } from '@/lib/suivi-actions';
import { OperationFields, emptyOperation, operationToPayload, type OperationFormValue } from './OperationForm';
import type { OperationLog } from '@/lib/api';

export function OperationEditor({ campaignId, initial, trigger }: { campaignId: string; initial?: OperationLog; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OperationFormValue>(initial
    ? { type: initial.type, date: initial.date, inputs: initial.inputs, laborCost: initial.laborCost != null ? String(initial.laborCost) : '', notes: initial.notes ?? '' }
    : emptyOperation());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      if (initial) await updateOperation(initial.id, operationToPayload(form));
      else await createOperation({ campaignId, ...operationToPayload(form) });
      setOpen(false); if (!initial) setForm(emptyOperation()); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? 'Modifier l’opération' : 'Nouvelle opération'}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <OperationFields value={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{initial ? 'Enregistrer' : 'Ajouter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Row actions opération** — `.../OperationRowActions.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteOperation } from '@/lib/suivi-actions';
import { OperationEditor } from './OperationEditor.client';
import type { OperationLog } from '@/lib/api';

export function OperationRowActions({ op }: { op: OperationLog }) {
  const router = useRouter();
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    try { await deleteOperation(op.id); setDelOpen(false); router.refresh(); } finally { setBusy(false); }
  }
  return (
    <div className="flex gap-2">
      <OperationEditor campaignId={op.campaignId} initial={op} trigger={<Button variant="outline" size="sm">Modifier</Button>} />
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette opération ?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={del}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Page journal** — `.../page.tsx` :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listCampaigns, listOperations } from '@/lib/api';
import { getSession } from '@/lib/session';
import { labelOf, OPERATION_TYPE_LABELS } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { OperationEditor } from './OperationEditor.client';
import { OperationRowActions } from './OperationRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function JournalPage({ params }: { params: { id: string; cid: string } }) {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [campaigns, operations] = await Promise.all([
    listCampaigns(params.id).catch(() => []), listOperations(params.cid).catch(() => []),
  ]);
  const campaign = campaigns.find((c) => c.id === params.cid);
  if (!campaign) notFound();
  return (
    <main className="space-y-6">
      <div>
        <Link href={`/parcelles/${params.id}`} className="text-xs text-muted-foreground hover:underline">← Retour à la parcelle</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Journal — {campaign.season}</h1>
          {canWrite && <OperationEditor campaignId={campaign.id} trigger={<Button>Nouvelle opération</Button>} />}
        </div>
      </div>
      {operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune opération journalisée.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-6">
          {operations.map((op) => (
            <li key={op.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{labelOf(OPERATION_TYPE_LABELS, op.type)} <span className="font-normal text-muted-foreground">· {new Date(op.date).toLocaleDateString('fr-FR')}</span></p>
                  {op.inputs.length > 0 && (
                    <p className="text-sm text-muted-foreground">{op.inputs.map((i) => `${i.product}${i.quantity != null ? ` ${i.quantity}${i.unit ?? ''}` : ''}`).join(' · ')}</p>
                  )}
                  {op.laborCost != null && <p className="text-xs text-muted-foreground">Main d&apos;œuvre : {op.laborCost}</p>}
                  {op.notes && <p className="text-sm">{op.notes}</p>}
                </div>
                {canWrite && <OperationRowActions op={op} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/app/parcelles/[id]/campagnes"
git commit -m "feat(admin): journal de campagne — timeline d'opérations + intrants répétables (gating écriture)"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/api && npx tsc --noEmit` → OK
- [ ] `cd apps/api && npx jest campaign operation-log` → tout vert
- [ ] `cd apps/admin && npx tsc --noEmit` → OK
- [ ] **Migrations** : `cd apps/api && npx prisma migrate deploy` (DB up) → tables `Campaign` + `OperationLog`.
- [ ] Manuel (compte tenant) : depuis une parcelle → « Voir » → créer une campagne (culture/variété/saison) → ouvrir le journal → ajouter une opération avec intrants → éditer/supprimer ; `VIEWER` ne voit pas les boutons ; une autre org ne voit rien.

## Notes hors périmètre (rappel)

- Recommandations datées (D), photos géolocalisées (E), exécutant distinct, catalogue intrants, mobile.
- `cropId`/`varietyId` non validés en profondeur côté API (données de référence).
- Value objects allégés (snapshots) — cohérent avec la brique B.
