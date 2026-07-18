# Enrichir les sections existantes de la fiche Culture (léger) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les champs manquants à 5 sections existantes (identité, exigences, calendrier, fertilisation, itinéraire) de la fiche Culture event-sourcée, de l'event/VO jusqu'à l'éditeur admin, en TDD strict et sans migration Prisma.

**Architecture:** Fiche Culture event-sourcée (`apps/api`, hexagonal). Pour les 4 sections « section-VO » (climatique, phénologie, nutrition, itinéraire), l'input du use-case EST le JSON du value object et le read-model le passe tel quel → **étendre le VO propage de bout en bout** ; seule l'**identité** (champs inline dans `CropCreated`/`IdentityEdited` + `CropDocument`) touche l'agrégat, les use-cases create/update et le read-model. Admin : éditeurs + `lib/api.ts` + libellés.

**Tech Stack:** NestJS 10, Prisma 5 (colonnes JSON), Jest (event-sourcing) ; Next.js 14 admin, Vitest.

## Global Constraints

- **Clean architecture** : modifier dans l'ordre `domain/` (VO purs) → `application/` (use-cases, projection, read-model) → `presentation/`/admin. Les VO restent sans dépendance framework.
- **TDD strict** : pour chaque champ, écrire d'abord un test **rouge** (round-trip VO ou agrégat/use-case), puis l'implémentation minimale (vert).
- **Champs optionnels** au sein de leur section (remplissage incrémental) : chaque nouveau champ est `?:` dans le JSON/VO ; `fromJSON` lit `undefined` proprement, `toJSON` l'omet si absent. Pas de gestion de rétro-compatibilité d'events (données existantes supprimables ; la suite de tests efface la DB).
- **Aucune migration Prisma** (sections en colonnes JSON : `climatic`, `phenology`, `nutrition` sur `Crop` ; `operations` sur `CroppingWindow` ; identité sur `Crop`). **Aucune nouvelle catégorie de complétude.**
- **Enums** : code technique + table de libellés FR côté admin (`lib/labels.ts`), comme `CYCLE_TYPE_LABELS`.
- **Pattern VO** (à suivre pour chaque VO) : interface `…JSON`, `CreateProps`, constructeur privé, `static create`, getters, `toJSON`, `static fromJSON`. Ajouter un champ optionnel = l'ajouter à ces 6 endroits (cf. `stage?` dans `NutrientRequirement`, `notes?` dans `TechnicalOperation`).
- **Commits** : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Identité — `usageCategory` + `description`

**Files:**
- Modify: `apps/api/src/domain/crop/crop-event.ts` (events `CropCreated`, `IdentityEdited`)
- Modify: `apps/api/src/domain/crop/crop.ts` (agrégat : champs, create, fromEvents, apply, editIdentity, getters, snapshot)
- Modify: `apps/api/src/application/crop/create-crop.use-case.ts`
- Modify: `apps/api/src/application/crop/update-crop.use-case.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts` (`CropDocument` + `toCropDocument` + `serializedText`)
- Test: `apps/api/src/domain/crop/crop.identity.spec.ts` (nouveau)
- Modify (admin): `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/labels.ts`, `apps/admin/src/app/crops/[id]/editors/IdentityEditor.tsx`

**Interfaces:**
- Produces : `Crop.create` et `editIdentity` acceptent `usageCategory?: string` et `description?: Record<string, string>` ; `CropSnapshot` et `CropDocument` exposent `usageCategory?`/`description?`.

- [ ] **Step 1: Écrire le test agrégat (échoue)**

`apps/api/src/domain/crop/crop.identity.spec.ts` :

