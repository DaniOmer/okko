# Sécurité éditoriale : brouillon / publié (Lot B, socle) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de retravailler une fiche publiée sans que les modifications soient visibles tant qu'elles ne sont pas republiées — une version **publiée figée** (lecteurs) + un **brouillon** (tête du flux, admin), avec **Publier** et **Abandonner**.

**Architecture:** Sur le socle event sourcing existant (flux unique par culture, source de vérité). `Publier` fige le document composé complet dans une nouvelle projection `PublishedCrop`. `Abandonner` émet un événement `DraftDiscarded` (sans payload) ; l'agrégat mémorise un **point de contrôle** re-dérivé au repli à chaque `Published` et le restaure à l'abandon, puis les projections normalisées (cœur + 5 sections) sont reconstruites à l'état publié. Deux drapeaux dérivés (`hasUnpublishedChanges`, `hasPublishedVersion`) entrent dans le `CropSnapshot` → la projection → le document.

**Tech Stack:** NestJS 10 + TypeScript + Prisma (PostgreSQL) + Jest (TDD).

## Global Constraints

- **Clean architecture** : domaine sans import externe (domaine→domaine permis) ; ports dans `application/**` ; adaptateurs dans `infrastructure/**`.
- **Flux unique = source de vérité** ; la projection `Crop` + tables de section = caches reconstructibles. `Crop.fromEvents` reste le chemin de reconstruction (jamais `fromSnapshot` pour muter).
- **`version` inchangé** : compteur de mutations de contenu actuel. Pas de « numéro de révision publiée » dans cette brique.
- **Statut inchangé** : `DRAFT/PUBLISHED/ARCHIVED` et transitions identiques. Éditer une fiche `PUBLISHED` la laisse `PUBLISHED`.
- **Brique fonctionnelle** (pas refactor pur) : les 2 champs additifs `hasUnpublishedChanges`/`hasPublishedVersion` sont attendus ; les documents existants gardent tous leurs champs. Compléter (pas réécrire) les specs qui asservissent la forme exacte du document/snapshot.
- **Mappage HTTP de l'abandon sans version publiée** : `NoPublishedVersionError` → **409 Conflict** (cohérent avec `CropStatusError`/`ConcurrencyError`).
- **Tests** : TDD (rouge d'abord). Après **chaque tâche**, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`. Suite single-worker ; ⚠️ `deleteMany` sur la base de dev — OK (base vide, cf. contrainte projet).
- **Migrations** : `npx prisma migrate dev --name <nom>` (Docker `okko-db-1` doit être Up). Une migration par tâche qui touche le schéma.
- Commits fréquents, préfixes `feat(api):` / `refactor(api):` / `test(api):`. Terminer **chaque** message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes s'exécutent depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Créés :**
- `src/application/crop/compose-crop-document.ts` — service applicatif qui assemble le `CropDocument` complet (cœur + 5 sections enrichies). Réutilisé par `publish` (figeage) et le contrôleur.
- `src/application/crop/published-crop.repository.ts` — port `PublishedCropRepository` + `PUBLISHED_CROP_REPOSITORY` + type `PublishedCropRecord`.
- `src/infrastructure/crop/prisma-published-crop.repository.ts` — adaptateur Prisma.
- `src/application/crop/in-memory-published-crop.repository.ts` — adaptateur in-memory (tests).
- `src/application/crop/discard-draft.use-case.ts` — use-case `Abandonner`.
- `src/application/crop/discard-draft.use-case.spec.ts`.
- `src/application/crop/compose-crop-document.spec.ts`.
- `test/crop-versioning.e2e-spec.ts` — parcours e2e complet.

**Modifiés :**
- `src/domain/crop/crop-event.ts` — variante `DraftDiscarded`.
- `src/domain/crop/crop.ts` — `CropSnapshot` (+2 drapeaux), point de contrôle, `discardDraft()`, `NoPublishedVersionError`, `apply`, `toSnapshot`/`fromSnapshot`.
- `src/domain/crop/crop.events.spec.ts`, `src/domain/crop/crop.spec.ts` — specs domaine.
- `src/application/crop/publish-crop.use-case.ts` (+ `.spec.ts`) — figeage `PublishedCrop`.
- `src/application/crop/crop-read-model.ts` (+ `.spec.ts`) — `CropDocument` (+2 drapeaux) + `toCropDocument`.
- Les 5 ports de section + impls Prisma + adaptateurs in-memory — méthode `replaceForCrop`.
- `src/infrastructure/crop/prisma-crop.repository.ts` — 2 colonnes drapeaux.
- `src/presentation/crop/crop.controller.ts` — endpoints `GET /crops/:id/published`, `POST /crops/:id/discard`, adoption du composeur, mapping erreur.
- `src/crop.module.ts` — DI (composeur, published repo, discard, publish enrichi).
- `prisma/schema.prisma` — modèle `PublishedCrop` + 2 colonnes sur `Crop`.
- `test/crop.e2e-spec.ts` et `test/crop-sections-event-sourcing.e2e-spec.ts` — ajout `publishedCrop.deleteMany()` au nettoyage.

---

## Task 1 : Agrégat — abandon, point de contrôle, drapeaux (domaine, TDD)

**Files:**
- Modify: `src/domain/crop/crop-event.ts`
- Modify: `src/domain/crop/crop.ts`
- Modify: `src/domain/crop/crop.events.spec.ts`
- Modify: `src/domain/crop/crop.spec.ts`

**Interfaces:**
- Produces : événement `{ type: 'DraftDiscarded' }` ; `Crop.discardDraft(): void` ; getters/état dérivé `hasUnpublishedChanges`/`hasPublishedVersion` ; `CropSnapshot` gagne `hasUnpublishedChanges: boolean` et `hasPublishedVersion: boolean` ; `NoPublishedVersionError` exporté depuis `crop.ts`. `fromEvents`/`pullPendingEvents` inchangés en signature.

- [ ] **Step 1 : Ajouter la variante d'événement** dans `crop-event.ts`, à la fin de l'union (avant le `;` final) :

```ts
  | { type: 'DraftDiscarded' };
```

- [ ] **Step 2 : Écrire les tests qui échouent** — ajouter à la fin de `crop.events.spec.ts`. Réutiliser les helpers `make()`/`stored()` déjà présents dans ce fichier (bloc Lot A/sections). Si `make()` crée un `Crop` neuf et `stored(events)` enveloppe des `CropEvent[]` en `{ event, streamId: 'c1' }[]`, alors :

```ts
describe('Crop draft/published editorial safety', () => {
  const v = (id: string): VarietySnapshot =>
    ({ id, cropId: 'c1', name: { fr: `V${id}` }, traits: [] } as VarietySnapshot);

  it('publish pose hasPublishedVersion et remet hasUnpublishedChanges à false', () => {
    const c = make();
    c.rename(TranslatableText.create({ fr: 'Nouveau' }));
    expect(c.hasUnpublishedChanges).toBe(true);
    c.publish();
    expect(c.hasPublishedVersion).toBe(true);
    expect(c.hasUnpublishedChanges).toBe(false);
  });

  it('éditer après publication remet hasUnpublishedChanges à true sans toucher hasPublishedVersion', () => {
    const c = make();
    c.publish();
    c.addVariety(v('a'));
    expect(c.hasUnpublishedChanges).toBe(true);
    expect(c.hasPublishedVersion).toBe(true);
  });

  it('discardDraft restaure cœur + sections à l\'état publié et remet le drapeau à false', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();
    const versionAtPublish = c.version;
    c.addVariety(v('b'));
    c.rename(TranslatableText.create({ fr: 'Brouillon modifié' }));
    expect(c.varieties).toHaveLength(2);
    c.discardDraft();
    expect(c.varieties).toEqual([v('a')]);
    expect(c.version).toBe(versionAtPublish);
    expect(c.commonNames.toJSON()).toEqual(make().commonNames.toJSON());
    expect(c.hasUnpublishedChanges).toBe(false);
  });

  it('discardDraft lève NoPublishedVersionError si jamais publié', () => {
    const c = make();
    c.addVariety(v('a'));
    expect(() => c.discardDraft()).toThrow(NoPublishedVersionError);
  });

  it('repli déterministe : [Created, éditions, Published, éditions, DraftDiscarded] == état au Published', () => {
    const built = make();
    built.addVariety(v('a'));
    built.publish();
    const atPublish = Crop.fromEvents(stored(built.pullPendingEvents())).toSnapshot();
    built.addVariety(v('b'));
    built.discardDraft();
    const rebuilt = Crop.fromEvents(stored(built.pullPendingEvents()));
    expect(rebuilt.toSnapshot()).toEqual(atPublish);
    expect(rebuilt.varieties).toEqual([v('a')]);
  });
});
```

Ajouter en tête de fichier les imports manquants s'ils n'y sont pas déjà : `import { NoPublishedVersionError } from './crop';` et `import { TranslatableText } from '../shared/translatable-text';`.

> ⚠️ Si les helpers `make()`/`stored()` ont une forme différente dans ce fichier, adapter les appels (mais **ne pas** changer leur définition). Lire le haut de `crop.events.spec.ts` avant d'écrire.

- [ ] **Step 3 : Lancer → échoue.**

Run: `npx jest -- crop.events`
Expected: FAIL (`discardDraft`/`NoPublishedVersionError`/`hasUnpublishedChanges` inexistants).

- [ ] **Step 4 : Modifier `crop.ts`.**

4a. Ajouter l'erreur exportée (en haut, après les imports) :

```ts
export class NoPublishedVersionError extends Error {
  constructor(public readonly cropId: string) {
    super(`Crop ${cropId} has no published version to revert to`);
    this.name = 'NoPublishedVersionError';
  }
}
```

4b. Étendre `CropSnapshot` (ajouter les 2 champs à l'interface) :

```ts
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
```

4c. Déclarer les champs (avec les autres `private _...`) :

```ts
  private _hasUnpublishedChanges = false;
  private _hasPublishedVersion = false;
  private _publishedCheckpoint?: {
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
  };
```

4d. Getters (avec les autres) :

```ts
  get hasUnpublishedChanges(): boolean { return this._hasUnpublishedChanges; }
  get hasPublishedVersion(): boolean { return this._hasPublishedVersion; }
```

4e. Mutation publique (près de `publish()`/`archive()`) :

```ts
  discardDraft(): void {
    if (!this._hasPublishedVersion) throw new NoPublishedVersionError(this._id);
    this.raise({ type: 'DraftDiscarded' });
  }
```

4f. Helpers privés (près de `apply`) :

```ts
  private captureCheckpoint(): void {
    this._publishedCheckpoint = {
      commonNames: this._commonNames, status: this._status, version: this._version,
      metadata: { ...this._metadata }, climatic: this._climatic, edaphic: this._edaphic,
      phenology: [...this._phenology], nutrition: [...this._nutrition], yields: [...this._yields],
      varieties: [...this._varieties], windows: [...this._windows], zones: [...this._zones],
      pests: [...this._pests], prices: [...this._prices],
    };
  }

  private restoreCheckpoint(): void {
    const cp = this._publishedCheckpoint!;
    this._commonNames = cp.commonNames; this._status = cp.status; this._version = cp.version;
    this._metadata = { ...cp.metadata }; this._climatic = cp.climatic; this._edaphic = cp.edaphic;
    this._phenology = [...cp.phenology]; this._nutrition = [...cp.nutrition]; this._yields = [...cp.yields];
    this._varieties = [...cp.varieties]; this._windows = [...cp.windows]; this._zones = [...cp.zones];
    this._pests = [...cp.pests]; this._prices = [...cp.prices];
    this._hasUnpublishedChanges = false;
  }
```

4g. Dans `apply`, marquer les mutations de **contenu** comme non publiées. Ajouter `this._hasUnpublishedChanges = true;` à chacun de ces `case` **existants** : `ClimaticRequirementsSet`, `EdaphicRequirementsSet`, `PhenologySet`, `NutritionSet`, `YieldsSet`, `Renamed`, `MetadataSet`, `VarietyAdded`, `CroppingWindowAdded`, `PricePointAdded`, `ZoneSuitabilitySet`, `PestControlSet`. Exemple :

```ts
      case 'Renamed': this._commonNames = TranslatableText.create(e.commonNames); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'VarietyAdded': this._varieties = [...this._varieties, e.variety]; this._hasUnpublishedChanges = true; break;
```

Remplacer le `case 'Published'` existant et ajouter `DraftDiscarded` :

```ts
      case 'Published': this._status = CropStatus.PUBLISHED; this._hasPublishedVersion = true; this._hasUnpublishedChanges = false; this.captureCheckpoint(); break;
      case 'DraftDiscarded': this.restoreCheckpoint(); break;
```

`Archived` et `CropCreated` : inchangés.

4h. `toSnapshot()` — ajouter au retour :

```ts
      hasUnpublishedChanges: this._hasUnpublishedChanges,
      hasPublishedVersion: this._hasPublishedVersion,
```

4i. `fromSnapshot(s)` — après `const crop = new Crop(...)` (transformer le `return new Crop(...)` en variable), restaurer les drapeaux puis `return crop;` :

```ts
    const crop = new Crop(
      s.id, TranslatableText.create(s.commonNames), s.scientificName, s.family,
      s.cycleType, s.status, s.version, { ...s.metadata },
      s.climatic ? ClimaticRequirements.fromJSON(s.climatic) : undefined,
      s.edaphic ? EdaphicRequirements.fromJSON(s.edaphic) : undefined,
      (s.phenology ?? []).map((j) => PhenologicalStage.fromJSON(j)),
      (s.nutrition ?? []).map((j) => NutrientRequirement.fromJSON(j)),
      (s.yields ?? []).map((j) => YieldReference.fromJSON(j)),
    );
    crop._hasUnpublishedChanges = s.hasUnpublishedChanges;
    crop._hasPublishedVersion = s.hasPublishedVersion;
    return crop;
```

- [ ] **Step 5 : Lancer les nouveaux tests → passent.**

Run: `npx jest -- crop.events`
Expected: PASS.

- [ ] **Step 6 : Corriger `crop.spec.ts` (mécanique).** `CropSnapshot` a 2 champs de plus → les assertions d'égalité de `toSnapshot()` échouent.

Run: `npx jest -- crop.spec`
Pour chaque assertion `toSnapshot()` qui échoue, ajouter aux objets attendus `hasUnpublishedChanges: <valeur>, hasPublishedVersion: <valeur>` : `false`/`false` pour une culture jamais éditée-après-création ou éditée-non-publiée ; après une édition de contenu → `hasUnpublishedChanges: true` ; après `publish()` → `hasUnpublishedChanges: false, hasPublishedVersion: true`. Se laisser guider par le diff Jest.

Run: `npx jest -- crop.spec crop.events`
Expected: PASS.

- [ ] **Step 7 : Non-régression domaine + typage.**

Run: `npx jest -- src/domain && npx tsc --noEmit`
Expected: PASS + zéro erreur TS. (Des erreurs TS « property missing » ailleurs sont normales à ce stade — elles seront corrigées aux tâches 2/3 ; si `tsc` bloque, noter les fichiers concernés et vérifier qu'ils figurent bien dans les tâches suivantes avant de continuer.)

- [ ] **Step 8 : Commit**

```bash
git add src/domain/crop/crop-event.ts src/domain/crop/crop.ts src/domain/crop/crop.events.spec.ts src/domain/crop/crop.spec.ts
git commit -m "feat(api): agrégat Crop — abandon de brouillon + point de contrôle publié + drapeaux

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Projection Crop — 2 colonnes drapeaux + document (read-model)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/infrastructure/crop/prisma-crop.repository.ts`
- Modify: `src/application/crop/crop-read-model.ts`
- Modify: `src/application/crop/crop-read-model.spec.ts`
- Modify: éventuellement `test/prisma-crop.repository.int-spec.ts`

**Interfaces:**
- Consumes : `CropSnapshot.hasUnpublishedChanges`/`hasPublishedVersion` (Task 1).
- Produces : `CropDocument` gagne `hasUnpublishedChanges: boolean` et `hasPublishedVersion: boolean` ; la projection persiste/relit ces 2 colonnes.

- [ ] **Step 1 : Schéma Prisma** — ajouter 2 colonnes au modèle `Crop` (après `yields`) :

```prisma
  hasUnpublishedChanges Boolean  @default(false)
  hasPublishedVersion   Boolean  @default(false)
```

- [ ] **Step 2 : Migration**

Run: `npx prisma migrate dev --name add_crop_draft_flags`
Expected: migration créée + client régénéré, pas d'erreur. (Docker `okko-db-1` doit être Up.)

- [ ] **Step 3 : Persistance projection** — dans `prisma-crop.repository.ts`, ajouter les 2 champs dans `toRow`/l'objet `create`/`update` **et** dans `toSnapshot` (lecture). Repérer la méthode `save` (upsert) et la conversion `toSnapshot(row)` ; ajouter :

- côté écriture : `hasUnpublishedChanges: s.hasUnpublishedChanges, hasPublishedVersion: s.hasPublishedVersion,`
- côté lecture : `hasUnpublishedChanges: row.hasUnpublishedChanges, hasPublishedVersion: row.hasPublishedVersion,`

- [ ] **Step 4 : Écrire le test read-model qui échoue** — ajouter à `crop-read-model.spec.ts` :

```ts
it('expose hasUnpublishedChanges et hasPublishedVersion depuis le snapshot', () => {
  const base = /* snapshot minimal déjà utilisé dans ce fichier */;
  const doc = toCropDocument({ ...base, hasUnpublishedChanges: true, hasPublishedVersion: true });
  expect(doc.hasUnpublishedChanges).toBe(true);
  expect(doc.hasPublishedVersion).toBe(true);
});
```

> Réutiliser le snapshot de base déjà construit dans ce fichier (lire les tests existants) plutôt que d'en fabriquer un ; y ajouter les 2 champs.

- [ ] **Step 5 : Lancer → échoue.**

Run: `npx jest -- crop-read-model`
Expected: FAIL (`doc.hasUnpublishedChanges` undefined).

- [ ] **Step 6 : `crop-read-model.ts`** — ajouter à l'interface `CropDocument` :

```ts
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
```

et dans l'objet retourné par `toCropDocument`, après `version: s.version,` (ou à la fin de l'objet) :

```ts
    hasUnpublishedChanges: s.hasUnpublishedChanges,
    hasPublishedVersion: s.hasPublishedVersion,
```

- [ ] **Step 7 : Compléter les specs qui asservissent le document/snapshot (mécanique).**

Run: `npx jest`
Corriger toute assertion d'égalité stricte cassée par les 2 nouveaux champs (notamment `test/prisma-crop.repository.int-spec.ts` si elle compare un snapshot complet, et les specs read-model / e2e crop existantes) en ajoutant `hasUnpublishedChanges`/`hasPublishedVersion` aux objets attendus. Se laisser guider par le diff Jest.

Expected: PASS (toute la suite) + `npx tsc --noEmit` propre.

- [ ] **Step 8 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/infrastructure/crop/prisma-crop.repository.ts src/application/crop/crop-read-model.ts src/application/crop/crop-read-model.spec.ts test/prisma-crop.repository.int-spec.ts
git commit -m "feat(api): projection Crop porte hasUnpublishedChanges/hasPublishedVersion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Projection publiée + composeur + figeage à la publication

**Files:**
- Create: `src/application/crop/compose-crop-document.ts` (+ `.spec.ts`)
- Create: `src/application/crop/published-crop.repository.ts`
- Create: `src/infrastructure/crop/prisma-published-crop.repository.ts`
- Create: `src/application/crop/in-memory-published-crop.repository.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/application/crop/publish-crop.use-case.ts` (+ `.spec.ts`)
- Modify: `src/crop.module.ts`

**Interfaces:**
- Consumes : `ListVarietiesUseCase`, `ListCropZonesUseCase`, `ListCroppingWindowsUseCase`, `ListCropPestsUseCase`, `ListCropPricesUseCase` (tous `execute({ cropId })`), `toCropDocument`, `CropSnapshot`, `CropEventStore`, `CropRepository`.
- Produces : `CropDocumentComposer.compose(cropId, snap): Promise<CropDocument>` ; `PUBLISHED_CROP_REPOSITORY`, `PublishedCropRepository { save(r), findByCrop(id) }`, `PublishedCropRecord`.

- [ ] **Step 1 : Composeur** — créer `src/application/crop/compose-crop-document.ts` :

```ts
import { CropSnapshot } from '../../domain/crop/crop';
import { CropDocument, toCropDocument } from './crop-read-model';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCropZonesUseCase } from '../zone/list-crop-zones.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPestsUseCase } from '../pest/list-crop-pests.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';

export class CropDocumentComposer {
  constructor(
    private readonly listVarieties: ListVarietiesUseCase,
    private readonly listZones: ListCropZonesUseCase,
    private readonly listWindows: ListCroppingWindowsUseCase,
    private readonly listPests: ListCropPestsUseCase,
    private readonly listPrices: ListCropPricesUseCase,
  ) {}

  async compose(cropId: string, snap: CropSnapshot): Promise<CropDocument> {
    const varieties = await this.listVarieties.execute({ cropId });
    const zones = await this.listZones.execute({ cropId });
    const windows = await this.listWindows.execute({ cropId });
    const pests = await this.listPests.execute({ cropId });
    const prices = await this.listPrices.execute({ cropId });
    return toCropDocument(snap, { varieties, zones, windows, pests, prices });
  }
}
```

- [ ] **Step 2 : Test composeur** — créer `compose-crop-document.spec.ts` :

```ts
import { CropDocumentComposer } from './compose-crop-document';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { CropSnapshot } from '../../domain/crop/crop';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

const snap: CropSnapshot = {
  id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
  cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.DRAFT, version: 1, metadata: {},
  hasUnpublishedChanges: false, hasPublishedVersion: false,
};

// Stubs pour les listes enrichies (zones/pests) : execute renvoie [] .
const zonesStub = { execute: async () => [] } as unknown as import('../zone/list-crop-zones.use-case').ListCropZonesUseCase;
const pestsStub = { execute: async () => [] } as unknown as import('../pest/list-crop-pests.use-case').ListCropPestsUseCase;

describe('CropDocumentComposer', () => {
  it('assemble le document complet avec les variétés de la culture', async () => {
    const varieties = new InMemoryVarietyRepository();
    await varieties.save({ id: 'v1', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] });
    const composer = new CropDocumentComposer(
      new ListVarietiesUseCase(varieties),
      zonesStub,
      new ListCroppingWindowsUseCase(new InMemoryCroppingWindowRepository()),
      pestsStub,
      new ListCropPricesUseCase(new InMemoryPricePointRepository()),
    );
    const doc = await composer.compose('c1', snap);
    expect(doc.varieties.map((v) => v.id)).toEqual(['v1']);
    expect(doc.id).toBe('c1');
  });
});
```

Run: `npx jest -- compose-crop-document`
Expected: PASS (le composeur existe déjà — ce test le verrouille).

- [ ] **Step 3 : Port projection publiée** — créer `src/application/crop/published-crop.repository.ts` :

```ts
import { CropDocument } from './crop-read-model';

export const PUBLISHED_CROP_REPOSITORY = Symbol('PUBLISHED_CROP_REPOSITORY');

export interface PublishedCropRecord {
  cropId: string;
  document: CropDocument;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedCropRepository {
  save(record: PublishedCropRecord): Promise<void>;
  findByCrop(cropId: string): Promise<PublishedCropRecord | null>;
}
```

- [ ] **Step 4 : Adaptateur in-memory** — créer `src/application/crop/in-memory-published-crop.repository.ts` :

```ts
import { PublishedCropRecord, PublishedCropRepository } from './published-crop.repository';

export class InMemoryPublishedCropRepository implements PublishedCropRepository {
  private store = new Map<string, PublishedCropRecord>();
  async save(record: PublishedCropRecord): Promise<void> { this.store.set(record.cropId, record); }
  async findByCrop(cropId: string): Promise<PublishedCropRecord | null> { return this.store.get(cropId) ?? null; }
}
```

- [ ] **Step 5 : Modèle Prisma** — ajouter à `schema.prisma` :

```prisma
model PublishedCrop {
  cropId      String   @id
  document    Json
  version     Int
  publishedAt DateTime
  publishedBy String
}
```

- [ ] **Step 6 : Migration**

Run: `npx prisma migrate dev --name add_published_crop`
Expected: migration créée + client régénéré.

- [ ] **Step 7 : Adaptateur Prisma** — créer `src/infrastructure/crop/prisma-published-crop.repository.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropDocument } from '../../application/crop/crop-read-model';
import { PublishedCropRecord, PublishedCropRepository } from '../../application/crop/published-crop.repository';

@Injectable()
export class PrismaPublishedCropRepository implements PublishedCropRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(r: PublishedCropRecord): Promise<void> {
    const data = {
      document: r.document as unknown as Prisma.InputJsonValue,
      version: r.version,
      publishedAt: new Date(r.publishedAt),
      publishedBy: r.publishedBy,
    };
    await this.prisma.publishedCrop.upsert({
      where: { cropId: r.cropId },
      create: { cropId: r.cropId, ...data },
      update: data,
    });
  }

  async findByCrop(cropId: string): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findUnique({ where: { cropId } });
    if (!row) return null;
    return {
      cropId: row.cropId,
      document: row.document as unknown as CropDocument,
      version: row.version,
      publishedAt: row.publishedAt.toISOString(),
      publishedBy: row.publishedBy,
    };
  }
}
```

- [ ] **Step 8 : Test use-case publish qui échoue** — dans `publish-crop.use-case.spec.ts`, ajouter un test vérifiant le figeage. Construire le use-case avec les nouveaux paramètres (composeur + published repo). Réutiliser le bootstrap event-sourcé déjà présent dans ce fichier (`InMemoryCropEventStore` + `CreateCropUseCase`). Exemple d'ossature :

```ts
import { CropDocumentComposer } from './compose-crop-document';
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';

// zones/pests : stubs execute -> []
const composer = new CropDocumentComposer(
  new ListVarietiesUseCase(new InMemoryVarietyRepository()),
  { execute: async () => [] } as any,
  new ListCroppingWindowsUseCase(new InMemoryCroppingWindowRepository()),
  { execute: async () => [] } as any,
  new ListCropPricesUseCase(new InMemoryPricePointRepository()),
);
const published = new InMemoryPublishedCropRepository();

it('publie et fige le document dans PublishedCrop', async () => {
  // ... amorcer un crop via CreateCropUseCase (comme les tests existants) ...
  const publish = new PublishCropUseCase(events, crops, audit, clock, composer, published);
  await publish.execute({ id: 'c1', actor: 'a' });
  const rec = await published.findByCrop('c1');
  expect(rec).not.toBeNull();
  expect(rec!.document.id).toBe('c1');
  expect(rec!.version).toBeGreaterThanOrEqual(1);
});
```

Mettre à jour les instanciations existantes de `new PublishCropUseCase(...)` dans ce spec pour passer `composer, published` en 5ᵉ/6ᵉ arguments.

Run: `npx jest -- publish-crop`
Expected: FAIL (constructeur à 4 args / `published` vide).

- [ ] **Step 9 : Enrichir `publish-crop.use-case.ts`** :

```ts
import { CropDocumentComposer } from './compose-crop-document';
import { PublishedCropRepository } from './published-crop.repository';
// ... imports existants ...

export class PublishCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly composer: CropDocumentComposer,
    private readonly published: PublishedCropRepository,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.publish();
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    const document = await this.composer.compose(input.id, next);
    await this.published.save({ cropId: input.id, document, version: next.version, publishedAt: at, publishedBy: input.actor });
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { status: 'PUBLISHED' } });
    return next;
  }
}
```

- [ ] **Step 10 : DI dans `crop.module.ts`** :

10a. Imports :

```ts
import { CropDocumentComposer } from './application/crop/compose-crop-document';
import { PUBLISHED_CROP_REPOSITORY } from './application/crop/published-crop.repository';
import { PrismaPublishedCropRepository } from './infrastructure/crop/prisma-published-crop.repository';
```

10b. Providers (ajouter) :

```ts
    { provide: PUBLISHED_CROP_REPOSITORY, useClass: PrismaPublishedCropRepository },
    {
      provide: CropDocumentComposer,
      useFactory: (v, z, w, p, pr) => new CropDocumentComposer(v, z, w, p, pr),
      inject: [ListVarietiesUseCase, ListCropZonesUseCase, ListCroppingWindowsUseCase, ListCropPestsUseCase, ListCropPricesUseCase],
    },
```

10c. Remplacer le provider `PublishCropUseCase` existant par :

```ts
    {
      provide: PublishCropUseCase,
      useFactory: (es, r, a, c, comp, pub) => new PublishCropUseCase(es, r, a, c, comp, pub),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, CropDocumentComposer, PUBLISHED_CROP_REPOSITORY],
    },
```

> `ListCropZonesUseCase` et `ListCropPestsUseCase` sont déjà importés/fournis dans le module. Vérifier que les 5 `List*UseCase` sont bien tous des providers avant `CropDocumentComposer` (l'ordre de déclaration n'importe pas pour Nest, mais les tokens doivent exister).

- [ ] **Step 11 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 12 : Commit**

```bash
git add src/application/crop/compose-crop-document.ts src/application/crop/compose-crop-document.spec.ts src/application/crop/published-crop.repository.ts src/application/crop/in-memory-published-crop.repository.ts src/infrastructure/crop/prisma-published-crop.repository.ts prisma/schema.prisma prisma/migrations src/application/crop/publish-crop.use-case.ts src/application/crop/publish-crop.use-case.spec.ts src/crop.module.ts
git commit -m "feat(api): publier fige le document composé dans PublishedCrop (+ composeur partagé)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : `replaceForCrop` sur les 5 sections + use-case Abandonner

**Files:**
- Modify: les 5 ports de section + 5 impls Prisma + 5 adaptateurs in-memory (chemins ci-dessous)
- Create: `src/application/crop/discard-draft.use-case.ts` (+ `.spec.ts`)
- Modify: `src/crop.module.ts`

**Interfaces:**
- Produces : `replaceForCrop(cropId: string, items: T[]): Promise<void>` sur `VarietyRepository`, `CroppingWindowRepository`, `CropZoneSuitabilityRepository`, `CropPestControlRepository`, `PricePointRepository` ; `DiscardDraftUseCase.execute({ id, actor }): Promise<CropSnapshot>`.

Chemins des trios (port / prisma / in-memory) :
- Variétés : `src/application/crop/variety.repository.ts` / `src/infrastructure/crop/prisma-variety.repository.ts` / `src/application/crop/in-memory-variety.repository.ts` (type `VarietySnapshot`)
- Fenêtres : `src/application/window/cropping-window.repository.ts` / `src/infrastructure/window/prisma-cropping-window.repository.ts` / `src/application/window/in-memory-cropping-window.repository.ts` (type `CroppingWindowSnapshot`)
- Zones : `src/application/zone/crop-zone-suitability.repository.ts` / `src/infrastructure/zone/prisma-crop-zone-suitability.repository.ts` / `src/application/zone/in-memory-crop-zone-suitability.repository.ts` (type `CropZoneSuitabilitySnapshot`)
- Ravageurs : `src/application/pest/crop-pest-control.repository.ts` / `src/infrastructure/pest/prisma-crop-pest-control.repository.ts` / `src/application/pest/in-memory-crop-pest-control.repository.ts` (type `CropPestControlSnapshot`)
- Prix : `src/application/price/price-point.repository.ts` / `src/infrastructure/price/prisma-price-point.repository.ts` / `src/application/price/in-memory-price-point.repository.ts` (type `PricePointSnapshot`)

- [ ] **Step 1 : Ports** — ajouter la signature à chacune des 5 interfaces (adapter le type d'item) :

```ts
  replaceForCrop(cropId: string, items: VarietySnapshot[]): Promise<void>;
```

- [ ] **Step 2 : Impls Prisma** — ajouter la méthode à chacune des 5 classes. Modèle « id » (variété, fenêtre, prix — remplacer `variety`/`croppingWindow`/`pricePoint` et `toRow`) :

```ts
  async replaceForCrop(cropId: string, items: VarietySnapshot[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.variety.deleteMany({ where: { cropId } }),
      ...items.map((v) => this.prisma.variety.create({ data: this.toRow(v) })),
    ]);
  }
```

Modèle « clé composite » (zone, ravageur — remplacer `cropZoneSuitability`/`cropPestControl` et `toRow`) : identique, `deleteMany({ where: { cropId } })` puis `create({ data: this.toRow(...) })` pour chaque item.

- [ ] **Step 3 : Adaptateurs in-memory** — ajouter à chacun des 5 :

```ts
  async replaceForCrop(cropId: string, items: VarietySnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
```

- [ ] **Step 4 : Test use-case Abandonner qui échoue** — créer `discard-draft.use-case.spec.ts`. Amorcer via `InMemoryCropEventStore` + `CreateCropUseCase`, ajouter une variété, publier, ajouter une 2ᵉ variété, abandonner, vérifier le retour à l'état publié :

```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase } from './publish-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { DiscardDraftUseCase } from './discard-draft.use-case';
import { NoPublishedVersionError } from '../../domain/crop/crop';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryCropZoneSuitabilityRepository } from '../zone/in-memory-crop-zone-suitability.repository';
import { InMemoryCropPestControlRepository } from '../pest/in-memory-crop-pest-control.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { CropDocumentComposer } from './compose-crop-document';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-09T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('DiscardDraftUseCase', () => {
  beforeEach(() => { idSeq = 0; });

  function arrange() {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const windows = new InMemoryCroppingWindowRepository();
    const zones = new InMemoryCropZoneSuitabilityRepository();
    const pests = new InMemoryCropPestControlRepository();
    const prices = new InMemoryPricePointRepository();
    const published = new InMemoryPublishedCropRepository();
    const audit = { record: jest.fn() };
    const composer = new CropDocumentComposer(
      new ListVarietiesUseCase(varieties),
      { execute: async () => [] } as any,
      new ListCroppingWindowsUseCase(windows),
      { execute: async () => [] } as any,
      new ListCropPricesUseCase(prices),
    );
    return { events, crops, varieties, windows, zones, pests, prices, published, audit, composer };
  }

  it('revient à l\'état publié (cœur + variétés) et vide les modifs non publiées', async () => {
    const a = arrange();
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const addVariety = new AddVarietyUseCase(a.events, a.varieties, a.audit, clock, ids);
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [], actor: 'a' });
    await new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published).execute({ id: 'c1', actor: 'a' });
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Draft-only' }, traits: [], actor: 'a' });
    expect((await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' }))).toHaveLength(2);

    const discard = new DiscardDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    const snap = await discard.execute({ id: 'c1', actor: 'a' });

    expect(snap.hasUnpublishedChanges).toBe(false);
    const list = await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' });
    expect(list.map((v) => v.name.fr)).toEqual(['Obatanpa']);
  });

  it('lève NoPublishedVersionError si jamais publié', async () => {
    const a = arrange();
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const discard = new DiscardDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(discard.execute({ id: 'c1', actor: 'a' })).rejects.toThrow(NoPublishedVersionError);
  });
});
```

Run: `npx jest -- discard-draft`
Expected: FAIL (`discard-draft.use-case` inexistant).

- [ ] **Step 5 : `discard-draft.use-case.ts`** :

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

export class DiscardDraftUseCase {
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

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.discardDraft(); // lève NoPublishedVersionError si jamais publié
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.varieties.replaceForCrop(input.id, crop.varieties);
    await this.windows.replaceForCrop(input.id, crop.windows);
    await this.zones.replaceForCrop(input.id, crop.zones);
    await this.pests.replaceForCrop(input.id, crop.pests);
    await this.prices.replaceForCrop(input.id, crop.prices);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { draftDiscarded: true } });
    return next;
  }
}
```

