# Spec — Admin : confort & fraîcheur (Brique 1 : A1 + A2 + A3)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Corriger trois bugs d'usage transverses relevés en test réel de l'admin, chacun avec une cause racine identifiée :

- **A1** — les formulaires d'ajout ne se vident pas après soumission.
- **A2** — le dashboard et la liste de cultures affichent des données périmées après une création (refresh manuel nécessaire).
- **A3** — la sélection de date ne fonctionne pas dans le formulaire de prix.

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§A).

## 2. Périmètre

### Dans le lot
- **A1** : reset des champs après ajout réussi dans les éditeurs de type *ajout/append*.
- **A2** : `router.refresh()` après création dans les flux « mutation puis navigation ».
- **A3** : remplacer le `DatePicker` (Popover + Calendrier) par un `<input type="date">` natif, signature `value/onChange(iso)` inchangée.

### Hors périmètre
- Complétude / règle de publication / sémantique de version → **Brique 2**.
- Édition (update) des sous-items → **Brique 3**.
- Refonte des fenêtres de production / itinéraire technique → **D1**.
- Suppression des composants `calendar.tsx` / `popover.tsx` (réutilisables ailleurs — on les laisse en place, même inutilisés par le date-picker).
- Aucun changement back-end (API inchangée).

## 3. Comportement préservé
- `RequirementsEditor` (édite un singleton climatique/édaphique **pré-rempli**) : **exclu de A1** — un reset à vide y serait faux.
- Le contrat ISO `yyyy-MM-dd` de `DatePicker` (`value` / `onChange(iso)`) : **inchangé** → aucun appelant à modifier.
- `EditorShell` : **inchangé** (le fix A1 vit dans les éditeurs, pas dans la coquille).
- Toute la chaîne versioning/diff/publication : inchangée.

## 4. Architecture

### 4.1 A1 — reset des champs après ajout
**Cause.** Les champs vivent dans un `useState` du composant éditeur **externe**, toujours monté ; fermer le dialogue (`EditorShell` : `setOpen(false)`) ne le démonte pas → les valeurs persistent et réapparaissent à la réouverture.

**Fix.** Dans chaque éditeur *ajout/append*, réinitialiser les champs **dans la fonction soumise, après l'`await`** de l'appel API :
```tsx
submit(async () => {
  await addVariety(cropId, { … });
  setName(''); setMaturityDays(''); setTraits('');   // reset après succès
});
```
`EditorShell.submit` fait `await fn(); setOpen(false); router.refresh();` → le reset s'exécute avant la fermeture ; réouverture = champs vides. Si l'appel API échoue (`throw`), le reset n'a pas lieu (les valeurs saisies restent) — comportement voulu.

**Éditeurs concernés** (tous sous `apps/admin/src/app/crops/[id]/editors/`), avec les setters à remettre à leur valeur initiale :
| Éditeur | Appel | Champs à réinitialiser (valeur initiale) |
|---|---|---|
| `VarietyEditor` | `addVariety` | `name('')`, `maturityDays('')`, `traits('')` |
| `WindowEditor` | `addWindow` | `zoneId('')`, `season('')`, `sowingStart('')`, `sowingEnd('')`, `irrigation(false)`, `ops([])` |
| `PestControlEditor` | `setPestControl` | `pestId('')`, `susceptibility('MEDIUM')`, `threshold('')`, `stages('')` |
| `NutritionEditor` | `setNutrition` | `nutrient('')`, `amount('')`, `unit('kg/ha')`, `basis('PER_HECTARE')`, `stage('')` |
| `PriceEditor` | `addPrice` | `market('')`, `date('')`, `price('')`, `unit('FCFA/kg')`, `currency('XOF')` |
| `YieldsEditor` | `setYields` | `level('MEDIUM')`, `min('')`, `avg('')`, `pot('')`, `unit('t/ha')` |
| `PhenologyEditor` | `setPhenology` | `name('')`, `start('')`, `end('')` |

