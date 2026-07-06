# Event Sourcing du cœur Culture (Lot A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Event-sourcer le cœur de l'agrégat `Crop` (10 mutations) sans aucun changement de comportement visible : chaque mutation émet un événement dans un flux append-only, l'état se reconstruit par repli, la table `Crop` devient une projection.

**Architecture :** Clean architecture existante. Nouveau : union `CropEvent`, port `CropEventStore` (append optimiste + load ordonné) avec adaptateurs in-memory + Prisma. L'agrégat `Crop` gagne `apply`/`fromEvents`/`raise`/`pullPendingEvents`. Les use-cases cœur passent de « load snapshot → muter → save snapshot » à « load events → fromEvents → muter → append events → rafraîchir la projection ». Le `version` domaine (compteur de contenu) reste découplé de la `sequence` d'événements (position/concurrence).

**Tech Stack :** NestJS 10 + TypeScript + Prisma + Jest (TDD).

## Global Constraints

- **Clean architecture** : domaine sans import externe ; port dans `application/**` ; adaptateurs Prisma dans `infrastructure/**`. Ne pas contourner les couches.
- **Zéro changement visible** : les documents et endpoints renvoient exactement la même chose. **Garde-fou nº1** : les specs **domaine** (`crop.spec.ts`, etc.) et **e2e** (`crop.e2e-spec.ts`, etc.) passent **sans modification**. (Les specs **unitaires des use-cases** sont, elles, mises à jour dans ce lot — nouveau constructeur + amorçage par événements ; ce sont des collaborateurs qui changent, pas le comportement.)
- **Sémantique `version`** : `create` → 1 ; mutations de contenu (`ClimaticRequirementsSet`, `EdaphicRequirementsSet`, `PhenologySet`, `NutritionSet`, `YieldsSet`, `Renamed`, `MetadataSet`) → `+1` ; `Published`/`Archived` → **inchangé**. La **`sequence`** (position 1..N dans le flux) est distincte et compte TOUS les événements.
- **Champs immuables** (`_id`, `_scientificName`, `_family`, `_cycleType`) : posés **uniquement au constructeur** (via `create` ou `fromEvents` à partir de `CropCreated`). `apply` ne les touche jamais.
- **Projection** : après chaque `append`, le use-case fait `crops.save(crop.toSnapshot())`. `CROP_REPOSITORY`/`toCropDocument` inchangés.
- **AuditLog conservé** : chaque use-case garde son `audit.record(...)` existant.
- **Départ à neuf** : base vide, aucune migration de données. (Une migration de **schéma** Prisma est nécessaire pour la table `CropEvent`.)
- **Tests** : TDD (rouge d'abord). Après chaque tâche, `pnpm --filter @okko/api test` **entièrement vert**. La suite tourne single-worker (DB partagée) ; ne pas paralléliser. ⚠️ Elle fait `deleteMany` — OK ici (base vide).
- Commits fréquents, préfixe `feat(api):`/`refactor(api):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Créés :**
- `apps/api/src/domain/crop/crop-event.ts` — union `CropEvent`
- `apps/api/src/domain/crop/crop.events.spec.ts` — specs ES de l'agrégat
- `apps/api/src/application/crop/crop-event-store.ts` — port + `StoredCropEvent` + `ConcurrencyError`
- `apps/api/src/application/crop/in-memory-crop-event-store.ts` (+ `.spec.ts`)
- `apps/api/src/infrastructure/crop/prisma-crop-event-store.ts` (+ `apps/api/test/prisma-crop-event-store.int-spec.ts`)

**Modifiés :**
- `apps/api/src/domain/crop/crop.ts` — `apply`/`fromEvents`/`raise`/`pullPendingEvents`, `create` + mutations émettent des événements
- `apps/api/prisma/schema.prisma` (+ migration) — modèle `CropEvent`
- Les 7 use-cases cœur + leurs specs unitaires + leurs providers dans `apps/api/src/crop.module.ts`
- `apps/api/src/presentation/crop/crop.controller.ts` — mappage `ConcurrencyError` → 409

---

## Task 1 : Modèle d'événements + agrégat event-sourcé (domaine, TDD)

**Files:**
- Create: `apps/api/src/domain/crop/crop-event.ts`
- Create: `apps/api/src/domain/crop/crop.events.spec.ts`
- Modify: `apps/api/src/domain/crop/crop.ts`

**Interfaces:**
- Produces : `type CropEvent` (union) ; `Crop.fromEvents(events: { event: CropEvent }[]): Crop` ; `Crop.pullPendingEvents(): CropEvent[]` ; `Crop.create(...)` et les mutations émettent désormais des événements. `toSnapshot`/`fromSnapshot` **conservés**.

- [ ] **Step 1 : Créer `crop-event.ts`**

```ts
import { CycleType } from './cycle-type';
import { ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStageJSON } from './phenological-stage';
import { NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReferenceJSON } from './yield-reference';

export type CropEvent =
  | { type: 'CropCreated'; commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType }
  | { type: 'Renamed'; commonNames: Record<string, string> }
  | { type: 'MetadataSet'; key: string; value: unknown }
  | { type: 'ClimaticRequirementsSet'; climatic: ClimaticRequirementsJSON }
  | { type: 'EdaphicRequirementsSet'; edaphic: EdaphicRequirementsJSON }
  | { type: 'PhenologySet'; phenology: PhenologicalStageJSON[] }
  | { type: 'NutritionSet'; nutrition: NutrientRequirementJSON[] }
  | { type: 'YieldsSet'; yields: YieldReferenceJSON[] }
  | { type: 'Published' }
  | { type: 'Archived' };
```

- [ ] **Step 2 : Test qui échoue — `crop.events.spec.ts`**

```ts
import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { ClimaticRequirements } from '../shared/climatic-requirements';

const make = () => Crop.create({
  id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }),
  scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
});
const stored = (events: ReturnType<Crop['pullPendingEvents']>) => events.map((event) => ({ event, streamId: 'c1' }));