- [ ] **Step 6 : DI dans `crop.module.ts`** :

Imports :
```ts
import { DiscardDraftUseCase } from './application/crop/discard-draft.use-case';
```
Provider (ajouter) :
```ts
    {
      provide: DiscardDraftUseCase,
      useFactory: (es, r, v, w, z, p, pr, a, c) => new DiscardDraftUseCase(es, r, v, w, z, p, pr, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, VARIETY_REPOSITORY, CROPPING_WINDOW_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (les impls Prisma `replaceForCrop` sont couvertes indirectement ; les int-specs existantes restent vertes).

- [ ] **Step 8 : Commit**

```bash
git add src/application src/infrastructure src/crop.module.ts
git commit -m "feat(api): abandon de brouillon (replaceForCrop sur les 5 sections + use-case discard)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : Endpoints + contrôleur (published, discard, composeur)

**Files:**
- Modify: `src/presentation/crop/crop.controller.ts`

**Interfaces:**
- Consumes : `PUBLISHED_CROP_REPOSITORY`/`PublishedCropRepository`, `DiscardDraftUseCase`, `CropDocumentComposer`, `NoPublishedVersionError`.
- Produces : `GET /crops/:id/published` (document figé ou 404) ; `POST /crops/:id/discard` (document brouillon reconstruit).

