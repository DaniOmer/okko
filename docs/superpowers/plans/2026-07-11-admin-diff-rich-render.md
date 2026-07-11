# Admin — rendu riche du diff par sous-champ (polish) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les items `changed` du diff par sous-champ (« maturityDays : 120 → 130 ») via `changed[].fields` au lieu de deux blocs JSON entiers.

**Architecture :** Aucun changement back-end — on consomme le `fields` déjà renvoyé par l'API. On déclare `fields` dans le type `ItemChange` admin, et on rend chaque item modifié comme une liste de `FieldRow` (composant déjà présent) sur `c.fields`.

**Tech Stack :** Next.js 14, TypeScript, Tailwind.

## Global Constraints

- **Aucun changement back-end** ; `changed[].fields: FieldChange[]` est déjà fourni par l'API (piste 3 mergée).
- **Pas de framework de test admin** : barrière = **`pnpm --filter @okko/admin build`** vert + smoke manuel (à rapporter ; app live non lancée par l'implémenteur).
- **Libellés = clés brutes en repli** : `FieldRow` utilise `FIELD_LABELS[f.field] ?? f.field` — aucune nouvelle map.
- **Portée** : seuls les items `changed` changent de rendu. **Ajoutés / Supprimés** et les **champs de haut niveau** (`diff.fields`) : inchangés. `BeforeAfter` reste utilisé par `FieldRow` (champs complexes).
- Copie UI en français. Commit `feat(admin):`. Terminer le message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**Modifiés :**
- `apps/admin/src/lib/api.ts` — `ItemChange` gagne `fields`.
- `apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx` — rendu des items `changed` par `FieldRow`.

---

## Task 1 : `ItemChange.fields` (admin) + rendu riche des items modifiés

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx`

**Interfaces:**
- Consumes : `FieldRow` (déjà dans `CropDiffView.tsx`), `FieldChange` (déjà dans `api.ts`).
- Produces : `ItemChange { key, before, after, fields: FieldChange[] }` côté admin.

- [ ] **Step 1 : Déclarer `fields` sur `ItemChange`** — dans `apps/admin/src/lib/api.ts`, l'interface `ItemChange` :
```ts
export interface ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[]; }
```
(`FieldChange` est déjà défini dans ce fichier.)

- [ ] **Step 2 : Rendu riche des items `changed`** — dans `apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx`, dans `SectionBlock`, à l'intérieur du groupe **Modifiés**, remplacer le corps de la map `diff.changed.map(...)`. Le corps actuel rend `itemLabel(...)` + `<BeforeAfter before={c.before} after={c.after} />` ; le remplacer par une liste de `FieldRow` sur `c.fields` :
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
> Lire le bloc « Modifiés » actuel de `SectionBlock` pour remplacer exactement la map existante. Ne toucher ni aux groupes **Ajoutés**/**Supprimés**, ni au bloc « Champs modifiés » de haut niveau, ni à `FieldRow`/`BeforeAfter`/`itemLabel` (réutilisés tels quels). Le prop `key` extérieur reste `c.key`. `c.fields` est toujours non vide pour un item modifié.

- [ ] **Step 3 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (compile + typecheck ; `c.fields` est désormais typé grâce au Step 1).

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant). API sur `:3001` + `pnpm --filter @okko/admin dev` : sur une culture avec une variété modifiée entre deux versions publiées, la vue de diff (`/crops/[id]/diff`) affiche « maturityDays : 120 → 130 » sous le libellé de l'item (au lieu de deux blocs JSON) ; ajoutés/supprimés et champs de haut niveau inchangés.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx
git commit -m "feat(admin): rendu du diff par sous-champ pour les items modifiés

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- Items `changed` rendus par sous-champ (`FieldRow` sur `c.fields`) au lieu de blocs JSON entiers ; libellés bruts en repli.
- Ajoutés/Supprimés et champs de haut niveau inchangés ; `FieldRow`/`BeforeAfter`/`itemLabel` réutilisés sans modif.
- Zéro back-end ; `pnpm --filter @okko/admin build` vert.