describe('Crop event sourcing', () => {
  it('create émet CropCreated et le tampon se vide', () => {
    const c = make();
    const evs = c.pullPendingEvents();
    expect(evs).toEqual([{ type: 'CropCreated', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL }]);
    expect(c.pullPendingEvents()).toEqual([]); // vidé
  });

  it('une mutation de contenu émet son événement et incrémente version', () => {
    const c = make(); c.pullPendingEvents();
    c.setClimaticRequirements(ClimaticRequirements.fromJSON({ temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } }));
    const evs = c.pullPendingEvents();
    expect(evs[0].type).toBe('ClimaticRequirementsSet');
    expect(c.version).toBe(2);
  });

  it('publish émet Published sans changer version', () => {
    const c = make(); c.pullPendingEvents();
    c.publish();
    expect(c.pullPendingEvents()).toEqual([{ type: 'Published' }]);
    expect(c.version).toBe(1);
    expect(c.status).toBe('PUBLISHED');
  });

  it('fromEvents reconstruit un état identique à la même séquence de mutations', () => {
    const built = make();
    built.setClimaticRequirements(ClimaticRequirements.fromJSON({ temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } }));
    built.publish();
    const events = stored(built.pullPendingEvents());
    const rebuilt = Crop.fromEvents(events);
    expect(rebuilt.toSnapshot()).toEqual(built.toSnapshot());
  });
});
```

- [ ] **Step 3 : Lancer → échoue** (`pullPendingEvents`/`fromEvents` absents).

Run: `pnpm --filter @okko/api test -- crop.events`
Expected: FAIL.

- [ ] **Step 4 : Modifier `crop.ts`** — ajouter le tampon, `raise`, `apply`, `fromEvents`, `pullPendingEvents`, et faire émettre `create` + les mutations. Détails :
  - Importer `CropEvent` (`import { CropEvent } from './crop-event';`).
  - Ajouter un champ `private _pending: CropEvent[] = [];` (initialisé à la déclaration, hors constructeur, pour ne pas changer la signature du constructeur privé).
  - `create(props)` : construire l'instance comme aujourd'hui **puis** `crop._pending.push({ type: 'CropCreated', commonNames: props.commonNames.toJSON(), scientificName: props.scientificName, family: props.family, cycleType: props.cycleType });` avant de la retourner. (Le constructeur a déjà posé l'état ; on n'`apply` pas `CropCreated`.)
  - Remplacer le corps de **chaque mutation** par un `this.raise(...)`. Exemples :
    ```ts
    setClimaticRequirements(c: ClimaticRequirements): void { this.raise({ type: 'ClimaticRequirementsSet', climatic: c.toJSON() }); }
    setEdaphicRequirements(e: EdaphicRequirements): void { this.raise({ type: 'EdaphicRequirementsSet', edaphic: e.toJSON() }); }
    setPhenology(stages: PhenologicalStage[]): void { this.raise({ type: 'PhenologySet', phenology: stages.map((s) => s.toJSON()) }); }
    setNutrition(list: NutrientRequirement[]): void { this.raise({ type: 'NutritionSet', nutrition: list.map((n) => n.toJSON()) }); }
    setYields(list: YieldReference[]): void { this.raise({ type: 'YieldsSet', yields: list.map((y) => y.toJSON()) }); }
    rename(commonNames: TranslatableText): void { this.raise({ type: 'Renamed', commonNames: commonNames.toJSON() }); }
    setMetadata(key: string, value: unknown): void { this.raise({ type: 'MetadataSet', key, value }); }
    publish(): void { assertCanTransition(this._status, CropStatus.PUBLISHED); this.raise({ type: 'Published' }); }
    archive(): void { assertCanTransition(this._status, CropStatus.ARCHIVED); this.raise({ type: 'Archived' }); }
    ```
  - Ajouter `raise` + `apply` + `pullPendingEvents` :
    ```ts
    private raise(e: CropEvent): void { this.apply(e); this._pending.push(e); }
    pullPendingEvents(): CropEvent[] { const p = this._pending; this._pending = []; return p; }

    private apply(e: CropEvent): void {
      switch (e.type) {
        case 'ClimaticRequirementsSet': this._climatic = ClimaticRequirements.fromJSON(e.climatic); this._version += 1; break;
        case 'EdaphicRequirementsSet': this._edaphic = EdaphicRequirements.fromJSON(e.edaphic); this._version += 1; break;
        case 'PhenologySet': this._phenology = e.phenology.map((j) => PhenologicalStage.fromJSON(j)); this._version += 1; break;
        case 'NutritionSet': this._nutrition = e.nutrition.map((j) => NutrientRequirement.fromJSON(j)); this._version += 1; break;
        case 'YieldsSet': this._yields = e.yields.map((j) => YieldReference.fromJSON(j)); this._version += 1; break;
        case 'Renamed': this._commonNames = TranslatableText.create(e.commonNames); this._version += 1; break;
        case 'MetadataSet': this._metadata = { ...this._metadata, [e.key]: e.value }; this._version += 1; break;
        case 'Published': this._status = CropStatus.PUBLISHED; break;
        case 'Archived': this._status = CropStatus.ARCHIVED; break;
        case 'CropCreated': /* posé au constructeur, jamais rejoué ici */ break;
      }
    }
    ```
  - Ajouter `fromEvents`. **L'id de l'agrégat = le `streamId` du flux** (les événements ne répètent pas l'id). `fromEvents` reçoit des `StoredCropEvent` (qui portent `streamId`) ; il construit la base depuis `CropCreated` avec `stored[0].streamId`, puis `apply` le reste :
    ```ts
    static fromEvents(stored: { event: CropEvent; streamId: string }[]): Crop {
      if (stored.length === 0 || stored[0].event.type !== 'CropCreated') {
        throw new Error('Crop stream must start with CropCreated');
      }
      const c = stored[0].event; // type CropCreated
      const crop = new Crop(
        stored[0].streamId,
        TranslatableText.create(c.commonNames), c.scientificName, c.family, c.cycleType,
        CropStatus.DRAFT, 1, {}, undefined, undefined, [], [], [],
      );
      for (let i = 1; i < stored.length; i++) crop.apply(stored[i].event);
      return crop;
    }
    ```
    Le paramètre est typé `{ event: CropEvent; streamId: string }[]` — compatible avec `StoredCropEvent[]` (Task 2). Le helper `stored()` du test (Step 2) fournit déjà `streamId: 'c1'`, donc `rebuilt.toSnapshot().id === 'c1'` comme `built`.

- [ ] **Step 5 : Lancer → passent** (`crop.events.spec.ts`).

Run: `pnpm --filter @okko/api test -- crop.events`
Expected: PASS.

- [ ] **Step 6 : Vérifier la non-régression domaine** — les specs existantes de l'agrégat passent toujours (comportement de `toSnapshot`/`version`/`status` inchangé).

Run: `pnpm --filter @okko/api test -- crop.spec crop-status`
Expected: PASS (inchangés).

- [ ] **Step 7 : Commit**

```bash
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.events.spec.ts apps/api/src/domain/crop/crop.ts
git commit -m "feat(api): agrégat Crop event-sourcé (apply/fromEvents/raise) + modèle d'événements"
```

---

## Task 2 : Port `CropEventStore` + adaptateur in-memory (TDD)

**Files:**
- Create: `apps/api/src/application/crop/crop-event-store.ts`
- Create: `apps/api/src/application/crop/in-memory-crop-event-store.ts`
- Create: `apps/api/src/application/crop/in-memory-crop-event-store.spec.ts`

**Interfaces:**
- Produces : `CROP_EVENT_STORE` (Symbol) ; `StoredCropEvent = { streamId: string; sequence: number; event: CropEvent; actor: string; at: string }` ; `class ConcurrencyError extends Error` ; `interface CropEventStore { append(streamId, expectedSequence, entries): Promise<void>; load(streamId): Promise<StoredCropEvent[]> }` où `entries: { event: CropEvent; actor: string; at: string }[]`.

- [ ] **Step 1 : Créer `crop-event-store.ts`**

```ts
import { CropEvent } from '../../domain/crop/crop-event';

