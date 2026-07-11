# Restauration d'une version publiée (Lot C2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recharger le contenu d'une version publiée passée dans le brouillon, via une généralisation de la mécanique de point de contrôle du Lot B (map par révision) et un endpoint `POST /crops/:id/versions/:revision/restore`.

**Architecture :** L'agrégat garde désormais un point de contrôle **par révision** (`Map<revision, état>`) au lieu d'un seul ; `restoreDraft(N)` émet un événement `DraftRestored{N}` qui restaure l'état de la révision N au repli. `DraftDiscarded` devient le cas particulier « restaurer la dernière révision ». Un helper partagé reconstruit les projections (cœur + 5 sections), utilisé par l'abandon et la restauration. Le flux d'événements reste la source de vérité (source **sans perte**).

**Tech Stack :** NestJS 10 + TypeScript + Prisma + Jest.

## Global Constraints

- **Flux d'événements = source de vérité, sans perte** ; les points de contrôle tiennent les **snapshots de section complets** (pas la vue composée appauvrie de C1). La restauration ne lit **pas** `PublishedCrop`.
- **`version` (compteur de contenu) et statut inchangés** ; restaurer **ne publie pas** (`_hasPublishedVersion` et la dernière révision intacts, statut reste `PUBLISHED`).
- **Sémantique des drapeaux** : restaurer la **dernière** révision → `hasUnpublishedChanges=false` ; une **antérieure** → `true`.
- **`DraftDiscarded` : comportement préservé** (revient à la dernière version publiée), réimplémenté via le mécanisme généralisé — la non-régression est testée.
- **Mapping HTTP** : `CropNotFoundError → 404`, `NoPublishedVersionError → 409` (existant), **`RevisionNotFoundError → 404`** (ajout).
- **Pas de changement de schéma** (aucune migration).
- **Tests** : TDD (rouge d'abord). Après **chaque tâche**, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`. Suite single-worker ; ⚠️ `deleteMany` vide la base de dev — OK.
- Commits `feat(api):`/`refactor(api):`/`test(api):`. Terminer **chaque** message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Modifiés :**
- `src/domain/crop/crop-event.ts` — variante `DraftRestored`.
- `src/domain/crop/crop.ts` — map de points de contrôle, `_publishedRevision`, `restoreDraft`, `restoreFromCheckpoint`, `RevisionNotFoundError`, `apply`.
- `src/domain/crop/crop.events.spec.ts` — tests domaine.
- `src/application/crop/discard-draft.use-case.ts` — utilise le helper partagé.
- `src/crop.module.ts` — DI de `RestoreDraftUseCase`.
- `src/presentation/crop/crop.controller.ts` — endpoint restore + `mapCropError`.

**Créés :**
- `src/application/crop/rebuild-crop-projections.ts` — helper partagé.
- `src/application/crop/restore-draft.use-case.ts` (+ `.spec.ts`).
- `test/crop-restore.e2e-spec.ts`.

---

## Task 1 : Agrégat — points de contrôle par révision + `restoreDraft` (domaine, TDD)

**Files:**
- Modify: `src/domain/crop/crop-event.ts`
- Modify: `src/domain/crop/crop.ts`
- Modify: `src/domain/crop/crop.events.spec.ts`

**Interfaces:**
- Produces : événement `{ type: 'DraftRestored'; revision: number }` ; `Crop.restoreDraft(revision: number): void` ; `RevisionNotFoundError` exporté depuis `crop.ts`. `discardDraft`/`toSnapshot`/`fromSnapshot` inchangés en signature.

- [ ] **Step 1 : Ajouter la variante d'événement** dans `crop-event.ts`. Remplacer la fin de l'union `  | { type: 'DraftDiscarded' };` par :
```ts
  | { type: 'DraftDiscarded' }
  | { type: 'DraftRestored'; revision: number };
```

- [ ] **Step 2 : Écrire les tests qui échouent** — ajouter dans le `describe('Crop draft/published editorial safety', ...)` de `crop.events.spec.ts` (réutiliser `make()`/`v()` déjà présents ; importer `RevisionNotFoundError` depuis `./crop`) :
```ts
  it('restoreDraft ramène le brouillon à l\'état d\'une révision antérieure et marque des modifs', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();                 // révision 1 = {a}
    c.addVariety(v('b'));
    c.publish();                 // révision 2 = {a,b}
    expect(c.hasUnpublishedChanges).toBe(false);
    c.restoreDraft(1);
    expect(c.varieties).toEqual([v('a')]);
    expect(c.hasUnpublishedChanges).toBe(true); // diffère de la dernière publiée (rév. 2)
  });

  it('restaurer la dernière révision revient à l\'état publié sans modifs (comme un abandon)', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();                 // révision 1
    c.addVariety(v('b'));        // brouillon divergent
    c.restoreDraft(1);
    expect(c.varieties).toEqual([v('a')]);
    expect(c.hasUnpublishedChanges).toBe(false);
  });

  it('restoreDraft lève NoPublishedVersionError si jamais publié', () => {
    const c = make();
    c.addVariety(v('a'));
    expect(() => c.restoreDraft(1)).toThrow(NoPublishedVersionError);
  });

  it('restoreDraft lève RevisionNotFoundError hors bornes', () => {
    const c = make();
    c.publish();                 // seule la révision 1 existe
    expect(() => c.restoreDraft(0)).toThrow(RevisionNotFoundError);
    expect(() => c.restoreDraft(2)).toThrow(RevisionNotFoundError);
  });

  it('repli déterministe : [Published v1, éditions, Published v2, éditions, DraftRestored(1)] == état à v1', () => {
    // Un SEUL drain de pullPendingEvents à la fin, pour que le flux rejoué commence bien par CropCreated.
    const built = make();
    built.addVariety(v('a'));
    built.publish();            // v1 = {a}
    built.addVariety(v('b'));
    built.publish();            // v2 = {a,b}
    built.addVariety(v('c'));
    built.restoreDraft(1);      // retour à {a}
    const rebuilt = Crop.fromEvents(stored(built.pullPendingEvents()));
    expect(rebuilt.varieties).toEqual([v('a')]);
    expect(rebuilt.hasUnpublishedChanges).toBe(true);
  });

  it('non-régression : DraftDiscarded revient toujours à la dernière version publiée', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();
    c.addVariety(v('b'));
    c.discardDraft();
    expect(c.varieties).toEqual([v('a')]);
    expect(c.hasUnpublishedChanges).toBe(false);
  });
```
> ⚠️ Lire le haut de `crop.events.spec.ts` pour la forme exacte de `make()`/`stored()`/`v()` et adapter (ne pas les redéfinir). Vérifier que `NoPublishedVersionError` est déjà importé ; sinon `import { NoPublishedVersionError, RevisionNotFoundError } from './crop';`.

- [ ] **Step 3 : Lancer → échoue.**

Run: `npx jest -- crop.events`
Expected: FAIL (`restoreDraft`/`RevisionNotFoundError` inexistants).

- [ ] **Step 4 : Modifier `crop.ts`.**

4a. Ajouter l'erreur (après `NoPublishedVersionError`) :
```ts
export class RevisionNotFoundError extends Error {
  constructor(public readonly cropId: string, public readonly revision: number) {
    super(`Crop ${cropId} has no published revision ${revision}`);
    this.name = 'RevisionNotFoundError';
  }
}
```

4b. Définir le type du point de contrôle au niveau module (après les imports, avant `export interface CropSnapshot`) — reprend exactement les champs de l'ancien `_publishedCheckpoint` :
```ts
interface Checkpoint {
  commonNames: TranslatableText;
  status: CropStatus;
  version: number;
  metadata: Record<string, unknown>;
  climatic: ClimaticRequirements | undefined;
  edaphic: EdaphicRequirements | undefined;
  phenology: PhenologicalStage[];
  nutrition: NutrientRequirement[];
  yields: YieldReference[];
  varieties: VarietySnapshot[];
  windows: CroppingWindowSnapshot[];
  zones: CropZoneSuitabilitySnapshot[];
  pests: CropPestControlSnapshot[];
  prices: PricePointSnapshot[];
}
```

4c. Remplacer le champ `private _publishedCheckpoint?: { ... };` (le bloc entier lignes ~58-74) par :
```ts
  private _publishedRevision = 0;
  private _checkpoints = new Map<number, Checkpoint>();
```

4d. Remplacer `captureCheckpoint`/`restoreCheckpoint` par :
```ts
  private captureCheckpoint(): void {
    this._checkpoints.set(this._publishedRevision, {
      commonNames: this._commonNames, status: this._status, version: this._version,
      metadata: { ...this._metadata }, climatic: this._climatic, edaphic: this._edaphic,
      phenology: [...this._phenology], nutrition: [...this._nutrition], yields: [...this._yields],
      varieties: [...this._varieties], windows: [...this._windows], zones: [...this._zones],
      pests: [...this._pests], prices: [...this._prices],
    });
  }

  private restoreFromCheckpoint(revision: number): void {
    const cp = this._checkpoints.get(revision)!;
    this._commonNames = cp.commonNames; this._status = cp.status; this._version = cp.version;
    this._metadata = { ...cp.metadata }; this._climatic = cp.climatic; this._edaphic = cp.edaphic;
    this._phenology = [...cp.phenology]; this._nutrition = [...cp.nutrition]; this._yields = [...cp.yields];
    this._varieties = [...cp.varieties]; this._windows = [...cp.windows]; this._zones = [...cp.zones];
    this._pests = [...cp.pests]; this._prices = [...cp.prices];
    this._hasUnpublishedChanges = (revision !== this._publishedRevision);
  }
```

4e. Ajouter la mutation `restoreDraft` (près de `discardDraft`) :
```ts
  restoreDraft(revision: number): void {
    if (!this._hasPublishedVersion) throw new NoPublishedVersionError(this._id);
    if (!this._checkpoints.has(revision)) throw new RevisionNotFoundError(this._id, revision);
    this.raise({ type: 'DraftRestored', revision });
  }
```

4f. Dans `apply`, remplacer les cas `Published` et `DraftDiscarded` et ajouter `DraftRestored` :
```ts
      case 'Published': this._status = CropStatus.PUBLISHED; this._hasPublishedVersion = true; this._hasUnpublishedChanges = false; this._publishedRevision += 1; this.captureCheckpoint(); break;
      case 'DraftDiscarded': this.restoreFromCheckpoint(this._publishedRevision); break;
      case 'DraftRestored': this.restoreFromCheckpoint(e.revision); break;
```

> `fromSnapshot` ne change pas : la map et `_publishedRevision` sont de l'état dérivé du repli (comme l'ancien checkpoint) ; la garde existante reste valable (restauration/abandon toujours via `fromEvents`).