```ts
import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';

function newCrop() {
  return Crop.create({
    id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
    usageCategory: 'CEREAL', description: { fr: 'Céréale de base' },
  });
}

describe('Crop identity — usageCategory + description', () => {
  it('create expose usageCategory + description dans le snapshot', () => {
    const s = newCrop().toSnapshot();
    expect(s.usageCategory).toBe('CEREAL');
    expect(s.description).toEqual({ fr: 'Céréale de base' });
  });
  it('editIdentity met à jour usageCategory + description', () => {
    const c = newCrop();
    c.editIdentity({ scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, usageCategory: 'FODDER', description: { fr: 'Fourrage' } });
    const s = c.toSnapshot();
    expect(s.usageCategory).toBe('FODDER');
    expect(s.description).toEqual({ fr: 'Fourrage' });
  });
  it('create sans usageCategory/description → undefined (optionnel)', () => {
    const s = Crop.create({ id: 'c2', commonNames: TranslatableText.create({ fr: 'X' }), scientificName: 'X', family: 'Y', cycleType: CycleType.SEASONAL_ANNUAL }).toSnapshot();
    expect(s.usageCategory).toBeUndefined();
    expect(s.description).toBeUndefined();
  });
});
```

Run: `cd apps/api && npx jest crop.identity --silent`
Expected: FAIL (create/editIdentity n'acceptent pas encore ces champs ; snapshot ne les a pas).

- [ ] **Step 2: Étendre les events**

`apps/api/src/domain/crop/crop-event.ts` — ajouter les champs optionnels :

```ts
  | { type: 'CropCreated'; commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType; usageCategory?: string; description?: Record<string, string> }
```
et
```ts
  | { type: 'IdentityEdited'; scientificName: string; family: string; cycleType: CycleType; usageCategory?: string; description?: Record<string, string> }
```

- [ ] **Step 3: Étendre l'agrégat `Crop`**

Dans `apps/api/src/domain/crop/crop.ts` :
- Ajouter deux champs au constructeur (params positionnels **mutables**, après `_yields`) : `private _usageCategory: string | undefined`, `private _description: Record<string, string> | undefined`. → Les **3** sites d'appel de `new Crop(...)` doivent passer une valeur pour ces deux nouveaux params (voir ci-dessous).
- `static create(props)` : accepter `usageCategory?: string; description?: Record<string, string>` dans `props` ; au `new Crop(...)`, passer `props.usageCategory, props.description` en dernier ; inclure dans l'event : `crop._pending.push({ type: 'CropCreated', …, usageCategory: props.usageCategory, description: props.description })`.
- `static fromEvents` : au `new Crop(...)` (identité posée depuis `CropCreated`, variable `c`), passer `c.usageCategory, c.description` en dernier.
- `static fromSnapshot(s)` : au `new Crop(...)`, passer `s.usageCategory, s.description` en dernier.
- `apply('IdentityEdited')` : ajouter `this._usageCategory = e.usageCategory; this._description = e.description;` (réaffectation, d'où des champs mutables).
- `editIdentity(p)` : élargir la signature à `{ scientificName; family; cycleType; usageCategory?: string; description?: Record<string, string> }` et inclure `usageCategory`/`description` dans l'event `IdentityEdited` émis.
- Ajouter les getters `get usageCategory(): string | undefined { return this._usageCategory; }` et `get description(): Record<string, string> | undefined { return this._description; }`.
- `toSnapshot()` : ajouter `usageCategory: this._usageCategory, description: this._description`.
- `fromSnapshot(s)` : passer `s.usageCategory`, `s.description` au constructeur.
- `CropSnapshot` (interface, même fichier ou son fichier) : ajouter `usageCategory?: string; description?: Record<string, string>`.

Run: `cd apps/api && npx jest crop.identity --silent`
Expected: PASS.

- [ ] **Step 4: Use-cases create + update**

`apps/api/src/application/crop/create-crop.use-case.ts` : ajouter `usageCategory?: string; description?: Record<string, string>` à l'input `CreateCropInput` et les passer à `Crop.create({ …, usageCategory: input.usageCategory, description: input.description })`.

`apps/api/src/application/crop/update-crop.use-case.ts` : ajouter `usageCategory?: string; description?: Record<string, string>` à l'input et les passer à `crop.editIdentity({ …, usageCategory: input.usageCategory, description: input.description })` (là où l'identité est éditée).

- [ ] **Step 5: Read-model + serializedText**

`apps/api/src/application/crop/crop-read-model.ts` :
- `interface CropDocument` : ajouter `usageCategory?: string; description?: Record<string, string>;`.
- `toCropDocument(s, opts)` : dans l'objet retourné, ajouter `usageCategory: s.usageCategory, description: s.description`.
- `serializedText` (les `lines`) : après la ligne « Famille », ajouter si présent :
  ```ts
  if (s.usageCategory) lines.push(`Catégorie : ${s.usageCategory}`);
  ```

- [ ] **Step 6: Compilation API + suite crop**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/api && npx jest crop --silent`
Expected: PASS (identité + non-régression crop unitaire).

- [ ] **Step 7: Admin — types, libellés, éditeur**

`apps/admin/src/lib/api.ts` : ajouter `usageCategory?: string; description?: Record<string, string>` à `CropDocument` (et donc `CropDetail`) ; élargir la signature de `updateCrop` pour accepter `usageCategory?` et `description?`.

`apps/admin/src/lib/labels.ts` : ajouter
```ts
export const USAGE_CATEGORY_LABELS: Record<string, string> = {
  CEREAL: 'Céréale', LEGUME: 'Légumineuse', VEGETABLE: 'Maraîchère', FRUIT: 'Fruitière',
  TUBER: 'Tubercule', INDUSTRIAL: 'Industrielle', FODDER: 'Fourragère', TREE: 'Arboricole',
};
```

`apps/admin/src/app/crops/[id]/editors/IdentityEditor.tsx` : ajouter un **select** « Catégorie d'usage » (options depuis `USAGE_CATEGORY_LABELS`, via `@/components/ui/select`) et un **textarea** « Description » (clé `fr`), câblés dans l'appel `updateCrop(cropId, { …, usageCategory, description: { fr: description } })`. Suivre le pattern des champs existants de l'éditeur (state local + submit).

- [ ] **Step 8: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/domain/crop apps/api/src/application/crop apps/admin/src/lib apps/admin/src/app/crops/\[id\]/editors/IdentityEditor.tsx
git commit -m "feat(crop): identité — catégorie d'usage + description

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Exigences — `altitude` + `waterNeed` + `droughtSensitivity`

**Files:**
- Modify: `apps/api/src/domain/shared/climatic-requirements.ts`
- Modify: `apps/api/src/application/crop/crop-read-model.ts` (serializedText)
- Test: `apps/api/src/domain/shared/climatic-requirements.spec.ts` (créer si absent, sinon étendre)
- Modify (admin): `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/labels.ts`, `apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx`

**Interfaces:**
- Consumes : `RangeValue`.
- Produces : `ClimaticRequirementsJSON` gagne `altitude?`, `waterNeed?`, `droughtSensitivity?` — propagé automatiquement via `SetCropRequirementsInput.climatic` (JSON du VO), l'event `ClimaticRequirementsSet`, le snapshot et `CropDocument.climatic` (passe-plat).

- [ ] **Step 1: Test round-trip du VO (échoue)**

`apps/api/src/domain/shared/climatic-requirements.spec.ts` (créer, ou ajouter ce `describe` s'il existe) :

```ts
import { ClimaticRequirements } from './climatic-requirements';
import { RangeValue } from './range-value';

describe('ClimaticRequirements — altitude + waterNeed + droughtSensitivity', () => {
  it('round-trip toJSON/fromJSON conserve les nouveaux champs', () => {
    const c = ClimaticRequirements.create({
      altitude: RangeValue.create({ min: 0, optimal: 800, max: 2000, unit: 'm' }),
      waterNeed: 'MEDIUM', droughtSensitivity: 'LOW',
    });
    const json = c.toJSON();
    expect(json.altitude).toEqual({ min: 0, optimal: 800, max: 2000, unit: 'm' });
    expect(json.waterNeed).toBe('MEDIUM');
    expect(json.droughtSensitivity).toBe('LOW');
    const back = ClimaticRequirements.fromJSON(json);
    expect(back.altitude?.optimal).toBe(800);
    expect(back.waterNeed).toBe('MEDIUM');
    expect(back.droughtSensitivity).toBe('LOW');
  });
  it('champs absents → undefined', () => {
    const json = ClimaticRequirements.create({}).toJSON();
    expect(json.altitude).toBeUndefined();
    expect(json.waterNeed).toBeUndefined();
    expect(json.droughtSensitivity).toBeUndefined();
  });
});
```

Run: `cd apps/api && npx jest climatic-requirements --silent`
Expected: FAIL.

- [ ] **Step 2: Étendre le VO `ClimaticRequirements`**

Dans `apps/api/src/domain/shared/climatic-requirements.ts` :
- `interface ClimaticProps` : ajouter `altitude?: RangeValue; waterNeed?: string; droughtSensitivity?: string;`.
- `interface ClimaticRequirementsJSON` : ajouter `altitude?: ReturnType<RangeValue['toJSON']>; waterNeed?: string; droughtSensitivity?: string;`.
- getters : `get altitude(): RangeValue | undefined { return this.props.altitude; }`, `get waterNeed(): string | undefined { return this.props.waterNeed; }`, `get droughtSensitivity(): string | undefined { return this.props.droughtSensitivity; }`.
- `toJSON()` : ajouter `altitude: this.props.altitude?.toJSON(), waterNeed: this.props.waterNeed, droughtSensitivity: this.props.droughtSensitivity`.
- `fromJSON(json)` : ajouter `altitude: json.altitude ? RangeValue.create(json.altitude) : undefined, waterNeed: json.waterNeed, droughtSensitivity: json.droughtSensitivity`.

Run: `cd apps/api && npx jest climatic-requirements --silent`
Expected: PASS.

- [ ] **Step 3: serializedText**

`apps/api/src/application/crop/crop-read-model.ts` — après le bloc `if (s.climatic?.rainfall)`, ajouter :

```ts
  if (s.climatic?.altitude) {
    const a = s.climatic.altitude;
    lines.push(`Altitude : ${a.min}–${a.optimal}–${a.max} ${a.unit}`);
  }
  if (s.climatic?.waterNeed) lines.push(`Besoin en eau : ${s.climatic.waterNeed}`);
  if (s.climatic?.droughtSensitivity) lines.push(`Sensibilité sécheresse : ${s.climatic.droughtSensitivity}`);
```

- [ ] **Step 4: Compilation + suite crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest crop climatic-requirements --silent`
Expected: clean + PASS.

- [ ] **Step 5: Admin — types, libellés, éditeur**

`apps/admin/src/lib/api.ts` : dans le type `climatic` de `CropDetail`, ajouter `altitude?: { min: number; optimal: number; max: number; unit: string }; waterNeed?: string; droughtSensitivity?: string`.

`apps/admin/src/lib/labels.ts` :
```ts
export const WATER_NEED_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé' };
export const DROUGHT_SENSITIVITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };
```

`apps/admin/src/app/crops/[id]/editors/RequirementsEditor.tsx` : ajouter un champ **altitude** (min/optimal/max, unité `m`) sur le même pattern que température/pluviométrie, et deux **selects** besoin en eau / sensibilité sécheresse (libellés ci-dessus), câblés dans le payload `climatic` envoyé à `setRequirements`.

- [ ] **Step 6: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/domain/shared/climatic-requirements.ts apps/api/src/domain/shared/climatic-requirements.spec.ts apps/api/src/application/crop/crop-read-model.ts apps/admin/src/lib apps/admin/src/app/crops/\[id\]/editors/RequirementsEditor.tsx
git commit -m "feat(crop): exigences — altitude + besoin en eau + sensibilité sécheresse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Calendrier — `description` + `recommendedWork` par stade

**Files:**
- Modify: `apps/api/src/domain/crop/phenological-stage.ts`
- Test: `apps/api/src/domain/crop/phenological-stage.spec.ts` (créer/étendre)
- Modify (admin): `apps/admin/src/lib/api.ts`, `apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`

**Interfaces:**
- Produces : `PhenologicalStageJSON` gagne `description?: string`, `recommendedWork?: string` — propagé via l'event `PhenologySet` (JSON du VO), le snapshot et `CropDocument.phenology` (passe-plat).

- [ ] **Step 1: Test round-trip du VO (échoue)**

`apps/api/src/domain/crop/phenological-stage.spec.ts` (créer/ajouter) :

```ts
import { PhenologicalStage } from './phenological-stage';
import { TranslatableText } from '../shared/translatable-text';

describe('PhenologicalStage — description + recommendedWork', () => {
  it('round-trip conserve les nouveaux champs', () => {
    const s = PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'Floraison' }), startDay: 40, endDay: 55, order: 3,
      description: 'Apparition des fleurs', recommendedWork: 'Surveiller les pollinisateurs',
    });
    const json = s.toJSON();
    expect(json.description).toBe('Apparition des fleurs');
    expect(json.recommendedWork).toBe('Surveiller les pollinisateurs');
    const back = PhenologicalStage.fromJSON(json);
    expect(back.description).toBe('Apparition des fleurs');
    expect(back.recommendedWork).toBe('Surveiller les pollinisateurs');
  });
  it('champs absents → undefined', () => {
    const json = PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Levée' }), startDay: 0, endDay: 7, order: 0 }).toJSON();
    expect(json.description).toBeUndefined();
    expect(json.recommendedWork).toBeUndefined();
  });
});
```

Run: `cd apps/api && npx jest phenological-stage --silent`
Expected: FAIL.

- [ ] **Step 2: Étendre le VO `PhenologicalStage`**

Dans `apps/api/src/domain/crop/phenological-stage.ts` :
- `interface PhenologicalStageJSON` : ajouter `description?: string; recommendedWork?: string;`.
- `interface CreateProps` : ajouter `description?: string; recommendedWork?: string;`.
- Constructeur : ajouter deux params `private readonly _description: string | undefined`, `private readonly _recommendedWork: string | undefined`.
- `static create` : passer `props.description`, `props.recommendedWork` au constructeur.
- getters : `get description(): string | undefined { return this._description; }`, `get recommendedWork(): string | undefined { return this._recommendedWork; }`.
- `toJSON()` : ajouter `description: this._description, recommendedWork: this._recommendedWork`.
- `fromJSON(json)` : passer `json.description`, `json.recommendedWork` au constructeur.

Run: `cd apps/api && npx jest phenological-stage --silent`
Expected: PASS.

- [ ] **Step 3: Compilation + suite crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest crop phenological-stage --silent`
Expected: clean + PASS.

- [ ] **Step 4: Admin — types + éditeur**

`apps/admin/src/lib/api.ts` : `PhenologicalStage` gagne `description?: string; recommendedWork?: string`.

`apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx` : pour chaque stade, ajouter deux **textarea** « Description » et « Travaux recommandés », câblés dans le payload de `setPhenology`. Suivre le pattern des champs de stade existants (name/startDay/endDay).

- [ ] **Step 5: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/crop/phenological-stage.ts apps/api/src/domain/crop/phenological-stage.spec.ts apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/PhenologyEditor.tsx
git commit -m "feat(crop): calendrier — description + travaux recommandés par stade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fertilisation — `method` par apport

**Files:**
- Modify: `apps/api/src/domain/crop/nutrient-requirement.ts`
- Test: `apps/api/src/domain/crop/nutrient-requirement.spec.ts` (créer/étendre)
- Modify (admin): `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/labels.ts`, `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`

**Interfaces:**
- Produces : `NutrientRequirementJSON` gagne `method?: string` — propagé via l'event `NutritionSet` (JSON du VO), le snapshot et `CropDocument.nutrition` (passe-plat).

- [ ] **Step 1: Test round-trip du VO (échoue)**

`apps/api/src/domain/crop/nutrient-requirement.spec.ts` (créer/ajouter) :

```ts
import { NutrientRequirement, NutrientBasis } from './nutrient-requirement';

describe('NutrientRequirement — method', () => {
  it('round-trip conserve method', () => {
    const n = NutrientRequirement.create({ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE, stage: 'Levée', method: 'BROADCAST' });
    const json = n.toJSON();
    expect(json.method).toBe('BROADCAST');
    expect(NutrientRequirement.fromJSON(json).method).toBe('BROADCAST');
  });
  it('method absent → undefined', () => {
    const json = NutrientRequirement.create({ nutrient: 'P', amount: 40, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }).toJSON();
    expect(json.method).toBeUndefined();
  });
});
```

Run: `cd apps/api && npx jest nutrient-requirement --silent`
Expected: FAIL.

- [ ] **Step 2: Étendre le VO `NutrientRequirement`**

Dans `apps/api/src/domain/crop/nutrient-requirement.ts` (même pattern que `stage?`) :
- `NutrientRequirementJSON` : ajouter `method?: string;`.
- `CreateProps` : ajouter `method?: string;`.
- Constructeur : ajouter `private readonly _method: string | undefined`.
- `static create` : passer `props.method`.
- getter : `get method(): string | undefined { return this._method; }`.
- `toJSON()` : ajouter `method: this._method`.
- `fromJSON(json)` : passer `json.method`.

Run: `cd apps/api && npx jest nutrient-requirement --silent`
Expected: PASS.

- [ ] **Step 3: Compilation + suite crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest crop nutrient-requirement --silent`
Expected: clean + PASS.

- [ ] **Step 4: Admin — types, libellés, éditeur**

`apps/admin/src/lib/api.ts` : `NutrientRequirement` gagne `method?: string`.

`apps/admin/src/lib/labels.ts` :
```ts
export const FERTILIZATION_METHOD_LABELS: Record<string, string> = {
  BROADCAST: 'Épandage', LOCALIZED: 'Localisé', FOLIAR: 'Foliaire', FERTIGATION: 'Fertirrigation',
};
```

`apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx` : pour chaque apport, ajouter un **select** « Méthode d'application » (libellés ci-dessus), câblé dans le payload de `setNutrition`. Suivre le pattern des champs existants (nutrient/amount/unit/basis/stage).

- [ ] **Step 5: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/crop/nutrient-requirement.ts apps/api/src/domain/crop/nutrient-requirement.spec.ts apps/admin/src/lib apps/admin/src/app/crops/\[id\]/editors/NutritionEditor.tsx
git commit -m "feat(crop): fertilisation — méthode d'application

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Itinéraire technique — `equipment` par opération

**Files:**
- Modify: `apps/api/src/domain/window/technical-operation.ts`
- Test: `apps/api/src/domain/window/technical-operation.spec.ts` (créer/étendre)
- Modify (admin): `apps/admin/src/lib/api.ts`, `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`

**Interfaces:**
- Produces : `TechnicalOperationJSON` gagne `equipment?: string[]` — propagé via le snapshot de fenêtre (`CroppingWindowSnapshot.operations`), le repo `CroppingWindow` (colonne JSON `operations`) et `CropDocument.croppingWindows`.

- [ ] **Step 1: Test round-trip du VO (échoue)**

`apps/api/src/domain/window/technical-operation.spec.ts` (créer/ajouter) :

```ts
import { TechnicalOperation } from './technical-operation';
import { TranslatableText } from '../shared/translatable-text';
import { OperationType } from './operation-type';

describe('TechnicalOperation — equipment', () => {
  it('round-trip conserve equipment', () => {
    const op = TechnicalOperation.create({
      type: OperationType.SOWING, label: TranslatableText.create({ fr: 'Semis' }), timingDays: 0,
      inputs: ['semences'], equipment: ['semoir', 'tracteur'],
    });
    const json = op.toJSON();
    expect(json.equipment).toEqual(['semoir', 'tracteur']);
    expect(TechnicalOperation.fromJSON(json).equipment).toEqual(['semoir', 'tracteur']);
  });
  it('equipment absent → [] (par défaut)', () => {
    const json = TechnicalOperation.create({ type: OperationType.SOWING, label: TranslatableText.create({ fr: 'Semis' }), timingDays: 0 }).toJSON();
    expect(json.equipment).toEqual([]);
  });
});
```

> Note : vérifier la valeur exacte d'un membre de `OperationType` dans `apps/api/src/domain/window/operation-type.ts` et l'utiliser (ex. `OperationType.SOWING` ou l'équivalent réel).

Run: `cd apps/api && npx jest technical-operation --silent`
Expected: FAIL.

- [ ] **Step 2: Étendre le VO `TechnicalOperation`**

Dans `apps/api/src/domain/window/technical-operation.ts` (même pattern que `inputs`) :
- `TechnicalOperationJSON` : ajouter `equipment: string[];` (toujours présent, `[]` par défaut — comme `inputs`).
- `CreateProps` : ajouter `equipment?: string[];`.
- Constructeur : ajouter `private readonly _equipment: string[]`.
- `static create` : passer `props.equipment ?? []`.
- getter : `get equipment(): string[] { return [...this._equipment]; }`.
- `toJSON()` : ajouter `equipment: [...this._equipment]`.
- `fromJSON(json)` : passer `[...(json.equipment ?? [])]` (tolère l'absence).

Run: `cd apps/api && npx jest technical-operation --silent`
Expected: PASS.

- [ ] **Step 3: Compilation + suite fenêtre/crop**

Run: `cd apps/api && npx tsc --noEmit && npx jest technical-operation window crop --silent`
Expected: clean + PASS.

- [ ] **Step 4: Admin — types + éditeur**

`apps/admin/src/lib/api.ts` : `TechnicalOperation` gagne `equipment?: string[]` (ou `equipment: string[]`).

`apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx` : pour chaque opération, ajouter un champ **matériel** (liste de chaînes), même UI que `inputs`, câblé dans le payload d'`addWindow`/`updateWindow`.

- [ ] **Step 5: Compilation + build admin**

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain/window/technical-operation.ts apps/api/src/domain/window/technical-operation.spec.ts apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/WindowEditor.tsx
git commit -m "feat(crop): itinéraire — matériel par opération

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Vérification finale

**Files:** aucune modification (vérification).

- [ ] **Step 1: Suite API complète (⚠️ efface la DB — prévenir)**

Run: `pnpm --filter @okko/api test`
Expected: PASS — non-régression complète (versions, diff, complétude, publish) + les nouveaux champs.

- [ ] **Step 2: Admin — tests + build**

Run: `cd apps/admin && pnpm test`
Expected: PASS.

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 3: Smoke manuel (checklist)**

Éditer une fiche : catégorie d'usage + description ; altitude + besoin en eau + sensibilité sécheresse ; description + travaux par stade ; méthode de fertilisation ; matériel d'opération → **publier** → vérifier le rendu du diff et l'affichage. (Aucun commit — vérification.)

---

## Vérification finale (post-tâches)
- `pnpm --filter @okko/api test` vert (⚠️ efface la DB) ; `cd apps/admin && pnpm test` vert ; `tsc --noEmit` + `pnpm build` OK.
- Les 5 sections exposent leurs nouveaux champs de l'event à l'éditeur ; diff lisible.

## Critères de succès (rappel spec)
- [ ] Les 5 sections exposent leurs nouveaux champs (identité, exigences, calendrier, fertilisation, itinéraire).
- [ ] Champs optionnels ; clean architecture (domain→application→présentation) ; chaque couche en TDD.
- [ ] Aucune migration Prisma ; aucune nouvelle catégorie de complétude.
- [ ] Enums via code + libellés FR ; `equipment`/matériel en liste ; description/travaux en texte.
- [ ] Suites API (dont non-régression crop) + admin vertes ; build OK.

## Suite
Brique « moyen » : variétés structurées + symptômes ravageurs/maladies + commercialisation enrichie (migrations).
