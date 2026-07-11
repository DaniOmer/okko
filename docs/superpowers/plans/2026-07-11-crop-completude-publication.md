# Complétude & publication (Brique 2 : B1 + B2 + E1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la complétude affichée en liste/dashboard (B1), interdire la publication d'une fiche < 100 % (B2), et afficher comme « version » le numéro de révision publiée — Brouillon → v1 → v2 (E1).

**Architecture :** API d'abord (TDD Jest), puis admin (barrière build). B1 = la liste hydrate chaque fiche via le composer existant. B2 = garde de complétude dans `PublishCropUseCase` (lue depuis l'agrégat), erreur → 422. E1 = persister `publishedVersion` (= `_publishedRevision`) sur la projection `Crop` et l'exposer/afficher. Le point délicat : la garde B2 fait échouer tout test qui publie ; on prépare donc les tests (crops complets) **avant** d'ajouter la garde, pour garder la suite verte à chaque étape.

**Tech Stack :** NestJS, Prisma (PostgreSQL), Jest (API) ; Next.js 14, TypeScript (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir l'utilisateur avant de lancer `pnpm --filter @okko/api test`. La DB est actuellement vide.
- **Complétude = 10 catégories** booléennes : `climatic, edaphic, phenology, nutrition, yields, varieties, zones, windows, pests, prices` (`crop-completeness.ts`). 100 % = les 10.
- **B2** : la garde vit dans `PublishCropUseCase` (invariant applicatif), lue depuis l'**agrégat** (getters). Publier < 100 % → `IncompleteCropError` → **422** ; aucune écriture. S'applique 1re publication **et** republications.
- **E1** : ne PAS modifier le mécanisme interne `_version` ; on ajoute et affiche `publishedVersion`. Aucun use-case `Crop` n'utilise `fromSnapshot` (tous `fromEvents`) → pas de risque d'écraser `publishedVersion`.
- **API** : barrière = `pnpm --filter @okko/api test` vert + migration appliquée. **Admin** : barrière = `pnpm --filter @okko/admin build` vert + smoke manuel.
- Commits `feat(api):` / `fix(api):` / `feat(admin):` selon la tâche. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 (E1) :** `apps/api/prisma/schema.prisma`, migration ; `apps/api/src/domain/crop/crop.ts` (`CropSnapshot`, `toSnapshot`) ; `apps/api/src/infrastructure/crop/prisma-crop.repository.ts` (`toSnapshot`) ; `apps/api/src/application/crop/crop-read-model.ts` (`CropDocument`).
**Task 2 (B1) :** `apps/api/src/presentation/crop/crop.controller.ts` (`list`) ; `apps/api/test/helpers/complete-crop.ts` (nouveau) ; `apps/api/test/crop-completeness-list.e2e-spec.ts` (nouveau).
**Task 3 (retrofit e2e) :** les 7 e2e qui publient (voir tâche).
**Task 4 (B2) :** `apps/api/src/application/crop/publish-crop.use-case.ts` (garde + `IncompleteCropError`) ; `apps/api/src/presentation/crop/crop.controller.ts` (`mapCropError`) ; specs unitaires publish/restore/discard ; nouveaux tests garde.
**Task 5 (admin E1) :** `apps/admin/src/lib/api.ts`, `.../crops/[id]/page.tsx`, `.../crops/[id]/published/page.tsx`, `.../crops/[id]/versions/page.tsx`.
**Task 6 (admin B2) :** `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`, `.../crops/[id]/page.tsx`.

---

## Task 1 : E1 — persister & exposer `publishedVersion`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`model Crop`)
- Create: migration `add_crop_published_version`
- Modify: `apps/api/src/domain/crop/crop.ts` (`CropSnapshot`, `toSnapshot`)
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts` (`toSnapshot`)
- Modify: `apps/api/src/application/crop/crop-read-model.ts` (`CropDocument` + retour)

**Interfaces:**
- Produces : `CropSnapshot.publishedVersion: number` (= `_publishedRevision`, 0 si jamais publié) ; `CropDocument.publishedVersion: number`.

- [ ] **Step 1 : Schéma Prisma** — dans `apps/api/prisma/schema.prisma`, `model Crop`, ajouter après `hasPublishedVersion` :
```prisma
  publishedVersion      Int      @default(0)
```

- [ ] **Step 2 : Migration**

Run: `cd apps/api && pnpm prisma migrate dev --name add_crop_published_version`
Expected: migration créée + appliquée ; `prisma generate` régénère le client (le type `Crop` gagne `publishedVersion`).

- [ ] **Step 3 : `CropSnapshot`** — dans `apps/api/src/domain/crop/crop.ts`, ajouter à l'interface `CropSnapshot` (après `hasPublishedVersion`) :
```ts
  publishedVersion: number;
```

- [ ] **Step 4 : `toSnapshot()`** — dans la même classe, ajouter au littéral retourné par `toSnapshot()` (après `hasPublishedVersion: this._hasPublishedVersion`) :
```ts
      publishedVersion: this._publishedRevision,
```

- [ ] **Step 5 : Écrire le test repo (in-memory round-trip)** — ajouter un test dans une spec repo (créer `apps/api/src/application/crop/in-memory-crop.repository.spec.ts` si absent) : sauver un snapshot avec `publishedVersion: 2` → `findById`/`list` le renvoient. Utiliser un objet `CropSnapshot` complet minimal (tous champs requis, `publishedVersion: 2`).
```ts
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

it('porte publishedVersion au round-trip', async () => {
  const repo = new InMemoryCropRepository();
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.DRAFT, version: 3, metadata: {},
    hasUnpublishedChanges: false, hasPublishedVersion: true, publishedVersion: 2,
  } as any;
  await repo.save(snap);
  expect((await repo.findById('c1'))!.publishedVersion).toBe(2);
  expect((await repo.list())[0].publishedVersion).toBe(2);
});
```

- [ ] **Step 6 : Run le test → échoue** (le type/valeur `publishedVersion` doit déjà compiler grâce aux steps 3-4 ; le test doit passer directement si l'in-memory stocke `s` tel quel — c'est le cas). Run: `pnpm --filter @okko/api test -- in-memory-crop.repository` — Expected: PASS (l'in-memory stocke le record intact). Si le fichier n'existe pas encore, ce step le crée.

- [ ] **Step 7 : Prisma repo `toSnapshot(row)`** — dans `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`, ajouter au littéral de `toSnapshot(row)` (après `hasPublishedVersion: row.hasPublishedVersion`) :
```ts
      publishedVersion: row.publishedVersion,