export const CROP_EVENT_STORE = Symbol('CROP_EVENT_STORE');

export interface StoredCropEvent {
  streamId: string;
  sequence: number;
  event: CropEvent;
  actor: string;
  at: string;
}

export class ConcurrencyError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Concurrency conflict: expected sequence ${expected}, found ${actual}`);
    this.name = 'ConcurrencyError';
  }
}

export interface CropEventStore {
  // expectedSequence = dernière séquence connue du flux (0 pour un flux neuf).
  append(streamId: string, expectedSequence: number, entries: { event: CropEvent; actor: string; at: string }[]): Promise<void>;
  load(streamId: string): Promise<StoredCropEvent[]>; // ordonné par sequence croissante
}
```

- [ ] **Step 2 : Test qui échoue — `in-memory-crop-event-store.spec.ts`**

```ts
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { ConcurrencyError } from './crop-event-store';

const entry = (t: string, actor = 'a') => ({ event: { type: t } as any, actor, at: '2026-07-06T00:00:00.000Z' });

describe('InMemoryCropEventStore', () => {
  it('append puis load renvoie les événements ordonnés avec séquence 1..N', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated'), entry('Published')]);
    const loaded = await s.load('c1');
    expect(loaded.map((e) => e.sequence)).toEqual([1, 2]);
    expect(loaded.map((e) => e.event.type)).toEqual(['CropCreated', 'Published']);
  });

  it('rejette (ConcurrencyError) si expectedSequence est périmé', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated')]);
    await expect(s.append('c1', 0, [entry('Published')])).rejects.toBeInstanceOf(ConcurrencyError);
    await s.append('c1', 1, [entry('Published')]); // séquence correcte -> OK
    expect((await s.load('c1')).length).toBe(2);
  });

  it('les flux sont indépendants', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated')]);
    await s.append('c2', 0, [entry('CropCreated')]);
    expect((await s.load('c1')).length).toBe(1);
    expect((await s.load('c2')).length).toBe(1);
  });
});
```

