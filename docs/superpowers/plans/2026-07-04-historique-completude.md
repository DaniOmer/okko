# Base de connaissances — Plan 7 : Historique d'audit + indicateur de complétude — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boucler la Phase 0 en rendant l'**historique d'audit** d'une fiche consultable (API + admin) et en calculant un **indicateur de complétude** par catégorie, exposé dans le read-model et l'admin.

**Architecture:** Poursuit la clean architecture des Plans 1-6. L'audit est déjà écrit sur chaque mutation (table `AuditLog`). On ajoute un **port de LECTURE séparé** `AuditLogReader` (ségrégation d'interface — le port d'écriture `AuditLogRepository` reste inchangé pour ne pas casser les ~13 mocks `{ record }` existants). La complétude est une **fonction pure** calculée dans le read-model à partir des collections déjà résolues.

**Tech Stack:** NestJS, TypeScript strict, Prisma, PostgreSQL, Jest, Next.js.

## Global Constraints

- Langage : **TypeScript strict** partout.
- Méthodologie : **TDD**.
- **Clean architecture** : domaine pur ; ports en application ; adaptateurs en infra.
- **NE PAS élargir le port d'écriture `AuditLogRepository`** (13 fichiers de test le mockent avec `{ record: jest.fn() }`). Ajouter un port de lecture distinct `AuditLogReader` + token `AUDIT_LOG_READER`. La classe Prisma `PrismaAuditLogRepository` implémente les DEUX interfaces.
- Complétude = **fonction pure** ; incluse dans `CropDocument.completeness` (calculée dans `toCropDocument`).
- Casts JSON via `Prisma.InputJsonValue` / `as unknown as` (jamais `as any`).
- Mutations (il n'y en a pas de nouvelles ici — lecture seule) ; horloge/id injectés si besoin.
- Suite en série (`maxWorkers:1`) ; nettoyer les tables touchées.
- Rétrocompat : `toCropDocument` gagne un champ calculé `completeness` (pas d'argument nouveau) ; les appels existants restent valides.

---

## File Structure

```
apps/api/src/
├── application/
│   ├── audit/
│   │   ├── audit-log.repository.ts      # MODIFY: add AuditLogReader port + AuditRecord type
│   │   └── in-memory-audit-log.reader.ts # NEW test util (reader)
│   ├── crop/
│   │   ├── get-crop-history.use-case.ts # NEW
│   │   ├── crop-completeness.ts         # NEW pure function
│   │   └── crop-read-model.ts           # MODIFY: add completeness to CropDocument
├── infrastructure/audit/prisma-audit-log.repository.ts # MODIFY: implement listByEntity
└── presentation/crop/crop.controller.ts # MODIFY: GET /crops/:id/history
apps/api/src/crop.module.ts              # MODIFY: AUDIT_LOG_READER + GetCropHistoryUseCase
apps/admin/src/app/crops/[id]/page.tsx   # MODIFY: completeness + history sections
apps/admin/src/app/crops/page.tsx        # MODIFY: completeness badge in the list
apps/admin/src/lib/api.ts                # MODIFY: types + history call
```

---

### Task 1: `AuditLogReader` port + Prisma read impl (integration test)

**Files:**
- Modify: `apps/api/src/application/audit/audit-log.repository.ts`
- Create: `apps/api/src/application/audit/in-memory-audit-log.reader.ts`
- Modify: `apps/api/src/infrastructure/audit/prisma-audit-log.repository.ts`
- Test: `apps/api/test/prisma-audit-log.reader.int-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, existing `AuditEntry` (write shape).
- Produces:
  - `interface AuditRecord { id: string; entityType: string; entityId: string; actor: string; at: string; changes: Record<string, unknown>; }`.
  - `const AUDIT_LOG_READER = Symbol('AUDIT_LOG_READER')`.
  - `interface AuditLogReader { listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]>; }` (most recent first).
  - `PrismaAuditLogRepository` now also implements `AuditLogReader` (adds `listByEntity`).
  - `InMemoryAuditLogReader` test util.

- [ ] **Step 1: Add the reader port + AuditRecord type**

In `apps/api/src/application/audit/audit-log.repository.ts`, ADD (keep the existing `AUDIT_LOG_REPOSITORY`, `AuditEntry`, `AuditLogRepository` exactly as they are):
```ts
export interface AuditRecord {
  id: string;
  entityType: string;
  entityId: string;
  actor: string;
  at: string;
  changes: Record<string, unknown>;
}

export const AUDIT_LOG_READER = Symbol('AUDIT_LOG_READER');

export interface AuditLogReader {
  listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]>;
}
```

- [ ] **Step 2: In-memory reader (test util)**

`apps/api/src/application/audit/in-memory-audit-log.reader.ts`:
```ts
import { AuditLogReader, AuditRecord } from './audit-log.repository';

