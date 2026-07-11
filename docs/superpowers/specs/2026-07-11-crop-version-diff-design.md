# Spec — Diff sémantique entre versions publiées (Lot C3, API)

**Projet** : Okko — API
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Comparer **deux versions publiées** d'une culture et renvoyer un **diff sémantique** : les champs de contenu qui ont changé et, pour chaque section à clé, les items ajoutés / supprimés / modifiés. Dernière sous-brique du Lot C (après C1 — historique, C2 — restauration).

Le diff compare les **deux documents figés** (`PublishedCrop.document` des révisions concernées, via `findRevision` de C1) — calcul pur, pas de rejeu. C'est une comparaison de ce que les lecteurs ont réellement vu à chaque publication.

**Décisions (brainstorming 2026-07-11) :**
- **Périmètre = API seulement** (affichage admin = brique ultérieure).
- **Granularité = diff sémantique par item** : ajouté/supprimé/modifié identifiés par clé (pas par index → pas de bruit de réordonnancement) ; item « modifié » = item **avant**/**après** entier (pas de descente dans les sous-champs — raffinement additif possible plus tard).
- **Deux révisions arbitraires** (`from`, `to`, n'importe quel sens), en **query** : `GET /crops/:id/diff?from=A&to=B`.

## 2. Périmètre

### Dans le lot
- Fonction pure `diffCropDocuments` + types `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange`.
- Endpoint `GET /crops/:id/diff?from=A&to=B`.

### Hors périmètre
- **Descente dans les sous-champs** d'un item modifié (`maturityDays: 120 → 130`) → raffinement ultérieur.
- **Diff item-par-item des sections sans clé** (phénologie/nutrition/rendements) → comparées comme tableaux entiers ici.
- **Affichage admin** (vue de comparaison) → brique ultérieure.
- Changement de schéma / de stockage → aucun (pure lecture + calcul).

## 3. Comportement préservé
- Endpoints existants (`/published`, `/versions`, `/versions/:revision`, restore…) : **inchangés**.
- Aucune mutation, aucun événement, aucun changement de schéma : C3 est **purement additif** (une lecture + une fonction pure).

## 4. Architecture

### 4.1 Source
Les deux documents figés `PublishedCrop.document` (type `CropDocument`), obtenus via `PublishedCropRepository.findRevision(cropId, revision)` (C1).

### 4.2 Modèle du résultat
```ts
export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange  { key: string;   before: unknown; after: unknown; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];     // champs cœur/valeur modifiés (uniquement les modifiés)
  sections: SectionDiff[];   // sections à clé, uniquement celles ayant un changement
}
```
Sortie **concise** : `fields` ne contient que les champs modifiés ; `sections` ne contient que les sections ayant au moins un `added`/`removed`/`changed`.

### 4.3 Ce qui est comparé
- **Champs cœur** → `fields[]` (avant/après si diffèrent) : `name`, `scientificName`, `family`, `cycleType`, `climatic`, `edaphic`, `metadata`.
- **Sections à clé** → `sections[]` (ajouté/supprimé/modifié par clé) :
  | Section | Clé |
  |---|---|
  | `varieties` | `id` |
  | `zones` | `zoneId` |
  | `croppingWindows` | `id` |
  | `pests` | `pestId` |
  | `prices` | `id` |
- **Sections sans clé** → `fields[]` en **valeur entière** (avant/après du tableau si différent) : `phenology`, `nutrition`, `yields`.
- **Exclus** (méta/dérivé, hors contenu) : `status`, `version`, `completeness`, `serializedText`, `hasUnpublishedChanges`, `hasPublishedVersion`, `id`.

### 4.4 Fonction pure `crop-diff.ts`
`src/application/crop/crop-diff.ts` (aucune dépendance framework) :
```ts
export function diffCropDocuments(
  fromRevision: number, toRevision: number,
  before: CropDocument, after: CropDocument,
): CropDiff
```
- **`deepEqual(a, b): boolean`** — helper récursif **insensible à l'ordre des clés** (robuste pour `metadata`), utilisé pour toutes les comparaisons.
- **Champs cœur** : itère `['name','scientificName','family','cycleType','climatic','edaphic','metadata']` → `FieldChange` si `!deepEqual(before[f], after[f])`.
- **Sections-valeur** : `['phenology','nutrition','yields']` → `FieldChange{ field, before, after }` si le tableau diffère.
- **Sections à clé** : pour chaque `{section, key}`, indexer `before`/`after` par la clé, puis :
  - `added` = items de `after` dont la clé est absente de `before` ;
  - `removed` = items de `before` dont la clé est absente de `after` ;
  - `changed` = clés communes où `!deepEqual(beforeItem, afterItem)` → `{ key, before: beforeItem, after: afterItem }`.
  - N'ajouter la `SectionDiff` que si au moins un des trois est non vide.
- Retour : `{ cropId: before.id, from: fromRevision, to: toRevision, fields, sections }`.

### 4.5 Endpoint (lecture directe repo, comme `/versions`)
```ts
@Get(':id/diff')
async diff(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
  const a = await this.publishedCrops.findRevision(id, Number(from));
  if (!a) throw new NotFoundException(`crop ${id} revision ${from}`);
  const b = await this.publishedCrops.findRevision(id, Number(to));
  if (!b) throw new NotFoundException(`crop ${id} revision ${to}`);
  return diffCropDocuments(Number(from), Number(to), a.document, b.document);
}
```
- `@Query` importé de `@nestjs/common`. Pas de nouveau use-case (cohérent avec `/versions`).
- Route `:id/diff` : segment littéral distinct, pas de conflit avec `:id/versions...`.

## 5. Gestion d'erreur
- `from` ou `to` inexistante / invalide (`NaN`) → `findRevision` = `null` → **404**.
- `from == to` → documents identiques → `fields:[], sections:[]` (diff vide) → **200**.

## 6. Tests
- **Unit** (`crop-diff.spec`) : docs identiques → diff vide ; `name` modifié → `fields` ; variété ajoutée / supprimée / modifiée (même `id`, `maturityDays` différent) → `sections.varieties` (added/removed/changed) ; zone modifiée par `zoneId` ; `phenology` modifiée → `fields` (tableau entier) ; `metadata` insensible à l'ordre des clés (`deepEqual`).
- **e2e** (`crop-diff.e2e-spec`) : créer → variété X → publier (v1) → renommer + variété Y → publier (v2) → `GET /crops/:id/diff?from=1&to=2` → `fields` contient le changement de `name`, `sections.varieties.added` contient Y ; sens inverse `from=2&to=1` symétrique (Y en `removed`) ; `from==to` → diff vide ; `from=99` → 404.
- **Non-régression** : aucune (ajout pur) ; la suite API reste verte.

## 7. Critères de succès
- [ ] `diffCropDocuments` pure + `deepEqual` insensible à l'ordre des clés.
- [ ] Champs cœur, sections à clé (added/removed/changed), sections-valeur, exclusions — conformes au §4.3.
- [ ] Endpoint `GET /crops/:id/diff?from=A&to=B` (404 si révision absente, 200 diff vide si `from==to`).
- [ ] Suite API entière verte.
- [ ] Descente dans les sous-champs & diff item des sections sans clé & admin **non** inclus.

## Références
- C1 (historique / `findRevision`) : `docs/superpowers/specs/2026-07-10-crop-version-history-design.md`.
- Code : `apps/api/src/application/crop/crop-read-model.ts` (`CropDocument`), `src/application/crop/published-crop.repository.ts` (`findRevision`), `src/presentation/crop/crop.controller.ts` (endpoint `versions`, injection `publishedCrops`).
