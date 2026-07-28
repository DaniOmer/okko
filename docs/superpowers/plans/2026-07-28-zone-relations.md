# Zone agro-écologique — relations (Brique 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la zone agro-écologique une fiche `/zones/[id]` affichant ses champs descriptifs et deux relations : « cultures adaptées » (lecture seule) et « bioagresseurs fréquents » (relation directe éditable avec niveau de fréquence).

**Architecture:** Nouvelle table de liaison autonome `ZonePestPresence` (zone↔bioagresseur + fréquence), mirroir de `CropZoneSuitability` — repo + use-cases set/remove/list + endpoints. « Cultures adaptées » = vue inverse read-only de `CropZoneSuitability`. Une fiche zone admin (`/zones/[id]`) sert de surface (lecture descriptive + les 2 relations + éditeur bioagresseurs).

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Migration additive** : une **nouvelle table** `ZonePestPresence` (`CREATE TABLE`), aucune colonne ajoutée aux tables existantes. Inspecter le SQL ; si Prisma propose reset/drop → STOP + BLOCKED. Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- Fréquence : `OCCASIONAL` / `FREQUENT` / `ENDEMIC` (Occasionnel / Fréquent / Endémique). Le domaine ne valide pas l'énum (contrainte portée par le Select admin).
- « Cultures adaptées » = **lecture seule** (édition sur la fiche culture). `ZonePestPresence` n'est PAS sur l'agrégat `AgroEcologicalZone` (table de liaison autonome).
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine `ZonePestPresence` + repo interface + in-memory

**Files:**
- Create: `apps/api/src/domain/zone/zone-pest-presence.ts`
- Create: `apps/api/src/application/zone/zone-pest-presence.repository.ts`
- Create: `apps/api/src/application/zone/in-memory-zone-pest-presence.repository.ts`
- Test: `apps/api/src/domain/zone/zone-pest-presence.spec.ts` (create)

**Interfaces:**
- Produces: `ZonePestPresence` (`create`/`toSnapshot`/`fromSnapshot`), `ZonePestPresenceSnapshot { zoneId; pestId; frequency }`, `ZONE_PEST_PRESENCE_REPOSITORY` token + `ZonePestPresenceRepository` (`save`/`listByZone`/`listByPest`/`delete`/`deleteByZone`), `InMemoryZonePestPresenceRepository`.

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/zone/zone-pest-presence.spec.ts`:
```ts
import { ZonePestPresence } from './zone-pest-presence';