- [ ] **Step 1 : Imports** dans `crop.controller.ts` :

```ts
import { PUBLISHED_CROP_REPOSITORY, PublishedCropRepository } from '../../application/crop/published-crop.repository';
import { DiscardDraftUseCase } from '../../application/crop/discard-draft.use-case';
import { CropDocumentComposer } from '../../application/crop/compose-crop-document';
import { NoPublishedVersionError } from '../../domain/crop/crop';
```

- [ ] **Step 2 : Mapping erreur** — dans `mapCropError`, ajouter avant le `throw e;` final :

```ts
  if (e instanceof NoPublishedVersionError) throw new ConflictException((e as Error).message);
```

- [ ] **Step 3 : Injections constructeur** — ajouter au constructeur du `CropController` :

```ts
    private readonly discardDraft: DiscardDraftUseCase,
    private readonly composer: CropDocumentComposer,
    @Inject(PUBLISHED_CROP_REPOSITORY) private readonly publishedCrops: PublishedCropRepository,
```

- [ ] **Step 4 : Adopter le composeur** — remplacer le corps de la méthode privée `composeCropDocument` par une délégation :

```ts
  private async composeCropDocument(id: string, snap: CropSnapshot) {
    return this.composer.compose(id, snap);
  }
```

- [ ] **Step 5 : Nouveaux endpoints** — ajouter dans la classe (par ex. après `publish`) :