- [ ] **Step 3 : Lancer → échoue.** `pnpm --filter @okko/api test -- in-memory-crop-event-store` → FAIL.

- [ ] **Step 4 : Implémenter `in-memory-crop-event-store.ts`**

```ts
import { CropEventStore, StoredCropEvent, ConcurrencyError } from './crop-event-store';
import { CropEvent } from '../../domain/crop/crop-event';

export class InMemoryCropEventStore implements CropEventStore {
  private streams = new Map<string, StoredCropEvent[]>();

  async append(streamId: string, expectedSequence: number, entries: { event: CropEvent; actor: string; at: string }[]): Promise<void> {
    const cur = this.streams.get(streamId) ?? [];
    if (cur.length !== expectedSequence) throw new ConcurrencyError(expectedSequence, cur.length);
    const appended = entries.map((e, i) => ({ streamId, sequence: cur.length + i + 1, event: e.event, actor: e.actor, at: e.at }));
    this.streams.set(streamId, [...cur, ...appended]);
  }

  async load(streamId: string): Promise<StoredCropEvent[]> {
    return [...(this.streams.get(streamId) ?? [])];
  }
}
```

- [ ] **Step 5 : Lancer → passent.** `pnpm --filter @okko/api test -- in-memory-crop-event-store` → PASS (3 tests).

