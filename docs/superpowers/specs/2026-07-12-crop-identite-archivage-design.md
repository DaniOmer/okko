# Spec — Édition de l'identité & archivage de culture

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-12
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Boucher deux trous du back-office : (1) **éditer l'identité** d'une culture (nom, nom scientifique, famille, type de cycle) — aujourd'hui figée après création ; (2) **archiver / désarchiver** une culture (retrait réversible), aujourd'hui absent de l'UI.

Référence : backlog vision Phase 0 (complétude admin).

## 2. Contexte (vérifié)

- **Identité** : `UpdateCropUseCase` + `PATCH /crops/:id` gèrent uniquement `commonNames` (via `rename`) + `metadata`. `scientificName`, `family`, `cycleType` sont **posés à la création** (`CropCreated`) et **immuables** (pas d'événement/méthode de mutation ; champs `readonly` dans l'agrégat). Aucun éditeur admin d'identité.
- **Archivage** : le domaine a `archive()` (événement `Archived`), mais la machine à états (`crop-status.ts`) n'autorise que `PUBLISHED → ARCHIVED`, `PUBLISHED → PUBLISHED`, `ARCHIVED → DRAFT`. Pas de `DRAFT → ARCHIVED`, pas d'`unarchive()`, pas de use-case/endpoint/UI. La liste `/crops` affiche tout.
- Colonnes `scientificName/family/cycleType` déjà présentes sur la projection `Crop` → **pas de migration**. Flux d'événements + DB vides → **pas d'upcasting**.
- `CropStatusError` (transition illégale) est déjà mappée → `ConflictException (409)` par `mapCropError`.
- ⚠️ La suite de tests API **efface la DB de dev** — prévenir.
- **Décisions brainstorming** : identité **complète** éditable ; archivage **réversible seulement** (pas de suppression dure) ; archivable depuis **brouillon ET publié** ; archivées **masquées** de la liste par défaut.

## 3. Périmètre

### Dans le lot
- **API identité** : événement `IdentityEdited` + `editIdentity` ; `UpdateCropUseCase` accepte `scientificName?/family?/cycleType?` ; `PATCH /crops/:id` étendu.
- **API archivage** : assouplir la machine à états (`DRAFT → ARCHIVED`) ; `unarchive()` + événement `Unarchived` ; `ArchiveCropUseCase` + `UnarchiveCropUseCase` ; `POST /crops/:id/archive` + `/unarchive`.
- **Admin** : éditeur d'identité ; boutons Archiver/Désarchiver ; liste masquant les archivées + vue « Archivées » avec Désarchiver.

