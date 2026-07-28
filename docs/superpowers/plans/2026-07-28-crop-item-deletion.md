# Suppression d'items de fiche culture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de supprimer les 5 sous-entités d'une fiche culture (variétés, notes de zone, fenêtres de culture, liens ravageurs, points de prix), depuis la modale d'édition, avec confirmation.

**Architecture:** `Crop` est event-sourcé. Chaque suppression = un nouvel événement `XRemoved` sur l'agrégat (l'`apply` filtre la collection), un `RemoveXUseCase` (charge les events → vérifie l'existence → émet l'événement → append + `crops.save` → **`repo.replaceForCrop(cropId, crop.<collection>)`** pour resynchroniser la projection de lecture → audit), un endpoint `DELETE`, et côté admin un bouton réutilisable `DeleteWithConfirm` branché dans les 5 éditeurs en mode édition.

**Tech Stack:** NestJS, event sourcing (CropEventStore), Prisma 5, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Aucune migration** : événements + méthode `replaceForCrop` déjà existante ; pas de schéma modifié.
- Synchronisation de la projection **via `replaceForCrop(cropId, items)`** (déjà exposé par les 5 repos) — ne PAS ajouter de méthode `delete()`.
- « Supprimer » retire l'association au niveau culture, **pas** l'entité globale (zone/ravageur des catalogues) → aucune intégrité référentielle à gérer.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.
- Bouton de suppression visible **en mode édition seulement** (`initial` présent), jamais à la création.

---

### Task 1: Domaine — 5 événements `XRemoved` + méthodes + `apply`

**Files:**
- Modify: `apps/api/src/domain/crop/crop-event.ts`
- Modify: `apps/api/src/domain/crop/crop.ts`
- Test: `apps/api/src/domain/crop/crop.remove-items.spec.ts` (create)

**Interfaces:**
- Produces: `Crop.removeVariety(id)`, `Crop.removeCroppingWindow(id)`, `Crop.removePricePoint(id)`, `Crop.removeZoneSuitability(zoneId)`, `Crop.removePestControl(pestId)` ; événements `VarietyRemoved{varietyId}`, `CroppingWindowRemoved{windowId}`, `PricePointRemoved{priceId}`, `ZoneSuitabilityRemoved{zoneId}`, `PestControlRemoved{pestId}`.

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/crop/crop.remove-items.spec.ts`:
```ts
import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { VarietySnapshot } from './variety';
import { CroppingWindowSnapshot } from '../window/cropping-window';
import { CropZoneSuitabilitySnapshot } from '../zone/crop-zone-suitability';
import { CropPestControlSnapshot } from '../pest/crop-pest-control';
import { PricePointSnapshot } from '../price/price-point';

const newCrop = () => Crop.create({ id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }), scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL });
const variety = (id: string) => ({ id, cropId: 'c1', name: { fr: id }, traits: [] } as VarietySnapshot);
const window = (id: string) => ({ id, cropId: 'c1', zoneId: 'z1', season: 'Saison des pluies', irrigationRequired: false, operations: [] } as CroppingWindowSnapshot);
const price = (id: string) => ({ id, cropId: 'c1', form: 'GRAIN', market: 'M', periodStart: '2026-01', periodEnd: '2026-01', price: 100, unit: 'KG', currency: 'XOF' } as PricePointSnapshot);
const zone = (zoneId: string) => ({ cropId: 'c1', zoneId, rating: 'SUITABLE' } as CropZoneSuitabilitySnapshot);
const pest = (pestId: string) => ({ cropId: 'c1', pestId, susceptibility: 'MEDIUM', sensitiveStages: [], controlMethods: [] } as CropPestControlSnapshot);

