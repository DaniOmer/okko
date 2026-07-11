# Spec — Rendement par zone (+ type d'intrants + unité) — D2

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Raffiner le rendement de référence : remplacer le **niveau d'intrants** (Faible/Moyen/Élevé) par un **type d'intrants** (chimique / bio / combinaison), transformer l'**unité** en sélecteur (t/ha, kg/ha, q/ha), et exploiter le **rattachement à une zone** de production (déjà présent dans le modèle).

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D2).

## 2. Contexte (vérifié)

- `YieldReference` (`apps/api/src/domain/crop/yield-reference.ts`) : enum `InputLevel` (LOW/MEDIUM/HIGH), champ `inputLevel`, + `min`/`average`/`potential`/`unit`, et **`zoneId?` déjà présent**. Validation `min ≤ average ≤ potential`.
- Les yields sont une colonne **JSON** sur `Crop` (pas de table dédiée) → **pas de migration** ; changement de forme JSON seulement. Le flux d'événements et la DB de dev sont **vides** → **pas d'upcasting**.
- `inputLevel` apparaît dans : le modèle, le read model (ligne « Rendement »), **7 fichiers de test** API (`restore-draft`, `discard-draft`, `set-crop-nutrition`, `publish-crop`, `crop-read-model.spec`, `yield-reference.spec`, `crop.spec`) + e2e (`nutrition-price`) + helper (`complete-crop.ts`), et côté admin (`labels`, `page.tsx`, `CropReadView`, `YieldsEditor`, `lib/api`).
- ⚠️ La suite de tests API **efface la DB de dev** — prévenir avant de la lancer.

## 3. Périmètre

### Dans le lot
- **Modèle** : `InputLevel` → `InputType` (`CHEMICAL`/`ORGANIC`/`MIXED`), `inputLevel` → `inputType`. `zoneId?` inchangé.
- **Admin** : sélecteur type d'intrants ; unité en sélecteur (t/ha, kg/ha, q/ha) ; sélecteur zone (zones rattachées + « global »). Mode édition (Brique 3) conservé.
- **Affichage** : type + rendement + unité + « zone X » si rattaché.

### Hors périmètre
- **Migration** (JSON, pas de colonne) ; **upcasting** (flux vide).
- Validation stricte `zoneId ∈ zones rattachées` (le sélecteur admin le contraint déjà — durcissement possible plus tard).
- Refontes D1/D3/D4, vue client F1.

### Comportement préservé
- Ajout **et** édition d'un rendement (Brique 3) : conservés. Validation `min ≤ average ≤ potential` : conservée.
- `zoneId` **optionnel** : un rendement sans zone = « global ».
- Autres sections : inchangées.

## 4. Architecture — API

### 4.1 Modèle — `apps/api/src/domain/crop/yield-reference.ts`
- Enum : `InputLevel { LOW, MEDIUM, HIGH }` → `InputType { CHEMICAL = 'CHEMICAL', ORGANIC = 'ORGANIC', MIXED = 'MIXED' }`.
- Renommer `inputLevel` → `inputType` (type `InputType`) partout : `YieldReferenceJSON`, `CreateProps`, champ privé `_inputLevel`→`_inputType`, constructeur, getter, `create`, `toJSON`, `fromJSON`. `zoneId?` conservé. Validation inchangée.

### 4.2 Read model — `apps/api/src/application/crop/crop-read-model.ts`
- Ligne « Rendement » : `y.inputLevel` → `y.inputType`.

### 4.3 Événement & aggregat
- `YieldsSet` porte `YieldReferenceJSON[]` (avec `inputType`) — aucune autre modif d'événement. `apply`/`setYields` inchangés (ils re-mappent le JSON).