- [ ] **Step 6 : Commit**

```bash
git add apps/api/src/application/crop/crop-event-store.ts apps/api/src/application/crop/in-memory-crop-event-store.ts apps/api/src/application/crop/in-memory-crop-event-store.spec.ts
git commit -m "feat(api): port CropEventStore + adaptateur in-memory (concurrence optimiste)"
```

---

## Task 3 : Table Prisma `CropEvent` + adaptateur Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: (migration Prisma générée)
- Create: `apps/api/src/infrastructure/crop/prisma-crop-event-store.ts`
- Create: `apps/api/test/prisma-crop-event-store.int-spec.ts`

**Interfaces:**
- Consumes : `CropEventStore`, `StoredCropEvent`, `ConcurrencyError` (Task 2), `PrismaService`.

- [ ] **Step 1 : Ajouter le modèle dans `schema.prisma`**

```prisma
model CropEvent {
  id        String   @id @default(uuid())
  streamId  String
  sequence  Int
  type      String
  payload   Json
  actor     String
  at        DateTime

  @@unique([streamId, sequence])
  @@index([streamId])
}
```

- [ ] **Step 2 : Générer la migration**

Run: `pnpm --filter @okko/api exec prisma migrate dev --name crop_event_store`
Expected: migration créée + client régénéré. (Si le projet utilise `db push`, adapter : `prisma db push` puis `prisma generate`.)

- [ ] **Step 3 : Implémenter `prisma-crop-event-store.ts`** (mirrorer un adaptateur Prisma existant, ex. `prisma-zone.repository.ts`)

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropEventStore, StoredCropEvent, ConcurrencyError } from '../../application/crop/crop-event-store';
import { CropEvent } from '../../domain/crop/crop-event';

@Injectable()
export class PrismaCropEventStore implements CropEventStore {
  constructor(private readonly prisma: PrismaService) {}

