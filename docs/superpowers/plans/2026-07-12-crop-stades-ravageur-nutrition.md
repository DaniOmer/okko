# Ravageur & nutrition par stade — D3/D4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le stade d'un besoin nutritif et les stades sensibles d'un ravageur se choisissent parmi les stades phénologiques de la fiche (affichés avec leur plage « après semis » J), au lieu de texte libre.

**Architecture :** Admin uniquement, aucun changement API (le stade reste stocké comme son nom, une chaîne). Task 1 : un helper `stageWithRange` + les deux éditeurs (Nutrition → `<Select>` de stade ; Ravageur → cases à cocher) recevant `phenology`, et `page.tsx` leur passe `crop.phenology`. Task 2 : l'affichage (nutrition + ravageur) montre les stades avec leur plage J.

**Tech Stack :** Next.js 14, TypeScript, shadcn/ui (Select), `<input type="checkbox">` natif.

## Global Constraints

- **Zéro changement API / domaine / migration / test API** : le stade reste une chaîne (nom du stade) au stockage ; on ne fait que contraindre la saisie admin et enrichir l'affichage. La suite API n'est **pas** touchée (pas de wipe DB).
- **Imposer la phénologie d'abord** : si `crop.phenology` est vide, le sélecteur/les cases affichent un **message d'invite**, pas de saisie libre.
- **Seuil de nuisibilité inchangé** (reste `<Input>` texte).
- **Ajout ET édition** (Brique 3) des deux éditeurs conservés ; `controlMethods`/threshold du ravageur préservés en édition.
- **Radix Select** refuse `value=""` → l'option « Aucun » de la nutrition utilise la sentinelle `NONE`.
- **Legacy** : un stade stocké absent de la phénologie s'affiche tel quel (repli sur le nom).
- **Admin** : barrière = `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 :** `apps/admin/src/lib/labels.ts` (helper) ; `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx` ; `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx` ; `apps/admin/src/app/crops/[id]/page.tsx` (passer `phenology` aux éditeurs).
**Task 2 :** `apps/admin/src/app/crops/[id]/page.tsx` (affichage) ; `apps/admin/src/app/crops/[id]/CropReadView.tsx`.

Type partagé pour la prop : `Phen = { name: Record<string, string>; startDay: number; endDay: number }[]` (compatible avec `crop.phenology`).

---

## Task 1 : helper + éditeurs (stade en select / cases à cocher) + wiring

**Files:**
- Modify: `apps/admin/src/lib/labels.ts`
- Modify: `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (props `phenology`)

**Interfaces:**
- Produces : `stageWithRange(name, phenology): string` ; `NutritionEditor`/`PestControlEditor` acceptent `phenology`.

- [ ] **Step 1 : Helper `stageWithRange`** — dans `apps/admin/src/lib/labels.ts` (près de `labelOf`) :
```ts
// Résout un nom de stade en « nom (Jx–Jy) » via la phénologie ; repli sur le nom seul.
export function stageWithRange(
  name: string,
  phenology: { name: Record<string, string>; startDay: number; endDay: number }[],
): string {
  const s = phenology.find((p) => (p.name.fr ?? '') === name);
  return s ? `${name} (J${s.startDay}–J${s.endDay})` : name;
}
```