- [ ] **Step 5 : Lancer les nouveaux tests → passent.**

Run: `npx jest -- crop.events`
Expected: PASS.

- [ ] **Step 6 : Non-régression domaine + typage.**

Run: `npx jest -- src/domain && npx tsc --noEmit`
Expected: PASS, zéro erreur TS.

- [ ] **Step 7 : Commit**
```bash
git add src/domain/crop/crop-event.ts src/domain/crop/crop.ts src/domain/crop/crop.events.spec.ts
git commit -m "feat(api): agrégat Crop — points de contrôle par révision + restoreDraft

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Helper partagé + `RestoreDraftUseCase` + DI (application, TDD)

**Files:**
- Create: `src/application/crop/rebuild-crop-projections.ts`
- Modify: `src/application/crop/discard-draft.use-case.ts`
- Create: `src/application/crop/restore-draft.use-case.ts`
- Create: `src/application/crop/restore-draft.use-case.spec.ts`
- Modify: `src/crop.module.ts`

**Interfaces:**
- Consumes : `Crop.restoreDraft(revision)` (Task 1).
- Produces : `rebuildCropProjections(crop, repos): Promise<CropSnapshot>` ; `RestoreDraftUseCase.execute({ id, revision, actor }): Promise<CropSnapshot>`.

- [ ] **Step 1 : Créer le helper** `src/application/crop/rebuild-crop-projections.ts` :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { VarietyRepository } from './variety.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CropZoneSuitabilityRepository } from '../zone/crop-zone-suitability.repository';
import { CropPestControlRepository } from '../pest/crop-pest-control.repository';
import { PricePointRepository } from '../price/price-point.repository';

export interface CropProjectionRepositories {
  crops: CropRepository;
  varieties: VarietyRepository;
  windows: CroppingWindowRepository;
  zones: CropZoneSuitabilityRepository;
  pests: CropPestControlRepository;
  prices: PricePointRepository;
}

export async function rebuildCropProjections(crop: Crop, repos: CropProjectionRepositories): Promise<CropSnapshot> {
  const next = crop.toSnapshot();
  await repos.crops.save(next);
  await repos.varieties.replaceForCrop(crop.id, crop.varieties);
  await repos.windows.replaceForCrop(crop.id, crop.windows);
  await repos.zones.replaceForCrop(crop.id, crop.zones);
  await repos.pests.replaceForCrop(crop.id, crop.pests);
  await repos.prices.replaceForCrop(crop.id, crop.prices);
  return next;
}
```