describe('Crop — remove items', () => {
  it('removeVariety retire la variété ciblée et préserve les autres', () => {
    const c = newCrop(); c.addVariety(variety('v1')); c.addVariety(variety('v2'));
    c.removeVariety('v1');
    expect(c.varieties.map((v) => v.id)).toEqual(['v2']);
    expect(c.toSnapshot().hasUnpublishedChanges).toBe(true);
  });
  it('removeCroppingWindow retire la fenêtre ciblée', () => {
    const c = newCrop(); c.addCroppingWindow(window('w1')); c.addCroppingWindow(window('w2'));
    c.removeCroppingWindow('w1');
    expect(c.windows.map((w) => w.id)).toEqual(['w2']);
  });
  it('removePricePoint retire le prix ciblé', () => {
    const c = newCrop(); c.addPricePoint(price('pr1')); c.addPricePoint(price('pr2'));
    c.removePricePoint('pr1');
    expect(c.prices.map((p) => p.id)).toEqual(['pr2']);
  });
  it('removeZoneSuitability retire la note de la zone ciblée', () => {
    const c = newCrop(); c.setZoneSuitability(zone('z1')); c.setZoneSuitability(zone('z2'));
    c.removeZoneSuitability('z1');
    expect(c.zones.map((z) => z.zoneId)).toEqual(['z2']);
  });
  it('removePestControl retire le lien du ravageur ciblé', () => {
    const c = newCrop(); c.setPestControl(pest('p1')); c.setPestControl(pest('p2'));
    c.removePestControl('p1');
    expect(c.pests.map((p) => p.pestId)).toEqual(['p2']);
  });
  it('un retrait sur un id absent laisse la collection inchangée', () => {
    const c = newCrop(); c.addVariety(variety('v1'));
    c.removeVariety('nope');
    expect(c.varieties.map((v) => v.id)).toEqual(['v1']);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/crop/crop.remove-items.spec.ts` → FAIL (méthodes inexistantes).

- [ ] **Step 3: Add events to `crop-event.ts`**

In `apps/api/src/domain/crop/crop-event.ts`, add to the `CropEvent` union (before `DraftDiscarded`):
```ts
  | { type: 'VarietyRemoved'; varietyId: string }
  | { type: 'CroppingWindowRemoved'; windowId: string }
  | { type: 'ZoneSuitabilityRemoved'; zoneId: string }
  | { type: 'PestControlRemoved'; pestId: string }
  | { type: 'PricePointRemoved'; priceId: string }
```

- [ ] **Step 4: Add remove methods to `crop.ts`**

In `apps/api/src/domain/crop/crop.ts`, right after `setPestControl(...)` (~line 196), add:
```ts
  removeVariety(id: string): void { this.raise({ type: 'VarietyRemoved', varietyId: id }); }
  removeCroppingWindow(id: string): void { this.raise({ type: 'CroppingWindowRemoved', windowId: id }); }
  removePricePoint(id: string): void { this.raise({ type: 'PricePointRemoved', priceId: id }); }
  removeZoneSuitability(zoneId: string): void { this.raise({ type: 'ZoneSuitabilityRemoved', zoneId }); }
  removePestControl(pestId: string): void { this.raise({ type: 'PestControlRemoved', pestId }); }
```

- [ ] **Step 5: Add `apply` cases in `crop.ts`**

In the `apply` switch, after `case 'PestControlSet': ...` (~line 226), add:
```ts
      case 'VarietyRemoved': this._varieties = this._varieties.filter((x) => x.id !== e.varietyId); this._hasUnpublishedChanges = true; break;
      case 'CroppingWindowRemoved': this._windows = this._windows.filter((x) => x.id !== e.windowId); this._hasUnpublishedChanges = true; break;
      case 'PricePointRemoved': this._prices = this._prices.filter((x) => x.id !== e.priceId); this._hasUnpublishedChanges = true; break;
      case 'ZoneSuitabilityRemoved': this._zones = this._zones.filter((z) => z.zoneId !== e.zoneId); this._hasUnpublishedChanges = true; break;
      case 'PestControlRemoved': this._pests = this._pests.filter((p) => p.pestId !== e.pestId); this._hasUnpublishedChanges = true; break;
```

- [ ] **Step 6: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/crop` → all PASS.

- [ ] **Step 7: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.remove-items.spec.ts
git commit -m "feat(crop): événements XRemoved + méthodes de retrait (variété/fenêtre/prix/zone/ravageur)"
```

---

### Task 2: Application — 5 `RemoveXUseCase`

**Files:**
- Create: `apps/api/src/application/crop/remove-variety.use-case.ts`
- Create: `apps/api/src/application/window/remove-cropping-window.use-case.ts`
- Create: `apps/api/src/application/price/remove-price-point.use-case.ts`
- Create: `apps/api/src/application/zone/remove-crop-zone-suitability.use-case.ts`
- Create: `apps/api/src/application/pest/remove-crop-pest-control.use-case.ts`
- Test: `apps/api/src/application/crop/remove-variety.use-case.spec.ts` (create)

**Interfaces:**
- Consumes: `Crop.removeX` (Task 1) ; `CropEventStore` ; les repos de projection (`replaceForCrop`) ; `CropNotFoundError` (`../crop/publish-crop.use-case`) ; erreurs `VarietyNotFoundError` (`../crop/update-variety.use-case`), `CroppingWindowNotFoundError` (`./update-cropping-window.use-case`), `PricePointNotFoundError` (`./update-price-point.use-case`).
- Produces: `RemoveVarietyUseCase`, `RemoveCroppingWindowUseCase`, `RemovePricePointUseCase`, `RemoveCropZoneSuitabilityUseCase` (+ `ZoneSuitabilityNotFoundError`), `RemoveCropPestControlUseCase` (+ `PestControlNotFoundError`). Chaque `execute(input)` renvoie `Promise<void>`.

- [ ] **Step 1: Failing test (variété — représentatif)**

Create `apps/api/src/application/crop/remove-variety.use-case.spec.ts` — **réutilise le harnais de `update-variety.use-case.spec.ts`** (READ ce fichier d'abord : il fournit un `CropEventStore` en mémoire, un `VarietyRepository` en mémoire, un audit factice et une horloge fixe ; copie ses helpers/`beforeEach`). Ajoute :
```ts
// Pré-requis (mêmes helpers que update-variety.use-case.spec.ts) :
//   - un event store en mémoire pré-chargé avec un crop 'c1' possédant les variétés v1 et v2
//     (via CropCreated + VarietyAdded, comme le fait le spec update),
//   - un VarietyRepository en mémoire contenant v1 et v2,
//   - un audit en mémoire, une horloge fixe.
describe('RemoveVarietyUseCase', () => {
  it('culture inconnue → CropNotFoundError', async () => {
    await expect(uc.execute({ cropId: 'ghost', varietyId: 'v1', actor: 'a@b.c' })).rejects.toThrow(CropNotFoundError);
  });
  it('variété inconnue → VarietyNotFoundError', async () => {
    await expect(uc.execute({ cropId: 'c1', varietyId: 'nope', actor: 'a@b.c' })).rejects.toThrow(VarietyNotFoundError);
  });
  it('retire la variété des events ET de la projection', async () => {
    await uc.execute({ cropId: 'c1', varietyId: 'v1', actor: 'a@b.c' });
    const crop = Crop.fromEvents(await events.load('c1'));
    expect(crop.varieties.map((v) => v.id)).toEqual(['v2']);
    expect((await varieties.listByCrop('c1')).map((v) => v.id)).toEqual(['v2']);
    expect(audit.records.at(-1)).toMatchObject({ entityType: 'Variety', entityId: 'v1', changes: { removed: { id: 'v1' } } });
  });
});
```
(Adapte les noms `uc`, `events`, `varieties`, `audit` à ceux du spec `update-variety` réutilisé. Importe `Crop`, `CropNotFoundError`, `VarietyNotFoundError`, `RemoveVarietyUseCase`.)

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/crop/remove-variety.use-case.spec.ts` → FAIL (use-case inexistant).

- [ ] **Step 3: `remove-variety.use-case.ts`**
```ts
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from './crop-event-store';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';
import { VarietyNotFoundError } from './update-variety.use-case';

export interface RemoveVarietyInput { cropId: string; varietyId: string; actor: string; }

export class RemoveVarietyUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveVarietyInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.varieties.some((v) => v.id === input.varietyId)) throw new VarietyNotFoundError(input.varietyId);
    crop.removeVariety(input.varietyId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.varieties.replaceForCrop(input.cropId, crop.varieties);
    await this.audit.record({ entityType: 'Variety', entityId: input.varietyId, actor: input.actor, at, changes: { removed: { id: input.varietyId } } });
  }
}
```

- [ ] **Step 4: `remove-cropping-window.use-case.ts`**
```ts
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { CroppingWindowNotFoundError } from './update-cropping-window.use-case';

export interface RemoveCroppingWindowInput { cropId: string; windowId: string; actor: string; }

export class RemoveCroppingWindowUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCroppingWindowInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.windows.some((w) => w.id === input.windowId)) throw new CroppingWindowNotFoundError(input.windowId);
    crop.removeCroppingWindow(input.windowId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.windows.replaceForCrop(input.cropId, crop.windows);
    await this.audit.record({ entityType: 'CroppingWindow', entityId: input.windowId, actor: input.actor, at, changes: { removed: { id: input.windowId } } });
  }
}
```

- [ ] **Step 5: `remove-price-point.use-case.ts`**
```ts
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { PricePointRepository } from './price-point.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { PricePointNotFoundError } from './update-price-point.use-case';

export interface RemovePricePointInput { cropId: string; priceId: string; actor: string; }

export class RemovePricePointUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemovePricePointInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.prices.some((p) => p.id === input.priceId)) throw new PricePointNotFoundError(input.priceId);
    crop.removePricePoint(input.priceId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.prices.replaceForCrop(input.cropId, crop.prices);
    await this.audit.record({ entityType: 'PricePoint', entityId: input.priceId, actor: input.actor, at, changes: { removed: { id: input.priceId } } });
  }
}
```

- [ ] **Step 6: `remove-crop-zone-suitability.use-case.ts`**
```ts
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class ZoneSuitabilityNotFoundError extends Error {
  constructor(id: string) { super(`Zone suitability not found: ${id}`); this.name = 'ZoneSuitabilityNotFoundError'; }
}

export interface RemoveCropZoneSuitabilityInput { cropId: string; zoneId: string; actor: string; }

export class RemoveCropZoneSuitabilityUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCropZoneSuitabilityInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.zones.some((z) => z.zoneId === input.zoneId)) throw new ZoneSuitabilityNotFoundError(input.zoneId);
    crop.removeZoneSuitability(input.zoneId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.suitabilities.replaceForCrop(input.cropId, crop.zones);
    await this.audit.record({ entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`, actor: input.actor, at, changes: { removed: { zoneId: input.zoneId } } });
  }
}
```

- [ ] **Step 7: `remove-crop-pest-control.use-case.ts`**
```ts
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class PestControlNotFoundError extends Error {
  constructor(id: string) { super(`Pest control not found: ${id}`); this.name = 'PestControlNotFoundError'; }
}