```
> `save` n'a pas besoin de changement : `payload = { ...s, … }` inclut déjà `publishedVersion` via le spread, et la colonne existe désormais.

- [ ] **Step 8 : Read model** — dans `apps/api/src/application/crop/crop-read-model.ts` : ajouter `publishedVersion: number;` à l'interface `CropDocument` (après `hasPublishedVersion`), et au littéral retourné par `toCropDocument` ajouter `publishedVersion: s.publishedVersion,`.

- [ ] **Step 9 : Full API test suite** (⚠️ prévenir : efface la DB).

Run: `pnpm --filter @okko/api test`
Expected: vert. (Les specs existantes qui construisent des `CropSnapshot` littéraux complets pourraient exiger `publishedVersion` — si le typecheck échoue, ajouter `publishedVersion: 0` à ces littéraux.)

- [ ] **Step 10 : Commit**
```bash
git add apps/api/prisma apps/api/src/domain/crop/crop.ts apps/api/src/infrastructure/crop/prisma-crop.repository.ts apps/api/src/application/crop/crop-read-model.ts apps/api/src/application/crop/in-memory-crop.repository.spec.ts
git commit -m "feat(api): persiste et expose publishedVersion (= révision publiée)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : B1 — hydrater la liste + helper de fiche complète

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (`@Get() list`)
- Create: `apps/api/test/helpers/complete-crop.ts`
- Create: `apps/api/test/crop-completeness-list.e2e-spec.ts`