- [ ] **Step 2 : Refactorer `discard-draft.use-case.ts`** pour utiliser le helper. Ajouter l'import `import { rebuildCropProjections } from './rebuild-crop-projections';` et remplacer le bloc `const next = crop.toSnapshot(); await this.crops.save(next); await this.varieties.replaceForCrop(...); ...(les 5 replaceForCrop)...` par :
```ts
    const next = await rebuildCropProjections(crop, { crops: this.crops, varieties: this.varieties, windows: this.windows, zones: this.zones, pests: this.pests, prices: this.prices });
```
(Conserver le reste : `append`, `audit.record({ ... draftDiscarded: true })`, `return next`.)

- [ ] **Step 3 : Créer `restore-draft.use-case.ts`** :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { VarietyRepository } from './variety.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CropZoneSuitabilityRepository } from '../zone/crop-zone-suitability.repository';
import { CropPestControlRepository } from '../pest/crop-pest-control.repository';
import { PricePointRepository } from '../price/price-point.repository';
import { rebuildCropProjections } from './rebuild-crop-projections';

export class RestoreDraftUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly varieties: VarietyRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly zones: CropZoneSuitabilityRepository,
    private readonly pests: CropPestControlRepository,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; revision: number; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.restoreDraft(input.revision); // NoPublishedVersionError / RevisionNotFoundError
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = await rebuildCropProjections(crop, { crops: this.crops, varieties: this.varieties, windows: this.windows, zones: this.zones, pests: this.pests, prices: this.prices });
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { draftRestoredFromRevision: input.revision } });
    return next;
  }
}
```

- [ ] **Step 4 : Écrire `restore-draft.use-case.spec.ts` (échoue d'abord).** Mirrorer l'arrange de `discard-draft.use-case.spec.ts` (in-memory event store + repos de section + `CreateCropUseCase` + `AddVarietyUseCase` + `PublishCropUseCase` avec composer + `InMemoryPublishedCropRepository`). Lire ce fichier pour reprendre exactement ses fixtures.
```ts
  it('restaure le contenu d\'une révision antérieure dans le brouillon', async () => {
    const a = arrange(); // même helper que discard-draft.use-case.spec (event store, crops, 5 repos, published, composer, audit)
    await createCrop(a, 'c1');                         // CreateCropUseCase
    const addVariety = new AddVarietyUseCase(a.events, a.varieties, a.audit, clock, ids);
    await addVariety.execute({ cropId: 'c1', name: { fr: 'X' }, traits: [], actor: 'admin' });
    const publish = new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published);
    await publish.execute({ id: 'c1', actor: 'admin' });   // rév. 1 = {X}
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Y' }, traits: [], actor: 'admin' });
    await publish.execute({ id: 'c1', actor: 'admin' });   // rév. 2 = {X,Y}

    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    const snap = await restore.execute({ id: 'c1', revision: 1, actor: 'admin' });

    expect(snap.hasUnpublishedChanges).toBe(true);        // diffère de la rév. 2
    const list = await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' });
    expect(list.map((x) => x.name.fr)).toEqual(['X']);    // projection revenue à la rév. 1
  });

  it('lève RevisionNotFoundError pour une révision inexistante', async () => {
    const a = arrange();
    await createCrop(a, 'c2');
    await new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published).execute({ id: 'c2', actor: 'admin' });
    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(restore.execute({ id: 'c2', revision: 99, actor: 'admin' })).rejects.toThrow(RevisionNotFoundError);
  });
