# Spec — Historique des versions publiées (Lot C1, API)

**Projet** : Okko — API
**Date** : 2026-07-10
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Conserver **chaque version publiée** d'une culture (et non plus seulement la dernière) et permettre de **lister** ces versions et de **consulter** une version figée passée. C'est la fondation du Lot C ; la **restauration** (C2) et le **diff sémantique** (C3) en dépendent et suivront dans des briques séparées.

Aujourd'hui, la projection `PublishedCrop` a `cropId` en **clé primaire** (une ligne par culture) : republier **écrase** la version figée. Seul le flux d'événements retient l'historique complet. C1 fait de `PublishedCrop` une projection **multi-lignes** (une ligne par version publiée), sans changer la source de vérité (le flux d'événements).

**Décisions (brainstorming 2026-07-10) :**
- **Découpage du Lot C** : C1 (historique) → C2 (restauration) → C3 (diff). C1 d'abord.
- **Périmètre C1 = API seulement** (câblage admin = brique ultérieure, comme pour Lot B).
- **Métadonnées de version = auto seulement** : `revision`, `version` (contenu), `publishedAt`, `publishedBy`. Pas de note d'intention utilisateur (ajout additif possible plus tard).
- **Stockage = approche « multi-lignes »** (stocker chaque version figée), et non « dériver du flux ». Motif : cohérent avec le Lot B (document composé figé) ; **fidélité point-dans-le-temps** (les libellés de zone/ravageur figés au moment de la publication, non recalculables depuis le flux si une entité a été renommée depuis).

## 2. Périmètre

### Dans le lot
- `PublishedCrop` multi-lignes, clé `(cropId, revision)` + migration.
- Port `PublishedCropRepository` : `revision` sur le record, nouveau type léger `PublishedCropVersion`, méthodes `findLatest`/`findRevision`/`listByCrop` (+ `save` en INSERT).
- `PublishCropUseCase` : calcule `revision = max + 1` et insère.
- Endpoints `GET /crops/:id/versions` et `GET /crops/:id/versions/:revision`.