### Hors périmètre
- **Suppression dure** (incompatible event-sourcing/audit).
- Édition de `metadata` via UI ; refonte de la liste ; sources ouvertes (#1) ; migration (colonnes existent).

### Comportement préservé
- `rename` (commonNames) et le reste de `UpdateCropUseCase` : inchangés (on ajoute des champs optionnels).
- Les versions publiées figées (`PublishedCrop`) : **conservées** à l'archivage.
- Publication/complétude/diff : inchangés. Éditer l'identité déclenche `hasUnpublishedChanges` (comme les autres éditions).

## 4. Architecture — API

### 4.1 Identité éditable
- **Événement** (`crop-event.ts`) : `| { type: 'IdentityEdited'; scientificName: string; family: string; cycleType: CycleType }`.
- **Domaine** (`crop.ts`) : rendre `_scientificName/_family/_cycleType` **mutables** ; méthode `editIdentity(p: { scientificName: string; family: string; cycleType: CycleType }): void { this.raise({ type: 'IdentityEdited', ...p }); }` ; `apply` : `case 'IdentityEdited': this._scientificName = e.scientificName; this._family = e.family; this._cycleType = e.cycleType; this._version += 1; this._hasUnpublishedChanges = true; break;`.
- **`UpdateCropUseCase`** : `UpdateCropInput` gagne `scientificName?: string; family?: string; cycleType?: CycleType`. Dans `execute`, après le bloc `rename`/`metadata` : si l'un des trois est fourni, appeler `crop.editIdentity({ scientificName: input.scientificName ?? before.scientificName, family: input.family ?? before.family, cycleType: (input.cycleType ?? before.cycleType) as CycleType })` (on complète avec les valeurs actuelles pour un événement complet). Ajouter au journal d'audit `changes.identity` si modifié.
- **Endpoint** (`crop.controller.ts`) : `@Patch(':id')` — le `@Body()` accepte en plus `scientificName?/family?/cycleType?` (passés à `updateCrop.execute`).

### 4.2 Archivage réversible
- **Machine à états** (`crop-status.ts`) : ajouter `CropStatus.ARCHIVED` à la liste autorisée depuis `DRAFT` → `[CropStatus.PUBLISHED, CropStatus.ARCHIVED]`.
- **Domaine** (`crop.ts`) : `archive()` existe. Ajouter `unarchive(): void { assertCanTransition(this._status, CropStatus.DRAFT); this.raise({ type: 'Unarchived' }); }` ; événement `Unarchived` ; `apply` : `case 'Unarchived': this._status = CropStatus.DRAFT; break;`. (L'`Archived` existant met `_status = ARCHIVED`.)
- **Use-cases** (miroir léger de `PublishCropUseCase`, sans figer de document) :
  - `ArchiveCropUseCase.execute({ id, actor })` : charge les événements, `crop.archive()`, append, `crops.save(next)`, audit `{ status: 'ARCHIVED' }`.
  - `UnarchiveCropUseCase.execute({ id, actor })` : idem avec `crop.unarchive()`, audit `{ status: 'DRAFT' }`.
- **Endpoints** (`crop.controller.ts`) : `@Post(':id/archive')` et `@Post(':id/unarchive')` → renvoient `toCropDocument(snap)` ; erreurs via `mapCropError` (`CropStatusError → 409` déjà mappé). Providers câblés dans `crop.module.ts`.

### 4.3 Tests (TDD)
- `update-crop` / nouveau `crop.spec` : `editIdentity` met à jour les trois champs (round-trip), `_hasUnpublishedChanges` passe à true.
- `archive-crop.use-case.spec` / `unarchive-crop.use-case.spec` : archive un brouillon **et** un publié → statut ARCHIVED ; unarchive → DRAFT ; transition illégale (ex. archive d'un déjà archivé) → `CropStatusError`.
- e2e : `PATCH /crops/:id` avec `{ family, cycleType }` → `GET` reflète ; `POST /archive` puis `GET` status ARCHIVED ; `POST /unarchive` → DRAFT ; archive illégale → 409.
- Non-régression : la garde de publication (Brique 2) et les e2e existants restent verts.

## 5. Architecture — Admin

### 5.1 `lib/api.ts`
- `updateCrop(id, body)` : le corps accepte `{ commonNames?, scientificName?, family?, cycleType? }` (`PATCH /crops/:id`). (Vérifier s'il existe déjà une fonction ; sinon l'ajouter.)
- `archiveCrop(id)` : `POST /crops/:id/archive`. `unarchiveCrop(id)` : `POST /crops/:id/unarchive`.

### 5.2 Éditeur d'identité — `editors/IdentityEditor.tsx`
`EditorShell` label « Modifier l'identité » ; champs pré-remplis : **nom (fr)** (`commonNames.fr`), **nom scientifique**, **famille**, **type de cycle** (`<Select>` sur `CYCLE_TYPE_LABELS`). Soumission `updateCrop(cropId, { commonNames: { fr }, scientificName, family, cycleType })`. Placé dans l'en-tête de la fiche (`crops/[id]/page.tsx`), à côté du nom.
> Le composant reçoit les valeurs actuelles en props (`initial`).

### 5.3 Archivage — bouton sur la fiche
Dans `crops/[id]/page.tsx` : si `status !== 'ARCHIVED'` → bouton **Archiver** (confirmation via `EditorShell` : « Archiver cette culture ? Elle sera retirée de la liste. ») → `archiveCrop` puis `router.push('/crops')`. Si `status === 'ARCHIVED'` → bandeau « Culture archivée » + bouton **Désarchiver** → `unarchiveCrop` (revient en brouillon).

### 5.4 Liste — masquer les archivées
`crops/page.tsx` (server component, `searchParams`) :
- Par défaut : n'afficher que `status !== 'ARCHIVED'`.
- Un lien « **Archivées (N)** » (`?archived=1`) affiche **uniquement** les archivées, chacune avec un bouton **Désarchiver** ; un lien retour « ← Cultures actives ».
- `N` = nombre d'archivées (calculé depuis `listCrops()`).

## 6. Gestion d'erreur
- Transition illégale (archive d'une archivée, unarchive d'une non-archivée) → **409** (`CropStatusError`). Culture inexistante → 404. Identité : `cycleType` invalide contraint par le select admin (API loose).

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : modifier l'identité (nom/scientifique/famille/cycle) → reflété ; archiver une culture → disparaît de la liste, visible dans « Archivées », désarchivable → revient active (brouillon).

## 8. Critères de succès
- [ ] Identité : `IdentityEdited` + `editIdentity` + `UpdateCropUseCase`/`PATCH` étendus ; les 4 champs éditables ; éditeur admin.
- [ ] Archivage : `DRAFT → ARCHIVED` autorisé ; `archive`/`unarchive` (use-cases + endpoints) ; boutons admin ; liste masque les archivées + vue « Archivées » avec Désarchiver ; versions publiées conservées.
- [ ] Transitions illégales → 409. Suite API verte ; build admin vert. Pas de suppression dure ; pas de migration.

## Références
- API : `src/domain/crop/{crop,crop-event,crop-status}.ts`, `src/application/crop/{update-crop,archive-crop,unarchive-crop}.use-case.ts`, `src/presentation/crop/crop.controller.ts`, `src/crop.module.ts`.
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/editors/IdentityEditor.tsx` (nouveau), `src/app/crops/page.tsx`, `src/lib/labels.ts` (`CYCLE_TYPE_LABELS`, `CROP_STATUS_LABELS`).
