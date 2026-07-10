# Spec — Restauration d'une version publiée dans le brouillon (Lot C2, API)

**Projet** : Okko — API
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Permettre de **recharger le contenu d'une version publiée passée dans le brouillon** (la tête du flux). Restaurer la révision N peuple le brouillon avec l'état de N ; l'éditeur relit puis **republie** (ou continue d'éditer, ou abandonne) via le flux brouillon/publié existant. C'est la 2ᵉ sous-brique du Lot C (après C1 — historique) ; le **diff sémantique** (C3) suivra.

Cette brique **généralise la mécanique de point de contrôle du Lot B** : aujourd'hui l'agrégat garde un seul point de contrôle (dernière publication) et `DraftDiscarded` y revient. C2 garde **un point de contrôle par révision** et ajoute une restauration vers une révision arbitraire ; l'abandon devient un cas particulier (restaurer la dernière révision).

**Décisions (brainstorming 2026-07-11) :**
- **Périmètre = API seulement** (câblage admin = brique ultérieure, comme C1).
- **Sémantique = charger dans le brouillon** (non destructif ; republier reste le geste explicite), et non « republication immédiate ».
- **Source de restauration = rejeu du flux via points de contrôle par révision** (approche **sans perte**), et **non** le document figé `PublishedCrop` de C1 (appauvri : les vues composées n'ont pas `provenance`/`sensitiveStages`/seuils → restaurer depuis lui perdrait des données). Le flux d'événements reste la source de vérité.
- **Factorisation** : extraire un helper partagé de reconstruction des projections, utilisé par l'abandon **et** la restauration.

## 2. Périmètre

### Dans le lot
- Agrégat : map de points de contrôle par révision, `restoreDraft(revision)`, événement `DraftRestored`, `RevisionNotFoundError` ; `DraftDiscarded` refactoré en cas particulier.
- Use-case `RestoreDraftUseCase` + helper partagé `rebuildCropProjections` (refactor de `DiscardDraftUseCase` pour l'utiliser).
- Endpoint `POST /crops/:id/versions/:revision/restore`.

### Hors périmètre
- **Diff sémantique** entre versions → C3.
- **Câblage admin** (bouton « Restaurer cette version ») → brique ultérieure.
- Republication automatique après restauration (l'utilisateur republie explicitement) → hors périmètre par décision.

## 3. Comportement préservé
- **Abandon** (`DraftDiscarded`) : comportement inchangé (revient à la dernière version publiée) — désormais implémenté via le helper de restauration généralisé.
- **`version` (compteur de contenu) et statut** : inchangés. Restaurer **ne publie pas** : `hasPublishedVersion` et la dernière révision publiée sont intacts ; le statut reste `PUBLISHED`.
- Flux d'événements = source de vérité ; restaurer **append** `DraftRestored` (append-only, historique préservé).

## 4. Architecture

### 4.1 Agrégat `Crop` — points de contrôle par révision
- Remplacer le point de contrôle unique par :
  - `_checkpoints: Map<number, Checkpoint>` — état complet (cœur + snapshots de section, **sans perte**, même capture qu'au Lot B) par n° de révision.
  - `_publishedRevision: number` — dernière révision publiée (0 si jamais).
- `case 'Published'` : `_publishedRevision += 1` puis capture le point de contrôle sous ce numéro.
- **Nouvel événement** : `{ type: 'DraftRestored'; revision: number }`.
- **Mutation** :
  ```ts
  restoreDraft(revision: number): void {
    if (!this._hasPublishedVersion) throw new NoPublishedVersionError(this._id);
    if (!this._checkpoints.has(revision)) throw new RevisionNotFoundError(this._id, revision);
    this.raise({ type: 'DraftRestored', revision });
  }
  ```
- **Repli** : `case 'DraftRestored': this.restoreFromCheckpoint(e.revision)`. Helper `restoreFromCheckpoint(rev)` : restaure l'état depuis `_checkpoints.get(rev)` et pose `hasUnpublishedChanges = (rev !== this._publishedRevision)`.
- `case 'DraftDiscarded'` **devient** : `this.restoreFromCheckpoint(this._publishedRevision)` (→ drapeau `false`, comportement Lot B préservé).
- **Sémantique des drapeaux** : restaurer la **dernière** révision → `hasUnpublishedChanges=false` ; restaurer une **antérieure** → `hasUnpublishedChanges=true`. Restaurer ne touche pas `_publishedRevision`/`_hasPublishedVersion`/statut.
- **Nouvelle erreur** `RevisionNotFoundError` (exportée depuis `crop.ts`, comme `NoPublishedVersionError`).
- **Inchangé** : `toSnapshot`/`fromSnapshot` (map + `_publishedRevision` = état dérivé du repli, hors snapshot cœur ; la garde `fromSnapshot` du Lot B reste — restauration toujours via `fromEvents`). `version`/statut intacts.
- **Coût mémoire** : O(nombre de publications) points de contrôle au repli — négligeable (peu de publications par culture).

### 4.2 Use-case `RestoreDraftUseCase` + helper partagé
Miroir de `DiscardDraftUseCase`, avec un paramètre `revision` :
```ts
async execute(input: { id: string; revision: number; actor: string }): Promise<CropSnapshot> {
  const stored = await this.events.load(input.id);
  if (stored.length === 0) throw new CropNotFoundError(input.id);
  const crop = Crop.fromEvents(stored);
  crop.restoreDraft(input.revision);           // NoPublishedVersionError / RevisionNotFoundError
  const at = this.clock.nowIso();
  await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
  const next = await rebuildCropProjections(crop, { crops, varieties, windows, zones, pests, prices });
  await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { draftRestoredFromRevision: input.revision } });
  return next;
}
```
- **Helper partagé** `rebuildCropProjections(crop, repos)` : `crops.save(crop.toSnapshot())` + `replaceForCrop` sur les 5 repos de section, renvoie le `CropSnapshot`. `DiscardDraftUseCase` est refactoré pour l'utiliser (son audit et sa mutation restent propres à lui).
- **Dépendances** de `RestoreDraftUseCase** : `CropEventStore`, `CropRepository`, les 5 repos de section, `AuditLogRepository`, `Clock` (identiques à l'abandon).

### 4.3 Endpoint
| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/crops/:id/versions/:revision/restore` | restaure la révision N dans le brouillon → renvoie le document brouillon reconstruit (via `composeCropDocument`, comme l'abandon) |
- `:revision` parsé en entier ; l'existence est validée par l'agrégat (`RevisionNotFoundError`).
- Câblage DI dans `crop.module.ts` (comme `DiscardDraftUseCase`).

## 5. Gestion d'erreur
- flux vide → `CropNotFoundError` → **404**.
- jamais publiée → `NoPublishedVersionError` → **409**.
- révision hors `[1, dernière révision]` → `RevisionNotFoundError` → **404** (ajout à `mapCropError`).

## 6. Tests (TDD)
- **Domaine** (`crop.events.spec`) : `restoreDraft(N)` restaure cœur + sections à l'état de N ; restaurer la dernière révision → `hasUnpublishedChanges=false` ; restaurer une antérieure → `true` ; `NoPublishedVersionError` si jamais publiée ; `RevisionNotFoundError` hors bornes (0, max+1) ; **déterminisme du repli** `[Published v1, éditions, Published v2, éditions, DraftRestored(1)]` ⟶ état == état à v1 ; **non-régression `DraftDiscarded`** après refactor.
- **Use-case** (`restore-draft.spec`) : publier A (v1) → éditer en B → publier B (v2) → éditer en C → `restore(1)` → projections cœur + une section == A, drapeau `true` ; `restore(2)` → == B, drapeau `false`.
- **e2e** (`crop-restore.e2e-spec`) : créer → variété X → publier (v1) → variété Y → publier (v2) → `POST /versions/1/restore` → `GET /crops/:id` ne montre que X + `hasUnpublishedChanges=true` ; puis `POST /publish` → `/versions` contient v3 ; `/versions/99/restore` → 404 ; culture jamais publiée → restore → 409.
- **Non-régression** : use-case abandon + ses specs + e2e `crop-versioning` (chemin abandon) verts après l'extraction du helper.

## 7. Critères de succès
- [ ] Agrégat : map de points de contrôle par révision, `restoreDraft`, `DraftRestored`, `RevisionNotFoundError` ; `DraftDiscarded` = cas particulier.
- [ ] Helper `rebuildCropProjections` partagé (abandon refactoré).
- [ ] `RestoreDraftUseCase` + DI.
- [ ] Endpoint `POST /crops/:id/versions/:revision/restore` (404/409 corrects).
- [ ] Suite API entière verte (chemin abandon et C1 inclus).
- [ ] Diff (C3) **non** inclus.

## Références
- C1 (historique) : `docs/superpowers/specs/2026-07-10-crop-version-history-design.md`.
- Lot B (checkpoint/discard) : `docs/superpowers/specs/2026-07-09-event-sourcing-crop-lot-b-brouillon-publie-design.md`.
- Code : `apps/api/src/domain/crop/crop.ts` (checkpoint, `discardDraft`, `apply`), `src/domain/crop/crop-event.ts`, `src/application/crop/discard-draft.use-case.ts`, `src/presentation/crop/crop.controller.ts` (`mapCropError`, endpoint `discard`), `src/crop.module.ts`.
