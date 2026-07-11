# Spec — Diff : descente dans les sous-champs d'un item modifié (API)

**Projet** : Okko — API
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Enrichir le diff sémantique (`diffCropDocuments`, C3) pour préciser **quels champs** d'un item de section modifié diffèrent, au lieu de ne renvoyer que l'item entier avant/après. Chaque item `changed` gagne une liste `fields` des sous-champs modifiés (`{ field, before, after }`). Prépare le rendu riche côté admin (piste 2, qui consommera `fields`).

**Contexte (vérifié) :** `crop-diff.ts` renvoie aujourd'hui `changed: ItemChange[]` avec `ItemChange { key, before, after }` (item entier). `deepEqual` (insensible à l'ordre des clés) existe déjà dans ce module.

**Décision (brainstorming 2026-07-11) :** **profondeur = un niveau** — on diffe les **champs directs** de l'item ; un champ dont la valeur est un objet/tableau imbriqué est reporté **en entier** (avant/après), sans descendre dedans (cohérent avec le traitement des champs cœur).

## 2. Périmètre

### Dans le lot
- `ItemChange` gagne `fields: FieldChange[]` (rétro-compatible : `key`/`before`/`after` conservés).
- Helper `diffObjectFields` + branchement dans la boucle `changed`.
- Tests unitaires (+ complétion des assertions existantes) ; non-régression e2e.

### Hors périmètre
- **Diff récursif / chemins** (`name.fr`, `controlMethods[0].category`) → non traité (un seul niveau).
- **Rendu admin** du détail par champ → piste 2 (séparée).
- Sections-valeur (phénologie/nutrition/rendements) et champs cœur → inchangés.
- Changement de stockage/schéma → aucun.

## 3. Comportement préservé
- `changed[].before`/`after` : **conservés** → l'admin D2 (qui les affiche) reste fonctionnel.
- Champs cœur, sections-valeur, added/removed : inchangés.
- Aucune mutation, aucun schéma : ajout **purement additif** à une fonction pure.

## 4. Architecture

### 4.1 `crop-diff.ts`
- **`ItemChange`** :
```ts
export interface ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[]; }
```
- **Helper** (module) :
```ts
function diffObjectFields(before: unknown, after: unknown): FieldChange[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (!deepEqual(b[k], a[k])) out.push({ field: k, before: b[k], after: a[k] });
  }
  return out;
}
```
- **Boucle `changed`** (sections à clé) :
```ts
if (afterItem !== undefined && !deepEqual(beforeItem, afterItem))
  changed.push({ key: k, before: beforeItem, after: afterItem, fields: diffObjectFields(beforeItem, afterItem) });
```
- Le reste de `diffCropDocuments` (champs cœur, sections-valeur, added/removed) : inchangé.

## 5. Gestion d'erreur
- Aucune nouvelle (fonction pure ; `diffObjectFields` gère `before`/`after` nuls via `?? {}`).

## 6. Tests
- **Unit** (`crop-diff.spec`) :
  - variété modifiée (`maturityDays 120→130`, `name` identique) → `changed[0].fields` égale `[{ field: 'maturityDays', before: 120, after: 130 }]` ; `changed[0].before`/`after` toujours présents (items entiers).
  - zone modifiée par `rating` → `fields: [{ field: 'rating', … }]`.
  - champ imbriqué modifié (`name.fr` change) → `fields` reporte l'objet `name` **entier** (un seul niveau, pas de chemin `name.fr`).
  - **Compléter** le test existant « variété modifiée (même id) → changed » : ajouter la clé `fields` à l'objet attendu.
- **Non-régression** : `crop-diff.e2e` reste vert (ajout additif) ; si un cas y asserte la forme de `changed`, le compléter avec `fields`.

## 7. Critères de succès
- [ ] `ItemChange.fields: FieldChange[]` + `diffObjectFields` + branchement dans `changed`.
- [ ] `before`/`after` conservés (rétro-compat admin).
- [ ] Un niveau de profondeur (valeurs imbriquées reportées entières).
- [ ] Suite API entière verte (unit complétés + e2e).
- [ ] Récursif / rendu admin **non** inclus.

## Références
- C3 (diff) : `docs/superpowers/specs/2026-07-11-crop-version-diff-design.md`.
- Code : `apps/api/src/application/crop/crop-diff.ts`, `apps/api/src/application/crop/crop-diff.spec.ts`, `apps/api/test/crop-diff.e2e-spec.ts`.