export interface RemoveCropPestControlInput { cropId: string; pestId: string; actor: string; }

export class RemoveCropPestControlUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly controls: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCropPestControlInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.pests.some((p) => p.pestId === input.pestId)) throw new PestControlNotFoundError(input.pestId);
    crop.removePestControl(input.pestId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.controls.replaceForCrop(input.cropId, crop.pests);
    await this.audit.record({ entityType: 'CropPestControl', entityId: `${input.cropId}:${input.pestId}`, actor: input.actor, at, changes: { removed: { pestId: input.pestId } } });
  }
}
```

- [ ] **Step 8: Run → pass**

`pnpm --filter @okko/api exec jest src/application/crop/remove-variety.use-case.spec.ts` → PASS.

- [ ] **Step 9: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/crop/remove-variety.use-case.ts apps/api/src/application/crop/remove-variety.use-case.spec.ts apps/api/src/application/window/remove-cropping-window.use-case.ts apps/api/src/application/price/remove-price-point.use-case.ts apps/api/src/application/zone/remove-crop-zone-suitability.use-case.ts apps/api/src/application/pest/remove-crop-pest-control.use-case.ts
git commit -m "feat(crop): 5 RemoveXUseCase (retrait + resync projection via replaceForCrop + audit)"
```

---