**Interfaces:**
- Consumes : `this.composer.compose(id, snap)` (déjà injecté et utilisé par `get`).
- Produces : `fillAllSections(app, cropId)` — remplit les 10 catégories d'une fiche via HTTP (réutilisé par les tâches 3 et 4).

- [ ] **Step 1 : Créer le helper `complete-crop.ts`** — `apps/api/test/helpers/complete-crop.ts` (bodies repris verbatim des e2e existants) :
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Remplit les 10 catégories de complétude d'une fiche existante (crée zone + ravageur globaux). */
export async function fillAllSections(app: INestApplication, cropId: string): Promise<void> {
  const http = app.getHttpServer();
  await request(http).patch(`/crops/${cropId}/requirements`).send({
    climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
    edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } },
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/phenology`).send({
    stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/nutrition`).send({
    requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: 'PER_HECTARE' }],
  }).expect(200);
  await request(http).patch(`/crops/${cropId}/yields`).send({
    yields: [{ inputLevel: 'MEDIUM', min: 2, average: 4, potential: 6, unit: 't/ha' }],
  }).expect(200);
  await request(http).post(`/crops/${cropId}/varieties`).send({
    name: { fr: 'Variété test' }, maturityDays: 90, traits: ['précoce'],
  }).expect(201);
  const zone = await request(http).post('/zones').send({
    name: { fr: 'Zone test' }, country: 'BJ', koppen: 'BSh',
  }).expect(201);
  await request(http).put(`/crops/${cropId}/zones/${zone.body.id}`).send({
    rating: 'SUITABLE', justification: 'Convient',
  }).expect(200);
  await request(http).post(`/crops/${cropId}/windows`).send({
    zoneId: zone.body.id, season: 'Hivernage', irrigationRequired: false,
    operations: [{ type: 'PLANTING', label: { fr: 'Semis direct' }, timingDays: 0, inputs: [] }],
  }).expect(201);
  const pest = await request(http).post('/pests').send({
    name: { fr: 'Striga' }, type: 'WEED', scientificName: 'Striga hermonthica',
  }).expect(201);
  await request(http).put(`/crops/${cropId}/pests/${pest.body.id}`).send({
    susceptibility: 'HIGH', sensitiveStages: ['tallage'],
    controlMethods: [{ category: 'PREVENTION', description: { fr: 'Désherbage précoce' }, inputs: [] }],
  }).expect(200);
  await request(http).post(`/crops/${cropId}/prices`).send({
    market: 'Parakou', date: '2026-06-01', price: 200, unit: 'FCFA/kg', currency: 'XOF',
  }).expect(201);
}
```
> Ces bodies sont ceux des e2e existants (`crop-sections-event-sourcing`, `variety-requirements`, `nutrition-price`, `window`). Si une route renvoie un statut différent, corriger le `.expect(...)` selon le contrôleur.

- [ ] **Step 2 : Écrire le test B1** — `apps/api/test/crop-completeness-list.e2e-spec.ts` : créer une fiche, `fillAllSections`, puis `GET /crops` → l'item a `completeness.percent === 100`. S'inspirer de l'entête d'un e2e existant (`crop.e2e-spec.ts`) pour le bootstrap Nest + `beforeAll/afterAll` + nettoyage Prisma. Cœur du test :
```ts
const crop = await request(app.getHttpServer()).post('/crops')
  .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
  .expect(201);
await fillAllSections(app, crop.body.id);
const list = await request(app.getHttpServer()).get('/crops').expect(200);
const item = list.body.find((c: any) => c.id === crop.body.id);
expect(item.completeness.percent).toBe(100);
```

- [ ] **Step 3 : Run le test → échoue** (avant le fix : la liste ne renvoie pas les sous-collections → percent < 100).
Run: `pnpm --filter @okko/api test -- crop-completeness-list`
Expected: FAIL (percent ≈ 50, pas 100).

- [ ] **Step 4 : Corriger la liste** — dans `apps/api/src/presentation/crop/crop.controller.ts`, remplacer `@Get() list()` :
```ts
  @Get()
  async list() {
    const snaps = await this.crops.list();
    return Promise.all(snaps.map((s) => this.composer.compose(s.id, s)));
  }
