# Fiche Culture — variétés (résistances/adaptation) + commercialisation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir les variétés (résistances par maladie du référentiel + adaptation par zone) et ajouter une section commercialisation (produits/formes/débouchés) comptée dans la complétude, en TDD, avec migrations Prisma.

**Architecture:** Fiche Culture event-sourcée. Variétés : VO `Variety` étendu + 2 colonnes JSON sur la table `Variety` (les events `VarietyAdded`/`VarietyUpdated` portent le snapshot → propagation auto). Commercialisation : nouvelle section crop suivant le template `yields` (VO → event `CommercializationSet` → agrégat → colonne JSON `Crop` → projection → complétude). Réutilise `PestDisease`, `AgroEcologicalZone`, `SuitabilityRating`.

**Tech Stack:** NestJS 10, Prisma 5 (migrations manuelles), Jest ; Next.js 14 admin, Vitest.

## Global Constraints

- **Clean architecture + TDD** : `domain/` (VO purs, framework-free) → `application/` → `presentation/`/admin ; test rouge d'abord.
- **Champs optionnels** ; pas de rétro-compat d'events (DB effacée par les tests, pas de données à préserver).
- **Migrations manuelles** (`prisma migrate dev` interactif inutilisable ici) : éditer `schema.prisma`, écrire `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `npx prisma db execute --file <sql> --schema prisma/schema.prisma` + `npx prisma migrate resolve --applied <name>` + `npx prisma generate`. Vérifier `npx prisma migrate status` → "up to date".
- **Enums (code + libellés FR côté admin)** : `ResistanceLevel` = `LOW`/`MEDIUM`/`HIGH` (Faible/Moyenne/Élevée) ; formes `GRAIN`/`FLOUR`/`OIL`/`LEAF`/`FRUIT`/`TUBER`/`OTHER` ; unités `KG`/`BAG`/`CRATE`/`TONNE`. Réutiliser `SuitabilityRating` (`SUITABLE`/`MARGINAL`/`UNSUITABLE`) pour l'adaptation zone.
- **Templates existants à suivre** : `domain/crop/yield-reference.ts` + `application/crop/set-crop-yields.use-case.ts` (section crop) ; `domain/crop/variety.ts` + `infrastructure/crop/prisma-variety.repository.ts` (liste projetée).
- **Commits** : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Variétés — VO + migration + repo + use-cases (API)

**Files:**
- Create: `apps/api/src/domain/crop/resistance-level.ts`
- Modify: `apps/api/src/domain/crop/variety.ts`
- Test: `apps/api/src/domain/crop/variety.spec.ts` (créer/étendre)
- Modify: `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/<ts>_variety_resistances_adaptations/migration.sql` (nouveau)
- Modify: `apps/api/src/infrastructure/crop/prisma-variety.repository.ts`
- Modify: `apps/api/src/application/crop/add-variety.use-case.ts`, `apps/api/src/application/crop/update-variety.use-case.ts`

**Interfaces:**
- Consumes: `SuitabilityRating` (`domain/zone/suitability-rating.ts`).
- Produces: `VarietySnapshot` gagne `diseaseResistances?: { pestId: string; level: ResistanceLevel }[]` et `zoneAdaptations?: { zoneId: string; rating: SuitabilityRating }[]`. Réutilisé par la Task 2 (admin).

- [ ] **Step 1: Type ResistanceLevel**

`apps/api/src/domain/crop/resistance-level.ts` :

```ts
export enum ResistanceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
```

- [ ] **Step 2: Test round-trip du VO Variety (échoue)**

`apps/api/src/domain/crop/variety.spec.ts` (créer/ajouter) :

```ts
import { Variety } from './variety';
import { TranslatableText } from '../shared/translatable-text';
import { ResistanceLevel } from './resistance-level';
import { SuitabilityRating } from '../zone/suitability-rating';