```ts
  @Get(':id/published')
  async published(@Param('id') id: string) {
    const rec = await this.publishedCrops.findByCrop(id);
    if (!rec) throw new NotFoundException(id);
    return rec.document;
  }

  @Post(':id/discard')
  async discard(@Param('id') id: string) {
    try {
      const snap = await this.discardDraft.execute({ id, actor: ACTOR });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }
```

> Attention à l'ordre des routes Nest : `@Get(':id/published')` doit être déclaré comme les autres sous-routes `:id/...` — pas d'ambiguïté avec `@Get(':id')` car le segment `/published` les distingue.

- [ ] **Step 6 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS. (Les e2e existants passent : `GET /crops/:id` et la publication conservent leur comportement, aux 2 champs additifs près déjà intégrés.)

- [ ] **Step 7 : Commit**

```bash
git add src/presentation/crop/crop.controller.ts
git commit -m "feat(api): endpoints GET /crops/:id/published et POST /crops/:id/discard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 : e2e — parcours brouillon/publié complet

**Files:**
- Create: `test/crop-versioning.e2e-spec.ts`
- Modify: `test/crop.e2e-spec.ts`, `test/crop-sections-event-sourcing.e2e-spec.ts` (nettoyage `publishedCrop`)

- [ ] **Step 1 : Nettoyage `publishedCrop`** — dans `test/crop.e2e-spec.ts` et `test/crop-sections-event-sourcing.e2e-spec.ts`, ajouter `await prisma.publishedCrop.deleteMany();` en **tête** des blocs `beforeAll` et `afterAll` de nettoyage (avant `cropEvent.deleteMany()`). `PublishedCrop` n'a pas de FK, l'ordre est libre ; le mettre en premier est sûr.

- [ ] **Step 2 : e2e — écrire `test/crop-versioning.e2e-spec.ts`.** Mirrorer le bootstrap de `crop-sections-event-sourcing.e2e-spec.ts` (module `AppModule`, `PrismaService`, nettoyage identique **plus** `prisma.publishedCrop.deleteMany()`). Utiliser `supertest` comme les e2e existants (regarder l'import exact dans un e2e existant — souvent `import request from 'supertest';` et `request(app.getHttpServer())`). Cas :

```ts
  it('publier fige la version ; éditer diverge le brouillon mais pas le publié', async () => {
    // créer une culture complète (helpers ou POST /crops + sous-ressources comme dans les e2e existants)
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // publier
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // /published renvoie le document figé
    const pub1 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub1.body.id).toBe(id);

    // éditer le brouillon (rename via PATCH)
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Maïs modifié' } }).expect(200);

    // brouillon montre la modif + drapeau
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(draft.body.name).toBe('Maïs modifié');
    expect(draft.body.hasUnpublishedChanges).toBe(true);
    expect(draft.body.hasPublishedVersion).toBe(true);

    // publié reste figé
    const pub2 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub2.body.name).toBe('Maïs');
  });

  it('republier met à jour le figé', async () => {
    // ... créer + publier + éditer + republier ; GET /published reflète la nouvelle valeur ...
  });

  it('abandonner ramène le brouillon au publié (y compris une section)', async () => {
    // créer + ajouter une variété + publier ; ajouter une 2e variété ; POST /discard ;
    // GET /crops/:id/varieties -> une seule variété ; GET /crops/:id hasUnpublishedChanges=false
  });

  it('abandonner sans version publiée -> 409 ; /published sur fiche jamais publiée -> 404', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Sorgho' }, scientificName: 'Sorghum bicolor', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;
    await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(404);
    await request(app.getHttpServer()).post(`/crops/${id}/discard`).expect(409);
  });
