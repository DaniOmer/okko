# Spec — CRUD Zones & Ravageurs (édition + suppression)

**Projet** : Okko — back-office de la base de connaissances
**Date** : 2026-07-05
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Compléter le CRUD des deux catalogues de référence — **zones agro-écologiques** et **ravageurs/maladies** — avec **Modifier** et **Supprimer**. Aujourd'hui seuls Créer / Lister / Lire existent : une faute de frappe est incorrigible, une entrée obsolète ou en double est indélébile. La suppression d'une entité **rattachée à une ou plusieurs cultures est bloquée** (message clair), pour ne jamais laisser de lien orphelin ni retirer silencieusement de la donnée agronomique d'une fiche.

## 2. Périmètre

### Dans le lot
- **API** : endpoints `PATCH /zones/:id`, `DELETE /zones/:id`, `PATCH /pests/:id`, `DELETE /pests/:id` + use-cases + méthodes de repository + capacité de mise à jour dans les agrégats. TDD.
- **Règle de suppression** : refuser (409) si l'entité est référencée par au moins un lien culture ; sinon supprimer (204).
- **Admin** : colonne d'actions (Modifier / Supprimer) dans les listes `/zones` et `/pests` ; modale d'édition pré-remplie ; modale de confirmation de suppression affichant le blocage éventuel.

### Hors périmètre
- Journalisation `AuditLog` du CRUD catalogue (les créations de zone/ravageur ne sont pas auditées aujourd'hui ; on garde ce comportement).
- Édition des champs avancés des agrégats non exposés par l'admin (zone : `altitude`, `annualRainfall`, `notes`, `metadata` ; ravageur : `symptoms`, `photos`, `notes`, `metadata`). Ils restent inchangés lors d'une mise à jour.
- Suppression en cascade, archivage (soft delete), opérations en masse.

## 3. Champs modifiables (parité avec la création)

- **Zone** : `name.fr`, `country`, `koppen` (optionnel).
- **Ravageur** : `name.fr`, `type` (énum `PestType`), `scientificName` (optionnel).

Un `PATCH` remplace ces champs ; les champs hors périmètre sont **préservés** tels quels (on repart du snapshot existant, on applique le patch, on sauvegarde).

## 4. Architecture (clean architecture, patterns existants)

### 4.1 Domaine
Les agrégats `AgroEcologicalZone` et `PestDisease` sont aujourd'hui **immuables**. On leur ajoute une capacité de mise à jour des champs éditables, cohérente avec le pattern snapshot :
- Zone : méthode qui produit un agrégat mis à jour à partir des champs éditables (`name`, `country`, `koppen`), en conservant les autres champs du snapshot.
- Ravageur : idem (`name`, `type`, `scientificName`).

L'implémentation exacte (méthode `update(patch)` renvoyant un nouvel agrégat, ou reconstruction via `fromSnapshot` d'un snapshot fusionné) est laissée au plan, tant que les invariants du domaine restent respectés et que les champs hors périmètre sont préservés.