describe('Variety — diseaseResistances + zoneAdaptations', () => {
  it('round-trip toSnapshot/fromSnapshot conserve les listes', () => {
    const v = Variety.create({
      id: 'v1', cropId: 'c1', name: TranslatableText.create({ fr: 'Maïs jaune' }),
      diseaseResistances: [{ pestId: 'p1', level: ResistanceLevel.HIGH }],
      zoneAdaptations: [{ zoneId: 'z1', rating: SuitabilityRating.SUITABLE }],
    });
    const s = v.toSnapshot();
    expect(s.diseaseResistances).toEqual([{ pestId: 'p1', level: 'HIGH' }]);
    expect(s.zoneAdaptations).toEqual([{ zoneId: 'z1', rating: 'SUITABLE' }]);
    const back = Variety.fromSnapshot(s).toSnapshot();
    expect(back.diseaseResistances).toEqual([{ pestId: 'p1', level: 'HIGH' }]);
    expect(back.zoneAdaptations).toEqual([{ zoneId: 'z1', rating: 'SUITABLE' }]);
  });
  it('listes absentes → [] (défaut)', () => {
    const s = Variety.create({ id: 'v2', cropId: 'c1', name: TranslatableText.create({ fr: 'X' }) }).toSnapshot();
    expect(s.diseaseResistances).toEqual([]);
    expect(s.zoneAdaptations).toEqual([]);
  });
});
```

Run: `cd apps/api && npx jest variety --silent`
Expected: FAIL.

- [ ] **Step 3: Étendre le VO Variety**

Dans `apps/api/src/domain/crop/variety.ts` :
- imports : `import { ResistanceLevel } from './resistance-level';` et `import { SuitabilityRating } from '../zone/suitability-rating';`.
- Types de liste : `export interface VarietyDiseaseResistance { pestId: string; level: ResistanceLevel }` et `export interface VarietyZoneAdaptation { zoneId: string; rating: SuitabilityRating }`.
- `VarietySnapshot` : ajouter `diseaseResistances: VarietyDiseaseResistance[]; zoneAdaptations: VarietyZoneAdaptation[];` (toujours présents, `[]` par défaut).
- `CreateVarietyProps` : ajouter `diseaseResistances?: VarietyDiseaseResistance[]; zoneAdaptations?: VarietyZoneAdaptation[];`.
- Constructeur : 2 params `private readonly _diseaseResistances: VarietyDiseaseResistance[]`, `private readonly _zoneAdaptations: VarietyZoneAdaptation[]`.
- `static create` : passer `props.diseaseResistances ?? []`, `props.zoneAdaptations ?? []`.
- getters : `get diseaseResistances(): VarietyDiseaseResistance[] { return this._diseaseResistances.map((r) => ({ ...r })); }` et idem `zoneAdaptations`.
- `toSnapshot` : ajouter `diseaseResistances: this._diseaseResistances.map((r) => ({ ...r })), zoneAdaptations: this._zoneAdaptations.map((r) => ({ ...r }))`.
- `fromSnapshot` : passer `[...(s.diseaseResistances ?? [])].map((r) => ({ ...r }))` et idem (tolère l'absence pour d'anciens snapshots).

Run: `cd apps/api && npx jest variety --silent`
Expected: PASS.

- [ ] **Step 4: Migration Prisma (2 colonnes JSON)**

Dans `apps/api/prisma/schema.prisma`, `model Variety`, ajouter après `provenance` :

```prisma
  diseaseResistances Json?
  zoneAdaptations    Json?
```

Créer `apps/api/prisma/migrations/20260718140000_variety_resistances_adaptations/migration.sql` :

```sql
ALTER TABLE "Variety" ADD COLUMN "diseaseResistances" JSONB;
ALTER TABLE "Variety" ADD COLUMN "zoneAdaptations" JSONB;
```

Appliquer :
```bash
cd apps/api
npx prisma db execute --file prisma/migrations/20260718140000_variety_resistances_adaptations/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260718140000_variety_resistances_adaptations
npx prisma generate
```
Expected: `npx prisma migrate status` → "Database schema is up to date!".

- [ ] **Step 5: Repo Prisma Variety**

Dans `apps/api/src/infrastructure/crop/prisma-variety.repository.ts` :
- `toRow` : ajouter `diseaseResistances: (v.diseaseResistances ?? []) as unknown as Prisma.InputJsonValue, zoneAdaptations: (v.zoneAdaptations ?? []) as unknown as Prisma.InputJsonValue`.
- `toSnapshot` : ajouter `diseaseResistances: (row.diseaseResistances ?? []) as unknown as VarietySnapshot['diseaseResistances'], zoneAdaptations: (row.zoneAdaptations ?? []) as unknown as VarietySnapshot['zoneAdaptations']`.

Faire de même sur le double en mémoire si `apps/api/src/application/crop/in-memory-variety.repository.ts` mappe des champs (sinon il stocke le snapshot tel quel — vérifier).

- [ ] **Step 6: Use-cases add/update variety**

`apps/api/src/application/crop/add-variety.use-case.ts` : ajouter `diseaseResistances?: VarietyDiseaseResistance[]; zoneAdaptations?: VarietyZoneAdaptation[];` à `AddVarietyInput` et les passer à `Variety.create({ …, diseaseResistances: input.diseaseResistances, zoneAdaptations: input.zoneAdaptations })`.

`apps/api/src/application/crop/update-variety.use-case.ts` : idem sur son input + son appel `Variety.create`/mise à jour.

- [ ] **Step 7: Compilation + suite crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest variety crop --silent`
Expected: clean + PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/domain/crop/resistance-level.ts apps/api/src/domain/crop/variety.ts apps/api/src/domain/crop/variety.spec.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/infrastructure/crop/prisma-variety.repository.ts apps/api/src/application/crop/add-variety.use-case.ts apps/api/src/application/crop/update-variety.use-case.ts apps/api/src/application/crop/in-memory-variety.repository.ts
git commit -m "feat(crop): variétés — résistances (par maladie) + adaptation (par zone)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Variétés — éditeur admin

