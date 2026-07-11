# Spec — Note de publication (Lot Note, E1 : API)

**Projet** : Okko — API
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Permettre d'attacher une **note optionnelle** (message libre type « changelog », ex. « Ajout variété Obatanpa, MAJ prix ») à chaque **publication** d'une culture. E1 pose le côté API : stockage de la note par révision et exposition dans la liste des versions. Le câblage admin (saisie à la publication + affichage) est la sous-brique E2.

**Contexte (vérifié) :** `PublishedCrop` est multi-lignes par `(cropId, revision)` (C1). `PublishCropUseCase.execute({ id, actor })` fige le document + insère une révision (`revision = max + 1`). `POST /crops/:id/publish` ne prend pas de corps aujourd'hui. `GET /crops/:id/versions` renvoie `PublishedCropVersion[]` (métadonnées).

**Décisions (brainstorming 2026-07-11) :**
- **Découpage** : E1 (API) → E2 (admin). E1 d'abord.
- **Note optionnelle**, une par publication (pas de report d'une révision à l'autre), stockée sur l'**enregistrement de révision** (comme `publishedAt`/`publishedBy`), **pas** dans le document figé.
- **Normalisation** : chaîne vide/espaces → `null`.
- **Surface de lecture** : la note est renvoyée dans les **métadonnées** de `/versions` ; `/versions/:revision` (document figé) reste **inchangé**.

## 2. Périmètre

### Dans le lot
- Colonne `PublishedCrop.note String?` + migration.
- `note` sur `PublishedCropRecord` et `PublishedCropVersion` ; adaptateurs Prisma + in-memory.
- `PublishCropUseCase.execute` accepte `note?` (normalisée) et l'enregistre.
- `POST /crops/:id/publish` lit un corps optionnel `{ note?: string }`.

### Hors périmètre
- **Câblage admin** (saisie/affichage) → E2.
- Contrainte de longueur / validation avancée de la note → non traité (texte libre).
- Exposer la note dans `/versions/:revision` ou dans le document figé → non (métadonnées de liste seulement).

## 3. Comportement préservé
- Publier **sans corps** continue de fonctionner (note `null`) → publications existantes et republications inchangées.
- `PublishCropUseCase` : `note` est un paramètre **optionnel** → aucun appelant existant cassé.
- `GET /crops/:id/versions/:revision` et le document figé : **inchangés**.

## 4. Architecture

### 4.1 Modèle — `prisma/schema.prisma`
Ajouter à `model PublishedCrop` : `note String?`. Migration `add_published_crop_note` (colonne nullable, additive).

### 4.2 Port `PublishedCropRepository` — `published-crop.repository.ts`
- `PublishedCropRecord` gagne `note: string | null`.
- `PublishedCropVersion` gagne `note: string | null`.

### 4.3 Adaptateurs
- **Prisma** (`prisma-published-crop.repository.ts`) : `save` écrit `note: r.note` ; `toRecord` lit `note: row.note` ; `listByCrop` ajoute `note: true` au `select` et le mappe.
- **In-memory** (`in-memory-published-crop.repository.ts`) : le record est stocké tel quel → `note` porté ; `listByCrop` inclut `note` dans les métadonnées mappées.

### 4.4 `PublishCropUseCase` — `publish-crop.use-case.ts`
```ts
async execute(input: { id: string; actor: string; note?: string }): Promise<CropSnapshot> {
  ...
  const note = input.note?.trim() || null;
  await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor, note });
  ...
}
```

### 4.5 Endpoint — `crop.controller.ts`
```ts
@Post(':id/publish')
async publish(@Param('id') id: string, @Body() body?: { note?: string }) {
  try {
    const snap = await this.publishCrop.execute({ id, actor: ACTOR, note: body?.note });
    return toCropDocument(snap);
  } catch (e) {
    mapCropError(e, id);
  }
}
```
(`@Body` est déjà importé et utilisé par d'autres handlers. La réponse du handler reste inchangée.)

## 5. Gestion d'erreur
- Aucune nouvelle. `note` absente/vide → `null`. Corps absent → `body` undefined → `body?.note` undefined → `null`.

## 6. Tests (TDD)
- **Repo (in-memory)** : `save` d'un record avec `note` → `findLatest`/`findRevision` portent la note ; `listByCrop` la renvoie dans les métadonnées (toujours **sans** `document`) ; note `null` si le record ne la porte pas.
- **Use-case** (`publish-crop.spec`) : publier avec `note: 'X'` → la révision stockée a `note: 'X'` ; sans `note` → `null` ; `note: '  '` → `null`.
- **e2e** (`crop-versioning` ou un nouveau cas) : `POST /crops/:id/publish` avec `{ note: 'MAJ prix' }` → `GET /crops/:id/versions`[0].note === 'MAJ prix' ; publier **sans corps** → note `null`.
- **Non-régression** : les e2e/specs de publication existants restent verts (`note` optionnelle ; compléter une assertion seulement si elle asservit la forme complète d'un `PublishedCropRecord`/`PublishedCropVersion`).

## 7. Critères de succès
- [ ] `PublishedCrop.note String?` + migration additive.
- [ ] `note` sur `PublishedCropRecord`/`PublishedCropVersion` + adaptateurs (Prisma & in-memory).
- [ ] `PublishCropUseCase.execute({ …, note? })` normalise (vide → null) et enregistre.
- [ ] `POST /crops/:id/publish` lit `{ note? }` (corps optionnel) ; publier sans corps → null.
- [ ] `GET /crops/:id/versions` renvoie `note` ; `/versions/:revision` inchangé.
- [ ] Suite API entière verte.
- [ ] Câblage admin (E2) **non** inclus.

## Références
- C1 (versions) : `docs/superpowers/specs/2026-07-10-crop-version-history-design.md`.
- Code : `apps/api/prisma/schema.prisma` (`model PublishedCrop`), `src/application/crop/published-crop.repository.ts`, `src/infrastructure/crop/prisma-published-crop.repository.ts`, `src/application/crop/in-memory-published-crop.repository.ts`, `src/application/crop/publish-crop.use-case.ts`, `src/presentation/crop/crop.controller.ts`.