### Task 3: API — 5 endpoints `DELETE` + câblage module

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: les 5 `RemoveXUseCase` (Task 2) ; `ZoneSuitabilityNotFoundError`, `PestControlNotFoundError`, `CroppingWindowNotFoundError`, `CropNotFoundError`, `mapCropError` (existant).
- Produces: `DELETE /crops/:id/varieties/:varietyId`, `/windows/:windowId`, `/prices/:priceId`, `/zones/:zoneId`, `/pests/:pestId` (204).

- [ ] **Step 1: Module — 5 providers**

In `apps/api/src/crop.module.ts`, add imports (près des `UpdateX`/`SetX`) :
```ts
import { RemoveVarietyUseCase } from './application/crop/remove-variety.use-case';
import { RemoveCroppingWindowUseCase } from './application/window/remove-cropping-window.use-case';
import { RemovePricePointUseCase } from './application/price/remove-price-point.use-case';
import { RemoveCropZoneSuitabilityUseCase } from './application/zone/remove-crop-zone-suitability.use-case';
import { RemoveCropPestControlUseCase } from './application/pest/remove-crop-pest-control.use-case';
```
Add these provider objects to the `providers` array (à côté des `UpdateX`/`SetX` correspondants) :
```ts
    { provide: RemoveVarietyUseCase, useFactory: (es, vr, a, c) => new RemoveVarietyUseCase(es, vr, a, c), inject: [CROP_EVENT_STORE, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
    { provide: RemoveCroppingWindowUseCase, useFactory: (es, wr, a, c) => new RemoveCroppingWindowUseCase(es, wr, a, c), inject: [CROP_EVENT_STORE, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
    { provide: RemovePricePointUseCase, useFactory: (es, pr, a, c) => new RemovePricePointUseCase(es, pr, a, c), inject: [CROP_EVENT_STORE, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
    { provide: RemoveCropZoneSuitabilityUseCase, useFactory: (es, s, a, c) => new RemoveCropZoneSuitabilityUseCase(es, s, a, c), inject: [CROP_EVENT_STORE, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
    { provide: RemoveCropPestControlUseCase, useFactory: (es, ctrl, a, c) => new RemoveCropPestControlUseCase(es, ctrl, a, c), inject: [CROP_EVENT_STORE, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
```

