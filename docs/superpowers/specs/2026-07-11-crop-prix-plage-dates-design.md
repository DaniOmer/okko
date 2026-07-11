# Spec — Prix en plage de dates (+ édition) — D5

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Un relevé de prix porte aujourd'hui une **date unique**. Le passer à une **plage de dates** (début/fin), la fin étant **optionnelle** (défaut = début → un seul jour). Rendre aussi les relevés de prix **éditables** (le prix était la dernière section non éditable après la Brique 3).

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D5, §C1 report prix).

## 2. Contexte (vérifié)

- `PricePointSnapshot` / `PricePoint` (VO) / l'événement `PricePointAdded` / la colonne Prisma `PricePoint.date` portent un seul `date: string` (ISO `yyyy-MM-dd`).
- Tri « prix récent » : projection Prisma `orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]` ; in-memory `sort((a,b)=> a.date < b.date ? 1 : -1)`. Le read model affiche `prices[0]` comme « Prix récent … (marché, date) ».
- Le prix est en **append-only** (`PricePointAdded` pousse) — pas d'événement de mise à jour.
- Envoient un prix avec `{ date }` : le helper de test `apps/api/test/helpers/complete-crop.ts`, `nutrition-price.e2e-spec.ts` (×2), `crop-sections-event-sourcing.e2e-spec.ts`.
- Le flux d'événements **et** la DB de dev sont **vides** → **aucun upcasting** d'anciens événements nécessaire.
- ⚠️ La suite de tests API **efface la DB de dev** — prévenir avant de la lancer.

## 3. Périmètre

### Dans le lot
- **Modèle** : `date` → `periodStart` + `periodEnd` (domaine, événement, projection, migration).
- **Édition** : événement `PricePointUpdated` + `UpdatePricePointUseCase` + `PUT /crops/:id/prices/:priceId`.
- **Read model & affichage** : période (date unique si `periodStart === periodEnd`, sinon « du X au Y »).
- **Admin** : `PriceEditor` avec deux champs date (début obligatoire, fin optionnelle) + mode édition ; `page.tsx` affiche la période + « Modifier » par relevé ; `lib/api` `addPrice`/`updatePrice`.
- **Non-régression** : helper + e2e passent `{ date }` → `{ periodStart }`.

### Hors périmètre
- **Suppression** d'un relevé (non demandée).
- Refontes D1/D2/D3/D4, vue client F1.