  async append(streamId: string, expectedSequence: number, entries: { event: CropEvent; actor: string; at: string }[]): Promise<void> {
    const count = await this.prisma.cropEvent.count({ where: { streamId } });
    if (count !== expectedSequence) throw new ConcurrencyError(expectedSequence, count);
    try {
      await this.prisma.cropEvent.createMany({
        data: entries.map((e, i) => ({
          streamId, sequence: count + i + 1, type: e.event.type,
          payload: e.event as unknown as Prisma.InputJsonValue, actor: e.actor, at: new Date(e.at),
        })),
      });
    } catch (err) {
      // violation d'unicité (streamId, sequence) = conflit concurrent
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConcurrencyError(expectedSequence, count);
      }
      throw err;
    }
  }

  async load(streamId: string): Promise<StoredCropEvent[]> {
    const rows = await this.prisma.cropEvent.findMany({ where: { streamId }, orderBy: { sequence: 'asc' } });
    return rows.map((r) => ({
      streamId: r.streamId, sequence: r.sequence,
      event: r.payload as unknown as CropEvent, actor: r.actor, at: r.at.toISOString(),
    }));
  }
}
```

- [ ] **Step 4 : Int-spec — `apps/api/test/prisma-crop-event-store.int-spec.ts`.** Mirrorer un int-spec Prisma existant (ex. `prisma-zone.repository.int-spec.ts`) pour le bootstrap `PrismaService` + nettoyage (`prisma.cropEvent.deleteMany()` en `beforeEach`). Cas : `append` puis `load` renvoie les événements ordonnés (payload rond-trip) ; `append` avec `expectedSequence` périmé → `ConcurrencyError`.

- [ ] **Step 5 : Lancer → vert.** `pnpm --filter @okko/api test -- prisma-crop-event-store` → PASS.

- [ ] **Step 6 : Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/infrastructure/crop/prisma-crop-event-store.ts apps/api/test/prisma-crop-event-store.int-spec.ts
git commit -m "feat(api): table CropEvent + adaptateur Prisma CropEventStore"
```

---

## Task 4 : Event-sourcer create / publish / update (+ providers + specs)

**Files:**
- Modify: `apps/api/src/application/crop/create-crop.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/application/crop/publish-crop.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/application/crop/update-crop.use-case.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/crop.module.ts` (provider `CROP_EVENT_STORE` + injecter le store dans ces 3 use-cases)

**Interfaces:**
- Consumes : `CropEventStore` (`CROP_EVENT_STORE`), `CropRepository` (projection), `AuditLogRepository`, `Clock`.

**Patron de réécriture** (charger les événements → reconstruire → muter → append → rafraîchir la projection → audit). Chaque use-case gagne `private readonly events: CropEventStore` en **premier** paramètre de constructeur.

- [ ] **Step 1 : Réécrire `create-crop.use-case.ts`**

```ts
// imports : ajouter CropEventStore
import { CropEventStore } from './crop-event-store';
// ...
export class CreateCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateCropInput): Promise<CropSnapshot> {
    const crop = Crop.create({
      id: input.id,
      commonNames: TranslatableText.create(input.commonNames),
      scientificName: input.scientificName, family: input.family, cycleType: input.cycleType,
    });
    const at = this.clock.nowIso();
    await this.events.append(input.id, 0, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const snapshot = crop.toSnapshot();
    await this.crops.save(snapshot);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { created: snapshot } });
    return snapshot;
  }
}
```

- [ ] **Step 2 : Réécrire `publish-crop.use-case.ts`** (garde `CropNotFoundError` exporté ici) :

```ts
export class PublishCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.publish(); // valide la transition + émet Published
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { status: 'PUBLISHED' } });
    return next;
  }
}
```

- [ ] **Step 3 : Réécrire `update-crop.use-case.ts`** — même patron : `load` → `fromEvents` → `if (commonNames) crop.rename(...)` / `if (metadata) for (…) crop.setMetadata(k,v)` → `append(id, stored.length, pull…)` → `crops.save` → audit (conserver la construction `changes` existante à partir de `snap`=`stored`-reconstruit et `next`). Pour le `from` de l'audit, reconstruire `const before = crop0.toSnapshot()` **avant** mutation (garder une copie) ou lire depuis la projection `crops.findById` uniquement pour l'audit ; le plus simple : `const before = Crop.fromEvents(stored).toSnapshot();` puis muter une seconde instance — ou capturer `before` avant d'appeler les mutations sur la même instance. Choix : capturer `const before = crop.toSnapshot();` juste après `fromEvents`, avant les mutations.

- [ ] **Step 4 : Câbler dans `crop.module.ts`** — ajouter l'import et le provider du store, et injecter le store dans les 3 use-cases réécrits :