describe('ZonePestPresence', () => {
  it('create expose zoneId/pestId/frequency dans le snapshot', () => {
    const s = ZonePestPresence.create({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT' }).toSnapshot();
    expect(s).toEqual({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT' });
  });
  it('fromSnapshot round-trip', () => {
    const s = { zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC' };
    expect(ZonePestPresence.fromSnapshot(s).toSnapshot()).toEqual(s);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/zone/zone-pest-presence.spec.ts` → FAIL.

- [ ] **Step 3: Domain entity**

Create `apps/api/src/domain/zone/zone-pest-presence.ts`:
```ts
export interface ZonePestPresenceSnapshot {
  zoneId: string;
  pestId: string;
  frequency: string;
}

interface CreateProps {
  zoneId: string;
  pestId: string;
  frequency: string;
}

export class ZonePestPresence {
  private constructor(
    private readonly _zoneId: string,
    private readonly _pestId: string,
    private readonly _frequency: string,
  ) {}

  static create(props: CreateProps): ZonePestPresence {
    return new ZonePestPresence(props.zoneId, props.pestId, props.frequency);
  }

  get zoneId(): string { return this._zoneId; }
  get pestId(): string { return this._pestId; }
  get frequency(): string { return this._frequency; }

  toSnapshot(): ZonePestPresenceSnapshot {
    return { zoneId: this._zoneId, pestId: this._pestId, frequency: this._frequency };
  }

  static fromSnapshot(s: ZonePestPresenceSnapshot): ZonePestPresence {
    return new ZonePestPresence(s.zoneId, s.pestId, s.frequency);
  }
}
```

- [ ] **Step 4: Repository interface**

Create `apps/api/src/application/zone/zone-pest-presence.repository.ts`:
```ts
import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

export const ZONE_PEST_PRESENCE_REPOSITORY = Symbol('ZONE_PEST_PRESENCE_REPOSITORY');

export interface ZonePestPresenceRepository {
  save(s: ZonePestPresenceSnapshot): Promise<void>;
  listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]>;
  listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]>;
  delete(zoneId: string, pestId: string): Promise<void>;
  deleteByZone(zoneId: string): Promise<void>;
}
```

- [ ] **Step 5: In-memory repository**

Create `apps/api/src/application/zone/in-memory-zone-pest-presence.repository.ts`:
```ts
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

export class InMemoryZonePestPresenceRepository implements ZonePestPresenceRepository {
  private store: ZonePestPresenceSnapshot[] = [];
  async save(s: ZonePestPresenceSnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.zoneId === s.zoneId && x.pestId === s.pestId)).concat(s);
  }
  async listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]> {
    return this.store.filter((s) => s.zoneId === zoneId);
  }
  async listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]> {
    return this.store.filter((s) => s.pestId === pestId);
  }
  async delete(zoneId: string, pestId: string): Promise<void> {
    this.store = this.store.filter((x) => !(x.zoneId === zoneId && x.pestId === pestId));
  }
  async deleteByZone(zoneId: string): Promise<void> {
    this.store = this.store.filter((x) => x.zoneId !== zoneId);
  }
}
```

- [ ] **Step 6: Run → pass + commit**
```bash
pnpm --filter @okko/api exec jest src/domain/zone/zone-pest-presence.spec.ts
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/zone/zone-pest-presence.ts apps/api/src/domain/zone/zone-pest-presence.spec.ts apps/api/src/application/zone/zone-pest-presence.repository.ts apps/api/src/application/zone/in-memory-zone-pest-presence.repository.ts
git commit -m "feat(zone): entité ZonePestPresence + repository (relation zone↔bioagresseur)"
```

---

### Task 2: Migration + repo Prisma `ZonePestPresence`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration `<ts>_zone_pest_presence/migration.sql`
- Create: `apps/api/src/infrastructure/zone/prisma-zone-pest-presence.repository.ts`

**Interfaces:**
- Consumes: `ZonePestPresenceRepository`, `ZonePestPresenceSnapshot` (Task 1).
- Produces: `PrismaZonePestPresenceRepository`.

- [ ] **Step 1: Prisma model**

In `apps/api/prisma/schema.prisma`, add (près de `CropZoneSuitability`) :
```prisma
model ZonePestPresence {
  zoneId    String
  pestId    String
  frequency String
  createdAt DateTime @default(now())

  @@id([zoneId, pestId])
  @@index([pestId])
}
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name zone_pest_presence
```
Inspect the generated `migration.sql` — must be a single `CREATE TABLE "ZonePestPresence"` (+ its index/pk), NO drop/alter of existing tables. Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
If Prisma proposes reset/drop of any existing table → STOP + report BLOCKED.

- [ ] **Step 3: Prisma repository**

Create `apps/api/src/infrastructure/zone/prisma-zone-pest-presence.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { ZonePestPresence as PrismaZPP } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ZonePestPresenceRepository } from '../../application/zone/zone-pest-presence.repository';
import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

@Injectable()
export class PrismaZonePestPresenceRepository implements ZonePestPresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(s: ZonePestPresenceSnapshot): Promise<void> {
    await this.prisma.zonePestPresence.upsert({
      where: { zoneId_pestId: { zoneId: s.zoneId, pestId: s.pestId } },
      create: { zoneId: s.zoneId, pestId: s.pestId, frequency: s.frequency },
      update: { frequency: s.frequency },
    });
  }

  async listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]> {
    const rows = await this.prisma.zonePestPresence.findMany({ where: { zoneId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]> {
    const rows = await this.prisma.zonePestPresence.findMany({ where: { pestId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async delete(zoneId: string, pestId: string): Promise<void> {
    await this.prisma.zonePestPresence.delete({ where: { zoneId_pestId: { zoneId, pestId } } }).catch(() => undefined);
  }

  async deleteByZone(zoneId: string): Promise<void> {
    await this.prisma.zonePestPresence.deleteMany({ where: { zoneId } });
  }

  private toSnapshot(row: PrismaZPP): ZonePestPresenceSnapshot {
    return { zoneId: row.zoneId, pestId: row.pestId, frequency: row.frequency };
  }
}
```
(Note: `delete` swallows a not-found error so detaching an already-absent link is idempotent — mirrors 204 semantics.)

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/zone/prisma-zone-pest-presence.repository.ts
git commit -m "feat(zone): table + repo Prisma ZonePestPresence (migration additive)"
```

---

### Task 3: Use-cases (set/remove/list zone-pests + list zone-crops)

**Files:**
- Create: `apps/api/src/application/zone/set-zone-pest-presence.use-case.ts`
- Create: `apps/api/src/application/zone/remove-zone-pest-presence.use-case.ts`
- Create: `apps/api/src/application/zone/list-zone-pests.use-case.ts`
- Create: `apps/api/src/application/zone/list-zone-crops.use-case.ts`
- Test: `apps/api/src/application/zone/set-zone-pest-presence.use-case.spec.ts` (create)

**Interfaces:**
- Consumes: `ZonePestPresenceRepository` (Task 1), `ZoneRepository`, `PestRepository`, `CropRepository`, `CropZoneSuitabilityRepository` ; `ZoneNotFoundError` (`./update-zone.use-case`), `PestNotFoundError` (`../pest/update-pest.use-case`).
- Produces: `SetZonePestPresenceUseCase`, `RemoveZonePestPresenceUseCase`, `ListZonePestsUseCase` (+ `ZonePestView { pestId; pestName; kind; frequency }`), `ListZoneCropsUseCase` (+ `ZoneCropView { cropId; cropName; rating; justification? }`).
- Note: `delete-zone` cleanup is done in Task 4 (with the module), so this task's `tsc` stays green (the 4 new use-cases are standalone and unwired).

- [ ] **Step 1: Failing test (set — représentatif)**

Create `apps/api/src/application/zone/set-zone-pest-presence.use-case.spec.ts`:
```ts
import { SetZonePestPresenceUseCase } from './set-zone-pest-presence.use-case';
import { InMemoryZonePestPresenceRepository } from './in-memory-zone-pest-presence.repository';
import { ZoneNotFoundError } from './update-zone.use-case';
import { PestNotFoundError } from '../pest/update-pest.use-case';

const zoneRepo = (has: boolean) => ({ findById: async () => (has ? ({ id: 'z1' } as never) : null) } as never);
const pestRepo = (has: boolean) => ({ findById: async () => (has ? ({ id: 'p1' } as never) : null) } as never);
const audit = () => { const records: unknown[] = []; return { record: async (r: unknown) => { records.push(r); }, records } as never; };
const clock = { nowIso: () => '2026-07-28T00:00:00.000Z' } as never;

describe('SetZonePestPresenceUseCase', () => {
  it('zone inconnue → ZoneNotFoundError', async () => {
    const uc = new SetZonePestPresenceUseCase(zoneRepo(false), pestRepo(true), new InMemoryZonePestPresenceRepository(), audit(), clock);
    await expect(uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT', actor: 'a' })).rejects.toThrow(ZoneNotFoundError);
  });
  it('bioagresseur inconnu → PestNotFoundError', async () => {
    const uc = new SetZonePestPresenceUseCase(zoneRepo(true), pestRepo(false), new InMemoryZonePestPresenceRepository(), audit(), clock);
    await expect(uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
  it('set puis relecture + upsert de la fréquence', async () => {
    const presences = new InMemoryZonePestPresenceRepository();
    const uc = new SetZonePestPresenceUseCase(zoneRepo(true), pestRepo(true), presences, audit(), clock);
    await uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'OCCASIONAL', actor: 'a' });
    await uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC', actor: 'a' });
    expect(await presences.listByZone('z1')).toEqual([{ zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC' }]);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/zone/set-zone-pest-presence.use-case.spec.ts` → FAIL.

- [ ] **Step 3: `set-zone-pest-presence.use-case.ts`**
```ts
import { ZonePestPresence, ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';
import { ZoneRepository } from './zone.repository';
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { PestRepository } from '../pest/pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { ZoneNotFoundError } from './update-zone.use-case';
import { PestNotFoundError } from '../pest/update-pest.use-case';

export interface SetZonePestPresenceInput { zoneId: string; pestId: string; frequency: string; actor: string; }

export class SetZonePestPresenceUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly pests: PestRepository,
    private readonly presences: ZonePestPresenceRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetZonePestPresenceInput): Promise<ZonePestPresenceSnapshot> {
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    if (!(await this.pests.findById(input.pestId))) throw new PestNotFoundError(input.pestId);
    const snap = ZonePestPresence.create({ zoneId: input.zoneId, pestId: input.pestId, frequency: input.frequency }).toSnapshot();
    await this.presences.save(snap);
    await this.audit.record({
      entityType: 'ZonePestPresence', entityId: `${input.zoneId}:${input.pestId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { set: snap },
    });
    return snap;
  }
}
```

- [ ] **Step 4: `remove-zone-pest-presence.use-case.ts`**
```ts
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface RemoveZonePestPresenceInput { zoneId: string; pestId: string; actor: string; }

export class RemoveZonePestPresenceUseCase {
  constructor(
    private readonly presences: ZonePestPresenceRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveZonePestPresenceInput): Promise<void> {
    await this.presences.delete(input.zoneId, input.pestId);
    await this.audit.record({
      entityType: 'ZonePestPresence', entityId: `${input.zoneId}:${input.pestId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { removed: { zoneId: input.zoneId, pestId: input.pestId } },
    });
  }
}
```

- [ ] **Step 5: `list-zone-pests.use-case.ts`**
```ts
import { PestRepository } from '../pest/pest.repository';
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';

export interface ZonePestView {
  pestId: string;
  pestName: Record<string, string>;
  kind: string;
  frequency: string;
}

export class ListZonePestsUseCase {
  constructor(
    private readonly presences: ZonePestPresenceRepository,
    private readonly pests: PestRepository,
  ) {}

  async execute(input: { zoneId: string }): Promise<ZonePestView[]> {
    const links = await this.presences.listByZone(input.zoneId);
    const views: ZonePestView[] = [];
    for (const l of links) {
      const pest = await this.pests.findById(l.pestId);
      views.push({
        pestId: l.pestId,
        pestName: pest ? pest.name : { fr: l.pestId },
        kind: pest ? pest.kind : 'ANIMAL',
        frequency: l.frequency,
      });
    }
    return views;
  }
}
```

- [ ] **Step 6: `list-zone-crops.use-case.ts`**
```ts
import { CropRepository } from '../crop/crop.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';

export interface ZoneCropView {
  cropId: string;
  cropName: Record<string, string>;
  rating: string;
  justification?: string;
}

export class ListZoneCropsUseCase {
  constructor(
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly crops: CropRepository,
  ) {}

  async execute(input: { zoneId: string }): Promise<ZoneCropView[]> {
    const suits = await this.suitabilities.listByZone(input.zoneId);
    const views: ZoneCropView[] = [];
    for (const s of suits) {
      const crop = await this.crops.findById(s.cropId);
      views.push({
        cropId: s.cropId,
        cropName: crop ? crop.commonNames : { fr: s.cropId },
        rating: s.rating,
        justification: s.justification,
      });
    }
    return views;
  }
}
```

- [ ] **Step 7: Run → pass + commit**
```bash
pnpm --filter @okko/api exec jest src/application/zone src/domain/zone
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/zone/set-zone-pest-presence.use-case.ts apps/api/src/application/zone/remove-zone-pest-presence.use-case.ts apps/api/src/application/zone/list-zone-pests.use-case.ts apps/api/src/application/zone/list-zone-crops.use-case.ts apps/api/src/application/zone/set-zone-pest-presence.use-case.spec.ts
git commit -m "feat(zone): use-cases set/remove/list bioagresseurs + list cultures"
```

---

### Task 4: `delete-zone` cleanup + API endpoints + câblage module

**Files:**
- Modify: `apps/api/src/application/zone/delete-zone.use-case.ts`
- Modify: `apps/api/src/presentation/zone/zone.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: the 4 use-cases (Task 3), `ZONE_PEST_PRESENCE_REPOSITORY` + `PrismaZonePestPresenceRepository` (Tasks 1-2), `PestNotFoundError`.
- Produces: `PUT/DELETE/GET /zones/:id/pests[/...]`, `GET /zones/:id/crops` ; `DeleteZoneUseCase` gains a `presences` dependency (cleaned here together with its module factory so `tsc` stays green).

- [ ] **Step 0: `delete-zone.use-case` — nettoyage des liens**

In `apps/api/src/application/zone/delete-zone.use-case.ts`:
- Import: `import { ZonePestPresenceRepository } from './zone-pest-presence.repository';`
- Add a constructor param `private readonly presences: ZonePestPresenceRepository,` (after `links`).
- In `execute`, after `await this.zones.delete(input.id);`, add:
```ts
    await this.presences.deleteByZone(input.id);
```
(The module factory for `DeleteZoneUseCase` is updated in Step 1 below, so the whole compiles together.)

- [ ] **Step 1: Module — repo provider + 4 use-case providers + delete-zone inject**

In `apps/api/src/crop.module.ts`:
- Imports:
```ts
import { ZONE_PEST_PRESENCE_REPOSITORY } from './application/zone/zone-pest-presence.repository';
import { PrismaZonePestPresenceRepository } from './infrastructure/zone/prisma-zone-pest-presence.repository';
import { SetZonePestPresenceUseCase } from './application/zone/set-zone-pest-presence.use-case';
import { RemoveZonePestPresenceUseCase } from './application/zone/remove-zone-pest-presence.use-case';
import { ListZonePestsUseCase } from './application/zone/list-zone-pests.use-case';
import { ListZoneCropsUseCase } from './application/zone/list-zone-crops.use-case';
```
- Repo provider (near `CROP_ZONE_SUITABILITY_REPOSITORY`):
```ts
    { provide: ZONE_PEST_PRESENCE_REPOSITORY, useClass: PrismaZonePestPresenceRepository },
```
- Update the `DeleteZoneUseCase` provider to inject the presences repo:
```ts
    {
      provide: DeleteZoneUseCase,
      useFactory: (z, l, zpp, a, c) => new DeleteZoneUseCase(z, l, zpp, a, c),
      inject: [ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, ZONE_PEST_PRESENCE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```
- Add the 4 new providers:
```ts
    {
      provide: SetZonePestPresenceUseCase,
      useFactory: (z, p, zpp, a, c) => new SetZonePestPresenceUseCase(z, p, zpp, a, c),
      inject: [ZONE_REPOSITORY, PEST_REPOSITORY, ZONE_PEST_PRESENCE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: RemoveZonePestPresenceUseCase,
      useFactory: (zpp, a, c) => new RemoveZonePestPresenceUseCase(zpp, a, c),
      inject: [ZONE_PEST_PRESENCE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListZonePestsUseCase,
      useFactory: (zpp, p) => new ListZonePestsUseCase(zpp, p),
      inject: [ZONE_PEST_PRESENCE_REPOSITORY, PEST_REPOSITORY],
    },
    {
      provide: ListZoneCropsUseCase,
      useFactory: (s, cr) => new ListZoneCropsUseCase(s, cr),
      inject: [CROP_ZONE_SUITABILITY_REPOSITORY, CROP_REPOSITORY],
    },
```

- [ ] **Step 2: Controller — imports + injection + endpoints**

In `apps/api/src/presentation/zone/zone.controller.ts`:
- Add `Put` to the `@nestjs/common` import (currently `Body, Controller, Get, Param, Post, Patch, Delete, HttpCode, ...` — no `Put`).
- Imports:
```ts
import { SetZonePestPresenceUseCase } from '../../application/zone/set-zone-pest-presence.use-case';
import { RemoveZonePestPresenceUseCase } from '../../application/zone/remove-zone-pest-presence.use-case';
import { ListZonePestsUseCase } from '../../application/zone/list-zone-pests.use-case';
import { ListZoneCropsUseCase } from '../../application/zone/list-zone-crops.use-case';
import { PestNotFoundError } from '../../application/pest/update-pest.use-case';
```
- Constructor — inject (after `deleteZone`):
```ts
    private readonly setZonePest: SetZonePestPresenceUseCase,
    private readonly removeZonePest: RemoveZonePestPresenceUseCase,
    private readonly listZonePests: ListZonePestsUseCase,
    private readonly listZoneCrops: ListZoneCropsUseCase,
```
- Add handlers (before `private toResponse`):
```ts
  @Get(':id/crops')
  async crops(@Param('id') id: string) {
    return this.listZoneCrops.execute({ zoneId: id });
  }

  @Get(':id/pests')
  async pests(@Param('id') id: string) {
    return this.listZonePests.execute({ zoneId: id });
  }

  @Put(':id/pests/:pestId')
  async setPest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pestId') pestId: string, @Body() body: { frequency: string }) {
    try {
      return await this.setZonePest.execute({ zoneId: id, pestId, frequency: body.frequency, actor: user.email });
    } catch (e) {
      if (e instanceof ZoneNotFoundError || e instanceof PestNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Delete(':id/pests/:pestId')
  @HttpCode(204)
  async removePest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pestId') pestId: string) {
    await this.removeZonePest.execute({ zoneId: id, pestId, actor: user.email });
  }
```

- [ ] **Step 3: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/zone/delete-zone.use-case.ts apps/api/src/presentation/zone/zone.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(zone): nettoyage delete-zone + endpoints relations (PUT/DELETE/GET pests, GET crops) + câblage module"
```

---

### Task 5: Admin — plomberie (types, fetchers, actions, libellé)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/labels.ts`

**Interfaces:**
- Produces: `ZoneCropView`, `ZonePestView` types ; `getZone(id)`, `getZoneCrops(id)`, `getZonePests(id)` fetchers ; `setZonePest`/`removeZonePest` actions ; `FREQUENCY_LABELS`.

- [ ] **Step 1: `api.ts` — types + fetchers**

Add after the `Zone` interface / `listZones`:
```ts
export interface ZoneCropView { cropId: string; cropName: Record<string, string>; rating: string; justification?: string; }
export interface ZonePestView { pestId: string; pestName: Record<string, string>; kind: string; frequency: string; }

export async function getZone(id: string): Promise<Zone> {
  const res = await authFetch(`/zones/${id}`, { cache: 'no-store' });
  return res.json();
}
export async function getZoneCrops(id: string): Promise<ZoneCropView[]> {
  const res = await authFetch(`/zones/${id}/crops`, { cache: 'no-store' });
  return res.json();
}
export async function getZonePests(id: string): Promise<ZonePestView[]> {
  const res = await authFetch(`/zones/${id}/pests`, { cache: 'no-store' });
  return res.json();
}
```
(If `getZone` already exists, do not duplicate it.)

- [ ] **Step 2: `actions.ts` — mutations**

Add (near the zone actions):
```ts
export async function setZonePest(zoneId: string, pestId: string, frequency: string): Promise<void> {
  await authFetch(`/zones/${zoneId}/pests/${pestId}`, jsonInit('PUT', { frequency }));
}
export async function removeZonePest(zoneId: string, pestId: string): Promise<void> {
  await authFetch(`/zones/${zoneId}/pests/${pestId}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: `labels.ts`**
```ts
export const FREQUENCY_LABELS: Record<string, string> = { OCCASIONAL: 'Occasionnel', FREQUENT: 'Fréquent', ENDEMIC: 'Endémique' };
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib/api.ts apps/admin/src/lib/actions.ts apps/admin/src/lib/labels.ts
git commit -m "feat(admin): plomberie relations zone (types, fetchers, actions, libellé fréquence)"
```

---

### Task 6: Admin — fiche `/zones/[id]` + éditeur bioagresseurs + lien liste

**Files:**
- Create: `apps/admin/src/app/zones/[id]/page.tsx`
- Create: `apps/admin/src/app/zones/[id]/ZoneFicheView.tsx`
- Create: `apps/admin/src/app/zones/[id]/ZonePestPresenceEditor.tsx`
- Modify: `apps/admin/src/app/zones/page.tsx` (lien vers la fiche)

**Interfaces:**
- Consumes: `getZone`, `getZoneCrops`, `getZonePests`, `listPests` (existant), `setZonePest`, `removeZonePest` (Task 5) ; labels `CLIMATE_TYPE_LABELS`, `MONTH_LABELS`, `FERTILITY_LABELS`, `DRAINAGE_LABELS`, `SUITABILITY_RATING_LABELS`, `FREQUENCY_LABELS`, `PEST_KIND_LABELS`, `labelOf`.

- [ ] **Step 1: `ZoneFicheView.tsx` (lecture : descriptif + cultures adaptées)**

Create `apps/admin/src/app/zones/[id]/ZoneFicheView.tsx`:
```tsx
import type { Zone, ZoneCropView } from '@/lib/api';
import { labelOf, CLIMATE_TYPE_LABELS, MONTH_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SUITABILITY_RATING_LABELS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';

const rng = (r?: { min: number; max: number; unit?: string }) => (r ? `${r.min}–${r.max}${r.unit ? ' ' + r.unit : ''}` : null);
const month = (m?: string) => (m ? labelOf(MONTH_LABELS, m) : null);

export function ZoneFicheView({ zone, crops }: { zone: Zone; crops: ZoneCropView[] }) {
  const rows: [string, string | null][] = [
    ['Code', zone.code ?? null],
    ['Région administrative', zone.region ?? null],
    ['Type de climat', zone.climateType ? labelOf(CLIMATE_TYPE_LABELS, zone.climateType) : null],
    ['Classification de Köppen', zone.koppen ?? null],
    ['Altitude', rng(zone.altitude)],
    ['Pluviométrie annuelle', rng(zone.annualRainfall)],
    ['Température moyenne', zone.meanTemperature != null ? `${zone.meanTemperature} °C` : null],
    ['Humidité moyenne', zone.meanHumidity != null ? `${zone.meanHumidity} %` : null],
    ['Saison des pluies', month(zone.rainySeasonStart) && month(zone.rainySeasonEnd) ? `${month(zone.rainySeasonStart)} → ${month(zone.rainySeasonEnd)}` : null],
    ['Saison sèche', month(zone.drySeasonStart) && month(zone.drySeasonEnd) ? `${month(zone.drySeasonStart)} → ${month(zone.drySeasonEnd)}` : null],
    ['Fertilité', zone.fertility ? labelOf(FERTILITY_LABELS, zone.fertility) : null],
    ['Drainage', zone.drainage ? labelOf(DRAINAGE_LABELS, zone.drainage) : null],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{zone.name} <span className="text-base font-normal text-muted-foreground">{zone.country}</span></h1>
        {zone.climateType && <Badge variant="secondary" className="mt-1">{labelOf(CLIMATE_TYPE_LABELS, zone.climateType)}</Badge>}
        {zone.description?.fr && <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[#374151]">{zone.description.fr}</p>}
      </div>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-base font-semibold">Caractéristiques</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
        {(zone.soilTypes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1 text-sm">
            <span className="text-muted-foreground">Types de sols : </span>
            {zone.soilTypes!.map((t) => <span key={t} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{t}</span>)}
          </div>
        )}
      </section>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-base font-semibold">Cultures adaptées <span className="font-normal text-muted-foreground">({crops.length})</span></h2>
        {crops.length === 0
          ? <p className="text-sm text-muted-foreground">Aucune culture rattachée. La note d&apos;aptitude se définit depuis la fiche culture.</p>
          : (
            <ul className="space-y-1 text-sm">
              {crops.map((c) => (
                <li key={c.cropId} className="flex items-center gap-2">
                  <Badge variant="secondary">{labelOf(SUITABILITY_RATING_LABELS, c.rating)}</Badge>
                  <span>{c.cropName.fr ?? c.cropId}</span>
                  {c.justification && <span className="text-muted-foreground">— {c.justification}</span>}
                </li>
              ))}
            </ul>
          )}
        <p className="text-xs text-muted-foreground">Modifier l&apos;aptitude d&apos;une culture : depuis la fiche culture concernée.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: `ZonePestPresenceEditor.tsx` (client : bioagresseurs fréquents)**

Create `apps/admin/src/app/zones/[id]/ZonePestPresenceEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { labelOf, FREQUENCY_LABELS, PEST_KIND_LABELS } from '@/lib/labels';
import { setZonePest, removeZonePest } from '@/lib/actions';
import type { ZonePestView } from '@/lib/api';

const FREQ = ['OCCASIONAL', 'FREQUENT', 'ENDEMIC'];

export function ZonePestPresenceEditor({ zoneId, links, allPests }: {
  zoneId: string;
  links: ZonePestView[];
  allPests: { id: string; name: string; kind?: string }[];
}) {
  const router = useRouter();
  const [pestId, setPestId] = useState('');
  const [frequency, setFrequency] = useState('FREQUENT');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(links.map((l) => l.pestId));
  const options = allPests.filter((p) => !linkedIds.has(p.id));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  }

  const byKind = (kind: string) => links.filter((l) => (l.kind ?? 'ANIMAL') === kind);
  const groups: [string, string][] = [['ANIMAL', 'Ravageurs'], ['DISEASE', 'Maladies'], ['WEED', 'Adventices']];

  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-base font-semibold">Bioagresseurs fréquents <span className="font-normal text-muted-foreground">({links.length})</span></h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun bioagresseur rattaché.</p>}
      {groups.map(([kind, label]) => byKind(kind).length > 0 && (
        <div key={kind} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <ul className="space-y-1 text-sm">
            {byKind(kind).map((l) => (
              <li key={l.pestId} className="flex items-center gap-2">
                <span>{l.pestName.fr ?? l.pestId}</span>
                <Badge variant="secondary">{labelOf(FREQUENCY_LABELS, l.frequency)}</Badge>
                {confirmId === l.pestId ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Détacher ?</span>
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmId(null)}>Annuler</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => run(() => removeZonePest(zoneId, l.pestId)).then(() => setConfirmId(null))}>Détacher</Button>
                  </span>
                ) : (
                  <button type="button" className="text-xs text-destructive" onClick={() => setConfirmId(l.pestId)}>Détacher</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 pt-2">
        <div className="min-w-48 flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Ajouter un bioagresseur</label>
          <Select value={pestId} onValueChange={setPestId}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {options.length === 0
                ? <div className="px-2 py-1.5 text-sm text-muted-foreground">Tous déjà rattachés</div>
                : options.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.kind ? ` (${labelOf(PEST_KIND_LABELS, p.kind)})` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs text-muted-foreground">Fréquence</label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQ.map((f) => <SelectItem key={f} value={f}>{labelOf(FREQUENCY_LABELS, f)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" disabled={busy || !pestId} onClick={() => run(() => setZonePest(zoneId, pestId, frequency)).then(() => setPestId(''))}>Rattacher</Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `page.tsx` (fiche serveur)**

Create `apps/admin/src/app/zones/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getZone, getZoneCrops, getZonePests, listPests } from '@/lib/api';
import { ZoneFicheView } from './ZoneFicheView';
import { ZonePestPresenceEditor } from './ZonePestPresenceEditor';

export default async function ZoneFichePage({ params }: { params: { id: string } }) {
  const zone = await getZone(params.id).catch(() => null);
  if (!zone) notFound();
  const [crops, pests, allPests] = await Promise.all([
    getZoneCrops(params.id).catch(() => []),
    getZonePests(params.id).catch(() => []),
    listPests().catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/zones" className="text-xs text-muted-foreground hover:underline">← Retour aux zones</Link>
      <div className="mt-4">
        <ZoneFicheView zone={zone} crops={crops} />
        <ZonePestPresenceEditor zoneId={params.id} links={pests} allPests={allPests.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))} />
      </div>
    </main>
  );
}
```
(`listPests()` returns `Pest[]` with `id`, `name`, `kind?` — confirm those fields exist on the admin `Pest` type; they do.)

- [ ] **Step 4: `zones/page.tsx` — nom cliquable vers la fiche**

In `apps/admin/src/app/zones/page.tsx`:
- Ensure `Link` from `next/link` is imported.
- Change the zone-name cell (the `<TableCell>` rendering `z.name`) to a link:
```tsx
                <TableCell><Link href={`/zones/${z.id}`} className="font-medium hover:underline">{z.name}</Link></TableCell>
```

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/zones/[id]/page.tsx" "apps/admin/src/app/zones/[id]/ZoneFicheView.tsx" "apps/admin/src/app/zones/[id]/ZonePestPresenceEditor.tsx" "apps/admin/src/app/zones/page.tsx"
git commit -m "feat(admin): fiche zone (/zones/[id]) — descriptif + cultures adaptées + bioagresseurs fréquents"
```

- [ ] **Step 6: Vérification manuelle**

Démarrer admin + API. `/zones` : cliquer un nom → fiche. La fiche montre les caractéristiques descriptives, « Cultures adaptées » (lecture, avec badge d'aptitude ; message si vide) et « Bioagresseurs fréquents » (vide au départ). Rattacher un bioagresseur + fréquence → apparaît groupé par kind avec le badge fréquence ; changer la fréquence en re-rattachant le même → mise à jour ; « Détacher » → confirmation → retiré. Rattacher une culture à la zone depuis une fiche culture → réapparaît dans « Cultures adaptées ». Supprimer une zone (avec des liens bioagresseurs mais sans culture) → OK, liens nettoyés.

---

## Notes de fin

- `ZonePestPresence` = table de liaison autonome (mirroir `CropZoneSuitability`), hors agrégat Zone.
- « Cultures adaptées » lecture seule ; édition sur la fiche culture (`PUT /crops/:id/zones/:zoneId`).
- La suppression de zone reste bloquée si des **cultures** la référencent (`ZoneInUseError`) ; les liens bioagresseurs, eux, sont nettoyés (`deleteByZone`).