### 4.4 Use-case — `set-crop-yields.use-case.ts`
- Aucun changement de logique (l'input est `YieldReferenceJSON[]` ; `fromJSON` gère `inputType`).

### 4.5 Tests (TDD) & non-régression
- `yield-reference.spec` : round-trip porte `inputType` + `zoneId` ; `create` refuse un ordre invalide (inchangé).
- Remplacer `InputLevel.MEDIUM` → `InputType.CHEMICAL` (et l'import `InputLevel`→`InputType`) dans : `restore-draft.use-case.spec`, `discard-draft.use-case.spec`, `set-crop-nutrition.use-case.spec`, `publish-crop.use-case.spec`, `crop-read-model.spec`, `crop.spec`, `yield-reference.spec`.
- Remplacer `inputLevel: 'MEDIUM'` → `inputType: 'CHEMICAL'` dans : `apps/api/test/helpers/complete-crop.ts`, `apps/api/test/nutrition-price.e2e-spec.ts` (+ toute assertion sur `.inputLevel`).

## 5. Architecture — Admin

### 5.1 `labels.ts`
- Ajouter `INPUT_TYPE_LABELS = { CHEMICAL: 'Chimique', ORGANIC: 'Bio', MIXED: 'Combinaison' }`.
- Retirer `INPUT_LEVEL_LABELS` (devenu inutilisé après bascule des consommateurs).

### 5.2 `lib/api.ts`
- Type `YieldReference` : `inputLevel: string` → `inputType: string`. `setYields` : idem dans le corps.

### 5.3 `YieldsEditor.tsx` (mode édition conservé)
- Nouvelle prop `zones: { zoneId: string; zoneName: Record<string, string> }[]` (= `crop.zones`).
- **Type d'intrants** : select sur `INPUT_TYPE_LABELS` (remplace le select niveau) ; état `inputType`, défaut `CHEMICAL` ; en édition, init depuis `current[editIndex].inputType`.
- **Unité** : `<Input>` texte → `<Select>` `['t/ha','kg/ha','q/ha']` ; défaut `t/ha`.
- **Zone** : `<Select>` avec une option « Toutes zones (global) » (valeur vide) + une option par zone de `zones` (`value=zoneId`, libellé `zoneName.fr`) ; état `zoneId`, défaut '' ; en édition, init depuis `current[editIndex].zoneId ?? ''`.
- `nouvelItem = { inputType, min: Number(min), average: Number(avg), potential: Number(pot), unit, zoneId: zoneId || undefined }`. Reste du patron ajout/édition inchangé (reset seulement en ajout ; label/bouton Modifier/Enregistrer).

### 5.4 `page.tsx` & `CropReadView.tsx`
- Passer `zones={crop.zones}` au `YieldsEditor` (ajout dans l'en-tête + chaque éditeur d'item).
- Affichage d'un rendement : `{labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–{y.average}–{y.potential} {y.unit}` + `— zone {zoneName}` si `y.zoneId`, où `zoneName = crop.zones.find(z => z.zoneId === y.zoneId)?.zoneName.fr`. Import `INPUT_TYPE_LABELS` (remplace `INPUT_LEVEL_LABELS`).

## 6. Gestion d'erreur
- Aucune nouvelle. `zoneId` vide → global (pas d'erreur). Ordre invalide → `YieldReferenceError` (existant).

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : ajouter/éditer un rendement en choisissant type d'intrants, unité (select) et zone ; l'affichage montre le type et « zone X » quand rattaché ; sans zone = pas de mention.

## 8. Critères de succès
- [ ] `InputType` (CHEMICAL/ORGANIC/MIXED) remplace `InputLevel` ; `inputType` remplace `inputLevel` partout (modèle, read model, tests, admin). Plus aucune référence à `inputLevel`.
- [ ] Admin : type d'intrants en select ; unité en select {t/ha, kg/ha, q/ha} ; zone en select (rattachées + global) ; mode édition conservé.
- [ ] Affichage : type + « zone X » si rattaché ; `zoneId` optionnel.
- [ ] Suite API verte ; build admin vert. Pas de migration ; pas de suppression.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D2).
- API : `src/domain/crop/yield-reference.ts`, `src/application/crop/crop-read-model.ts`, specs listées §4.5.
- Admin : `src/lib/labels.ts`, `src/lib/api.ts`, `src/app/crops/[id]/editors/YieldsEditor.tsx`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/CropReadView.tsx`.
- Tests : `apps/api/test/helpers/complete-crop.ts`, `nutrition-price.e2e-spec.ts`.