export class InMemoryAuditLogReader implements AuditLogReader {
  constructor(private readonly records: AuditRecord[] = []) {}
  async listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]> {
    return this.records
      .filter((r) => r.entityType === entityType && r.entityId === entityId)
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }
}
```

- [ ] **Step 3: Write the failing integration test**

`apps/api/test/prisma-audit-log.reader.int-spec.ts`:
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaAuditLogRepository } from '../src/infrastructure/audit/prisma-audit-log.repository';

describe('PrismaAuditLogRepository reader (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaAuditLogRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.auditLog.deleteMany(); await prisma.$disconnect(); });

  it('records then lists entries for an entity, most recent first', async () => {
    await repo.record({ entityType: 'Crop', entityId: 'c-audit-1', actor: 'a', at: '2026-05-01T00:00:00.000Z', changes: { created: true } });
    await repo.record({ entityType: 'Crop', entityId: 'c-audit-1', actor: 'a', at: '2026-06-01T00:00:00.000Z', changes: { status: 'PUBLISHED' } });
    await repo.record({ entityType: 'Crop', entityId: 'other', actor: 'a', at: '2026-06-02T00:00:00.000Z', changes: {} });

    const list = await repo.listByEntity('Crop', 'c-audit-1');
    expect(list).toHaveLength(2);
    expect(list[0].at).toBe('2026-06-01T00:00:00.000Z'); // most recent first
    expect(typeof list[0].id).toBe('string');
    expect(list[0].changes).toEqual({ status: 'PUBLISHED' });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @okko/api test prisma-audit-log.reader`
Expected: FAIL — `listByEntity` not a function.

- [ ] **Step 5: Implement `listByEntity` on the Prisma repo**

In `apps/api/src/infrastructure/audit/prisma-audit-log.repository.ts`:
- Update the class declaration to implement both interfaces:
```ts
import { AuditEntry, AuditLogRepository, AuditLogReader, AuditRecord } from '../../application/audit/audit-log.repository';
```
```ts
export class PrismaAuditLogRepository implements AuditLogRepository, AuditLogReader {
```
- Add the method (keep the existing `record` method):
```ts
  async listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { at: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actor,
      at: r.at.toISOString(),
      changes: r.changes as Record<string, unknown>,
    }));
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-audit-log.reader`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/audit/audit-log.repository.ts apps/api/src/application/audit/in-memory-audit-log.reader.ts apps/api/src/infrastructure/audit/prisma-audit-log.repository.ts apps/api/test/prisma-audit-log.reader.int-spec.ts
git commit -m "feat(infra): add AuditLogReader port and Prisma listByEntity"
```

---

### Task 2: `GetCropHistoryUseCase` (application, TDD)

**Files:**
- Create: `apps/api/src/application/crop/get-crop-history.use-case.ts`
- Test: `apps/api/src/application/crop/get-crop-history.use-case.spec.ts`

**Interfaces:**
- Consumes: `AuditLogReader`, `CropRepository`, `CropNotFoundError`, `AuditRecord`.
- Produces: `GetCropHistoryUseCase.execute({ cropId }): Promise<AuditRecord[]>` — verifies the crop exists (throws `CropNotFoundError`), returns the crop-level audit records (`listByEntity('Crop', cropId)`).

- [ ] **Step 1: Write the failing test**

`apps/api/src/application/crop/get-crop-history.use-case.spec.ts`:
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { GetCropHistoryUseCase } from './get-crop-history.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryAuditLogReader } from '../audit/in-memory-audit-log.reader';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

describe('GetCropHistoryUseCase', () => {
  it('returns the crop-level audit records', async () => {
    const crops = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const reader = new InMemoryAuditLogReader([
      { id: 'r2', entityType: 'Crop', entityId: 'c1', actor: 'a', at: '2026-06-01T00:00:00.000Z', changes: { status: 'PUBLISHED' } },
      { id: 'r1', entityType: 'Crop', entityId: 'c1', actor: 'a', at: '2026-05-01T00:00:00.000Z', changes: { created: true } },
      { id: 'rx', entityType: 'Variety', entityId: 'v1', actor: 'a', at: '2026-06-02T00:00:00.000Z', changes: {} },
    ]);
    const out = await new GetCropHistoryUseCase(crops, reader).execute({ cropId: 'c1' });
    expect(out).toHaveLength(2); // only Crop/c1 entries, Variety excluded
    expect(out[0].id).toBe('r2'); // most recent first
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const crops = new InMemoryCropRepository();
    const reader = new InMemoryAuditLogReader([]);
    await expect(new GetCropHistoryUseCase(crops, reader).execute({ cropId: 'nope' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test get-crop-history`
