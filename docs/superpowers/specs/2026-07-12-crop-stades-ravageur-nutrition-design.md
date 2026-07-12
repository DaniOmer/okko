# Spec — Ravageur & nutrition par stade — D3/D4

**Projet** : Okko — admin (Next.js) uniquement
**Date** : 2026-07-12
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rattacher les **stades sensibles** d'un ravageur et le **stade** d'un besoin nutritif aux **stades phénologiques** définis sur la fiche (qui portent une plage « après semis » `startDay`–`endDay` depuis D1), au lieu d'un texte libre. Enrichir l'affichage avec la plage J.

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D3, §D4).

## 2. Contexte (vérifié)

- **`PhenologicalStage`** (JSON) : `name` (multilingue), `startDay`, `endDay` (J relatifs au semis — D1), `order`. Pas d'id stable → référencé par **nom**.
- **`NutrientRequirement.stage?: string`** (texte libre) ; **`CropPestControl.sensitiveStages: string[]`** (texte libre).
- Admin : `NutritionEditor` a un champ texte `stage` ; `PestControlEditor` a un champ texte à virgules `stages` ; les deux ont déjà un **mode édition** (Brique 3). `crop.phenology` est disponible dans `page.tsx` / `CropReadView`. Pas de composant `checkbox` shadcn → on utilise `<input type="checkbox">` natif (déjà utilisé ailleurs).
- **Décisions brainstorming** : le stade reste **stocké comme son nom (chaîne)** → **zéro changement API** ; le **seuil de nuisibilité reste texte libre** ; **imposer la phénologie d'abord** (menu déroulant / cases seulement, message si vide — pas de saisie libre).

## 3. Périmètre

### Dans le lot (admin seulement)
- **Nutrition** : le champ `stage` devient un **`<Select>`** peuplé depuis `crop.phenology` (+ « Aucun »).
- **Ravageur** : le champ `sensitiveStages` devient une **liste de cases à cocher** peuplée depuis `crop.phenology`.
- **Affichage** : chaque stade référencé est affiché avec sa **plage J** (résolue depuis la phénologie) ; helper partagé `stageWithRange`.

### Hors périmètre
- **Aucun changement API / domaine / événement / migration / tests API** (le stade reste une chaîne libre au stockage).
- Structurer le **seuil de nuisibilité** (reste texte libre).
- Validation API stade∈phénologie (contrainte uniquement par l'UI).
- Vue client F1.

### Comportement préservé
- Ajout **et** édition (Brique 3) de nutrition/ravageur : conservés. `controlMethods`/threshold du ravageur préservés (Brique 3).
- Legacy : un stade stocké ne correspondant à aucun stade phénologique s'affiche **tel quel** (juste le nom) ; en édition ravageur, une valeur legacy non-phéno n'est pas cochée (donc retirée à la ré-soumission — acceptable, DB vide).
- Autres sections inchangées.

## 4. Architecture — Admin

### 4.1 Helper `stageWithRange` — `src/lib/labels.ts` (ou `format.ts`)
```ts
// Résout un nom de stade en « nom (Jx–Jy) » via la phénologie ; repli sur le nom seul.
export function stageWithRange(name: string, phenology: { name: Record<string, string>; startDay: number; endDay: number }[]): string {
  const s = phenology.find((p) => (p.name.fr ?? '') === name);
  return s ? `${name} (J${s.startDay}–J${s.endDay})` : name;
}
```

### 4.2 `NutritionEditor.tsx`
- Nouvelle prop `phenology: { name: Record<string, string>; startDay: number; endDay: number }[]`.
- Champ **stade** : `<Input>` texte → `<Select>` :
  - valeur d'état `stage` (nom du stade, `''` = aucun) ; le `<Select>` utilise la sentinelle `NONE` pour l'option vide (Radix refuse `value=""`).
  - options : `<SelectItem value="NONE">Aucun / général</SelectItem>` + une par `phenology` (`value={p.name.fr}`, libellé `stageWithRange(p.name.fr, phenology)`).
  - si `phenology.length === 0` : seule l'option « Aucun » + un `<p>` d'invite « Définissez la phénologie pour cibler un stade ».
- Soumission inchangée : `stage: stage || undefined` (mode ajout **et** édition, `editIndex`).

### 4.3 `PestControlEditor.tsx`
- Nouvelle prop `phenology` (idem).
- Champ **stades sensibles** : `<Input>` texte à virgules → **cases à cocher** :
  - état `stages: string[]` (noms cochés) — initialisé depuis `initial?.sensitiveStages ?? []`.
  - une case par `phenology` : cocher/décocher ajoute/retire le nom ; libellé `stageWithRange(p.name.fr, phenology)`.
  - si `phenology.length === 0` : message d'invite « Définissez la phénologie pour cibler des stades sensibles » (pas de saisie).
- Soumission : `sensitiveStages: stages.length ? stages : undefined` (le reste — susceptibility/threshold/controlMethods — inchangé, y compris la préservation `controlMethods` en édition).
- Le seuil de nuisibilité (`threshold`) reste un `<Input>` texte.

### 4.4 `page.tsx` & `CropReadView.tsx`
- Passer `phenology={crop.phenology}` aux `NutritionEditor` et `PestControlEditor` (en-tête d'ajout **et** chaque instance d'édition par item).
- **Affichage nutrition** : `{n.nutrient} — {n.amount} {n.unit}` + `({stageWithRange(n.stage, crop.phenology)})` si `n.stage`.
- **Affichage ravageur** : lister `p.sensitiveStages` via `stageWithRange(s, crop.phenology)` (ex. « stades sensibles : tallage (J21–J35), montaison (J35–J60) »).

## 5. Gestion d'erreur
- Aucune nouvelle (zéro API). Stade vide (nutrition) → « Aucun ». Ravageur sans stade coché → `sensitiveStages` undefined (comme aujourd'hui).

## 6. Vérification
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : définir une phénologie ; ajouter/éditer un besoin nutritif en choisissant un stade → affiché avec sa plage J ; ajouter/éditer un ravageur en cochant des stades → affichés avec plages ; sur une fiche sans phénologie → invite à la définir.
- **Zéro API** → suite API non touchée (pas de wipe DB).

## 7. Critères de succès
- [ ] Nutrition : stade en `<Select>` (phéno + « Aucun ») ; ajout et édition OK.
- [ ] Ravageur : stades sensibles en cases à cocher (phéno) ; ajout et édition OK ; threshold/controlMethods préservés.
- [ ] Affichage nutrition/ravageur avec plage J (`stageWithRange`) ; repli sur le nom si legacy.
- [ ] Sans phénologie : message d'invite ; pas de saisie libre.
- [ ] `next build` vert ; zéro changement API ; seuil de nuisibilité inchangé.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D3, §D4).
- Admin : `src/lib/labels.ts` (helper), `src/app/crops/[id]/editors/{NutritionEditor,PestControlEditor}.tsx`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/CropReadView.tsx`.