### 4.2 Ports de repository
- `ZoneRepository` / `PestRepository` : ajout de **`delete(id): Promise<void>`**. La mise à jour réutilise **`save(snapshot)`** (upsert par id — déjà le comportement in-memory ; l'adaptateur Prisma doit faire un upsert).
- **Comptage des références** : aucun nouveau port nécessaire — les ports de liens existants exposent déjà `listByZone(zoneId)` (`CropZoneSuitabilityRepository`) et `listByPest(pestId)` (`CropPestControlRepository`). Le use-case de suppression compte via ces méthodes.

### 4.3 Use-cases (TDD)
- `UpdateZoneUseCase` : charge le snapshot (`findById`) → 404 (`ZoneNotFoundError`) si absent ; applique le patch ; `save`. Renvoie le snapshot mis à jour.
- `DeleteZoneUseCase` : 404 si absent ; **compte** `cropZoneLinks.listByZone(id)` → si > 0, lève `ZoneInUseError(count)` ; sinon `delete(id)`.
- `UpdatePestUseCase` / `DeletePestUseCase` : symétriques (`PestNotFoundError`, `PestInUseError(count)`, `cropPestLinks.listByPest(id)`).

### 4.4 Présentation (contrôleurs)
- `PATCH /zones/:id` (body : `{ name: { fr }, country, koppen? }`) → 200 (snapshot via read-model) ; `ZoneNotFoundError` → 404.
- `DELETE /zones/:id` → 204 ; `ZoneNotFoundError` → 404 ; `ZoneInUseError` → **409** (corps : message + `count`).
- `PATCH /pests/:id`, `DELETE /pests/:id` : symétriques.

### 4.5 Admin (Next.js)
- **Client API** (`lib/api.ts`) : `updateZone(id, input)`, `deleteZone(id)`, `updatePest(id, input)`, `deletePest(id)` (chacun lève sur `!res.ok`, en propageant le message 409 pour l'affichage).
- **Listes** : `/zones` et `/pests` (Tables shadcn) reçoivent une **colonne actions** en fin de ligne : bouton **Modifier** (ouvre la modale d'édition) + bouton **Supprimer** (ouvre la confirmation). Ces actions sont des **Client Components** greffés dans les lignes de la Table (les pages restent des Server Components ; une petite cellule cliente par ligne).
- **Modale d'édition** : `Dialog` shadcn pré-remplie avec les champs de création (Zone : nom fr / pays / Köppen ; Ravageur : nom fr / type via `PEST_TYPE_LABELS` / nom scientifique). Enregistrer → `PATCH` → succès ferme + `router.refresh()` ; erreur inline.
- **Modale de suppression** : confirmation (« Supprimer la zone “X” ? »). Confirmer → `DELETE`. Un **409** affiche le message « Rattachée à N culture(s) — détachez-la d'abord » **dans la modale**, sans supprimer.

## 5. Data flow
`PATCH` : admin envoie les champs éditables → use-case fusionne avec le snapshot existant → `save` (upsert) → read-model renvoyé. `DELETE` : use-case vérifie les liens (`listByZone`/`listByPest`) → supprime ou 409. Les fiches culture résolvant les noms de zone/ravageur **par id**, un renommage se reflète partout automatiquement ; une suppression n'est possible que sans référence, donc aucun lien orphelin.

## 6. Gestion d'erreur
- Suppression d'une entité référencée → **409** avec le nombre de cultures ; message affiché dans la modale, entité conservée.
- Entité introuvable (update ou delete) → **404**.
- Erreurs réseau/API affichées inline dans les modales (cohérent avec les éditeurs existants).

## 7. Tests
- **API en TDD** : use-cases (`UpdateZone`, `DeleteZone` avec cas « bloqué » et cas « supprimé », idem ravageur) + **e2e** des 4 endpoints, dont le **409 sur suppression rattachée** et le **404**.
- **Admin** : pas de tests unitaires — le **build** est la porte (`pnpm --filter @okko/admin build`), + vérification manuelle (éditer une zone/ravageur ; supprimer une entité libre ; tenter de supprimer une entité rattachée → message de blocage).
- Le reste de la suite API (136 tests) doit rester vert.

## 8. Critères de succès
- [ ] `PATCH`/`DELETE` fonctionnels pour zones et ravageurs ; champs hors périmètre préservés au `PATCH`.
- [ ] Suppression **bloquée (409 + count)** si l'entité est rattachée ; **204** sinon ; **404** si absente.
- [ ] Listes admin : colonne actions ; édition en modale pré-remplie ; suppression confirmée ; blocage affiché inline.
- [ ] `next build` OK ; suite API verte (existants + nouveaux tests) ; aucune régression sur Créer/Lister.

## 9. Notes de découpage
Ordre naturel du plan : (1) domaine + ports (update/delete, méthode de mise à jour), (2) use-cases update/delete zone (TDD), (3) use-cases update/delete ravageur (TDD), (4) endpoints + e2e, (5) client API admin, (6) actions + modales dans les listes. API et admin peuvent être des tâches distinctes.

## Références
- Agrégats : `apps/api/src/domain/zone/agro-ecological-zone.ts`, `apps/api/src/domain/pest/pest-disease.ts`.
- Ports : `application/zone/zone.repository.ts`, `application/pest/pest.repository.ts`, `application/zone/crop-zone-suitability.repository.ts` (`listByZone`), `application/pest/crop-pest-control.repository.ts` (`listByPest`).
- Contrôleurs : `presentation/zone/zone.controller.ts`, `presentation/pest/pest.controller.ts`.
- Listes admin : `apps/admin/src/app/zones/page.tsx`, `apps/admin/src/app/pests/page.tsx`.