Expected: FAIL — use-case not found.

- [ ] **Step 3: Implement the use-case**

`apps/api/src/application/crop/get-crop-history.use-case.ts`:
```ts
import { AuditLogReader, AuditRecord } from '../audit/audit-log.repository';
import { CropRepository } from './crop.repository';
import { CropNotFoundError } from './publish-crop.use-case';

export class GetCropHistoryUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogReader,
  ) {}

  async execute(input: { cropId: string }): Promise<AuditRecord[]> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    return this.audit.listByEntity('Crop', input.cropId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @okko/api test get-crop-history`
Expected: PASS (2 tests). Then full suite — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/crop/get-crop-history.use-case.*
git commit -m "feat(application): add get-crop-history use-case"
```

---

### Task 3: Completeness function + `CropDocument.completeness` (application, TDD)

**Files:**
- Create: `apps/api/src/application/crop/crop-completeness.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/crop/crop-completeness.spec.ts`, and add a case to `crop-read-model.spec.ts`

**Interfaces:**
- Consumes: the resolved collections available inside `toCropDocument`.
- Produces:
  - `interface CompletenessReport { categories: Record<string, boolean>; filled: number; total: number; percent: number; }`.
  - `function computeCompleteness(input: { climatic: boolean; edaphic: boolean; phenology: boolean; nutrition: boolean; yields: boolean; varieties: boolean; zones: boolean; windows: boolean; pests: boolean; prices: boolean; }): CompletenessReport`.
  - `CropDocument` gains `completeness: CompletenessReport`, computed inside `toCropDocument` from the resolved collections.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/application/crop/crop-completeness.spec.ts`:
```ts
import { computeCompleteness } from './crop-completeness';

describe('computeCompleteness', () => {
  it('counts filled categories and computes the percent', () => {
    const report = computeCompleteness({
      climatic: true, edaphic: true, phenology: false, nutrition: false, yields: false,
      varieties: true, zones: false, windows: false, pests: false, prices: false,
    });
    expect(report.total).toBe(10);
    expect(report.filled).toBe(3);
    expect(report.percent).toBe(30);
    expect(report.categories.climatic).toBe(true);
    expect(report.categories.phenology).toBe(false);
  });

  it('reports 100% when everything is filled', () => {
    const all = computeCompleteness({
      climatic: true, edaphic: true, phenology: true, nutrition: true, yields: true,
      varieties: true, zones: true, windows: true, pests: true, prices: true,
    });
    expect(report100(all)).toBe(100);
  });
});

function report100(r: { percent: number }): number { return r.percent; }
```

Append to `apps/api/src/application/crop/crop-read-model.spec.ts`:
```ts
describe('toCropDocument completeness', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 9, metadata: {},
    climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
  };

  it('includes a completeness report reflecting filled categories', () => {
    const doc = toCropDocument(snap);
    expect(doc.completeness.total).toBe(10);
    expect(doc.completeness.categories.climatic).toBe(true);
    expect(doc.completeness.categories.varieties).toBe(false);
    expect(doc.completeness.filled).toBe(1); // only climatic
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @okko/api test crop-completeness crop-read-model`
Expected: FAIL — `computeCompleteness` missing; `completeness` not on document.

- [ ] **Step 3: Implement `crop-completeness.ts`**

`apps/api/src/application/crop/crop-completeness.ts`:
```ts
export interface CompletenessReport {
  categories: Record<string, boolean>;
  filled: number;
  total: number;
  percent: number;
}

export interface CompletenessInput {
  climatic: boolean;
  edaphic: boolean;
  phenology: boolean;
  nutrition: boolean;
  yields: boolean;
  varieties: boolean;
  zones: boolean;
  windows: boolean;
  pests: boolean;
  prices: boolean;
}

export function computeCompleteness(input: CompletenessInput): CompletenessReport {
  const categories: Record<string, boolean> = { ...input };
  const values = Object.values(categories);
  const total = values.length;
  const filled = values.filter(Boolean).length;
  const percent = Math.round((filled / total) * 100);
  return { categories, filled, total, percent };
}
```