> Réinitialiser à la **valeur initiale du `useState`** (pas systématiquement `''` : `unit`, `basis`, `susceptibility`, `level`, `currency`, `irrigation` ont des valeurs par défaut). `RequirementsEditor` **exclu**.

### 4.2 A2 — fraîcheur du dashboard et de la liste après création
**Cause.** Les pages `*/new` font `router.push(...)` après création **sans** `router.refresh()` → le Router Cache client de Next sert un payload périmé (les `fetch` de liste sont déjà `cache: 'no-store'`, donc le trou est le cache de navigation, pas la donnée).

**Fix.** Ajouter `router.refresh()` avant la navigation dans les trois pages de création, sur le patron :
```tsx
await createCrop({ … });
router.refresh();          // invalide le Router Cache
router.push('/crops');
```
**Pages concernées :**
- `apps/admin/src/app/crops/new/page.tsx` (le cas signalé) → `router.push('/crops')`.
- `apps/admin/src/app/zones/new/page.tsx` → `router.push('/zones')`.
- `apps/admin/src/app/pests/new/page.tsx` → `router.push('/pests')`.

### 4.3 A3 — sélecteur de date natif
**Cause.** `DatePicker` monte un Radix `Popover` portalisé **hors** du `Dialog` modal (`EditorShell`) ; le dialogue modal désactive les pointer-events hors de son sous-arbre → les clics sur les jours du calendrier sont avalés.

**Fix.** Réécrire `apps/admin/src/components/date-picker.tsx` pour rendre un `<input type="date">` natif, **en gardant exactement la même interface** :
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
- La valeur d'un `<input type="date">` est déjà au format ISO `yyyy-MM-dd` → contrat inchangé, aucun appelant (`PriceEditor`) à modifier.
- Le prop `placeholder` reste dans la signature (compat), même si l'input natif ne l'utilise pas.
- On ne supprime pas `date-fns`/`calendar`/`popover` : seul le corps de `date-picker.tsx` change (plus d'import de `Calendar`/`Popover` dans ce fichier).

## 5. Gestion d'erreur
- **A1** : reset seulement après `await` réussi ; en cas d'exception, `EditorShell` affiche l'erreur et conserve la saisie.
- **A2** : `router.refresh()` est sans effet de bord si la donnée n'a pas changé ; aucune régression.
- **A3** : un `value` vide (`''`) affiche un input date vide ; `onChange` renvoie `''` si l'utilisateur efface la date (l'input natif renvoie une chaîne vide) — cohérent avec le contrat actuel.

## 6. Vérification
- **Barrière** : `pnpm --filter @okko/admin build` vert (pas de framework de test admin).
- **Smoke manuel** (déféré ; DB de dev à repeupler) :
  - ajouter deux variétés d'affilée → le second formulaire est **vide** ; idem fenêtre, ravageur, nutrition, prix, rendement, phénologie ;
  - créer une culture → dashboard (« Complétude moy. », compteurs) et liste **à jour sans reload** ; idem zone et ravageur/maladie ;
  - dans le formulaire de prix, choisir une date → elle s'affiche et **s'enregistre**.

## 7. Critères de succès
- [ ] A1 : les 7 éditeurs d'ajout réinitialisent leurs champs à leur valeur initiale après succès ; `RequirementsEditor` inchangé.
- [ ] A2 : `crops/new`, `zones/new`, `pests/new` appellent `router.refresh()` avant de naviguer.
- [ ] A3 : `date-picker.tsx` rend un `<input type="date">` natif ; signature `value/onChange(iso)` inchangée ; `PriceEditor` non modifié.
- [ ] `pnpm --filter @okko/admin build` vert.
- [ ] Aucun changement back-end ; `EditorShell` inchangé ; pas de suppression de `calendar.tsx`/`popover.tsx`.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§A).
- Fichiers : `apps/admin/src/app/crops/[id]/editors/{VarietyEditor,WindowEditor,PestControlEditor,NutritionEditor,PriceEditor,YieldsEditor,PhenologyEditor}.tsx`, `apps/admin/src/app/{crops,zones,pests}/new/page.tsx`, `apps/admin/src/components/date-picker.tsx`.