- [ ] **Step 2: Controller — imports + injection**

In `apps/api/src/presentation/crop/crop.controller.ts`:

2a. Add `Delete` and `HttpCode` to the `@nestjs/common` import (currently `Body, Controller, Get, Param, Patch, Post, Put, Query, ...`).

2b. Import the 5 use-cases + the 2 new errors:
```ts
import { RemoveVarietyUseCase } from '../../application/crop/remove-variety.use-case';
import { RemoveCroppingWindowUseCase } from '../../application/window/remove-cropping-window.use-case';
import { RemovePricePointUseCase } from '../../application/price/remove-price-point.use-case';
import { RemoveCropZoneSuitabilityUseCase, ZoneSuitabilityNotFoundError } from '../../application/zone/remove-crop-zone-suitability.use-case';
import { RemoveCropPestControlUseCase, PestControlNotFoundError } from '../../application/pest/remove-crop-pest-control.use-case';
```
(`CroppingWindowNotFoundError` est déjà importé pour le PUT window ; ne pas le réimporter.)

2c. Inject in the constructor (près des `updateVarietyUC`, `updateWindowUC`, etc.) :
```ts
    private readonly removeVarietyUC: RemoveVarietyUseCase,
    private readonly removeWindowUC: RemoveCroppingWindowUseCase,
    private readonly removePriceUC: RemovePricePointUseCase,
    private readonly removeZoneUC: RemoveCropZoneSuitabilityUseCase,
    private readonly removePestUC: RemoveCropPestControlUseCase,
```

