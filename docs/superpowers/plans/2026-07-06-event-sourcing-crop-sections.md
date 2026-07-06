# Sections de la Culture dans le flux d'événements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer les 5 sections (variétés, fenêtres, aptitudes de zone, lutte ravageurs, prix) dans le flux d'événements de la culture ; l'agrégat `Crop` absorbe les collections. Zéro changement de comportement visible.

**Architecture :** Extension du socle event sourcing du Lot A. 5 nouvelles variantes `CropEvent` portant les snapshots de section ; l'agrégat `Crop` tient `_varieties/_windows/_zones/_pests/_prices`, avec `apply` (push pour ajouts, upsert-par-clé pour zones/ravageurs) et des mutations qui émettent ces événements. Les 5 use-cases de section passent à « charger le flux → `fromEvents` → muter → `append` → mettre à jour la projection de section → audit ». Les tables-projections des sections + `composeCropDocument` restent inchangés.

**Tech Stack :** NestJS 10 + TypeScript + Prisma + Jest (TDD).

## Global Constraints

- **Clean architecture** : domaine sans import externe (les imports domaine→domaine sont permis) ; ports dans `application/**` ; adaptateurs dans `infrastructure/**`.
- **Zéro changement visible** : documents et endpoints identiques. **Garde-fou nº1** : specs **domaine** (`crop.spec.ts`, etc.) et **e2e** (`variety-requirements.e2e-spec.ts`, `window.e2e-spec.ts`, `nutrition-price.e2e-spec.ts`, `zone.e2e-spec.ts`, `pest.e2e-spec.ts`, etc.) passent **sans modification**. Les specs **unitaires** des use-cases de section changent (nouveau constructeur + amorçage par événements).
- **`version` de la culture NON affecté par les sections** : les 5 événements de section **avancent la `sequence`** mais **n'incrémentent pas** `_version` (traitement identique à `Published`/`Archived` du Lot A). Aujourd'hui éditer une section ne change pas `crop.version` — on préserve.
- **L'agrégat tient des snapshots** : `_varieties: VarietySnapshot[]`, etc. `apply` push/upsert le snapshot porté par l'événement (pas de reconstruction d'objet domaine dans `apply`).
- **Upsert par clé** : `ZoneSuitabilitySet` remplace l'entrée de même `zoneId` ; `PestControlSet` de même `pestId`. Ajouts (`VarietyAdded`/`CroppingWindowAdded`/`PricePointAdded`) : push.
- **Projections de section conservées** : chaque use-case appelle toujours `sectionRepo.save(snap)` ; `composeCropDocument`/`toCropDocument` inchangés.
- **`CropSnapshot` cœur inchangé** : les sections ne rentrent PAS dans `toSnapshot()` (elles vivent dans leurs tables ; l'agrégat les tient en mémoire pour le repli, utile au Lot B).
- **Tests** : TDD (rouge d'abord). Après chaque tâche, `pnpm --filter @okko/api test` **entièrement vert**. Suite single-worker ; ⚠️ `deleteMany` — OK (base vide).
- Commits fréquents, préfixe `feat(api):`/`refactor(api):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Modifiés :**
- `apps/api/src/domain/crop/crop-event.ts` — 5 variantes
- `apps/api/src/domain/crop/crop.ts` — collections, getters, mutations, `apply`
- `apps/api/src/domain/crop/crop.events.spec.ts` — specs sections (fold mixte, upsert, version)
- Les 5 use-cases de section (+ specs) : `application/crop/add-variety.use-case.ts`, `application/window/add-cropping-window.use-case.ts`, `application/price/add-price-point.use-case.ts`, `application/zone/set-crop-zone-suitability.use-case.ts`, `application/pest/set-crop-pest-control.use-case.ts`
- `apps/api/src/crop.module.ts` — DI des 5 use-cases
- (Task 4) un e2e nouveau : `apps/api/test/crop-sections-event-sourcing.e2e-spec.ts`

---

## Task 1 : Événements de section + agrégat (domaine, TDD)

**Files:**
- Modify: `apps/api/src/domain/crop/crop-event.ts`
- Modify: `apps/api/src/domain/crop/crop.ts`
- Modify: `apps/api/src/domain/crop/crop.events.spec.ts`

**Interfaces:**
- Produces : 5 variantes `CropEvent` ; `Crop` gagne `addVariety(v)`, `addCroppingWindow(w)`, `addPricePoint(p)`, `setZoneSuitability(s)`, `setPestControl(c)` + getters `varieties/windows/zones/pests/prices`. `fromEvents`/`pullPendingEvents`/`toSnapshot` cœur inchangés.

- [ ] **Step 1 : Étendre `crop-event.ts`** — ajouter les imports des snapshots + les 5 variantes à l'union `CropEvent` :

```ts
import { VarietySnapshot } from './variety';
import { CroppingWindowSnapshot } from '../window/cropping-window';
import { CropZoneSuitabilitySnapshot } from '../zone/crop-zone-suitability';
import { CropPestControlSnapshot } from '../pest/crop-pest-control';
import { PricePointSnapshot } from '../price/price-point';

// ... à la fin de l'union CropEvent, avant le `;` final :
  | { type: 'VarietyAdded'; variety: VarietySnapshot }
  | { type: 'CroppingWindowAdded'; window: CroppingWindowSnapshot }
  | { type: 'ZoneSuitabilitySet'; suitability: CropZoneSuitabilitySnapshot }
  | { type: 'PestControlSet'; control: CropPestControlSnapshot }
  | { type: 'PricePointAdded'; price: PricePointSnapshot }
```

- [ ] **Step 2 : Test qui échoue — ajouter à `crop.events.spec.ts`** (à la suite des tests Lot A) :

```ts
import { VarietySnapshot } from './variety';
// (les autres snapshots au besoin)

describe('Crop sections event sourcing', () => {
  const v = (id: string): VarietySnapshot => ({ id, cropId: 'c1', name: { fr: `V${id}` }, traits: [] } as VarietySnapshot);

  it('addVariety émet VarietyAdded, pousse dans la collection, sans changer version', () => {
    const c = make(); c.pullPendingEvents();          // make() = Crop.create(...) du bloc Lot A
    c.addVariety(v('a'));
    expect(c.pullPendingEvents()).toEqual([{ type: 'VarietyAdded', variety: v('a') }]);
    expect(c.varieties).toEqual([v('a')]);
    expect(c.version).toBe(1);                          // inchangé
  });

  it('setZoneSuitability fait un upsert par zoneId', () => {
    const c = make(); c.pullPendingEvents();
    const s1 = { cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any;
    const s2 = { cropId: 'c1', zoneId: 'z1', rating: 'MARGINAL' } as any;
    c.setZoneSuitability(s1); c.setZoneSuitability(s2);
    expect(c.zones).toEqual([s2]);                      // remplacé, pas dupliqué
  });

  it('fromEvents d\'un flux mixte reconstruit cœur + sections', () => {
    const built = make();
    built.addVariety(v('a'));
    built.setZoneSuitability({ cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any);
    const rebuilt = Crop.fromEvents(stored(built.pullPendingEvents()));  // stored() du bloc Lot A (ajoute streamId:'c1')
    expect(rebuilt.varieties).toEqual(built.varieties);
    expect(rebuilt.zones).toEqual(built.zones);
    expect(rebuilt.toSnapshot()).toEqual(built.toSnapshot());  // cœur identique
  });
});
```

- [ ] **Step 3 : Lancer → échoue.** `pnpm --filter @okko/api test -- crop.events` → FAIL.

- [ ] **Step 4 : Modifier `crop.ts`** :
  - Importer les snapshots : `import { VarietySnapshot } from './variety';` etc. (5 imports).
  - Champs (déclaration, hors constructeur) :
    ```ts
    private _varieties: VarietySnapshot[] = [];
    private _windows: CroppingWindowSnapshot[] = [];
    private _zones: CropZoneSuitabilitySnapshot[] = [];
    private _pests: CropPestControlSnapshot[] = [];
    private _prices: PricePointSnapshot[] = [];
    ```
  - Getters (copies) :
    ```ts
    get varieties(): VarietySnapshot[] { return [...this._varieties]; }
    get windows(): CroppingWindowSnapshot[] { return [...this._windows]; }
    get zones(): CropZoneSuitabilitySnapshot[] { return [...this._zones]; }
    get pests(): CropPestControlSnapshot[] { return [...this._pests]; }
    get prices(): PricePointSnapshot[] { return [...this._prices]; }
    ```
  - Mutations :
    ```ts
    addVariety(v: VarietySnapshot): void { this.raise({ type: 'VarietyAdded', variety: v }); }
    addCroppingWindow(w: CroppingWindowSnapshot): void { this.raise({ type: 'CroppingWindowAdded', window: w }); }
    addPricePoint(p: PricePointSnapshot): void { this.raise({ type: 'PricePointAdded', price: p }); }
    setZoneSuitability(s: CropZoneSuitabilitySnapshot): void { this.raise({ type: 'ZoneSuitabilitySet', suitability: s }); }
    setPestControl(c: CropPestControlSnapshot): void { this.raise({ type: 'PestControlSet', control: c }); }
    ```
  - Cas `apply` (ajouter au `switch`, **sans** `_version += 1`) :
    ```ts
    case 'VarietyAdded': this._varieties = [...this._varieties, e.variety]; break;
    case 'CroppingWindowAdded': this._windows = [...this._windows, e.window]; break;
    case 'PricePointAdded': this._prices = [...this._prices, e.price]; break;
    case 'ZoneSuitabilitySet': this._zones = [...this._zones.filter((z) => z.zoneId !== e.suitability.zoneId), e.suitability]; break;
    case 'PestControlSet': this._pests = [...this._pests.filter((p) => p.pestId !== e.control.pestId), e.control]; break;
    ```

- [ ] **Step 5 : Lancer → passent** (nouveaux tests sections).

Run: `pnpm --filter @okko/api test -- crop.events`
Expected: PASS.

- [ ] **Step 6 : Non-régression domaine** — `pnpm --filter @okko/api test -- crop.spec crop-status` → PASS (inchangés). Et `pnpm --filter @okko/api build` (ou `npx tsc --noEmit` dans apps/api) → zéro erreur (l'agrégat est importé largement).

- [ ] **Step 7 : Commit**

```bash
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.events.spec.ts
git commit -m "feat(api): agrégat Crop absorbe les sections (5 événements + apply push/upsert)"
```

---

## Task 2 : Event-sourcer les ajouts — variété / fenêtre / prix (+ DI + specs)

**Files:**
- Modify: `apps/api/src/application/crop/add-variety.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/application/window/add-cropping-window.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/application/price/add-price-point.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/crop.module.ts` (DI des 3 providers)

**Interfaces:**
- Consumes : `CropEventStore` (`CROP_EVENT_STORE`), les repos de section existants, `IdGenerator`, `AuditLogRepository`, `Clock`, (`ZoneRepository` pour la fenêtre).

**Patron** : remplacer la vérif d'existence `crops.findById` par `events.load` non vide ; construire l'entité (id via `ids`) ; `crop = Crop.fromEvents(stored)` ; `crop.addXxx(snap)` ; `append(cropId, stored.length, pull…)` ; `sectionRepo.save(snap)` ; audit (inchangé) ; renvoyer `snap`. `events: CropEventStore` devient le **1er** paramètre de constructeur (remplace `crops`).

- [ ] **Step 1 : Réécrire `add-variety.use-case.ts`** :

```ts
import { Variety, VarietySnapshot } from '../../domain/crop/variety';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from './crop-event-store';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';
import { IdGenerator } from '../shared/id-generator';

// AddVarietyInput inchangé

export class AddVarietyUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddVarietyInput): Promise<VarietySnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const variety = Variety.create({
      id: input.id ?? this.ids.next(), cropId: input.cropId,
      name: TranslatableText.create(input.name), maturityDays: input.maturityDays,
      yieldPotential: input.yieldPotential ? RangeValue.create(input.yieldPotential) : undefined,
      traits: input.traits,
    });
    const snap = variety.toSnapshot();
    const crop = Crop.fromEvents(stored);
    crop.addVariety(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.varieties.save(snap);
    await this.audit.record({ entityType: 'Variety', entityId: variety.id, actor: input.actor, at, changes: { created: snap } });
    return snap;
  }
}
```

- [ ] **Step 2 : Réécrire `add-cropping-window.use-case.ts`** — même patron, mais **conserver** la vérif zone : après le check `stored.length === 0`, garder `if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);`. Constructeur : `(events: CropEventStore, zones: ZoneRepository, windows: CroppingWindowRepository, audit, clock, ids)`. Mutation `crop.addCroppingWindow(snap)`. Audit inchangé (`entityType: 'CroppingWindow'`).

- [ ] **Step 3 : Réécrire `add-price-point.use-case.ts`** — même patron (pas de vérif annexe). Constructeur `(events, prices, audit, clock, ids)`. Mutation `crop.addPricePoint(snap)`. Audit inchangé (`entityType: 'PricePoint'`).

- [ ] **Step 4 : DI dans `crop.module.ts`** — pour les 3 providers, préfixer `inject` par `CROP_EVENT_STORE` (à la place de `CROP_REPOSITORY`) et l'arg `es` en 1er dans `useFactory`. Exemples :
  ```ts
  { provide: AddVarietyUseCase, useFactory: (es, vr, a, c, ids) => new AddVarietyUseCase(es, vr, a, c, ids),
    inject: [CROP_EVENT_STORE, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator] },
  { provide: AddCroppingWindowUseCase, useFactory: (es, zr, wr, a, c, ids) => new AddCroppingWindowUseCase(es, zr, wr, a, c, ids),
    inject: [CROP_EVENT_STORE, ZONE_REPOSITORY, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator] },
  { provide: AddPricePointUseCase, useFactory: (es, pr, a, c, ids) => new AddPricePointUseCase(es, pr, a, c, ids),
    inject: [CROP_EVENT_STORE, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator] },
  ```
  (Lire le module pour récupérer les noms de symboles exacts avant d'éditer.)

- [ ] **Step 5 : Mettre à jour les 3 specs unitaires** — amorcer la culture via `InMemoryCropEventStore` + `CreateCropUseCase` (event-sourcé), construire les use-cases avec `events` en 1er arg. Conserver les assertions (résultat identique). Ces specs **changent** — attendu.

- [ ] **Step 6 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS. Les e2e (`variety-requirements`, `window`, `nutrition-price`) passent **sans modification**.

- [ ] **Step 7 : Commit**

```bash
git add apps/api/src/application/crop/add-variety.use-case.ts apps/api/src/application/crop/add-variety.use-case.spec.ts apps/api/src/application/window/add-cropping-window.use-case.ts apps/api/src/application/window/add-cropping-window.use-case.spec.ts apps/api/src/application/price/add-price-point.use-case.ts apps/api/src/application/price/add-price-point.use-case.spec.ts apps/api/src/crop.module.ts
git commit -m "refactor(api): event-source ajouts variété/fenêtre/prix (projection conservée)"
```

---

## Task 3 : Event-sourcer les upserts — zone / ravageur (+ DI + specs)

**Files:**
- Modify: `apps/api/src/application/zone/set-crop-zone-suitability.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/application/pest/set-crop-pest-control.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/crop.module.ts` (DI des 2 providers)

**Patron** : `events.load` non vide (`CropNotFoundError`) → **conserver** la vérif zone/ravageur → construire le lien (comme aujourd'hui, avec `Provenance`) → `crop.setZoneSuitability(snap)` / `crop.setPestControl(snap)` → `append(cropId, stored.length, pull…)` → `linkRepo.save(snap)` (projection upsert, inchangée) → audit (inchangé). `events` en 1er param (remplace `crops`).

- [ ] **Step 1 : Réécrire `set-crop-zone-suitability.use-case.ts`** :

```ts
export class SetCropZoneSuitabilityUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly zones: ZoneRepository,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropZoneSuitabilityInput): Promise<CropZoneSuitabilitySnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const provenance = input.provenance ? Provenance.fromJSON(input.provenance) : Provenance.manual(input.actor, this.clock.nowIso());
    const suitability = CropZoneSuitability.create({
      cropId: input.cropId, zoneId: input.zoneId, rating: input.rating, justification: input.justification, provenance,
    });
    const snap = suitability.toSnapshot();
    const crop = Crop.fromEvents(stored);
    crop.setZoneSuitability(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.suitabilities.save(snap);
    await this.audit.record({ entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`, actor: input.actor, at, changes: { set: snap } });
    return snap;
  }
}
```
(Importer `Crop` et `CropEventStore`. `ZoneNotFoundError` reste exporté ici comme aujourd'hui.)

- [ ] **Step 2 : Réécrire `set-crop-pest-control.use-case.ts`** — symétrique : `events` en 1er param puis `pests: PestRepository, controls: CropPestControlRepository, audit, clock`. Après `stored.length` check, conserver `if (!(await this.pests.findById(input.pestId))) throw new PestNotFoundError(input.pestId);`. `crop.setPestControl(snap)`. Audit inchangé (`entityType: 'CropPestControl'`, `entityId: \`${cropId}:${pestId}\``).

- [ ] **Step 3 : DI dans `crop.module.ts`** — 2 providers, `CROP_EVENT_STORE` en 1er (à la place de `CROP_REPOSITORY`) :
  ```ts
  { provide: SetCropZoneSuitabilityUseCase, useFactory: (es, z, s, a, c) => new SetCropZoneSuitabilityUseCase(es, z, s, a, c),
    inject: [CROP_EVENT_STORE, ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
  { provide: SetCropPestControlUseCase, useFactory: (es, p, ctrl, a, c) => new SetCropPestControlUseCase(es, p, ctrl, a, c),
    inject: [CROP_EVENT_STORE, PEST_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
  ```

- [ ] **Step 4 : Mettre à jour les 2 specs unitaires** — amorcer via `InMemoryCropEventStore` + `CreateCropUseCase`, construire avec `events` en 1er. Conserver les assertions.

- [ ] **Step 5 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS. e2e zones/ravageurs inchangés verts. À ce stade, **les 5 sections sont event-sourcées**.

- [ ] **Step 6 : Commit**

```bash
git add apps/api/src/application/zone/set-crop-zone-suitability.use-case.ts apps/api/src/application/zone/set-crop-zone-suitability.use-case.spec.ts apps/api/src/application/pest/set-crop-pest-control.use-case.ts apps/api/src/application/pest/set-crop-pest-control.use-case.spec.ts apps/api/src/crop.module.ts
git commit -m "refactor(api): event-source upserts zone/ravageur (upsert par clé)"
```

---

## Task 4 : Vérification finale — repli = fiche complète (e2e)

**Files:**
- Create: `apps/api/test/crop-sections-event-sourcing.e2e-spec.ts`

- [ ] **Step 1 : e2e — `crop-sections-event-sourcing.e2e-spec.ts`.** Mirrorer le bootstrap de `crop.e2e-spec.ts` (module, `PrismaService`, nettoyage `cropEvent`/`crop`/tables de section en `beforeAll`/`afterAll`). Cas :
  - Créer une culture ; ajouter une variété, une zone (créer zone + `PUT /crops/:id/zones/:zoneId`), une fenêtre, un ravageur (créer ravageur + `PUT /crops/:id/pests/:pestId`), un prix.
  - **Assertion flux** : `prisma.cropEvent.findMany({ where: { streamId: cropId }, orderBy: { sequence: 'asc' } })` contient, après `CropCreated`, les types `VarietyAdded`, `ZoneSuitabilitySet`, `CroppingWindowAdded`, `PestControlSet`, `PricePointAdded` ; séquences 1..N contiguës.
  - **Assertion upsert** : refaire un `PUT /crops/:id/zones/:zoneId` sur la **même** zone → un **2e** `ZoneSuitabilitySet` dans le flux, mais `GET /crops/:id` ne montre **qu'une** entrée de zone (upsert projection).
  - **Non-régression** : `GET /crops/:id` renvoie le document complet attendu (variété, zone, fenêtre, ravageur, prix présents) — comportement identique.

- [ ] **Step 2 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS (tout, e2e inclus).

- [ ] **Step 3 : Commit**

```bash
git add apps/api/test/crop-sections-event-sourcing.e2e-spec.ts
git commit -m "test(api): e2e sections event-sourcées (flux peuplé + upsert + non-régression)"
```

---

## Notes de vérification finale (revue de branche)

- **Zéro changement visible** : e2e existants + specs domaine passent **sans modification** ; documents/endpoints identiques.
- **`version` intact** : les événements de section n'incrémentent pas `crop.version` (couvert par `crop.events.spec.ts`).
- **Repli = fiche complète** : un flux mixte reconstitue cœur + 5 sections (getters de l'agrégat) — base du Lot B.
- **Upsert par clé** : zones/ravageurs remplacent par `zoneId`/`pestId` (flux + projection cohérents).
- **DI** : les 5 providers injectent `CROP_EVENT_STORE` en 1er (ordre = constructeur).
- **Périmètre** : versionnage (brouillon/publication) **non** inclus → Lot B ; `AuditLog` conservé.