### Comportement préservé
- L'ajout d'un relevé reste possible (avec plage) ; la publication/complétude (catégorie `prices` = présence d'au moins un relevé) : inchangée.
- Autres sections : inchangées.

## 4. Architecture — API

### 4.1 Modèle — `apps/api/src/domain/price/price-point.ts`
- `PricePointSnapshot` : remplacer `date: string` par `periodStart: string; periodEnd: string`.
- `PricePoint` (VO) : remplacer `_date` par `_periodStart` + `_periodEnd`, getters, `toSnapshot`, `fromSnapshot`, `create`.

### 4.2 Événements — `apps/api/src/domain/crop/crop-event.ts` + `crop.ts`
- `PricePointAdded` : sa prop `price: PricePointSnapshot` porte désormais `periodStart`/`periodEnd` (via le snapshot ; pas de changement de forme d'événement autre que le snapshot).
- Ajouter `{ type: 'PricePointUpdated'; price: PricePointSnapshot }` à l'union.
- Domaine `crop.ts` : `updatePricePoint(p: PricePointSnapshot): void { this.raise({ type: 'PricePointUpdated', price: p }); }` ; `apply` : `case 'PricePointUpdated': this._prices = this._prices.map((x) => x.id === e.price.id ? e.price : x); this._hasUnpublishedChanges = true; break;`.

### 4.3 Use-cases — `apps/api/src/application/price/`
- **`AddPricePointUseCase`** : l'input remplace `date` par `periodStart: string; periodEnd?: string`. Normalisation `const periodEnd = input.periodEnd || input.periodStart;`. Validation `if (periodEnd < periodStart) throw new InvalidPricePeriodError();`. Construit le snapshot avec les deux dates.
- **`UpdatePricePointUseCase`** (nouveau, miroir de `UpdateVarietyUseCase`) : charge les événements, `PricePointNotFoundError` si l'id n'existe pas dans `crop.prices`, même normalisation/validation, `crop.updatePricePoint(snap)`, append, `prices.save(snap)` (upsert par id), audit.
- Erreurs : `InvalidPricePeriodError` (période invalide) et `PricePointNotFoundError` (id absent), dans le module prix ou `add-price-point.use-case.ts`.

### 4.4 Endpoint & mapping — `apps/api/src/presentation/crop/crop.controller.ts`
- `POST /crops/:id/prices` : corps `{ market, periodStart, periodEnd?, price, unit, currency }`.
- `PUT /crops/:id/prices/:priceId` : idem, met à jour.
- `mapCropError` : `InvalidPricePeriodError → UnprocessableEntityException (422)` ; `PricePointNotFoundError → NotFoundException (404)`.
- Provider `UpdatePricePointUseCase` câblé dans le module.

### 4.5 Projection & tri — `prisma-price-point.repository.ts` + in-memory
- Colonnes : `periodStart`, `periodEnd` (remplacent `date`). `toRow`/`toSnapshot` mappent les deux.
- Tri « récent » : `orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }]` (Prisma) ; in-memory `sort((a,b)=> a.periodEnd < b.periodEnd ? 1 : -1)`.
- **Migration Prisma** `price_point_date_range` : `PricePoint` perd `date`, gagne `periodStart String` + `periodEnd String` (DB vide → pas de backfill).

### 4.6 Read model — `apps/api/src/application/crop/crop-read-model.ts`
- Ligne « Prix récent » : afficher la période — `latest.periodStart === latest.periodEnd ? latest.periodStart : \`${latest.periodStart}–${latest.periodEnd}\``.

## 5. Architecture — Admin

### 5.1 `lib/api.ts`
- `addPrice(cropId, { market, periodStart, periodEnd?, price, unit, currency })` (POST).
- `updatePrice(cropId, priceId, { market, periodStart, periodEnd?, price, unit, currency })` (PUT).
- Type `CropPrice`/`PricePointSnapshot` admin : `date` → `periodStart` + `periodEnd`.

### 5.2 `PriceEditor.tsx` — plage + mode édition
- Deux `DatePicker` : **début** (obligatoire) et **fin** (optionnelle). État `periodStart`/`periodEnd`.
- Prop `initial?` (`{ id, market, periodStart, periodEnd, price, unit, currency }`) → mode édition (label « Modifier », champs pré-remplis, `updatePrice(cropId, initial.id, …)`), sinon ajout (`addPrice`, avec reset). Bouton `{editing ? 'Enregistrer' : 'Ajouter'}`.
- Garde de soumission : `if (!periodStart) return;` (la fin peut rester vide → défaut = début côté API).

### 5.3 `page.tsx` — affichage période + « Modifier »
- Chaque relevé : afficher `p.periodStart === p.periodEnd ? p.periodStart : \`${p.periodStart} → ${p.periodEnd}\`` — {prix} {unité} @ {marché} + `<PriceEditor cropId initial={p} />` (bouton « Modifier »). L'éditeur d'ajout reste dans l'en-tête.

## 6. Gestion d'erreur
- Période invalide (`fin < début`) → **422**. Id de prix inexistant → **404**. Fin vide → défaut = début (pas d'erreur).

## 7. Tests (TDD API)
- **Domaine/VO** : snapshot round-trip porte `periodStart`/`periodEnd`.
- **Add use-case** : plage stockée ; `periodEnd` omis → défaut = `periodStart` ; `fin < début` → `InvalidPricePeriodError`.
- **Update use-case** : met à jour par id (même count, nouvelles valeurs) ; id absent → `PricePointNotFoundError` ; même normalisation/validation.
- **e2e** : `POST` prix plage → `GET /crops/:id` montre la période ; `POST` sans `periodEnd` → période = un jour ; `PUT` met à jour ; `PUT` id absent → 404 ; période invalide → 422.
- **Non-régression** : helper `complete-crop.ts` + `nutrition-price.e2e` + `crop-sections-event-sourcing.e2e` passent `{ date }` → `{ periodStart: '2026-06-01' }` (fin par défaut) et les assertions liées à `date` s'adaptent.

## 8. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir) ; migration appliquée.
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : ajouter un relevé sur une plage et sur un jour ; modifier un relevé ; affichage « du X au Y » vs date unique.

## 9. Critères de succès
- [ ] Modèle `periodStart`/`periodEnd` (domaine, événement, projection, migration) ; fin optionnelle → défaut = début ; validation `début ≤ fin` → 422.
- [ ] Édition : `PricePointUpdated` + `UpdatePricePointUseCase` + `PUT /crops/:id/prices/:priceId` (404 si absent).
- [ ] Read model & admin affichent la période (date unique ou « X → Y »).
- [ ] Admin : `PriceEditor` deux dates + mode édition + « Modifier » par relevé.
- [ ] Non-régression (helper + e2e) verte ; build admin vert. Suppression non incluse.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md`.
- API : `src/domain/price/price-point.ts`, `src/domain/crop/{crop-event,crop}.ts`, `src/application/price/{add-price-point,update-price-point}.use-case.ts`, `src/application/price/in-memory-price-point.repository.ts`, `src/infrastructure/price/prisma-price-point.repository.ts`, `src/application/crop/crop-read-model.ts`, `src/presentation/crop/crop.controller.ts`, `prisma/schema.prisma`.
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/editors/PriceEditor.tsx`, `src/app/crops/[id]/page.tsx`.
- Tests : `apps/api/test/helpers/complete-crop.ts`, `nutrition-price.e2e-spec.ts`, `crop-sections-event-sourcing.e2e-spec.ts`.
