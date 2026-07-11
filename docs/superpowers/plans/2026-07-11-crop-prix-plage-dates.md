# Prix en plage de dates (+ édition) — D5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un relevé de prix porte une plage de dates (`periodStart`/`periodEnd`, fin optionnelle → défaut = début) au lieu d'une date unique, et devient éditable.

**Architecture :** API d'abord. Task 1 = renommage atomique `date` → `periodStart`+`periodEnd` à travers domaine, événement, projection (migration), read model, use-case d'ajout (normalisation + validation), et mise à jour des tests qui envoyaient `date`. Task 2 = édition (événement `PricePointUpdated` + use-case + `PUT`), miroir de la variété. Task 3 = admin (éditeur deux dates + mode édition + affichage période + « Modifier »).

**Tech Stack :** NestJS, Prisma, Jest (API) ; Next.js 14, TypeScript, shadcn/ui (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`. DB + flux d'événements **vides** → aucun upcasting.
- **Fin optionnelle** : `periodEnd = input.periodEnd || input.periodStart` (normalisé côté use-case ; le snapshot porte toujours les deux).
- **Validation** : `periodEnd < periodStart` (comparaison de chaînes ISO `yyyy-MM-dd`) → `InvalidPricePeriodError` → **422**. Id de prix absent → **404**.
- **Pas de suppression** de relevé (hors périmètre). Autres sections inchangées.
- **API** : barrière = `pnpm --filter @okko/api test` vert + migration appliquée. **Admin** : `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 (modèle) :** `apps/api/src/domain/price/price-point.ts` ; `apps/api/prisma/schema.prisma` + migration ; `apps/api/src/infrastructure/price/prisma-price-point.repository.ts` ; `apps/api/src/application/price/in-memory-price-point.repository.ts` ; `apps/api/src/application/price/add-price-point.use-case.ts` (+ spec) ; `apps/api/src/application/crop/crop-read-model.ts` ; `apps/api/src/presentation/crop/crop.controller.ts` ; tests : `apps/api/test/helpers/complete-crop.ts`, `nutrition-price.e2e-spec.ts`, `crop-sections-event-sourcing.e2e-spec.ts`.
**Task 2 (édition) :** `apps/api/src/domain/crop/crop-event.ts`, `crop.ts` ; `apps/api/src/application/price/update-price-point.use-case.ts` (nouveau, + spec) ; `crop.controller.ts` ; `crop.module.ts` ; un e2e.
**Task 3 (admin) :** `apps/admin/src/lib/api.ts` ; `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx` ; `apps/admin/src/app/crops/[id]/page.tsx`.

---

## Task 1 : API — modèle prix en plage de dates

**Files:** (voir File Structure, Task 1)

**Interfaces:**
- Produces : `PricePointSnapshot { id, cropId, market, periodStart, periodEnd, price, unit, currency }` ; `AddPricePointUseCase` input `{ …, periodStart, periodEnd? }` (normalisé, validé) ; `InvalidPricePeriodError`.

- [ ] **Step 1 : Écrire les tests use-case (échouent)** — dans `apps/api/src/application/price/add-price-point.use-case.spec.ts` (créer s'il n'existe pas ; sinon adapter). Cas :
```ts
// périodes: fin fournie -> stockée ; fin omise -> = début ; fin < début -> InvalidPricePeriodError
it('stocke la plage', async () => { /* add {periodStart:'2026-06-01', periodEnd:'2026-06-07'} -> snap.periodStart/periodEnd corrects */ });
it('fin omise = début', async () => { /* add {periodStart:'2026-06-01'} -> periodEnd === '2026-06-01' */ });
it('fin < début -> InvalidPricePeriodError', async () => { /* add {periodStart:'2026-06-07', periodEnd:'2026-06-01'} throws */ });
```
S'inspirer d'un spec use-case existant pour le câblage in-memory (event store, price repo, audit, clock, ids).

- [ ] **Step 2 : Run → échoue.** Run: `pnpm --filter @okko/api test -- add-price-point.use-case` — Expected: FAIL (compile ou assertions).

- [ ] **Step 3 : VO & snapshot** — dans `apps/api/src/domain/price/price-point.ts` : remplacer partout `date` par `periodStart` + `periodEnd` (interface `PricePointSnapshot`, `CreateProps`, champ privé `_date`→`_periodStart`+`_periodEnd`, constructeur, getters, `create`, `toSnapshot`, `fromSnapshot`).

- [ ] **Step 4 : Use-case d'ajout + erreur** — dans `add-price-point.use-case.ts` : l'input remplace `date: string` par `periodStart: string; periodEnd?: string`. Ajouter la classe `InvalidPricePeriodError extends Error` (name `'InvalidPricePeriodError'`). Dans `execute`, avant de construire le point :
```ts
const periodStart = input.periodStart;
const periodEnd = input.periodEnd || input.periodStart;
if (periodEnd < periodStart) throw new InvalidPricePeriodError();
```
Construire `PricePoint.create({ …, periodStart, periodEnd })`.

- [ ] **Step 5 : Run le test use-case → passe.** Run: `pnpm --filter @okko/api test -- add-price-point.use-case` — Expected: PASS.

- [ ] **Step 6 : Migration Prisma** — dans `apps/api/prisma/schema.prisma`, `model PricePoint` : remplacer `date String` par `periodStart String` + `periodEnd String`. Puis :
Run: `cd apps/api && pnpm prisma migrate dev --name price_point_date_range`
Expected: migration créée + appliquée (DB vide → pas de backfill). Client régénéré.

- [ ] **Step 7 : Repos** — `prisma-price-point.repository.ts` : `toRow`/`toSnapshot` mappent `periodStart`/`periodEnd` ; `orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }]`. `in-memory-price-point.repository.ts` : `sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1))`.

- [ ] **Step 8 : Read model** — dans `crop-read-model.ts`, la ligne « Prix récent » : remplacer `latest.date` par la période :
```ts
const per = latest.periodStart === latest.periodEnd ? latest.periodStart : `${latest.periodStart}–${latest.periodEnd}`;
lines.push(`Prix récent : ${latest.price} ${latest.unit} (${latest.market}, ${per})`);
```

- [ ] **Step 9 : Contrôleur** — `crop.controller.ts` : `@Post(':id/prices')` corps `{ market, periodStart, periodEnd?, price, unit, currency }` (passer à `execute`). Dans `mapCropError`, ajouter `if (e instanceof InvalidPricePeriodError) throw new UnprocessableEntityException((e as Error).message);` (importer `InvalidPricePeriodError` ; `UnprocessableEntityException` déjà importé depuis la Brique 2).

- [ ] **Step 10 : Non-régression tests** — remplacer `date: '…'` par `periodStart: '…'` dans les 3 fichiers, et adapter toute assertion sur `.date` :
  - `apps/api/test/helpers/complete-crop.ts` (l. 41) : `periodStart: '2026-06-01'`.
  - `apps/api/test/nutrition-price.e2e-spec.ts` (l. 40, 55 : bodies prix) + assertions éventuelles sur `prices[…].date` → `.periodStart`/`.periodEnd`.
  - `apps/api/test/crop-sections-event-sourcing.e2e-spec.ts` (body prix) + assertions.

- [ ] **Step 11 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert (toute référence à `date` sur le prix supprimée).

- [ ] **Step 12 : Commit**
```bash
git add apps/api/src/domain/price/price-point.ts apps/api/prisma apps/api/src/infrastructure/price/prisma-price-point.repository.ts apps/api/src/application/price/in-memory-price-point.repository.ts apps/api/src/application/price/add-price-point.use-case.ts apps/api/src/application/price/add-price-point.use-case.spec.ts apps/api/src/application/crop/crop-read-model.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/test/helpers/complete-crop.ts apps/api/test/nutrition-price.e2e-spec.ts apps/api/test/crop-sections-event-sourcing.e2e-spec.ts
git commit -m "feat(api): relevé de prix sur une plage de dates (periodStart/periodEnd)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : API — édition d'un relevé de prix

**Files:**
- Modify: `apps/api/src/domain/crop/crop-event.ts` (union), `apps/api/src/domain/crop/crop.ts` (`updatePricePoint` + apply)
- Create: `apps/api/src/application/price/update-price-point.use-case.ts` (+ spec)
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (endpoint + mapping), `apps/api/src/crop.module.ts` (provider)
- Modify: un e2e (PUT + 404 + 422)

**Interfaces:**
- Produces : `Crop.updatePricePoint(p)` ; `UpdatePricePointUseCase.execute({ cropId, priceId, market, periodStart, periodEnd?, price, unit, currency, actor })` ; `PricePointNotFoundError` ; `PUT /crops/:id/prices/:priceId`.

- [ ] **Step 1 : Écrire le test update use-case (échoue)** — `apps/api/src/application/price/update-price-point.use-case.spec.ts` : ajouter un prix (id 'p1') puis le mettre à jour → même count, nouvelles valeurs (dont la période) ; id absent → `PricePointNotFoundError` ; `fin < début` → `InvalidPricePeriodError` (réutilisé de Task 1).

- [ ] **Step 2 : Run → échoue.**

- [ ] **Step 3 : Événement** — `crop-event.ts` : ajouter `| { type: 'PricePointUpdated'; price: PricePointSnapshot }` (après `PricePointAdded`). `crop.ts` : `updatePricePoint(p: PricePointSnapshot): void { this.raise({ type: 'PricePointUpdated', price: p }); }` (près de `addPricePoint`, l. 167) ; apply (près l. 191) : `case 'PricePointUpdated': this._prices = this._prices.map((x) => x.id === e.price.id ? e.price : x); this._hasUnpublishedChanges = true; break;`.

- [ ] **Step 4 : Use-case** — `update-price-point.use-case.ts`, miroir de `UpdateVarietyUseCase` (dépendances : events, prices, audit, clock — pas d'ids). Classe `PricePointNotFoundError extends Error`. `execute` : charge événements ; `CropNotFoundError` si vide ; `PricePointNotFoundError` si `!crop.prices.some(p => p.id === input.priceId)` ; normaliser/valider la période (même règle que Task 1, réutiliser `InvalidPricePeriodError`) ; `PricePoint.create({ id: input.priceId, cropId: input.cropId, market, periodStart, periodEnd, price, unit, currency })` ; `crop.updatePricePoint(snap)` ; append ; `prices.save(snap)` (upsert par id) ; audit.

- [ ] **Step 5 : Run le test → passe.**

- [ ] **Step 6 : Endpoint + mapping** — `crop.controller.ts` : injecter `UpdatePricePointUseCase` ; handler :
```ts
@Put(':id/prices/:priceId')
async updatePrice(@Param('id') id: string, @Param('priceId') priceId: string, @Body() body: { market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }) {
  try { return await this.updatePriceUC.execute({ cropId: id, priceId, ...body, actor: ACTOR }); }
  catch (e) { mapCropError(e, id); }
}
```
`mapCropError` : `PricePointNotFoundError → NotFoundException`.

- [ ] **Step 7 : Provider module** — `crop.module.ts` : provider `UpdatePricePointUseCase` miroir de `AddPricePointUseCase` (sans `UuidIdGenerator`) : `inject: [CROP_EVENT_STORE, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK]`.

- [ ] **Step 8 : e2e** — `POST` prix → récupérer son id via `GET /crops/:id` → `PUT /crops/:id/prices/:pid` (nouvelle période + prix) → `GET` reflète la mise à jour, count inchangé ; `PUT` id absent → 404 ; `PUT` `fin < début` → 422.

- [ ] **Step 9 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 10 : Commit**
```bash
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/application/price/update-price-point.use-case.ts apps/api/src/application/price/update-price-point.use-case.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/
git commit -m "feat(api): édition d'un relevé de prix (PricePointUpdated + PUT /crops/:id/prices/:priceId)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Admin — éditeur plage + mode édition + affichage

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (type `PricePoint` + `addPrice`/`updatePrice`)
- Modify: `apps/admin/src/app/crops/[id]/editors/PriceEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes : API (Tasks 1-2). Produces : `PriceEditor` accepte `initial?`.

- [ ] **Step 1 : `lib/api.ts`** — type `PricePoint` : remplacer `date: string` par `periodStart: string; periodEnd: string`. `addPrice(cropId, body)` : corps `{ market, periodStart, periodEnd?, price, unit, currency }` (POST, inchangé sinon). Ajouter `updatePrice(cropId, priceId, body)` (même corps, `PUT /crops/${cropId}/prices/${priceId}`, mirroir de `updateVariety`).

- [ ] **Step 2 : `PriceEditor.tsx` — plage + mode édition** — lire le fichier (il a `market`, `date`, `price`, `unit`, `currency`, un `DatePicker` pour la date, garde `if (!date) return;`). Modifs :
  - États : remplacer `date` par `periodStart` et `periodEnd` (deux `DatePicker`). Label « Début * » / « Fin (optionnelle) ».
  - Prop `initial?: { id: string; market: string; periodStart: string; periodEnd: string; price: number; unit: string; currency: string }` ; `const editing = !!initial;` init des états depuis `initial` (price/… en `String(...)`).
  - Label `EditorShell` : `editing ? 'Modifier' : '+ Ajouter un relevé de prix'`.
  - Garde : `if (!periodStart) return;` (fin peut rester vide).
  - Submit : `const body = { market, periodStart, periodEnd: periodEnd || undefined, price: Number(price), unit, currency };` puis `editing ? updatePrice(cropId, initial!.id, body) : (addPrice(cropId, body) + reset)`. Reset seulement en ajout. Bouton `{editing ? 'Enregistrer' : 'Ajouter'}`.
  - Importer `updatePrice`.

- [ ] **Step 3 : `page.tsx` — affichage période + « Modifier »** — dans la Card Prix, remplacer le rendu des relevés :
```tsx
{crop.prices.map((p) => (
  <li key={p.id} className="flex items-center gap-2">
    <span>{p.periodStart === p.periodEnd ? p.periodStart : `${p.periodStart} → ${p.periodEnd}`} — {p.price} {p.unit} @ {p.market}</span>
    <PriceEditor cropId={params.id} initial={p} />
  </li>
))}
```
L'éditeur d'ajout (`<PriceEditor cropId={params.id} />`) reste dans l'en-tête de la Card.

- [ ] **Step 4 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 5 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Ajouter un relevé sur une plage (début + fin) et sur un jour (fin vide) → affichage « X → Y » vs date unique ; modifier un relevé → la valeur change ; l'ajout marche toujours.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/PriceEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): relevé de prix sur une plage de dates + édition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Modèle** : `date` → `periodStart`/`periodEnd` partout (domaine, événement, projection, migration, read model, admin) ; plus aucune référence à `.date` sur le prix. Fin optionnelle → défaut = début ; `fin < début` → 422.
- **Édition** : `PricePointUpdated` + `UpdatePricePointUseCase` + `PUT` (upsert par id, 404 si absent) ; admin mode édition + « Modifier » par relevé.
- **Affichage** : date unique si `début === fin`, sinon « X → Y » (read model et admin).
- Non-régression (helper + 2 e2e) verte ; suite API verte ; build admin vert. Pas de suppression.

## Self-review (couverture spec)

- §4.1 modèle VO/snapshot → Task 1 (Step 3). §4.5 projection/tri/migration → Task 1 (Steps 6-7). §4.3 add use-case (normalisation/validation) → Task 1 (Steps 1-5). §4.6 read model → Task 1 (Step 8). §4.4 POST/422 → Task 1 (Step 9). ✅
- §4.2/§4.3 édition (événement, use-case, PUT, 404) → Task 2. ✅
- §5 admin (api, éditeur plage+édition, affichage) → Task 3. ✅
- §2 non-régression (helper + 2 e2e) → Task 1 (Step 10). ✅
- §3 hors périmètre (suppression) → Global Constraints + Notes. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