- [ ] **Step 3: Controller — 5 handlers**

Add (par ex. juste après le `@Put(':id/varieties/:varietyId')` et ses voisins) :
```ts
  @Delete(':id/varieties/:varietyId')
  @HttpCode(204)
  async removeVariety(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('varietyId') varietyId: string) {
    try { await this.removeVarietyUC.execute({ cropId: id, varietyId, actor: user.email }); }
    catch (e) { mapCropError(e, id); }
  }

  @Delete(':id/windows/:windowId')
  @HttpCode(204)
  async removeWindow(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('windowId') windowId: string) {
    try { await this.removeWindowUC.execute({ cropId: id, windowId, actor: user.email }); }
    catch (e) {
      if (e instanceof CropNotFoundError || e instanceof CroppingWindowNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Delete(':id/prices/:priceId')
  @HttpCode(204)
  async removePrice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('priceId') priceId: string) {
    try { await this.removePriceUC.execute({ cropId: id, priceId, actor: user.email }); }
    catch (e) { mapCropError(e, id); }
  }

  @Delete(':id/zones/:zoneId')
  @HttpCode(204)
  async removeZone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('zoneId') zoneId: string) {
    try { await this.removeZoneUC.execute({ cropId: id, zoneId, actor: user.email }); }
    catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneSuitabilityNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Delete(':id/pests/:pestId')
  @HttpCode(204)
  async removePest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pestId') pestId: string) {
    try { await this.removePestUC.execute({ cropId: id, pestId, actor: user.email }); }
    catch (e) {
      if (e instanceof CropNotFoundError || e instanceof PestControlNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(crop): endpoints DELETE items (variété/fenêtre/prix/zone/ravageur) + câblage module"
```

---

