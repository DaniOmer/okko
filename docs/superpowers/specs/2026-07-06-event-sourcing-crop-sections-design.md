# Spec — Sections de la Culture dans le flux d'événements

**Projet** : Okko — base de connaissances
**Date** : 2026-07-06
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Faire entrer les **5 sections** de la fiche culture — variétés, fenêtres de production, aptitudes de zone, lutte contre ravageurs, relevés de prix — dans le **flux d'événements de la culture** posé au Lot A. Aujourd'hui ce sont des agrégats séparés (repos + tables distincts) que le read-model recoud. Après ce lot, chaque mutation de section **émet un événement dans le flux de la culture** (`streamId = cropId`) et l'agrégat `Crop` **absorbe les sections** : un seul repli du flux produit la fiche entière. C'est le prérequis pour versionner/diffuser la fiche complète (Lot B). **Zéro changement de comportement visible.**

Décision actée : **Option A** — l'agrégat `Crop` devient la **fiche complète** (tient les collections de sections), et non un simple routage d'événements.

## 2. Périmètre

### Dans le lot
- **5 nouveaux événements** dans l'union `CropEvent` : `VarietyAdded`, `CroppingWindowAdded`, `ZoneSuitabilitySet`, `PestControlSet`, `PricePointAdded`.
- **Agrégat `Crop` étendu** : collections `_varieties`, `_windows`, `_zones`, `_pests`, `_prices` ; handlers `apply` pour les 5 événements ; mutations qui émettent ces événements ; `fromEvents` les replie. Réutilise les types domaine existants (`Variety`, `CroppingWindow`, `CropZoneSuitability`, `CropPestControl`, `PricePoint`).
- **Réécriture des 5 use-cases de section** vers le flux (charge les événements → `fromEvents` → mute → `append` → met à jour la table-projection de la section → audit).
- **Read-model inchangé** : les tables-projections des sections + `composeCropDocument` restent la source de lecture → mêmes documents/endpoints.

### Hors périmètre (lots suivants)
- Brouillon / publication versionnée / historique / republier / diff sémantique → **Lot B, C**.
- Suppression des tables-projections des sections au profit d'une lecture depuis le repli : **non** — on garde les projections (zéro changement visible, faible risque).
- `AuditLog` : conservé tel quel.
- Migration de données : aucune (base vide).

## 3. Comportement préservé (le « zéro changement visible »)

- Tous les endpoints de section (`POST /crops/:id/varieties`, `PUT /crops/:id/zones/:zoneId`, `POST /crops/:id/windows`, `PUT /crops/:id/pests/:pestId`, `POST /crops/:id/prices`) et `GET /crops/:id` renvoient exactement les mêmes documents qu'avant.
- **`version` de la culture inchangé** : aujourd'hui, éditer une section **ne change pas** `crop.version`. On préserve ce comportement : les événements de section **avancent la `sequence`** du flux mais **n'incrémentent pas** le `version` domaine (même traitement que `Published`/`Archived` au Lot A).
- Les specs **domaine** et **e2e** existantes passent **sans modification** (garde-fou nº1). Les specs **unitaires** des use-cases de section évoluent (nouveau constructeur + amorçage par événements).

## 4. Architecture

### 4.1 Événements (ajouts à `domain/crop/crop-event.ts`)
```ts
  | { type: 'VarietyAdded'; variety: VarietyJSON }              // ajout (id propre généré en amont)
  | { type: 'CroppingWindowAdded'; window: CroppingWindowJSON } // ajout (id propre)
  | { type: 'ZoneSuitabilitySet'; suitability: CropZoneSuitabilityJSON }  // upsert par zoneId
  | { type: 'PestControlSet'; control: CropPestControlJSON }    // upsert par pestId
  | { type: 'PricePointAdded'; price: PricePointJSON }          // ajout (id propre)
```
Chaque payload porte le **snapshot JSON** de l'objet de section (types `…JSON`/snapshot déjà existants). L'id des entités « ajout » (variété, fenêtre, prix) est généré **dans le use-case** (via `IdGenerator`) et inclus dans l'événement, pour un repli déterministe.

### 4.2 Agrégat `Crop`
- Nouveaux champs privés : `_varieties: VarietySnapshot[]`, `_windows: CroppingWindowSnapshot[]`, `_zones: CropZoneSuitabilitySnapshot[]`, `_pests: CropPestControlSnapshot[]`, `_prices: PricePointSnapshot[]` (initialisés `[]` en déclaration, hors constructeur — comme `_pending` au Lot A, pour ne pas toucher la signature du constructeur privé).
- Getters correspondants (copies défensives).
- Mutations : `addVariety(v)`, `addCroppingWindow(w)`, `setZoneSuitability(s)`, `setPestControl(c)`, `addPricePoint(p)` → chacune `this.raise(event)`.
- `apply` (le fold) étendu : `VarietyAdded`/`CroppingWindowAdded`/`PricePointAdded` → `push` dans la collection ; `ZoneSuitabilitySet` → **remplacer** l'entrée de même `zoneId` (sinon push) ; `PestControlSet` → idem par `pestId`. **Aucun `_version += 1`** pour ces 5 événements.
- `fromEvents` : inchangé structurellement — la boucle `apply` gère naturellement les nouveaux types.
- `toSnapshot()` / `CropSnapshot` : **inchangés** (cœur seulement). Les sections vivent dans leurs propres tables-projections ; l'agrégat les tient en mémoire pour le repli (utile au Lot B), pas dans le snapshot cœur.