```
> Adapter `arrange`/`createCrop`/`ids`/`clock` aux helpers RÉELS de `discard-draft.use-case.spec.ts` (les recopier/réutiliser). Importer `RevisionNotFoundError` depuis `../../domain/crop/crop` et `ListVarietiesUseCase`/`AddVarietyUseCase`/`PublishCropUseCase`/`CreateCropUseCase` depuis leurs modules.

Run: `npx jest -- restore-draft`
Expected: FAIL puis PASS après Steps 1-3.

- [ ] **Step 5 : DI dans `crop.module.ts`.** Importer :
```ts
import { RestoreDraftUseCase } from './application/crop/restore-draft.use-case';
```
Ajouter un provider (même liste d'injection que `DiscardDraftUseCase`) :
```ts
    {
      provide: RestoreDraftUseCase,
      useFactory: (es, r, v, w, z, p, pr, a, c) => new RestoreDraftUseCase(es, r, v, w, z, p, pr, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, VARIETY_REPOSITORY, CROPPING_WINDOW_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 6 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS. L'abandon (`discard-draft.use-case.spec`, e2e `crop-versioning`) reste vert après le refactor du helper.

- [ ] **Step 7 : Commit**
```bash
git add src/application/crop/rebuild-crop-projections.ts src/application/crop/discard-draft.use-case.ts src/application/crop/restore-draft.use-case.ts src/application/crop/restore-draft.use-case.spec.ts src/crop.module.ts
git commit -m "feat(api): RestoreDraftUseCase + helper rebuildCropProjections (abandon refactoré)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Endpoint restore + e2e

**Files:**
- Modify: `src/presentation/crop/crop.controller.ts`
- Create: `test/crop-restore.e2e-spec.ts`

**Interfaces:**
- Consumes : `RestoreDraftUseCase` (Task 2), `RevisionNotFoundError` (Task 1).
- Produces : `POST /crops/:id/versions/:revision/restore` → document brouillon reconstruit.

- [ ] **Step 1 : Imports** dans `crop.controller.ts` :
```ts
import { RestoreDraftUseCase } from '../../application/crop/restore-draft.use-case';
import { NoPublishedVersionError, RevisionNotFoundError } from '../../domain/crop/crop';
```
> `NoPublishedVersionError` est déjà importé depuis `'../../domain/crop/crop'` — fusionner l'import plutôt que de le dupliquer (ajouter `RevisionNotFoundError` à la ligne existante).

- [ ] **Step 2 : Mapping d'erreur** — dans `mapCropError`, ajouter avant le `throw e;` final :
```ts
  if (e instanceof RevisionNotFoundError) throw new NotFoundException((e as Error).message);
```

- [ ] **Step 3 : Injection constructeur** — ajouter au constructeur du `CropController` :
```ts
    private readonly restoreDraft: RestoreDraftUseCase,
```

- [ ] **Step 4 : Endpoint** — ajouter (par ex. après la méthode `discard`) :
```ts
  @Post(':id/versions/:revision/restore')
  async restore(@Param('id') id: string, @Param('revision') revision: string) {
    try {
      const snap = await this.restoreDraft.execute({ id, revision: Number(revision), actor: ACTOR });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }
```

- [ ] **Step 5 : e2e** — créer `test/crop-restore.e2e-spec.ts`, en mirrorant le bootstrap de `test/crop-versioning.e2e-spec.ts` (module `AppModule`, `PrismaService`, nettoyage `beforeAll`/`afterAll` **incluant `prisma.publishedCrop.deleteMany()`**, `supertest`).
```ts
  it('restaure une version passée dans le brouillon, republiable ensuite', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Igname' }, scientificName: 'Dioscorea', family: 'Dioscoreaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // v1 avec variété X
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'X' }, traits: [] }).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    // v2 avec variété Y en plus
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'Y' }, traits: [] }).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // restaurer la rév. 1 dans le brouillon
    await request(app.getHttpServer()).post(`/crops/${id}/versions/1/restore`).expect(201);

    // le brouillon ne montre plus que X, avec modifs non publiées
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(draft.body.varieties.map((x: any) => x.name.fr)).toEqual(['X']);
    expect(draft.body.hasUnpublishedChanges).toBe(true);

    // republier -> nouvelle révision 3
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const versions = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(versions.body.map((v: any) => v.revision)).toEqual([3, 2, 1]);
  });

  it('révision inexistante -> 404 ; culture jamais publiée -> 409', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Taro' }, scientificName: 'Colocasia', family: 'Araceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;
    // jamais publiée -> restore -> 409
    await request(app.getHttpServer()).post(`/crops/${id}/versions/1/restore`).expect(409);
    // publier puis demander une révision inexistante -> 404
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/versions/99/restore`).expect(404);
  });
```
> Vérifier les codes HTTP réels (POST création 201, POST `/varieties` 201, POST `/publish` 201, POST `/restore` 201) et la forme du document (`varieties[].name.fr`, `hasUnpublishedChanges`) via `crop.controller.ts` / un e2e existant ; adapter les `.expect(...)` au réel.

- [ ] **Step 6 : Lancer le nouvel e2e seul.**

Run: `npx jest -- crop-restore`
Expected: PASS.

- [ ] **Step 7 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (tout — chemins abandon et C1 inclus, filet de non-régression).

- [ ] **Step 8 : Commit**
```bash
git add src/presentation/crop/crop.controller.ts test/crop-restore.e2e-spec.ts
git commit -m "feat(api): endpoint POST /crops/:id/versions/:revision/restore

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Restauration sans perte** : `restore(N)` ramène le brouillon à l'état exact de la révision N (cœur + sections, snapshots complets), via le rejeu du flux — pas le document figé appauvri.
- **Cohérence brouillon/publié** : restaurer une révision antérieure → `hasUnpublishedChanges=true` ; republier crée une nouvelle révision.
- **Non-régression** : `DraftDiscarded` inchangé (cas particulier) ; helper partagé par abandon et restauration ; C1 (`/versions`) vert.
- **Erreurs** : jamais publiée → 409 ; révision inexistante → 404.
- **Périmètre** : diff sémantique (C3) **non** inclus ; pas de câblage admin ; pas de changement de schéma.