### Hors périmètre
- **Restauration** d'une version passée dans le brouillon → **C2**.
- **Diff sémantique** entre versions → **C3**.
- **Note de publication** utilisateur (colonne optionnelle) → différée.
- **Câblage admin** (UI d'historique) → brique ultérieure.
- Purge/rétention des vieilles versions → non traité (le stockage croît d'une ligne par publication ; négligeable).

## 3. Comportement préservé
- `GET /crops/:id/published` (Lot B) : **inchangé côté client** — renvoie toujours la dernière version publiée, désormais via `findLatest` (= `revision` max).
- Sémantique de `version` (compteur de contenu) et de statut : **inchangées**. `revision` est un **nouveau** compteur, distinct, propre à la publication.
- Flux d'événements = source de vérité ; `PublishedCrop` reste une projection (désormais append-only par version).

## 4. Architecture

### 4.1 Modèle de données — `PublishedCrop` multi-lignes
```prisma
model PublishedCrop {
  cropId      String
  revision    Int        // n° de version publiée, 1..N par culture
  document    Json       // document composé figé (inchangé)
  version     Int        // compteur de contenu (crop.version) au figeage
  publishedAt DateTime
  publishedBy String
  @@id([cropId, revision])
}
```
- **`revision`** : monotone **par culture** (1ʳᵉ publication → 1, republication → 2…). Distinct de `version`.
- Publier = **INSERT** d'une nouvelle ligne (`revision = max + 1`), plus d'upsert-écrasement.
- « Version courante » = ligne de `revision` max.

**Migration** : ajouter `revision Int NOT NULL DEFAULT 1`, rétro-remplir les lignes existantes à `1` (au plus une ligne par culture aujourd'hui → pas de collision), puis passer la clé primaire de `cropId` à `(cropId, revision)`. Base de dev vidée par les tests → migration sans risque.

### 4.2 Port `PublishedCropRepository`
- `PublishedCropRecord` gagne `revision: number` (conserve `document`).
- Nouveau type léger (liste sans document) :
  ```ts
  export interface PublishedCropVersion {
    revision: number;
    version: number;
    publishedAt: string;
    publishedBy: string;
  }
  ```
- Méthodes :
  | Méthode | Rôle |
  |---|---|
  | `save(record: PublishedCropRecord): Promise<void>` | INSERT de la ligne (le record porte `revision`) |
  | `findLatest(cropId: string): Promise<PublishedCropRecord \| null>` | version courante = `revision` max (remplace `findByCrop`) |
  | `findRevision(cropId: string, revision: number): Promise<PublishedCropRecord \| null>` | version passée précise (avec `document`) |
  | `listByCrop(cropId: string): Promise<PublishedCropVersion[]>` | métadonnées, tri `revision` **décroissante** |
- **Adaptateur Prisma** : `save` = `create` ; `findLatest` = `findFirst({ where:{cropId}, orderBy:{revision:'desc'} })` ; `findRevision` = `findUnique` sur `(cropId, revision)` ; `listByCrop` = `findMany({ where:{cropId}, orderBy:{revision:'desc'}, select:{revision,version,publishedAt,publishedBy} })`.
- **Adaptateur in-memory** : tableau de records ; mêmes 4 méthodes (mapper vers `PublishedCropVersion` pour `listByCrop`).

### 4.3 `PublishCropUseCase`
Seul use-case muté. Après composition du document (inchangé) :
```ts
const latest = await this.published.findLatest(input.id);
const revision = latest ? latest.revision + 1 : 1;
await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor });
```

### 4.4 Endpoints (lecture directe repo, comme le Lot B)
Pas de nouveau use-case (le Lot B lit `published` directement dans le contrôleur ; on reste cohérent).
| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/crops/:id/published` | `findLatest` (inchangé côté client) |
| `GET` | `/crops/:id/versions` | `listByCrop` → `PublishedCropVersion[]` (tri décroissant, `[]` si aucune) |
| `GET` | `/crops/:id/versions/:revision` | `findRevision` → le `document`, **404** si absente |
- `:revision` parsé en entier ; révision inexistante/invalide → `findRevision` = `null` → 404.

## 5. Gestion d'erreur
- `GET /crops/:id/versions` : `[]` pour culture inconnue ou jamais publiée (pas de vérif d'existence — simplicité). 200.
- `GET /crops/:id/versions/:revision` : **404** si la ligne `(cropId, revision)` n'existe pas.
- `GET /crops/:id/published` : inchangé (404 si jamais publiée, via `findLatest` null).

## 6. Tests (TDD)
- **Repo (in-memory)** : `save` rev1 puis rev2 ; `findLatest` = rev2 ; `findRevision(1)` = rev1 (avec `document`) ; `listByCrop` = métadonnées `[rev2, rev1]` **sans** `document`.
- **Use-case** (`publish-crop.spec`) : 1ʳᵉ publication → `revision 1` ; republication → `revision 2` ; `findLatest` reflète la dernière.
- **e2e** (`crop-version-history.e2e-spec`) : créer → publier → éditer → republier ; `GET /versions` = 2 entrées (révisions 2,1) en métadonnées ; `GET /versions/1` = 1ᵉʳ document figé (anciennes valeurs), `/versions/2` = 2ᵉ (nouvelles) ; `/published` = révision 2 ; `/versions/99` → 404 ; culture jamais publiée → `/versions` = `[]`.
- **Non-régression** : e2e Lot B (`crop-versioning`, `crop-sections-event-sourcing`, `crop`) verts après `findByCrop → findLatest` + ajout de `revision` (compléter les assertions qui asservissent la forme de `PublishedCropRecord`).

## 7. Critères de succès
- [ ] `PublishedCrop` clé `(cropId, revision)` + migration additive.
- [ ] Port : `revision` sur le record, `PublishedCropVersion`, `findLatest`/`findRevision`/`listByCrop`, `save` en INSERT.
- [ ] `PublishCropUseCase` insère `revision = max + 1`.
- [ ] Endpoints `GET /crops/:id/versions` et `/crops/:id/versions/:revision` (404 si absente).
- [ ] `GET /crops/:id/published` inchangé côté client (via `findLatest`).
- [ ] Suite API entière verte (e2e Lot B inclus).
- [ ] Restauration et diff **non** inclus (C2/C3).

## Références
- Lot B (projection publiée) : `docs/superpowers/specs/2026-07-09-event-sourcing-crop-lot-b-brouillon-publie-design.md`.
- Code : `apps/api/src/application/crop/published-crop.repository.ts`, `src/infrastructure/crop/prisma-published-crop.repository.ts`, `src/application/crop/in-memory-published-crop.repository.ts`, `src/application/crop/publish-crop.use-case.ts`, `src/presentation/crop/crop.controller.ts`, `prisma/schema.prisma` (`model PublishedCrop`).
