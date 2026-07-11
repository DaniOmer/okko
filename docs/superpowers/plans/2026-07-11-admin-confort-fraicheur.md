# Admin — confort & fraîcheur (Brique 1 : A1 + A2 + A3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger trois bugs d'usage transverses de l'admin : formulaires d'ajout qui ne se vident pas (A1), dashboard/liste périmés après création (A2), sélecteur de date cassé dans le formulaire de prix (A3).

**Architecture :** Trois correctifs indépendants, tous côté admin, sans changement back-end ni modification d'`EditorShell`. A1 = reset des champs après succès dans chaque éditeur d'ajout. A2 = `router.refresh()` avant navigation dans les pages de création. A3 = réécriture de `date-picker.tsx` en `<input type="date">` natif à contrat identique.

**Tech Stack :** Next.js 14 (App Router), TypeScript, React hooks, shadcn/ui, Tailwind.

## Global Constraints

- **Zéro changement back-end** ; API inchangée.
- **`EditorShell` inchangé** : le fix A1 vit dans les éditeurs, pas dans la coquille.
- **Pas de framework de test admin** : barrière = **`pnpm --filter @okko/admin build`** vert + smoke manuel (à rapporter ; app live non lancée par l'implémenteur, DB de dev à repeupler).
- **A1** : réinitialiser chaque champ à la **valeur initiale de son `useState`** (pas systématiquement `''`), et **seulement après** l'`await` réussi de l'appel API (dans la fonction passée à `submit`). `RequirementsEditor` est **exclu** (édite un singleton pré-rempli).
- **A3** : conserver **exactement** la signature `DatePicker({ value, onChange, placeholder?, id? })` avec `value`/`onChange` en ISO `yyyy-MM-dd` → aucun appelant à modifier ; ne pas supprimer `calendar.tsx`/`popover.tsx`/`date-fns`.
- Copie UI en français. Commits `fix(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**A1 — reset (Task 1) :** `apps/admin/src/app/crops/[id]/editors/{VarietyEditor,WindowEditor,PestControlEditor,NutritionEditor,PriceEditor,YieldsEditor,PhenologyEditor}.tsx`

**A2 — refresh (Task 2) :** `apps/admin/src/app/{crops,zones,pests}/new/page.tsx`

**A3 — date native (Task 3) :** `apps/admin/src/components/date-picker.tsx`

Les trois tâches sont indépendantes (fichiers disjoints) et peuvent être revues séparément.

---

## Task 1 : A1 — vider les formulaires d'ajout après succès

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`

**Interfaces:**
- Consumes : `EditorShell` render-prop `{ submit, close, busy }` où `submit(fn)` fait `await fn(); setOpen(false); router.refresh()`. Chaque éditeur détient ses champs dans des `useState`.
- Produces : après un ajout réussi, les champs reviennent à leur valeur initiale ; `EditorShell` non modifié.

**Principe (identique pour chaque éditeur) :** transformer la fonction passée à `submit` pour qu'elle soit `async`, `await` l'appel API, puis remettre chaque `setX` à la valeur initiale de son `useState`. Ne rien changer d'autre (JSX, validation, imports).

- [ ] **Step 1 : Lire les 7 éditeurs** pour repérer la ligne exacte `submit(...)` et les setters de chacun. Chaque fichier suit le patron `submit(() => appelAPI(...))` (parfois précédé du calcul d'un `next`).

- [ ] **Step 2 : `VarietyEditor.tsx`** — le corps actuel appelle `addVariety`. Remplacer l'appel `submit(() => addVariety(cropId, { … }))` par une fonction `async` qui reset après succès. Champs & valeurs initiales : `name('')`, `maturityDays('')`, `traits('')`.
```tsx
submit(async () => {
  await addVariety(cropId, {
    name: { fr: name },
    maturityDays: maturityDays ? Number(maturityDays) : undefined,
    traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
  });
  setName(''); setMaturityDays(''); setTraits('');
});
```
> Reprendre **verbatim** le contenu de l'objet passé à `addVariety` tel qu'il est déjà dans le fichier (ci-dessus = la forme actuelle) ; seule la structure `submit(() => …)` → `submit(async () => { await …; reset })` change.

- [ ] **Step 3 : `WindowEditor.tsx`** — appel `addWindow`. Champs & valeurs initiales : `zoneId('')`, `season('')`, `sowingStart('')`, `sowingEnd('')`, `irrigation(false)`, `ops([])`.
```tsx
submit(async () => {
  await addWindow(cropId, {
    /* … objet actuel passé à addWindow, repris verbatim … */
  });
  setZoneId(''); setSeason(''); setSowingStart(''); setSowingEnd(''); setIrrigation(false); setOps([]);
});
```
> Conserver **verbatim** l'objet actuellement passé à `addWindow` (dont `operations: ops.map(...)`). N'ajouter que l'`await` et les resets.

- [ ] **Step 4 : `PestControlEditor.tsx`** — appel `setPestControl`. Champs & valeurs initiales : `pestId('')`, `susceptibility('MEDIUM')`, `threshold('')`, `stages('')`.
```tsx
submit(async () => {
  await setPestControl(cropId, pestId, {
    /* … objet actuel repris verbatim (susceptibility, threshold, sensitiveStages) … */
  });
  setPestId(''); setSusceptibility('MEDIUM'); setThreshold(''); setStages('');
});
```

- [ ] **Step 5 : `NutritionEditor.tsx`** — construit `next` puis appelle `setNutrition(cropId, next)`. Champs & valeurs initiales : `nutrient('')`, `amount('')`, `unit('kg/ha')`, `basis('PER_HECTARE')`, `stage('')`.
```tsx
submit(async () => {
  await setNutrition(cropId, next);
  setNutrient(''); setAmount(''); setUnit('kg/ha'); setBasis('PER_HECTARE'); setStage('');
});
```
> Laisser le calcul de `next` (à partir de la liste courante + nouvel élément) **inchangé, avant** l'appel `submit`.

- [ ] **Step 6 : `PriceEditor.tsx`** — appel `addPrice`. Champs & valeurs initiales : `market('')`, `date('')`, `price('')`, `unit('FCFA/kg')`, `currency('XOF')`. Le `submit` est déclenché depuis `onSubmit` du `<form>` après le garde `if (!date) return;`.
```tsx
submit(async () => {
  await addPrice(cropId, { market, date, price: Number(price), unit, currency });
  setMarket(''); setDate(''); setPrice(''); setUnit('FCFA/kg'); setCurrency('XOF');
});
```

- [ ] **Step 7 : `YieldsEditor.tsx`** — construit `next` puis appelle `setYields(cropId, next)`. Champs & valeurs initiales : `level('MEDIUM')`, `min('')`, `avg('')`, `pot('')`, `unit('t/ha')`.
```tsx
submit(async () => {
  await setYields(cropId, next);
  setLevel('MEDIUM'); setMin(''); setAvg(''); setPot(''); setUnit('t/ha');
});
```
> Laisser le calcul de `next` **inchangé, avant** l'appel `submit`.

- [ ] **Step 8 : `PhenologyEditor.tsx`** — construit `next = [...current, { … }]` puis appelle `setPhenology(cropId, next)`. Champs & valeurs initiales : `name('')`, `start('')`, `end('')`.
```tsx
submit(async () => {
  await setPhenology(cropId, next);
  setName(''); setStart(''); setEnd('');
});
```
> Laisser le calcul de `next` **inchangé, avant** l'appel `submit`.

- [ ] **Step 9 : Ne PAS toucher `RequirementsEditor.tsx`** (édite un singleton pré-rempli — exclu de A1).

- [ ] **Step 10 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (compile + typecheck ; les fonctions `submit` sont maintenant `async`, ce qui est compatible avec la signature `submit(fn: () => Promise<unknown>)`).

- [ ] **Step 11 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/editors/VarietyEditor.tsx apps/admin/src/app/crops/\[id\]/editors/WindowEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PestControlEditor.tsx apps/admin/src/app/crops/\[id\]/editors/NutritionEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PriceEditor.tsx apps/admin/src/app/crops/\[id\]/editors/YieldsEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PhenologyEditor.tsx
git commit -m "fix(admin): vider les formulaires d'ajout après soumission réussie

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : A2 — rafraîchir dashboard & liste après création

**Files:**
- Modify: `apps/admin/src/app/crops/new/page.tsx`
- Modify: `apps/admin/src/app/zones/new/page.tsx`
- Modify: `apps/admin/src/app/pests/new/page.tsx`

**Interfaces:**
- Consumes : `useRouter()` (déjà importé et utilisé dans ces pages via `router.push`).
- Produces : après création, le Router Cache client est invalidé → dashboard/liste frais à la navigation suivante.

- [ ] **Step 1 : `crops/new/page.tsx`** — dans le `try` de `submit`, insérer `router.refresh()` entre l'`await createCrop(...)` et le `router.push('/crops')` :
```tsx
await createCrop({ commonNames: { fr }, scientificName, family, cycleType });
router.refresh();
router.push('/crops');
```

- [ ] **Step 2 : `zones/new/page.tsx`** — même patron :
```tsx
await createZone({ name: { fr }, country, koppen: koppen || undefined });
router.refresh();
router.push('/zones');
```
> Reprendre **verbatim** l'objet actuellement passé à `createZone` ; n'ajouter que la ligne `router.refresh();`.

- [ ] **Step 3 : `pests/new/page.tsx`** — même patron :
```tsx
await createPest({ name: { fr }, type, scientificName: scientificName || undefined });
router.refresh();
router.push('/pests');
```
> Reprendre **verbatim** l'objet actuellement passé à `createPest` ; n'ajouter que la ligne `router.refresh();`.

- [ ] **Step 4 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert**.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/new/page.tsx apps/admin/src/app/zones/new/page.tsx apps/admin/src/app/pests/new/page.tsx
git commit -m "fix(admin): router.refresh() après création pour rafraîchir dashboard et listes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : A3 — sélecteur de date natif

**Files:**
- Modify: `apps/admin/src/components/date-picker.tsx`

**Interfaces:**
- Consumes : rien de nouveau (input HTML natif).
- Produces : `DatePicker({ value, onChange, placeholder?, id? })` — **signature identique** ; `value`/`onChange` en ISO `yyyy-MM-dd`. `PriceEditor` (seul appelant) inchangé.

- [ ] **Step 1 : Réécrire `date-picker.tsx`** — remplacer **tout le contenu** du fichier (le composant Popover+Calendar) par un `<input type="date">` natif à contrat identique :
```tsx
'use client';

export function DatePicker({
  value,
  onChange,
  id,
}: {
  value: string;                    // ISO yyyy-MM-dd
  onChange: (iso: string) => void;
  placeholder?: string;             // conservé pour compat d'appel ; non utilisé par l'input natif
  id?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}
```
> Les imports `date-fns`, `Calendar`, `Popover`, `lucide-react`, `cn`, `Button` de l'ancienne version disparaissent de **ce** fichier (plus utilisés ici). `placeholder` reste dans le type pour ne casser aucun appel, même s'il n'est pas rendu par l'input natif. Ne pas modifier `PriceEditor.tsx`.

- [ ] **Step 2 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (aucun import inutilisé restant dans `date-picker.tsx` ; `PriceEditor` compile sans changement — la signature est préservée).

- [ ] **Step 3 : Smoke manuel** (à rapporter, non bloquant). API sur `:3001` + `pnpm --filter @okko/admin dev` : ouvrir le formulaire « + Ajouter un relevé de prix » d'une culture, choisir une date → elle s'affiche et l'ajout s'enregistre (la date apparaît dans la liste des prix).

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/components/date-picker.tsx
git commit -m "fix(admin): sélecteur de date natif (input type=date) à contrat ISO inchangé

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **A1** : les 7 éditeurs d'ajout réinitialisent leurs champs **à leur valeur initiale** (pas tous à `''`) et **seulement après succès** ; `EditorShell` et `RequirementsEditor` inchangés ; validation/JSX/objets API repris verbatim.
- **A2** : `router.refresh()` présent avant navigation dans `crops/new`, `zones/new`, `pests/new`.
- **A3** : `date-picker.tsx` = `<input type="date">` natif ; signature `value/onChange(iso)` inchangée ; `PriceEditor` non modifié ; `calendar.tsx`/`popover.tsx` conservés.
- Zéro back-end ; `pnpm --filter @okko/admin build` vert à chaque tâche.

## Self-review (couverture spec)

- §4.1 A1 reset (7 éditeurs, valeurs initiales, après succès, RequirementsEditor exclu) → Task 1 (Steps 2-9). ✅
- §4.2 A2 refresh (crops/zones/pests new) → Task 2. ✅
- §4.3 A3 input natif (contrat inchangé, PriceEditor intact) → Task 3. ✅
- §6 vérification (build + smoke) → chaque tâche. ✅
- §2 hors périmètre (back-end, EditorShell, suppression calendar/popover) → Global Constraints + Notes finales. ✅