```

- [ ] **Step 5 : Run le test → passe.**
Run: `pnpm --filter @okko/api test -- crop-completeness-list`
Expected: PASS.

- [ ] **Step 6 : Full suite** (⚠️ efface la DB).
Run: `pnpm --filter @okko/api test`
Expected: vert.

- [ ] **Step 7 : Commit**
```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/test/helpers/complete-crop.ts apps/api/test/crop-completeness-list.e2e-spec.ts
git commit -m "fix(api): la liste des cultures hydrate les sections (complétude correcte)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : préparer les e2e de publication (fiches complètes, avant la garde)

**But :** avant d'ajouter la garde B2 (Task 4), rendre 100 %-complètes toutes les fiches que les e2e publient, pour que la suite reste verte quand la garde arrivera. **Aucun code de production ici** — uniquement des tests.

**Files (e2e qui appellent `/publish`) :**
- Modify: `apps/api/test/crop.e2e-spec.ts`
- Modify: `apps/api/test/crop-event-sourcing.e2e-spec.ts`
- Modify: `apps/api/test/crop-versioning.e2e-spec.ts`
- Modify: `apps/api/test/crop-version-history.e2e-spec.ts`
- Modify: `apps/api/test/crop-publish-note.e2e-spec.ts`
- Modify: `apps/api/test/crop-restore.e2e-spec.ts`
- Modify: `apps/api/test/crop-diff.e2e-spec.ts`

**Interfaces:** Consumes `fillAllSections` (Task 2).

- [ ] **Step 1 : Pour chaque fichier ci-dessus** — importer le helper (`import { fillAllSections } from './helpers/complete-crop';`) et, **juste avant le premier `POST /crops/:id/publish`** de chaque fiche testée, insérer `await fillAllSections(app, <cropId>);` (utiliser la variable d'id de la fiche du test ; `app` = l'instance Nest du fichier).
> Remplir les sections **avant la première publication** ⇒ elles sont constantes entre les révisions ⇒ les assertions de diff (`crop-diff`) et de nombre de versions (`crop-version-history`, `crop-versioning`) restent valides. La modification testée entre deux publications reste le seul delta.

- [ ] **Step 2 : Ajuster les assertions qui dépendent de la complétude/du corps** — si un test asserte `completeness.percent` d'une fiche désormais complète, mettre `100`. Si un test de diff attendait un document quasi vide, vérifier que le delta testé (le champ que le test change) est toujours le seul écart (il l'est, les sections étant constantes). Ne PAS changer la logique métier testée.

- [ ] **Step 3 : Full suite** (⚠️ efface la DB).
Run: `pnpm --filter @okko/api test`
Expected: **vert** (aucune garde encore ; les fiches sont juste plus complètes).