**Files:**
- Modify: `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/labels.ts`, `apps/admin/src/lib/actions.ts` (si `addVariety`/`updateVariety` y sont typés), `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`

**Interfaces:**
- Consumes: `Variety` API (Task 1), les listes maladies (`GET /pests` filtré type maladie) et zones (`GET /zones`) déjà exposées.

- [ ] **Step 1: Types + libellés admin**

`apps/admin/src/lib/api.ts` : `Variety` gagne `diseaseResistances?: { pestId: string; level: string }[]` et `zoneAdaptations?: { zoneId: string; rating: string }[]`. Élargir les signatures `addVariety`/`updateVariety` pour accepter ces deux listes.

`apps/admin/src/lib/labels.ts` : ajouter `export const RESISTANCE_LEVEL_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };`. Réutiliser le barème d'aptitude existant s'il a déjà des libellés (chercher `SUITABLE`/`MARGINAL`/`UNSUITABLE` dans `labels.ts` ; sinon ajouter `SUITABILITY_RATING_LABELS = { SUITABLE: 'Apte', MARGINAL: 'Marginale', UNSUITABLE: 'Inapte' }`).

- [ ] **Step 2: VarietyEditor — résistances + adaptations**

`apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx` : ajouter deux sous-sections répétables :
- **Résistances** : pour chaque entrée, un select maladie (options = maladies existantes, chargées via l'API pests filtrées sur le type maladie) + un select niveau (`RESISTANCE_LEVEL_LABELS`). Bouton « + résistance ».
- **Adaptation par zone** : pour chaque entrée, un select zone (options = zones existantes via l'API zones) + un select aptitude (`SUITABILITY_RATING_LABELS`). Bouton « + zone ».
Câbler les deux listes dans le payload passé à `addVariety`/`updateVariety`. Suivre le pattern des champs existants de l'éditeur (state local, listes éditables comme `traits`). L'éditeur (ou sa page parente) charge les référentiels maladies/zones ; réutiliser les appels API existants (`listPests`/`listZones`).

- [ ] **Step 3: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib apps/admin/src/app/crops/\[id\]/editors/VarietyEditor.tsx
git commit -m "feat(admin): éditeur variété — résistances + adaptation par zone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Commercialisation — section event-sourcée + complétude (API)

**Files:**
- Create: `apps/api/src/domain/crop/commercialization-product.ts` + `.spec.ts`
- Modify: `apps/api/src/domain/crop/crop-event.ts` (event `CommercializationSet`)
- Modify: `apps/api/src/domain/crop/crop.ts` (agrégat)
- Modify: `apps/api/prisma/schema.prisma` + migration (colonne `commercialization` sur `Crop`)
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`
- Modify: `apps/api/src/application/crop/crop-completeness.ts` + `crop-completeness.spec.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts` (`CropDocument` + completeness input + passe-plat)
- Create: `apps/api/src/application/crop/set-crop-commercialization.use-case.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`, `apps/api/src/crop.module.ts`
- Test: `apps/api/src/domain/crop/crop.commercialization.spec.ts`

**Interfaces:**
- Produces: `CommercializationProductJSON = { form: string; saleUnits: string[]; outlets: string[] }` ; `Crop.setCommercialization(list)` ; event `CommercializationSet` ; `CropSnapshot.commercialization` ; `CropDocument.commercialization` ; complétude à 11 catégories. Réutilisé par la Task 4.

- [ ] **Step 1: VO CommercializationProduct + test (échoue)**

`apps/api/src/domain/crop/commercialization-product.ts` :

```ts
export interface CommercializationProductJSON {
  form: string;
  saleUnits: string[];
  outlets: string[];
}

interface CreateProps {
  form: string;
  saleUnits?: string[];
  outlets?: string[];
}

export class CommercializationProduct {
  private constructor(
    private readonly _form: string,
    private readonly _saleUnits: string[],
    private readonly _outlets: string[],
  ) {}

  static create(props: CreateProps): CommercializationProduct {
    return new CommercializationProduct(props.form, props.saleUnits ?? [], props.outlets ?? []);
  }

  get form(): string { return this._form; }
  get saleUnits(): string[] { return [...this._saleUnits]; }
  get outlets(): string[] { return [...this._outlets]; }

  toJSON(): CommercializationProductJSON {
    return { form: this._form, saleUnits: [...this._saleUnits], outlets: [...this._outlets] };
  }

  static fromJSON(json: CommercializationProductJSON): CommercializationProduct {
    return new CommercializationProduct(json.form, [...(json.saleUnits ?? [])], [...(json.outlets ?? [])]);
  }
}
```

`apps/api/src/domain/crop/commercialization-product.spec.ts` :

```ts
import { CommercializationProduct } from './commercialization-product';

describe('CommercializationProduct', () => {
  it('round-trip conserve form/saleUnits/outlets', () => {
    const p = CommercializationProduct.create({ form: 'GRAIN', saleUnits: ['KG', 'BAG'], outlets: ['Marché local'] });
    const j = p.toJSON();
    expect(j).toEqual({ form: 'GRAIN', saleUnits: ['KG', 'BAG'], outlets: ['Marché local'] });
    expect(CommercializationProduct.fromJSON(j).toJSON()).toEqual(j);
  });
  it('listes absentes → []', () => {
    const j = CommercializationProduct.create({ form: 'OIL' }).toJSON();
    expect(j.saleUnits).toEqual([]);
    expect(j.outlets).toEqual([]);
  });
});
```

Run: `cd apps/api && npx jest commercialization-product --silent`
Expected: FAIL puis PASS.

- [ ] **Step 2: Événement + agrégat (test agrégat rouge d'abord)**

`apps/api/src/domain/crop/crop.commercialization.spec.ts` :

```ts
import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CommercializationProduct } from './commercialization-product';

function newCrop() {
  return Crop.create({ id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }), scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL });
}