### 4.3 Use-cases de section (patron réécrit)
Chaque use-case (`AddVariety`, `AddCroppingWindow`, `SetCropZoneSuitability`, `SetCropPestControl`, `AddPricePoint`) :
```
stored = eventStore.load(cropId)
if (stored.length === 0) throw CropNotFoundError
// vérifs d'existence conservées (ex. zone/ravageur pour les liens)
crop = Crop.fromEvents(stored)
entity = <Type>.create({ id: ids.next()…, … })   // construction inchangée
crop.addXxx(entity.toSnapshot())                  // -> raise(event)
append(cropId, stored.length, crop.pullPendingEvents().map(e => ({ event: e, actor, at })))
sectionRepo.save(entity.toSnapshot())             // projection de section (inchangée)
audit.record(...)                                 // conservé (mêmes entityType/changes)
return entity.toSnapshot()                         // valeur de retour inchangée
```
Injecte désormais `CROP_EVENT_STORE` (à la place de `CROP_REPOSITORY` pour la vérif d'existence — l'existence = flux non vide). Conserve `IdGenerator` pour les ajouts, et les repos zone/ravageur pour les vérifs de lien.

### 4.4 Read-model
`composeCropDocument` et `toCropDocument` **inchangés** : ils lisent les tables-projections des sections (`listVarieties`, `listCropZones`, `listWindows`, `listCropPests`, `listPrices`), toujours mises à jour par les use-cases. → Documents identiques.

## 5. Gestion d'erreur
- Culture introuvable (flux vide) → `CropNotFoundError` → 404 (inchangé).
- Zone/ravageur introuvable (liens) → erreurs existantes (`ZoneNotFoundError`/équivalent) → 404 (inchangé).
- Conflit de concurrence (`expectedSequence` périmé) → `ConcurrencyError` → 409 (déjà mappé au Lot A).

## 6. Tests
- **Non-régression** : specs **domaine** + **e2e** existantes passent **sans modification** (comportement identique).
- **Nouveaux (TDD)** :
  - Agrégat : chaque mutation de section émet le bon événement ; `apply` fait push / upsert-par-clé ; les événements de section **n'incrémentent pas** `version` ; `fromEvents` d'un flux mixte (cœur + sections) produit les bonnes collections (getters) ; upsert par `zoneId`/`pestId` remplace bien.
  - Use-cases : après exécution, le flux contient l'événement de section attendu **et** la table-projection de la section reflète le changement.
- e2e existants (`variety-requirements`, `window`, `nutrition-price`, zones/pests) restent verts.

## 7. Critères de succès
- [ ] 5 événements de section dans `CropEvent` ; agrégat `Crop` tient et replie les collections ; upsert par clé pour zones/ravageurs.
- [ ] Les 5 use-cases de section event-sourcés ; projections de section conservées et à jour ; audit conservé.
- [ ] **Suite API entière verte sans modifier les specs domaine/e2e** ; documents et endpoints inchangés ; `version` de la culture non affecté par les sections.
- [ ] Un repli complet du flux d'une culture reconstitue **toute la fiche** (cœur + 5 sections) — vérifié par un test d'agrégat.

## 8. Notes de découpage (pour le plan)
Ordre TDD suggéré : (1) 5 événements + collections/`apply`/mutations/getters sur `Crop` + specs d'agrégat (fold mixte, upsert) ; (2) réécriture `AddVariety` + `AddCroppingWindow` + `AddPricePoint` (ajouts) + DI + specs ; (3) réécriture `SetCropZoneSuitability` + `SetCropPestControl` (upserts) + DI + specs ; (4) vérif finale (suite entière verte + test « repli = fiche complète »). Chaque tâche garde la suite existante verte.

## Références
- Agrégat : `apps/api/src/domain/crop/crop.ts` (Lot A : `apply`/`fromEvents`/`raise`/`pullPendingEvents`).
- Événements : `apps/api/src/domain/crop/crop-event.ts` (Lot A).
- Event store : `application/crop/crop-event-store.ts` (Lot A).
- Types de section : `domain/crop/variety.ts`, `domain/window/*`, `domain/zone/crop-zone-suitability.ts`, `domain/pest/crop-pest-control.ts`, `domain/price/*` (ou emplacements équivalents).
- Use-cases : `add-variety`, `window/add-cropping-window`, `zone/set-crop-zone-suitability`, `pest/set-crop-pest-control`, `price/add-price-point`.
- Read-model : `crop.controller.ts` (`composeCropDocument`) + `crop-read-model.ts` (`toCropDocument`).