- [ ] **Step 2 : `NutritionEditor.tsx` — stade en `<Select>`** — ajouter la prop `phenology` et remplacer le champ stade :
  - Signature : `export function NutritionEditor({ cropId, current, phenology, editIndex }: { cropId: string; current: NutrientRequirement[]; phenology: { name: Record<string, string>; startDay: number; endDay: number }[]; editIndex?: number })`.
  - Importer `stageWithRange` depuis `@/lib/labels` (à côté de `NUTRITION_BASIS_LABELS`).
  - Le state `stage` et la logique de soumission restent inchangés (`stage: stage || undefined` ; reset en ajout `setStage('')`).
  - Remplacer le bloc « Stade (optionnel) » (l'`<Input>`) par :
```tsx
          <div className="space-y-1">
            <Label>Stade (optionnel)</Label>
            <Select value={stage || 'NONE'} onValueChange={(v) => setStage(v === 'NONE' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Aucun / général</SelectItem>
                {phenology.map((p) => <SelectItem key={p.name.fr} value={p.name.fr}>{stageWithRange(p.name.fr, phenology)}</SelectItem>)}
              </SelectContent>
            </Select>
            {phenology.length === 0 && <p className="text-xs text-muted-foreground">Définissez la phénologie pour cibler un stade.</p>}
          </div>
```
  (`Select`, `SelectItem`, etc. sont déjà importés.)

- [ ] **Step 3 : `PestControlEditor.tsx` — stades sensibles en cases à cocher** — ajouter la prop `phenology` et remplacer le champ texte :
  - Signature : ajouter `phenology: { name: Record<string, string>; startDay: number; endDay: number }[]` aux props.
  - Importer `stageWithRange` depuis `@/lib/labels` (à côté de `SUSCEPTIBILITY_LABELS`).
  - Remplacer l'état `const [stages, setStages] = useState((initial?.sensitiveStages ?? []).join(', '));` par :
```tsx
  const [stages, setStages] = useState<string[]>(initial?.sensitiveStages ?? []);
```
  - Dans la soumission, remplacer `sensitiveStages: stages ? stages.split(',')...` par :
```tsx
                sensitiveStages: stages.length ? stages : undefined,
```
  - Dans le reset (mode ajout), remplacer `setStages('')` par `setStages([])`.
  - Remplacer le bloc « Stades sensibles (optionnel) » (l'`<Input>`) par :
```tsx
          <div className="space-y-1">
            <Label>Stades sensibles (optionnel)</Label>
            {phenology.length === 0
              ? <p className="text-xs text-muted-foreground">Définissez la phénologie pour cibler des stades sensibles.</p>
              : phenology.map((p) => {
                  const nm = p.name.fr;
                  return (
                    <label key={nm} className="flex gap-2 items-center">
                      <input type="checkbox" checked={stages.includes(nm)} onChange={(e) => setStages(e.target.checked ? [...stages, nm] : stages.filter((x) => x !== nm))} />
                      {stageWithRange(nm, phenology)}
                    </label>
                  );
                })}
          </div>
```

- [ ] **Step 4 : `page.tsx` — passer `phenology`** — ajouter `phenology={crop.phenology}` aux **4** instances d'éditeur :
  - Nutrition en-tête : `<NutritionEditor cropId={params.id} current={crop.nutrition} phenology={crop.phenology} />`.
  - Nutrition par item : `<NutritionEditor cropId={params.id} current={crop.nutrition} editIndex={i} phenology={crop.phenology} />`.
  - Ravageur en-tête : `<PestControlEditor cropId={params.id} pests={pests} phenology={crop.phenology} />`.
  - Ravageur par item : `<PestControlEditor cropId={params.id} pests={pests} initial={{ … }} phenology={crop.phenology} />` (garder l'`initial` existant).

- [ ] **Step 5 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert (les 4 instances passent la prop requise `phenology`).

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/lib/labels.ts apps/admin/src/app/crops/\[id\]/editors/NutritionEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PestControlEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): stade nutrition en select + stades sensibles ravageur en cases (par phénologie)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : affichage des stades avec plage J

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (affichage nutrition + ravageur)
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx`

**Interfaces:**
- Consumes : `stageWithRange` (Task 1), `crop.phenology`.

- [ ] **Step 1 : `page.tsx` — nutrition avec plage** — importer `stageWithRange` (depuis `@/lib/labels`). Dans l'affichage d'un besoin nutritif, remplacer `(${n.stage})` par la plage :
```tsx
<span>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${stageWithRange(n.stage, crop.phenology)})` : ''}</span>
```
(reprendre exactement la ligne existante et ne changer que la partie `n.stage`.)

- [ ] **Step 2 : `page.tsx` — ravageur : lister les stades sensibles** — dans la Card Ravageurs, sous la liste `controlMethods` de chaque ravageur, ajouter une ligne si `p.sensitiveStages` non vide :
```tsx
{p.sensitiveStages.length > 0 && (
  <p className="text-xs text-muted-foreground">Stades sensibles : {p.sensitiveStages.map((s) => stageWithRange(s, crop.phenology)).join(', ')}</p>
)}
```
(placer après le `</ul>` des `controlMethods`, à l'intérieur du `<div key={p.pestId}>`.)

- [ ] **Step 3 : `CropReadView.tsx`** — importer `stageWithRange` si absent. Appliquer les **mêmes** deux changements : nutrition `(${stageWithRange(n.stage, crop.phenology)})` ; ravageur ligne « Stades sensibles : … » sous les `controlMethods`. (`CropReadView` reçoit `crop` avec `phenology`.)

- [ ] **Step 4 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 5 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Définir une phénologie (ex. Levée J5–J12, Tallage J21–J35) ; ajouter un besoin nutritif au stade « Tallage » → affiché « (Tallage (J21–J35)) » ; ajouter un ravageur en cochant « Tallage » → « Stades sensibles : Tallage (J21–J35) » ; sur une fiche sans phénologie → message d'invite dans les deux éditeurs.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/page.tsx apps/admin/src/app/crops/\[id\]/CropReadView.tsx
git commit -m "feat(admin): affiche les stades (nutrition/ravageur) avec leur plage J

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- Nutrition : stade en `<Select>` (phéno + « Aucun » via sentinelle `NONE`) ; ravageur : stades sensibles en cases à cocher (phéno) ; les deux avec message d'invite si phéno vide ; ajout + édition conservés ; threshold/controlMethods préservés.
- Affichage nutrition + ravageur avec plage J (`stageWithRange`), repli sur le nom si legacy.
- Zéro changement API ; seuil de nuisibilité inchangé ; build admin vert.

## Self-review (couverture spec)

- §4.1 helper → Task 1 Step 1. §4.2 nutrition select → Step 2. §4.3 ravageur cases → Step 3. §4.4 wiring phenology → Step 4 ; affichage → Task 2. ✅
- §3 « imposer la phénologie » (message si vide) → Task 1 Steps 2-3. ✅
- §3 hors périmètre (API, seuil) → Global Constraints + Notes. ✅
- §6 vérification (build + smoke) → Task 1 Step 5, Task 2 Steps 4-5. ✅