```

Compléter les 2 cas laissés en commentaire avec les mêmes primitives (POST création, POST `/varieties`, POST `/publish`, POST `/discard`, GET `/varieties`, GET `/published`). Utiliser les payloads exacts des e2e existants comme référence pour les sous-ressources.

- [ ] **Step 3 : Lancer le nouvel e2e seul.**

Run: `npx jest -- crop-versioning`
Expected: PASS.

- [ ] **Step 4 : Suite complète verte (filet zéro-régression).**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (tout — e2e existants inclus, avec les 2 champs additifs et le nettoyage `publishedCrop`).

- [ ] **Step 5 : Commit**

```bash
git add test/crop-versioning.e2e-spec.ts test/crop.e2e-spec.ts test/crop-sections-event-sourcing.e2e-spec.ts
git commit -m "test(api): e2e brouillon/publié (publier fige, éditer diverge, republier, abandonner, 404/409)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Sécurité éditoriale** : `GET /crops/:id/published` reste figé pendant qu'on édite le brouillon ; republier le met à jour ; abandonner ramène brouillon = publié (cœur + sections).
- **Repli déterministe** : `[…, Published, éditions, DraftDiscarded]` reconstruit l'état exact au `Published` (couvert domaine + e2e).
- **`version` & statut intacts** ; les 5 sections toujours event-sourcées ; `AuditLog` conservé (+ entrée `draftDiscarded`).
- **Champs additifs** `hasUnpublishedChanges`/`hasPublishedVersion` présents sur le document brouillon ; documents existants inchangés par ailleurs.
- **Périmètre** : historique multi-versions, restauration d'une version passée, diff → **non** inclus (briques suivantes ; `PublishedCrop` prêt à passer à plusieurs lignes/culture).