- [ ] **Step 4: Wire completeness into `crop-read-model.ts`**

In `apps/api/src/application/crop/crop-read-model.ts`:
- Add import: `import { computeCompleteness, CompletenessReport } from './crop-completeness';`
- Add `completeness: CompletenessReport;` to `CropDocument`.
- Just before building the returned object (after `nutrition`, `yields`, `prices`, `varieties`, `zones`, `windows`, `pests`, `climatic`, `edaphic` are all resolved), compute:
```ts
  const completeness = computeCompleteness({
    climatic: !!s.climatic,
    edaphic: !!s.edaphic,
    phenology: phenology.length > 0,
    nutrition: nutrition.length > 0,
    yields: yields.length > 0,
    varieties: varieties.length > 0,
    zones: zones.length > 0,
    windows: windows.length > 0,
    pests: pests.length > 0,
    prices: prices.length > 0,
  });
```
- Add `completeness,` to the returned object.

(Use the same local variable names already resolved in the function — `phenology`, `nutrition`, `yields`, `varieties`, `zones`, `windows`, `pests`, `prices`. `s.climatic`/`s.edaphic` come from the snapshot.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @okko/api test crop-completeness crop-read-model`
Expected: PASS (all existing + new). Then full suite — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/crop/crop-completeness.* apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add crop completeness report to the read-model"
```

---

### Task 4: Controller `GET /crops/:id/history` + module wiring (e2e)

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Test: `apps/api/test/history-completeness.e2e-spec.ts`

**Interfaces:**
- Consumes: `GetCropHistoryUseCase`.
- Produces endpoint: `GET /crops/:id/history` (404 if the crop is absent). `GET /crops/:id` already includes `completeness` (via the read-model).

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/history-completeness.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('History & completeness e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.auditLog.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('exposes crop history and a completeness report', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = crop.body.id;

    // a second crop-level mutation to grow the history
    await request(app.getHttpServer()).patch(`/crops/${id}/requirements`)
      .send({ climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } } })
      .expect(200);

    const history = await request(app.getHttpServer()).get(`/crops/${id}/history`).expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(2); // create + requirements
    expect(history.body[0]).toHaveProperty('entityType', 'Crop');

    const doc = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(doc.body.completeness.total).toBe(10);
    expect(doc.body.completeness.categories.climatic).toBe(true); // set via requirements
  });

  it('returns 404 for the history of an unknown crop', async () => {
    await request(app.getHttpServer()).get('/crops/does-not-exist/history').expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @okko/api test history-completeness.e2e`
Expected: FAIL — route not wired.

- [ ] **Step 3: Extend the crop controller**

In `apps/api/src/presentation/crop/crop.controller.ts`:
- Add import: `import { GetCropHistoryUseCase } from '../../application/crop/get-crop-history.use-case';`
- Inject into the constructor: `private readonly getHistory: GetCropHistoryUseCase,`
- Add the handler:
```ts
  @Get(':id/history')
  async history(@Param('id') id: string) {
    try {
      return await this.getHistory.execute({ cropId: id });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 4: Wire the module**

In `apps/api/src/crop.module.ts`:
- Add imports for `AUDIT_LOG_READER` (from the audit repository port file), `GetCropHistoryUseCase`.
- Register the reader provider (same Prisma class already used for the writer):
```ts
    { provide: AUDIT_LOG_READER, useClass: PrismaAuditLogRepository },
```
- Register the use-case:
```ts
    {
      provide: GetCropHistoryUseCase,
      useFactory: (cr, reader) => new GetCropHistoryUseCase(cr, reader),
      inject: [CROP_REPOSITORY, AUDIT_LOG_READER],
    },
```
(`PrismaAuditLogRepository` is already imported for `AUDIT_LOG_REPOSITORY`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm db:up && pnpm --filter @okko/api test history-completeness.e2e`
Expected: PASS. Then full suite — all green. Confirm no `as any`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/history-completeness.e2e-spec.ts
git commit -m "feat(api): wire crop history endpoint with e2e"
```

---

### Task 5: Admin — completeness badge (list + detail) + history section

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes: the Task 4 API + the `completeness` field on `CropDocument`.
- Produces: a completeness percent badge on the crop list and detail, plus a history section on the detail page.

- [ ] **Step 1: Extend the api client**

In `apps/admin/src/lib/api.ts`:
- Add types:
```ts
export interface CompletenessReport { categories: Record<string, boolean>; filled: number; total: number; percent: number; }
export interface AuditRecord { id: string; entityType: string; entityId: string; actor: string; at: string; changes: Record<string, unknown>; }
```
- Add `completeness: CompletenessReport;` to `CropDocument` (the list type) AND to `CropDetail`.
- Add a history fetch:
```ts
export async function getCropHistory(id: string): Promise<AuditRecord[]> {
  const res = await fetch(`${BASE}/crops/${id}/history`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```

- [ ] **Step 2: Completeness badge in the crop list**

In `apps/admin/src/app/crops/page.tsx`, show the percent next to each crop's status. Inside the list `<li>`, add after the status span:
```tsx
            <span className="ml-2 text-xs rounded bg-gray-100 px-2 py-0.5">{c.completeness.percent}%</span>
```
(`c` is the `CropDocument`; it now carries `completeness`.)

- [ ] **Step 3: Completeness + history on the crop detail page**

In `apps/admin/src/app/crops/[id]/page.tsx`:
- Import the history fetch: `import { getCrop, getCropHistory } from '../../../lib/api';`
- In the async page body, fetch history alongside the crop:
```tsx
  const [crop, history] = await Promise.all([getCrop(params.id), getCropHistory(params.id)]);
```
- Near the top (after the crop title/status line), add a completeness line:
```tsx
      <p className="text-sm">Complétude : <strong>{crop.completeness.percent}%</strong> ({crop.completeness.filled}/{crop.completeness.total} catégories)</p>
```
- Add a history section at the end of the page:
```tsx
      <section>
        <h2 className="font-semibold mb-2">Historique ({history.length})</h2>
        <ul className="divide-y text-sm">
          {history.map((h) => (
            <li key={h.id} className="py-2">{h.at} — {h.actor} — {Object.keys(h.changes).join(', ')}</li>
          ))}
        </ul>
      </section>
```

- [ ] **Step 4: Verify the admin builds**

Run: `pnpm --filter @okko/admin build`
Expected: build succeeds; `/crops` and `/crops/[id]` compile.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): completeness badge and crop history section"
```

---

## Self-Review

**1. Spec coverage (Plan 7 scope, spec §7 + §11 admin):**
- Historique/audit consultable → Tasks 1, 2, 4, 5. ✅
- Indicateur de complétude de la fiche → Tasks 3, 5. ✅
- Read-model enrichi (AI-ready, completeness inclus) → Task 3. ✅
- Ne pas casser le port d'écriture (ISP : reader séparé) → Task 1. ✅

**2. Placeholder scan:** aucun TBD/TODO ; code réel à chaque étape ; commandes + sorties attendues. ✅

**3. Type consistency:** `AuditRecord` (Task 1) → reader port, use-case (Task 2), controller (Task 4), admin (Task 5). `AuditLogReader` + `AUDIT_LOG_READER` (Task 1) → module (Task 4). `CompletenessReport` (Task 3) → read-model + admin (Task 5). `GetCropHistoryUseCase` inject `[CROP_REPOSITORY, AUDIT_LOG_READER]`. Le port d'écriture `AuditLogRepository` est INCHANGÉ (13 mocks `{ record }` restent valides). ✅

---

## Notes de conception
- **Ségrégation lecture/écriture** de l'audit (`AuditLogReader` distinct de `AuditLogRepository`) : évite de casser 13 fichiers de test et respecte l'ISP. La même classe Prisma implémente les deux.
- **Historique = niveau culture** (`entityType='Crop'`, `entityId=cropId`) : couvre create/publish/rename/metadata/requirements/phenology/nutrition/yields. L'historique des entités liées (variétés, adéquations, fenêtres, contrôles, prix) est hors périmètre de ce plan (leurs `entityId` ne sont pas le cropId) — extension future possible.
- **Complétude = fonction pure** dans le read-model, calculée sur les 10 catégories optionnelles déjà résolues. Incluse dans `CropDocument` → visible partout (API, admin, futur chatbot).
- **Fin de la Phase 0** : après ce plan, le back-office de la base de connaissances est complet (saisie + consultation + historique + complétude).
```
