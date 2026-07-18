# Fiche Culture — variétés (résistances/adaptation) + commercialisation — Design

**Statut :** validé (brainstorming), prêt pour le plan.

## Objectif

Compléter le référentiel Culture (brique « moyen », avec migrations) sur deux axes : (1) **variétés** — résistances aux maladies (par maladie du référentiel) + adaptation par zone (avec aptitude) ; (2) **commercialisation** — produits commercialisés (forme + unités de vente + débouchés) comme nouvelle section de la fiche, comptée dans la complétude.

## Contexte & état existant

Découverte à l'exploration : une partie de ce qui semblait manquer existe déjà.
- **Variété** (`domain/crop/variety.ts` + table Prisma `Variety` + événements `VarietyAdded`/`VarietyUpdated` event-sourcés) porte déjà : `name`, `maturityDays`, **`yieldPotential`** (plage, rendement potentiel), `traits: string[]`, `provenance`. **Manque** : résistances structurées + adaptation zone.
- **Symptômes** existent déjà sur le référentiel `PestDisease` (`symptoms?: Record<string,string>`) → **hors périmètre** de cette brique (couvert au niveau du bioagresseur).
- **Prix** (`PricePoint` : marché/période/prix/unité/devise) existent → inchangés. **Manque** : produits/formes/débouchés (concept neuf, niveau crop).
- La fiche Culture est **event-sourcée** : VO purs → événements → agrégat `Crop` (apply/snapshot) → projection `compose-crop-document`/`crop-read-model` (passe-plat) → repos Prisma → DTO → éditeurs admin. Complétude via `computeCompleteness` (10 catégories aujourd'hui).
- Barème d'aptitude existant réutilisé : `SuitabilityRating` = `SUITABLE` / `MARGINAL` / `UNSUITABLE` (`domain/zone/suitability-rating.ts`).

**Note forward-compat (hors périmètre) :** un onglet dédié « maladies » (référentiel riche : symptômes/traitement/stade) et l'association **maladie ↔ stade d'une culture** viendront plus tard. Le lien variété→maladie de cette brique réutilise le référentiel `PestDisease` existant, sans préempter cette évolution.

## Périmètre

**Inclus :** variétés (résistances par maladie + adaptation par zone) ; section commercialisation (produits/formes/débouchés) + catégorie de complétude ; migrations Prisma (2 colonnes `Variety`, 1 colonne `Crop`) ; TDD, clean architecture.

**Hors périmètre :** symptômes spécifiques-culture (le référentiel `PestDisease.symptoms` suffit) ; onglet de création/gestion des maladies (brique future) ; association maladie↔stade (future) ; récolte enrichie, post-récolte, adventices, bonnes pratiques, médias.

## Décisions produit (validées)

- Modèle **riche** pour les variétés : résistance **par maladie** (référentiel) + adaptation **par zone avec aptitude**.
- Commercialisation = **nouvelle section** de la fiche (niveau crop), **ajoutée à la complétude** (total 10 → 11 ; recalcul mécanique du pourcentage de toutes les fiches).
- Pas de données à préserver (DB effacée par les tests) ; pas de rétro-compatibilité d'events.
- **Clean architecture + TDD** stricts (VO purs → application → présentation/admin ; test rouge d'abord).

---

## Section 1 — Variétés (modèle riche)

**Nouveau type** `ResistanceLevel` = `LOW` / `MEDIUM` / `HIGH` (Faible / Moyenne / Élevée).

Le `VarietySnapshot` gagne deux listes structurées **optionnelles** :
- `diseaseResistances?: { pestId: string; level: ResistanceLevel }[]` — `pestId` référence une maladie du référentiel `PestDisease` (type maladie), choisie dans les maladies existantes.
- `zoneAdaptations?: { zoneId: string; rating: SuitabilityRating }[]` — `zoneId` référence une `AgroEcologicalZone` existante ; `rating` réutilise `SuitabilityRating`.

**Technique :**
- VO `Variety` (`domain/crop/variety.ts`) : ajouter les 2 listes dans les props, `VarietySnapshot`, `toSnapshot`, `fromSnapshot` (copies défensives, défaut `[]`/absent). Optionnellement 2 petits VO `DiseaseResistance`/`ZoneAdaptation` ou des objets JSON simples validés à la création.
- Les événements `VarietyAdded`/`VarietyUpdated` portent le `VarietySnapshot` → propagation automatique (comme la brique léger).
- **Migration Prisma** : ajouter 2 colonnes JSON à `Variety` : `diseaseResistances Json?`, `zoneAdaptations Json?` (appliquée à la main, `prisma migrate dev` non-interactif ici).
- Repo `Variety` (`toRow`/`toDomain`) : mapper les 2 colonnes.
- Use-cases `addVariety`/`updateVariety` : accepter les 2 listes en entrée.
- Admin : `lib/api.ts` (`Variety` gagne les 2 listes), `lib/labels.ts` (`RESISTANCE_LEVEL_LABELS`, et réutiliser le barème d'aptitude existant), `VarietyEditor.tsx` — choisir maladie (depuis la liste des maladies) + niveau, et zone (depuis les zones) + aptitude. L'éditeur charge les référentiels maladies/zones existants.

## Section 2 — Commercialisation (nouvelle section)

**Nouveau VO** `CommercializationProduct` :
- `form: string` — forme, enum `GRAIN` / `FLOUR` (farine) / `OIL` (huile) / `LEAF` (feuille) / `FRUIT` / `TUBER` / `OTHER`.
- `saleUnits: string[]` — unités de vente, codes `KG` / `BAG` (sac) / `CRATE` (caisse) / `TONNE` (multi-sélection).
- `outlets: string[]` — débouchés (marchés/circuits), chaînes libres.

**Technique** (mêmes patterns que `nutrition`/`yields` — sections JSON sur la table `Crop`) :
- VO `CommercializationProduct` (`domain/crop/…`) avec `toJSON`/`fromJSON`.
- Nouvel événement `CommercializationSet` (remplacement complet, comme `NutritionSet`) dans `domain/crop/crop-event.ts`.
- Agrégat `Crop` : champ `_commercialization: CommercializationProduct[]`, `apply('CommercializationSet')`, `setCommercialization(list)`, getter, `toSnapshot`, `fromSnapshot`, `CropSnapshot`.
- **Migration Prisma** : ajouter colonne JSON `commercialization Json?` à `Crop`.
- Repo Crop : persister/relire `commercialization`.
- Projection/read-model : `CropDocument.commercialization: CommercializationProductJSON[]` (passe-plat depuis le snapshot).
- **Complétude** : ajouter `commercialization: boolean` à `CompletenessInput` de `computeCompleteness` (total 10 → 11) ; le composer le renseigne (`commercialization.length > 0`).
- Use-case `setCommercialization` (event-sourced, comme `setNutrition`).
- Admin : `lib/api.ts` (`CropDetail.commercialization`), `lib/labels.ts` (`PRODUCT_FORM_LABELS`, `SALE_UNIT_LABELS`), nouvel éditeur `CommercializationEditor.tsx` (par produit : select forme + multi-select unités + liste débouchés) + son câblage dans un appel `setCommercialization`.

## Section 3 — Tests

**API** (Jest, event-sourcing, doubles en mémoire ; TDD, clean archi) :
- Variétés : `VarietySnapshot`/VO round-trip `diseaseResistances` + `zoneAdaptations` (toSnapshot/fromSnapshot, listes absentes → `[]`) ; agrégat rejoue un `VarietyAdded`/`VarietyUpdated` enrichi → document expose les listes ; repo `Variety` mappe les 2 colonnes (toRow/toDomain).
- Commercialisation : VO `CommercializationProduct` round-trip ; agrégat applique `CommercializationSet` → snapshot → `CropDocument.commercialization` ; use-case `setCommercialization` ; `computeCompleteness` compte la catégorie (total 11) — test mis à jour.
- Non-régression : suite crop complète verte (versions, diff, publish, complétude recalculée).

**Admin** : `tsc --noEmit` + `pnpm build` (VarietyEditor enrichi + CommercializationEditor).

**Migrations** : 2 colonnes JSON `Variety` + 1 colonne JSON `Crop`, appliquées à la main (comme les migrations précédentes du dépôt). Pas de données à préserver.

**Validation manuelle** : variété avec résistances (maladie+niveau) + adaptation zone (zone+aptitude) ; produits commercialisés (forme + unités + débouchés) ; publier → vérifier diff + affichage + complétude à 11 catégories.

## Critères de succès

- [ ] Variété : `diseaseResistances` (maladie du référentiel + niveau) et `zoneAdaptations` (zone + aptitude) de l'événement à l'éditeur ; migration 2 colonnes.
- [ ] Commercialisation : produits (forme + unités + débouchés) comme section event-sourcée + migration colonne `Crop` + éditeur.
- [ ] Complétude passe à 11 catégories (commercialisation comptée) ; test mis à jour.
- [ ] Clean architecture (VO purs → application → présentation) ; chaque couche en TDD.
- [ ] Suites API (dont non-régression crop) + admin vertes ; builds OK.
- [ ] Réutilise `PestDisease`/`AgroEcologicalZone`/`SuitabilityRating` existants (pas de duplication) ; forward-compatible avec le futur onglet maladies.

## Suite

Récolte enrichie, post-récolte, adventices, bonnes pratiques, médias/documentation ; onglet maladies (référentiel riche) + association maladie↔stade ; brique Carnet (données de terrain).