describe('Crop — commercialization', () => {
  it('setCommercialization → snapshot expose la liste', () => {
    const c = newCrop();
    c.setCommercialization([CommercializationProduct.create({ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché'] })]);
    expect(c.toSnapshot().commercialization).toEqual([{ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché'] }]);
  });
  it('crop neuf → commercialization = []', () => {
    expect(newCrop().toSnapshot().commercialization).toEqual([]);
  });
});
```

Run: `cd apps/api && npx jest crop.commercialization --silent`
Expected: FAIL.

Implémenter (suivre le template `yields`/`YieldsSet` dans `crop.ts` et `crop-event.ts`) :
- `crop-event.ts` : ajouter `| { type: 'CommercializationSet'; commercialization: CommercializationProductJSON[] }` (importer le type JSON).
- `crop.ts` :
  - champ constructeur `private _commercialization: CommercializationProduct[]` (mutable) ; passer `[]` aux 3 sites `new Crop(...)` (create/fromEvents/fromSnapshot) — pour fromSnapshot, reconstruire depuis `s.commercialization`.
  - `setCommercialization(list: CommercializationProduct[]): void { this.raise({ type: 'CommercializationSet', commercialization: list.map((p) => p.toJSON()) }); }` (comme `setYields`).
  - `apply('CommercializationSet')` : `this._commercialization = e.commercialization.map((j) => CommercializationProduct.fromJSON(j)); this._version += 1; this._hasUnpublishedChanges = true;`.
  - getter `get commercialization(): CommercializationProduct[]`.
  - `toSnapshot` : `commercialization: this._commercialization.map((p) => p.toJSON())`.
  - `CropSnapshot` : `commercialization: CommercializationProductJSON[]`.
  - Le `Checkpoint` : ajouter `commercialization` (comme yields/nutrition y figurent) dans l'interface `Checkpoint`, `captureCheckpoint`, `restoreFromCheckpoint` (suivre exactement le traitement de `yields`).

Run: `cd apps/api && npx jest crop.commercialization --silent`
Expected: PASS.

- [ ] **Step 3: Migration Prisma (colonne `commercialization` sur `Crop`)**

`schema.prisma`, `model Crop`, ajouter après `yields` : `  commercialization Json?`.

Créer `apps/api/prisma/migrations/20260718140100_crop_commercialization/migration.sql` :

```sql
ALTER TABLE "Crop" ADD COLUMN "commercialization" JSONB;
```

Appliquer (mêmes commandes que Task 1 Step 4, nom `20260718140100_crop_commercialization`).

- [ ] **Step 4: Repo Crop**

`apps/api/src/infrastructure/crop/prisma-crop.repository.ts` :
- `toRow` : `commercialization: (s.commercialization ?? []) as unknown as Prisma.InputJsonValue`.
- `toSnapshot` : `commercialization: (row.commercialization ?? []) as unknown as CropSnapshot['commercialization']`.

- [ ] **Step 5: Complétude (11 catégories)**

`apps/api/src/application/crop/crop-completeness.ts` : ajouter `commercialization: boolean;` à `CompletenessInput`.

`apps/api/src/application/crop/crop-completeness.spec.ts` : mettre à jour le test — `computeCompleteness` reçoit désormais 11 clés ; ajuster `filled`/`total`/`percent` attendus (total 11). Ajouter `commercialization: false/true` aux entrées de test.

`apps/api/src/application/crop/crop-read-model.ts` :
- `CropDocument` : ajouter `commercialization: CommercializationProductJSON[];`.
- `toCropDocument` : `const commercialization = s.commercialization ?? [];` puis l'inclure dans l'objet retourné et dans l'appel `computeCompleteness({ …, commercialization: commercialization.length > 0 })`.

- [ ] **Step 6: Use-case setCommercialization**

`apps/api/src/application/crop/set-crop-commercialization.use-case.ts` — copier `set-crop-yields.use-case.ts` en remplaçant yields→commercialization :

```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CommercializationProduct, CommercializationProductJSON } from '../../domain/crop/commercialization-product';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropCommercializationInput { cropId: string; commercialization: CommercializationProductJSON[]; actor: string; }

export class SetCropCommercializationUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: SetCropCommercializationInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    crop.setCommercialization(input.commercialization.map((j) => CommercializationProduct.fromJSON(j)));
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { commercialization: { from: before.commercialization, to: next.commercialization } } });
    return next;
  }
}
```

- [ ] **Step 7: Contrôleur + module DI**

`apps/api/src/presentation/crop/crop.controller.ts` : injecter `SetCropCommercializationUseCase` (constructeur) et ajouter un handler `@Roles('superadmin') @Post(':id/commercialization')` sur le modèle du handler yields :

```ts
async setCommercialization(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { commercialization: { form: string; saleUnits: string[]; outlets: string[] }[] }) {
  try { const snap = await this.setCommercializationUC.execute({ cropId: id, actor: user.email, commercialization: body.commercialization }); return this.composeCropDocument(id, snap); }
  catch (e) { mapCropError(e, id); }
}
```

`apps/api/src/crop.module.ts` : importer + factory (mêmes deps que `SetCropYieldsUseCase`) :
```ts
{ provide: SetCropCommercializationUseCase, useFactory: (es, r, a, c) => new SetCropCommercializationUseCase(es, r, a, c), inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK] },
```
(reprendre les tokens exacts de la factory `SetCropYieldsUseCase`.)

- [ ] **Step 8: Compilation + suite crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest crop commercialization --silent`
Expected: clean + PASS (dont complétude mise à jour).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/domain/crop/commercialization-product.ts apps/api/src/domain/crop/commercialization-product.spec.ts apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.commercialization.spec.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/infrastructure/crop/prisma-crop.repository.ts apps/api/src/application/crop/crop-completeness.ts apps/api/src/application/crop/crop-completeness.spec.ts apps/api/src/application/crop/crop-read-model.ts apps/api/src/application/crop/set-crop-commercialization.use-case.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(crop): section commercialisation (produits/formes/débouchés) + complétude

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Commercialisation — éditeur admin

**Files:**
- Modify: `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/labels.ts`, `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/app/crops/[id]/editors/CommercializationEditor.tsx`
- Modify: la page/section qui liste les éditeurs de la fiche crop (`apps/admin/src/app/crops/[id]/...`) pour brancher le nouvel éditeur.

**Interfaces:**
- Consumes: endpoint `POST /crops/:id/commercialization` (Task 3), `CropDetail.commercialization`.

- [ ] **Step 1: Types + libellés + action**

`apps/admin/src/lib/api.ts` : `CropDetail` gagne `commercialization: { form: string; saleUnits: string[]; outlets: string[] }[]`.

`apps/admin/src/lib/labels.ts` :
```ts
export const PRODUCT_FORM_LABELS: Record<string, string> = { GRAIN: 'Grain', FLOUR: 'Farine', OIL: 'Huile', LEAF: 'Feuille', FRUIT: 'Fruit', TUBER: 'Tubercule', OTHER: 'Autre' };
export const SALE_UNIT_LABELS: Record<string, string> = { KG: 'Kg', BAG: 'Sac', CRATE: 'Caisse', TONNE: 'Tonne' };
```

`apps/admin/src/lib/actions.ts` : ajouter `setCommercialization(cropId, products)` (Server Action) qui POST `/crops/${cropId}/commercialization` avec `{ commercialization: products }`, sur le modèle de `setYields`/`setNutrition`.

- [ ] **Step 2: CommercializationEditor**

`apps/admin/src/app/crops/[id]/editors/CommercializationEditor.tsx` : liste répétable de produits ; par produit : select **forme** (`PRODUCT_FORM_LABELS`), multi-sélection **unités** (`SALE_UNIT_LABELS`), liste de chaînes **débouchés** (même UI que `inputs`/`traits`). Bouton « + produit ». Câbler la liste dans l'appel `setCommercialization`. Suivre le pattern d'un éditeur de section existant (ex. `NutritionEditor`/`PriceEditor`).

- [ ] **Step 3: Brancher l'éditeur dans la fiche**

Ajouter `CommercializationEditor` à l'endroit où les autres éditeurs de section sont rendus (chercher `NutritionEditor`/`YieldsEditor` dans `apps/admin/src/app/crops/[id]/`), avec le même conteneur/onglet.

- [ ] **Step 4: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi ; la fiche crop rend l'éditeur commercialisation.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib apps/admin/src/app/crops/\[id\]
git commit -m "feat(admin): éditeur commercialisation (produits/formes/débouchés)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Vérification finale

- [ ] **Step 1: Suite API complète (⚠️ efface la DB — prévenir)**

Run: `pnpm --filter @okko/api test`
Expected: PASS — non-régression crop (versions, diff, publish) + complétude à 11 + variétés/commercialisation.

- [ ] **Step 2: Admin — tests + build**

Run: `cd apps/admin && pnpm test`
Expected: PASS.

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 3: Smoke manuel (checklist)**

Créer une variété avec résistances (maladie + niveau) + adaptation zone (zone + aptitude) ; renseigner des produits commercialisés (forme + unités + débouchés) ; publier → vérifier diff, affichage, et complétude à 11 catégories. (Aucun commit.)

---

## Vérification finale (post-tâches)
- `pnpm --filter @okko/api test` vert (⚠️ efface la DB) ; `cd apps/admin && pnpm test` vert ; `tsc --noEmit` + `pnpm build` OK.
- Migrations `Variety` (2 colonnes) + `Crop` (1 colonne) appliquées, `migrate status` clean.

## Critères de succès (rappel spec)
- [ ] Variété : diseaseResistances (maladie référentiel + niveau) + zoneAdaptations (zone + aptitude) de l'événement à l'éditeur ; migration 2 colonnes.
- [ ] Commercialisation : produits (forme + unités + débouchés) event-sourcés + migration colonne Crop + éditeur.
- [ ] Complétude à 11 catégories ; test mis à jour.
- [ ] Clean architecture ; TDD ; réutilise PestDisease/AgroEcologicalZone/SuitabilityRating.
- [ ] Suites API + admin vertes ; builds OK.

## Suite
Récolte enrichie, post-récolte, adventices, bonnes pratiques, médias ; onglet maladies + association maladie↔stade ; brique Carnet.