- [ ] **Step 4 : Commit**
```bash
git add apps/api/test/crop.e2e-spec.ts apps/api/test/crop-event-sourcing.e2e-spec.ts apps/api/test/crop-versioning.e2e-spec.ts apps/api/test/crop-version-history.e2e-spec.ts apps/api/test/crop-publish-note.e2e-spec.ts apps/api/test/crop-restore.e2e-spec.ts apps/api/test/crop-diff.e2e-spec.ts
git commit -m "test(api): fiches complètes avant publication dans les e2e (préparation garde B2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : B2 — garde de complétude à la publication

**Files:**
- Modify: `apps/api/src/application/crop/publish-crop.use-case.ts` (garde + `IncompleteCropError`)
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (`mapCropError` + import `UnprocessableEntityException`)
- Modify: `apps/api/src/application/crop/publish-crop.use-case.spec.ts` (fiches complètes + nouveau test garde)
- Modify: `apps/api/src/application/crop/restore-draft.use-case.spec.ts`, `apps/api/src/application/crop/discard-draft.use-case.spec.ts` (si elles publient via le use-case → seed complet)
- Modify: `apps/api/test/crop-versioning.e2e-spec.ts` (ajouter un cas e2e 422 ; déjà importe le helper depuis Task 3)

**Interfaces:**
- Consumes : `computeCompleteness` (`crop-completeness.ts`), getters de l'agrégat.
- Produces : `IncompleteCropError extends Error { missing: string[] }`.

- [ ] **Step 1 : Écrire le test unitaire de la garde (échoue d'abord)** — dans `publish-crop.use-case.spec.ts`, ajouter un test : créer une fiche **sans** sections → `execute` rejette `IncompleteCropError` avec `missing` non vide, et **aucun** `PublishedCrop` n'est créé.
```ts
it('refuse la publication si la fiche est incomplète (< 100%)', async () => {
  const events = new InMemoryCropEventStore();
  const repo = new InMemoryCropRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(events, repo, audit, clock).execute({
    id: 'ci', commonNames: { fr: 'X' }, scientificName: 'X', family: 'X',
    cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  let caught: unknown;
  try {
    await new PublishCropUseCase(events, repo, audit, clock, composer, published).execute({ id: 'ci', actor: 'a' });
  } catch (e) { caught = e; }
  expect((caught as Error).name).toBe('IncompleteCropError');
  expect((caught as any).missing.length).toBeGreaterThan(0);
  expect(await published.findLatest('ci')).toBeNull();
});
```

- [ ] **Step 2 : Run → échoue** (pas encore de garde : la publication réussit).
Run: `pnpm --filter @okko/api test -- publish-crop.use-case`
Expected: FAIL.

- [ ] **Step 3 : Implémenter la garde** — dans `apps/api/src/application/crop/publish-crop.use-case.ts` : ajouter la classe d'erreur (près de `CropNotFoundError`) et la garde dans `execute`, **avant** `crop.publish()` :
```ts
import { computeCompleteness } from './crop-completeness';

export class IncompleteCropError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Crop incomplete: missing ${missing.join(', ')}`);
    this.name = 'IncompleteCropError';
  }
}
```
Dans `execute`, après `const crop = Crop.fromEvents(stored);` et avant `crop.publish();` :
```ts
    const report = computeCompleteness({
      climatic: !!crop.climatic, edaphic: !!crop.edaphic,
      phenology: crop.phenology.length > 0, nutrition: crop.nutrition.length > 0,
      yields: crop.yields.length > 0, varieties: crop.varieties.length > 0,
      zones: crop.zones.length > 0, windows: crop.windows.length > 0,
      pests: crop.pests.length > 0, prices: crop.prices.length > 0,
    });
    if (report.percent < 100) {
      const missing = Object.entries(report.categories).filter(([, v]) => !v).map(([k]) => k);
      throw new IncompleteCropError(missing);
    }
```

- [ ] **Step 4 : Seed complet dans les tests unitaires existants** — les tests de `publish-crop.use-case.spec.ts` (et `restore-draft`/`discard-draft` s'ils publient via le use-case) créent des fiches nues puis publient → désormais bloqués. Avant chaque `publish.execute(...)`, amener la fiche à 100 % en exécutant les use-cases de section sur le **même** event store. Ajouter un helper local dans la spec :
```ts
// Rend une fiche 100%-complète au niveau agrégat (mêmes 10 catégories que la garde).
async function seedComplete(events: InMemoryCropEventStore, cropId: string) {
  const at = clock.nowIso(); const actor = 'a';
  const append = (type: string, extra: Record<string, unknown>) =>
    events.append(cropId, undefined as any, [{ event: { type, ...extra } as any, actor, at }]);
  // Utiliser les use-cases de section OU appender les événements de section.
}
```
> **Mécanisme au choix de l'implémenteur**, tant que la fiche atteint 100 % au niveau agrégat : (a) instancier et exécuter les use-cases `SetCropRequirementsUseCase`, `SetPhenologyUseCase`, `SetCropNutritionUseCase`, `SetCropYieldsUseCase`, `AddVarietyUseCase`, `SetCropZoneSuitabilityUseCase`, `AddCroppingWindowUseCase`, `SetCropPestControlUseCase`, `AddPricePointUseCase` (bodies = ceux de `fillAllSections`) ; ou (b) appender directement les 10 événements de section au `InMemoryCropEventStore` avant `publish`. Choisir (a) si les use-cases sont simples à câbler, sinon (b). Le test « publie une culture existante » et « incrémente la révision » et « note » doivent seeder complet avant chaque `publish.execute`.

- [ ] **Step 5 : Ajouter l'assertion `publishedVersion`** — dans le test « incrémente la révision » de `publish-crop.use-case.spec.ts`, après les deux publications, asserter que le snapshot renvoyé porte la bonne version :
```ts
const out1 = await uc.execute({ id: 'c3', actor: 'admin' }); // 1re
expect(out1.publishedVersion).toBe(1);
const out2 = await uc.execute({ id: 'c3', actor: 'admin' }); // 2e
expect(out2.publishedVersion).toBe(2);
```
(adapter aux appels existants ; garder les assertions `revision` déjà présentes.)

- [ ] **Step 6 : Contrôleur → 422** — dans `apps/api/src/presentation/crop/crop.controller.ts` : importer `UnprocessableEntityException` depuis `@nestjs/common`, importer `IncompleteCropError`, et ajouter dans `mapCropError` (avant le `throw` générique final) :
```ts
  if (e instanceof IncompleteCropError) throw new UnprocessableEntityException((e as Error).message);
```

- [ ] **Step 7 : Cas e2e 422** — dans `apps/api/test/crop-versioning.e2e-spec.ts`, ajouter un test : créer une fiche **sans** `fillAllSections`, `POST /crops/:id/publish` → **422**.
```ts
it('refuse la publication d'une fiche incomplète (422)', async () => {
  const crop = await request(app.getHttpServer()).post('/crops')
    .send({ commonNames: { fr: 'Vide' }, scientificName: 'X', family: 'X', cycleType: 'SEASONAL_ANNUAL' })
    .expect(201);
  await request(app.getHttpServer()).post(`/crops/${crop.body.id}/publish`).expect(422);
});
```

- [ ] **Step 8 : Full suite** (⚠️ efface la DB).
Run: `pnpm --filter @okko/api test`
Expected: **vert** (garde active ; tests de publication seedent complet ; nouveau 422 vert).

- [ ] **Step 9 : Commit**
```bash
git add apps/api/src/application/crop/publish-crop.use-case.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/application/crop/publish-crop.use-case.spec.ts apps/api/src/application/crop/restore-draft.use-case.spec.ts apps/api/src/application/crop/discard-draft.use-case.spec.ts apps/api/test/crop-versioning.e2e-spec.ts
git commit -m "feat(api): interdit la publication d'une fiche incomplète (<100%) -> 422

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : Admin — afficher la version publiée (E1)

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (`CropDocument` + `CropDetail`)
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/published/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/versions/page.tsx`

**Interfaces:** Consumes `CropDocument.publishedVersion` (API, Task 1).

- [ ] **Step 1 : Types admin** — dans `apps/admin/src/lib/api.ts`, ajouter `publishedVersion: number;` à l'interface `CropDocument` (elle est `extends` par `CropDetail`) :
```ts
export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean; hasPublishedVersion: boolean;
  completeness: CompletenessReport;
}
```

- [ ] **Step 2 : Détail** — dans `apps/admin/src/app/crops/[id]/page.tsx`, remplacer `<span>v{crop.version}</span>` (L43) par :
```tsx
            <span>{crop.publishedVersion === 0 ? 'Brouillon' : `v${crop.publishedVersion}`}</span>
```

- [ ] **Step 3 : Page publiée** — dans `apps/admin/src/app/crops/[id]/published/page.tsx` (L18), remplacer `v{crop.version}` par `v{crop.publishedVersion}` (une fiche publiée a `publishedVersion ≥ 1`).

- [ ] **Step 4 : Table des versions** — dans `apps/admin/src/app/crops/[id]/versions/page.tsx` : renommer l'en-tête `<TableHead>Révision</TableHead>` en `<TableHead>Version</TableHead>`, et **supprimer** la colonne interne « Version » : retirer `<TableHead>Version</TableHead>` de l'entête **et** la cellule `<TableCell>v{v.version}</TableCell>` du corps. La colonne d'identité continue d'afficher `v{v.revision}` avec le badge « courante ».

- [ ] **Step 5 : Build.**
Run: `pnpm --filter @okko/admin build`
Expected: vert.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/page.tsx apps/admin/src/app/crops/\[id\]/published/page.tsx apps/admin/src/app/crops/\[id\]/versions/page.tsx
git commit -m "feat(admin): affiche la version publiée (Brouillon -> v1 -> v2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 : Admin — bloquer Publier si < 100 % (B2)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:** Consumes `crop.completeness` (`{ percent, categories }`) déjà présent sur `crop`.

- [ ] **Step 1 : Passer `completeness` au bouton** — dans `apps/admin/src/app/crops/[id]/page.tsx`, ajouter le prop à `<PublishButton … completeness={crop.completeness} />`.

- [ ] **Step 2 : Adapter `PublishButton`** — recevoir `completeness: { percent: number; categories: Record<string, boolean> }`. Quand `completeness.percent < 100`, **remplacer** le rendu de `PublishDialog` (états « jamais publiée » et « modifications non publiées ») par un bouton **désactivé** + la liste des catégories manquantes. Ajouter en tête du composant :
```tsx
const missing = Object.entries(completeness.categories).filter(([, v]) => !v).map(([k]) => k);
const incomplete = completeness.percent < 100;
```
Dans l'état « jamais publiée » (`!hasPublishedVersion`), si `incomplete`, rendre :
```tsx
    if (incomplete) {
      return (
        <div className="space-y-1">
          <Button size="sm" disabled>Publier</Button>
          <p className="text-xs text-muted-foreground">Complétez la fiche pour publier — manquant : {missing.join(', ')}</p>
        </div>
      );
    }
```
Dans l'état « modifications non publiées », remplacer le `<PublishDialog … label="Republier" … />` par le même bloc désactivé (bouton « Republier » disabled + message) quand `incomplete` ; sinon le `PublishDialog` actuel. Laisser **Abandonner** et le lien « Voir la version publiée » inchangés. L'état « Publiée » propre : inchangé.
> Le prop `status` inutilisé existant reste. Utiliser les libellés bruts des catégories manquantes (pas de nouvelle map).

- [ ] **Step 3 : Build.**
Run: `pnpm --filter @okko/admin build`
Expected: vert.

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Fiche incomplète → bouton Publier grisé + catégories manquantes ; compléter les 10 → bouton actif ; publier → détail affiche « v1 » ; modifier + republier → « v2 » ; dashboard/liste affichent la vraie complétude.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/editors/PublishButton.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): désactive Publier/Republier tant que la fiche n'est pas complète

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **B1** : `GET /crops` hydrate via le composer → complétude correcte en liste/dashboard.
- **B2** : garde dans le use-case (lue depuis l'agrégat), `IncompleteCropError` → 422 ; aucune écriture si incomplet ; bouton admin grisé + catégories manquantes. Tests de publication seedent complet ; nouveau 422 e2e + refus unitaire.
- **E1** : `publishedVersion` persisté (migration) + exposé (snapshot, read model) + affiché (« Brouillon »/v{n} au détail, page publiée, table des versions sans colonne interne).
- Suite API verte (⚠️ efface la DB) ; build admin vert. `_version` interne intact ; détail API inchangé.

## Self-review (couverture spec)

- §4.1 B1 hydratation → Task 2. ✅
- §4.2 B2 garde + `IncompleteCropError` + 422 → Task 4 ; préparation tests → Task 3. ✅
- §4.3 E1 `publishedVersion` (schéma/migration/snapshot/toSnapshot/repos/read model) → Task 1. ✅
- §5.1 B1 admin (rien) → n/a. §5.2 B2 admin (bouton) → Task 6. §5.3 E1 admin (détail/publiée/table) → Task 5. ✅
- §7 tests (liste 100 %, refus < 100 %, publishedVersion 1→2, 422) → Tasks 2/4. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