```ts
import { CROP_EVENT_STORE } from './application/crop/crop-event-store';
import { PrismaCropEventStore } from './infrastructure/crop/prisma-crop-event-store';
// dans providers :
{ provide: CROP_EVENT_STORE, useClass: PrismaCropEventStore },
// et modifier les 3 providers concernés, ex. :
{
  provide: CreateCropUseCase,
  useFactory: (es, r, a, c) => new CreateCropUseCase(es, r, a, c),
  inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
},
// idem PublishCropUseCase et UpdateCropUseCase : préfixer inject par CROP_EVENT_STORE et l'arg es.
```

- [ ] **Step 5 : Mettre à jour les specs unitaires des 3 use-cases** — elles construisent le use-case et amorcent l'état. Nouveau patron d'amorçage : instancier `const events = new InMemoryCropEventStore()` et amorcer via `CreateCropUseCase` (ou en appendant directement le `CropCreated`). Construire les use-cases avec `new XUseCase(events, crops, audit, clock)`. Adapter les assertions inchangées (résultat identique). (Ces specs **changent** — c'est attendu : leurs collaborateurs ont changé.)

- [ ] **Step 6 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS (existants + adaptés). Les e2e (`crop.e2e-spec.ts`) passent **sans modification** — preuve du zéro changement visible pour create/publish/update.

- [ ] **Step 7 : Commit**

```bash
git add apps/api/src/application/crop/create-crop.use-case.ts apps/api/src/application/crop/create-crop.use-case.spec.ts apps/api/src/application/crop/publish-crop.use-case.ts apps/api/src/application/crop/publish-crop.use-case.spec.ts apps/api/src/application/crop/update-crop.use-case.ts apps/api/src/application/crop/update-crop.use-case.spec.ts apps/api/src/crop.module.ts
git commit -m "refactor(api): event-source create/publish/update (projection + audit conservés)"
```

---

## Task 5 : Event-sourcer requirements / phenology / nutrition / yields

**Files:**
- Modify (chacun + son `.spec.ts`) : `set-crop-requirements.use-case.ts`, `set-crop-phenology.use-case.ts`, `set-crop-nutrition.use-case.ts`, `set-crop-yields.use-case.ts`
- Modify: `apps/api/src/crop.module.ts` (injecter `CROP_EVENT_STORE` dans ces 4 providers)

**Interfaces:** identiques à Task 4 (les 4 use-cases gagnent `events: CropEventStore` en 1er paramètre).

Les 4 suivent **exactement** le patron de `publish` (Task 4 Step 2) : `load` → `if empty throw CropNotFoundError` → `fromEvents` → capturer `before = crop.toSnapshot()` pour l'audit → muter → `append(id, stored.length, pull…)` → `crops.save(next)` → audit (conserver la forme `changes` existante, `from: before.X`, `to: next.X`).

- [ ] **Step 1 : Réécrire `set-crop-requirements.use-case.ts`** — exemple complet :

```ts
export class SetCropRequirementsUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropRequirementsInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    if (input.climatic) crop.setClimaticRequirements(ClimaticRequirements.fromJSON(input.climatic));
    if (input.edaphic) crop.setEdaphicRequirements(EdaphicRequirements.fromJSON(input.edaphic));
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor, at,
      changes: { from: { climatic: before.climatic, edaphic: before.edaphic }, to: { climatic: next.climatic, edaphic: next.edaphic } },
    });
    return next;
  }
}
```

- [ ] **Step 2 : Réécrire `set-crop-phenology.use-case.ts`** — même patron, mutation `crop.setPhenology(input.stages.map(...))`, audit `changes: { phenology: { from: before.phenology, to: next.phenology } }`.

- [ ] **Step 3 : Réécrire `set-crop-nutrition.use-case.ts`** — mutation `crop.setNutrition(...)`, audit `{ nutrition: { from: before.nutrition, to: next.nutrition } }`.

- [ ] **Step 4 : Réécrire `set-crop-yields.use-case.ts`** — mutation `crop.setYields(...)`, audit `{ yields: { from: before.yields, to: next.yields } }`.

- [ ] **Step 5 : Câbler les 4 providers dans `crop.module.ts`** — préfixer chaque `inject` par `CROP_EVENT_STORE` et l'arg `es` dans le `useFactory` (ex. `useFactory: (es, r, a, c) => new SetCropRequirementsUseCase(es, r, a, c)`).

- [ ] **Step 6 : Mettre à jour les 4 specs unitaires** — amorcer via `InMemoryCropEventStore` + `CreateCropUseCase` (ou append direct du `CropCreated`), construire avec le store en 1er arg (comme Task 4 Step 5).

- [ ] **Step 7 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS. e2e inchangés verts. À ce stade, **tous les use-cases cœur sont event-sourcés**.

- [ ] **Step 8 : Commit**

```bash
git add apps/api/src/application/crop/set-crop-requirements.use-case.ts apps/api/src/application/crop/set-crop-requirements.use-case.spec.ts apps/api/src/application/crop/set-crop-phenology.use-case.ts apps/api/src/application/crop/set-crop-phenology.use-case.spec.ts apps/api/src/application/crop/set-crop-nutrition.use-case.ts apps/api/src/application/crop/set-crop-nutrition.use-case.spec.ts apps/api/src/application/crop/set-crop-yields.use-case.ts apps/api/src/application/crop/set-crop-yields.use-case.spec.ts apps/api/src/crop.module.ts
git commit -m "refactor(api): event-source requirements/phenology/nutrition/yields"
```

---

## Task 6 : Mappage `ConcurrencyError` → 409 + vérification finale

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Create: `apps/api/test/crop-event-sourcing.e2e-spec.ts`

- [ ] **Step 1 : Mapper `ConcurrencyError` → 409** — dans `crop.controller.ts`, importer `ConcurrencyError` (`../../application/crop/crop-event-store`) et `ConflictException` (déjà importé), et dans les `catch` des endpoints de mutation, ajouter `if (e instanceof ConcurrencyError) throw new ConflictException(e.message);`. (Un helper partagé `mapCropError(e, id)` est acceptable pour éviter la répétition, tant qu'il préserve le mappage existant `CropNotFoundError`→404 / `CropStatusError`→409.)

- [ ] **Step 2 : e2e de bout en bout — `crop-event-sourcing.e2e-spec.ts`.** Mirrorer le bootstrap de `crop.e2e-spec.ts`. Cas : créer une culture (POST), la modifier plusieurs fois (PATCH requirements/phenology…), publier ; puis vérifier via une requête directe au store (ou un endpoint existant) que le **flux d'événements** contient la séquence attendue (`CropCreated`, `ClimaticRequirementsSet`, …, `Published`) et que `GET /crops/:id` renvoie le document attendu (comportement identique). Assez d'un test de non-régression + un test « le flux est bien peuplé » (via `PrismaService.cropEvent.findMany`).

- [ ] **Step 3 : Lancer TOUTE la suite → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS (tout, e2e inclus).

- [ ] **Step 4 : Commit**

```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/test/crop-event-sourcing.e2e-spec.ts
git commit -m "feat(api): ConcurrencyError -> 409 + e2e event sourcing du cœur Culture"
```

---

## Notes de vérification finale (revue de branche)

- **Zéro changement visible** : `crop.e2e-spec.ts` et les specs domaine passent **sans modification** ; documents et endpoints identiques.
- **`version` préservé** : create=1, mutations de contenu +1, publish/archive +0 (couvert par `crop.events.spec.ts` + specs existantes).
- **Source de vérité** : chaque mutation cœur appende un événement ; la projection `Crop` est rafraîchie après append (les deux cohérents).
- **Concurrence** : `expectedSequence` périmé → `ConcurrencyError` → 409 ; unicité `(streamId, sequence)` en base.
- **Périmètre** : sections (variétés/fenêtres/zones/ravageurs/prix) **non** event-sourcées (lot ultérieur) ; aucune fonctionnalité visible ajoutée ; `AuditLog` conservé.
