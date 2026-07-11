# Spec — Admin : rendu riche du diff par sous-champ (polish)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Afficher les items **modifiés** du diff par **sous-champ** (« maturité : 120 → 130 ») au lieu de deux blocs JSON entiers avant/après. Exploite le `fields` ajouté à `ItemChange` côté API (piste 3, mergée).

**Contexte (vérifié) :** l'API renvoie désormais `changed[].fields: FieldChange[]` (sous-champs directs modifiés). Le composant admin `CropDiffView` (`src/app/crops/[id]/diff/CropDiffView.tsx`) rend actuellement chaque item modifié via `itemLabel` + `BeforeAfter` (deux `<pre>` JSON). Il possède déjà `FieldRow` (rendu « libellé : avant → après » scalaire / bloc compact objet).

**Décision (brainstorming 2026-07-11) :** libellés de sous-champs = **clés brutes** en repli (`FIELD_LABELS[clé] ?? clé`) — pas de map FR dédiée.

## 2. Périmètre

### Dans le lot
- `ItemChange` admin gagne `fields: FieldChange[]` (`src/lib/api.ts`).
- `CropDiffView` : les items `changed` rendus par liste de `FieldRow` (via `c.fields`) au lieu de `BeforeAfter`.

### Hors périmètre
- Map de libellés FR pour sous-champs (écartée).
- Rendu des champs cœur/valeur **complexes** de haut niveau (restent en JSON — pas de `fields` côté API).
- Note de publication (piste 4) ; changement back-end.

## 3. Comportement préservé
- **Ajoutés / Supprimés** : inchangés (listes de libellés d'items).
- **Champs modifiés de haut niveau** (`diff.fields`) : inchangés (scalaire inline / JSON).
- `BeforeAfter` reste utilisé par `FieldRow` pour les valeurs objet/tableau.

## 4. Architecture

### 4.1 Type admin — `src/lib/api.ts`
```ts
export interface ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[]; }
```

### 4.2 Rendu — `src/app/crops/[id]/diff/CropDiffView.tsx`
Dans `SectionBlock`, remplacer le rendu des items `changed` :
```tsx
{diff.changed.map((c) => (
  <div key={c.key} className="space-y-1">
    <div className="text-sm font-medium">{itemLabel(diff.section, c.before)}</div>
    <ul className="space-y-1 text-sm pl-4">
      {c.fields.map((f, i) => <FieldRow key={i} change={f} />)}
    </ul>
  </div>
))}
```
- `FieldRow` (existant) : sous-champ scalaire → « libellé : avant → après » inline ; objet/tableau → `BeforeAfter` compact. Libellé = `FIELD_LABELS[f.field] ?? f.field` (repli sur la clé brute).
- `c.fields` est toujours non vide pour un item modifié (before ≠ after ⇒ ≥ 1 clé diffère) → pas de cas vide.
- Le `key` du `<div>` extérieur = `c.key` (clé stable de l'`ItemChange`).
- `BeforeAfter` **n'est plus appelé directement** dans le rendu des items modifiés (mais reste dans `FieldRow`).

## 5. Gestion d'erreur
- Aucune nouvelle. Le type admin `ItemChange` déclare désormais `fields` (l'API le fournit toujours).

## 6. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck) sans erreur.
- Smoke manuel : sur une culture avec une variété modifiée entre deux versions, la vue de diff affiche « maturityDays : 120 → 130 » sous le libellé de l'item, au lieu de deux blocs JSON.

## 7. Critères de succès
- [ ] `ItemChange.fields` déclaré côté admin.
- [ ] Items `changed` rendus via `FieldRow` sur `c.fields` (plus de blocs JSON entiers pour eux).
- [ ] Ajoutés/Supprimés et champs de haut niveau inchangés.
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Map de libellés / champs complexes / note **non** inclus.

## Références
- Piste 3 (API `fields`) : `docs/superpowers/specs/2026-07-11-crop-diff-subfields-design.md`.
- D2 (diff admin) : `docs/superpowers/specs/2026-07-11-admin-version-diff-design.md`.
- Code : `src/lib/api.ts`, `src/app/crops/[id]/diff/CropDiffView.tsx`.