### Task 4: Admin — `DeleteWithConfirm` + 5 actions

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/DeleteWithConfirm.tsx`
- Modify: `apps/admin/src/lib/actions.ts`

**Interfaces:**
- Produces: `<DeleteWithConfirm onConfirm disabled? />` ; `deleteCropVariety(cropId, varietyId)`, `deleteCropWindow(cropId, windowId)`, `deleteCropPrice(cropId, priceId)`, `deleteCropZone(cropId, zoneId)`, `deleteCropPest(cropId, pestId)`.

- [ ] **Step 1: `DeleteWithConfirm` component**

Create `apps/admin/src/app/crops/[id]/editors/DeleteWithConfirm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function DeleteWithConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled={disabled}
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}>Supprimer</Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Supprimer définitivement ?</span>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirming(false)}>Annuler</Button>
      <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onConfirm}>Supprimer</Button>
    </div>
  );
}
```

- [ ] **Step 2: 5 actions**

In `apps/admin/src/lib/actions.ts`, add (après `deletePest`/les actions culture existantes) :
```ts
export async function deleteCropVariety(cropId: string, varietyId: string): Promise<void> {
  await authFetch(`/crops/${cropId}/varieties/${varietyId}`, { method: 'DELETE' });
}
export async function deleteCropWindow(cropId: string, windowId: string): Promise<void> {
  await authFetch(`/crops/${cropId}/windows/${windowId}`, { method: 'DELETE' });
}
export async function deleteCropPrice(cropId: string, priceId: string): Promise<void> {
  await authFetch(`/crops/${cropId}/prices/${priceId}`, { method: 'DELETE' });
}
export async function deleteCropZone(cropId: string, zoneId: string): Promise<void> {
  await authFetch(`/crops/${cropId}/zones/${zoneId}`, { method: 'DELETE' });
}
export async function deleteCropPest(cropId: string, pestId: string): Promise<void> {
  await authFetch(`/crops/${cropId}/pests/${pestId}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/crops/[id]/editors/DeleteWithConfirm.tsx" apps/admin/src/lib/actions.ts
git commit -m "feat(admin): composant DeleteWithConfirm + 5 actions de suppression d'items culture"
```

---

### Task 5: Admin — câbler la suppression dans les 5 éditeurs (mode édition)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`

**Interfaces:**
- Consumes: `DeleteWithConfirm`, `deleteCropX` (Task 4). `submit`/`busy` viennent du render-prop `EditorShell`. Id de l'item : `initial!.id` (variété, fenêtre, prix), `initial!.zoneId` (zone), `initial!.pestId` (ravageur).

Pour CHAQUE éditeur : (a) importer le composant + l'action ; (b) dans le pied de page (le `<div className="flex justify-end gap-2 pt-2">` contenant Annuler/Enregistrer), passer le conteneur en `flex items-center gap-2 pt-2`, insérer le bouton en tête (mode édition seulement) et pousser les boutons de droite avec `ml-auto`.

- [ ] **Step 1: `VarietyEditor.tsx`**

Imports :
```tsx
import { DeleteWithConfirm } from './DeleteWithConfirm';
import { deleteCropVariety } from '@/lib/actions';
```
Remplacer le pied :
```tsx
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
```
par (et changer le `<div>` englobant de `justify-end` à `items-center`) :
```tsx
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropVariety(cropId, initial!.id))} />}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
```

- [ ] **Step 2: `WindowEditor.tsx`** — même transformation, avec :
```tsx
import { DeleteWithConfirm } from './DeleteWithConfirm';
import { deleteCropWindow } from '@/lib/actions';
```
```tsx
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropWindow(cropId, initial!.id))} />}
```
(bouton droite : `{editing ? 'Enregistrer' : 'Ajouter'}`)

- [ ] **Step 3: `PriceEditor.tsx`** — avec :
```tsx
import { DeleteWithConfirm } from './DeleteWithConfirm';
import { deleteCropPrice } from '@/lib/actions';
```
```tsx
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropPrice(cropId, initial!.id))} />}
```
(bouton droite : `{editing ? 'Enregistrer' : 'Ajouter'}`)

- [ ] **Step 4: `ZoneSuitabilityEditor.tsx`** — avec :
```tsx
import { DeleteWithConfirm } from './DeleteWithConfirm';
import { deleteCropZone } from '@/lib/actions';
```
```tsx
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropZone(cropId, initial!.zoneId))} />}
```
(bouton droite : `{editing ? 'Enregistrer' : 'Rattacher'}`)

- [ ] **Step 5: `PestControlEditor.tsx`** — avec :
```tsx
import { DeleteWithConfirm } from './DeleteWithConfirm';
import { deleteCropPest } from '@/lib/actions';
```
```tsx
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropPest(cropId, initial!.pestId))} />}
```
(bouton droite : `{editing ? 'Enregistrer' : 'Rattacher'}`. Le `submit`/`busy`/`close` sont déjà exposés par le render-prop dans cet éditeur.)

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx" "apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx" "apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx" "apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx" "apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx"
git commit -m "feat(admin): bouton Supprimer (confirmation) dans les 5 éditeurs d'items culture"
```

- [ ] **Step 7: Vérification manuelle**

Démarrer admin + API. Sur une fiche culture avec des items :
- Ouvrir « Modifier » sur une variété → bouton « Supprimer » à gauche → clic → « Supprimer définitivement ? » → confirmer → la variété disparaît (liste rafraîchie), la culture passe en changements non publiés.
- Idem zone, fenêtre, lien ravageur, prix.
- À la **création** (« + Ajouter … »), pas de bouton Supprimer.
- Publier puis re-supprimer un item, « Annuler le brouillon » (discard) restaure l'item supprimé.

---

## Notes de fin

- **Aucune migration.** `replaceForCrop` (déjà implémenté par les 5 repos Prisma) resynchronise la projection.
- **DISEASE / entités globales** hors périmètre.
- Le `submit` du render-prop `EditorShell` gère `busy`, la fermeture et `router.refresh()` — la suppression le réutilise, donc pas de gestion d'état supplémentaire dans les éditeurs.
