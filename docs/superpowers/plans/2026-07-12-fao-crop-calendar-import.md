# Import du calendrier de semis FAO (tranche 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'expert cherche une culture par nom (autocomplétion FAO) et importe la fenêtre de semis FAO pour pré-remplir l'éditeur de fenêtre.

**Architecture :** API d'abord. Task 1 : catalogue cultures FAO embarqué + recherche (`GET /fao/crops`). Task 2 : port `CropCalendarProvider` + adaptateur FAO best-effort + stub + use-case de suggestion + endpoint. Task 3 : admin — section d'import (autocomplétion + Importer → pré-remplit `sowingStart`/`sowingEnd`). Tout ce qui est **automatiquement testé** passe par un **stub** ; l'appel FAO réel est best-effort (repli `null`) et validé en smoke manuel. Zéro changement de modèle.

**Tech Stack :** NestJS, `fetch` natif, Jest (API) ; Next.js 14, TypeScript, shadcn/ui (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`.
- **Appel FAO best-effort** : toute erreur (réseau, parse, pays/culture inconnus, 403/502) → `null` ; jamais de crash. **Les gates automatisés ne dépendent PAS d'un appel FAO réussi** (tests = catalogue + use-case avec stub + parsing sur échantillon ; build admin).
- **Zéro changement de modèle** (`CroppingWindow`, `Provenance`) : mode « suggérer & pré-remplir » ; la donnée validée par l'expert reste MANUELLE.
- **`fetch` natif** (pas de dépendance HTTP ajoutée).
- **API** : barrière = `pnpm --filter @okko/api test` vert. **Admin** : `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 :** `apps/api/src/infrastructure/fao/fao-crops.json` (nouveau) ; `apps/api/src/infrastructure/fao/fao-crop-catalog.ts` (+ spec) ; `apps/api/src/presentation/fao/fao.controller.ts` (nouveau) ; `apps/api/src/crop.module.ts`.
**Task 2 :** `apps/api/src/application/crop/crop-calendar-provider.ts` (port) ; `apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts` (+ spec) ; `apps/api/src/application/crop/suggest-sowing-window.use-case.ts` (+ spec) ; `apps/api/src/presentation/crop/crop.controller.ts` ; `apps/api/src/crop.module.ts`.
**Task 3 :** `apps/admin/src/lib/api.ts` ; `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`.

---

## Task 1 : API — catalogue cultures FAO + recherche

**Files:**
- Create: `apps/api/src/infrastructure/fao/fao-crops.json`
- Create: `apps/api/src/infrastructure/fao/fao-crop-catalog.ts` + `fao-crop-catalog.spec.ts`
- Create: `apps/api/src/presentation/fao/fao.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Produces : `FaoCropCatalog.search(q): { code; nameFr; nameEn }[]` ; `GET /fao/crops?q=`.

- [ ] **Step 1 : `fao-crops.json`** — liste de départ curée des cultures d'Afrique de l'Ouest (extensible). Chaque entrée `{ code, nameFr, nameEn }`. Le `code` est l'identifiant que l'adaptateur enverra à FAO — **le peupler avec le nom anglais de la culture** par défaut (ex. `"Maize"`), l'implémenteur pourra le raffiner en code FAO réel en Task 2 s'il confirme le format contre l'API. Contenu de départ :
```json
[
  { "code": "Maize", "nameFr": "Maïs", "nameEn": "Maize" },
  { "code": "Sorghum", "nameFr": "Sorgho", "nameEn": "Sorghum" },
  { "code": "Millet", "nameFr": "Mil", "nameEn": "Millet" },
  { "code": "Rice", "nameFr": "Riz", "nameEn": "Rice" },
  { "code": "Cowpea", "nameFr": "Niébé", "nameEn": "Cowpea" },
  { "code": "Groundnut", "nameFr": "Arachide", "nameEn": "Groundnut" },
  { "code": "Yam", "nameFr": "Igname", "nameEn": "Yam" },
  { "code": "Cassava", "nameFr": "Manioc", "nameEn": "Cassava" },
  { "code": "Soybean", "nameFr": "Soja", "nameEn": "Soybean" },
  { "code": "Cotton", "nameFr": "Coton", "nameEn": "Cotton" },
  { "code": "Sesame", "nameFr": "Sésame", "nameEn": "Sesame" },
  { "code": "Cocoa", "nameFr": "Cacao", "nameEn": "Cocoa" }
]
```

- [ ] **Step 2 : Écrire le test catalogue (échoue)** — `fao-crop-catalog.spec.ts` : `search('maï')` renvoie une entrée dont `nameFr === 'Maïs'` (insensible à la casse/accents) ; `search('rice')` trouve « Riz » (via `nameEn`) ; `search('')` renvoie une liste (courte, ≤ limite) ou vide selon l'implémentation choisie — asserter le comportement retenu.

- [ ] **Step 3 : Run → échoue.** Run: `pnpm --filter @okko/api test -- fao-crop-catalog` — Expected: FAIL.

- [ ] **Step 4 : `fao-crop-catalog.ts`** — charge le JSON (import statique) ; `search(q)` : normaliser `q` (minuscule, sans accents via `.normalize('NFD').replace(/\p{Diacritic}/gu, '')`), filtrer les entrées dont `nameFr`/`nameEn` normalisés contiennent `q`, limiter à 20. `q` vide → renvoyer les 20 premières (ou toutes si < 20).
```ts
import crops from './fao-crops.json';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export interface FaoCrop { code: string; nameFr: string; nameEn: string; }

export class FaoCropCatalog {
  private readonly all: FaoCrop[] = crops as FaoCrop[];
  search(q: string): FaoCrop[] {
    const n = norm(q.trim());
    const list = n ? this.all.filter((c) => norm(c.nameFr).includes(n) || norm(c.nameEn).includes(n)) : this.all;
    return list.slice(0, 20);
  }
}
```
> Vérifier que `tsconfig` autorise l'import JSON (`resolveJsonModule`) ; l'activer si besoin.

- [ ] **Step 5 : Run le test → passe.** Run: `pnpm --filter @okko/api test -- fao-crop-catalog` — Expected: PASS.

- [ ] **Step 6 : `FaoController` + module** — `apps/api/src/presentation/fao/fao.controller.ts` :
```ts
import { Controller, Get, Query } from '@nestjs/common';
import { FaoCropCatalog } from '../../infrastructure/fao/fao-crop-catalog';

@Controller('fao')
export class FaoController {
  constructor(private readonly catalog: FaoCropCatalog) {}
  @Get('crops')
  crops(@Query('q') q?: string) { return this.catalog.search(q ?? ''); }
}
```
Dans `crop.module.ts` : ajouter `FaoController` à `controllers`, et `FaoCropCatalog` aux `providers` (`{ provide: FaoCropCatalog, useClass: FaoCropCatalog }` ou simplement `FaoCropCatalog`).

- [ ] **Step 7 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 8 : Commit**
```bash
git add apps/api/src/infrastructure/fao/fao-crops.json apps/api/src/infrastructure/fao/fao-crop-catalog.ts apps/api/src/infrastructure/fao/fao-crop-catalog.spec.ts apps/api/src/presentation/fao/fao.controller.ts apps/api/src/crop.module.ts apps/api/tsconfig*.json
git commit -m "feat(api): catalogue cultures FAO embarqué + GET /fao/crops (recherche)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : API — provider calendrier + use-case de suggestion

**Files:**
- Create: `apps/api/src/application/crop/crop-calendar-provider.ts` (port)
- Create: `apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts` + `fao-crop-calendar.provider.spec.ts`
- Create: `apps/api/src/application/crop/suggest-sowing-window.use-case.ts` + `suggest-sowing-window.use-case.spec.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`, `apps/api/src/crop.module.ts`

**Interfaces:**
- Produces : `CropCalendarProvider` (port + `CROP_CALENDAR_PROVIDER`) ; `SuggestSowingWindowUseCase.execute({ faoCode, zoneId })` ; `GET /crops/:id/calendar-suggestion`.

- [ ] **Step 1 : Port** — `apps/api/src/application/crop/crop-calendar-provider.ts` :
```ts
export interface SowingWindowSuggestion { sowingStart: string; sowingEnd: string; sourceRef: string; }
export interface CropCalendarProvider {
  getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null>;
}
export const CROP_CALENDAR_PROVIDER = Symbol('CROP_CALENDAR_PROVIDER');
```

- [ ] **Step 2 : Écrire le test use-case (échoue)** — `suggest-sowing-window.use-case.spec.ts` : avec un **stub** provider (`{ getSowingWindow: async () => ({ sowingStart: '2000-06-01', sowingEnd: '2000-07-31', sourceRef: 'FAO' }) }`) et un `InMemoryZoneRepository` contenant une zone (country `BJ`) → `execute({ faoCode: 'Maize', zoneId })` renvoie la suggestion et a passé `country: 'BJ'` au provider ; provider renvoyant `null` → `execute` renvoie `null` ; zone absente → `ZoneNotFoundError`.

- [ ] **Step 3 : Run → échoue.** Run: `pnpm --filter @okko/api test -- suggest-sowing-window.use-case` — Expected: FAIL.

- [ ] **Step 4 : Use-case** — `suggest-sowing-window.use-case.ts` :
```ts
import { CropCalendarProvider, SowingWindowSuggestion } from './crop-calendar-provider';
import { ZoneRepository } from '../zone/zone.repository';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export class SuggestSowingWindowUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly provider: CropCalendarProvider,
  ) {}
  async execute(input: { faoCode: string; zoneId: string }): Promise<SowingWindowSuggestion | null> {
    const zone = await this.zones.findById(input.zoneId);
    if (!zone) throw new ZoneNotFoundError(input.zoneId);
    return this.provider.getSowingWindow({ faoCode: input.faoCode, country: zone.country });
  }
}
```
(vérifier la forme réelle de `ZoneRepository.findById` — renvoie un snapshot avec `.country` ; adapter l'accès si nécessaire.)

- [ ] **Step 5 : Run le test → passe.** Run: `pnpm --filter @okko/api test -- suggest-sowing-window.use-case` — Expected: PASS.

- [ ] **Step 6 : Adaptateur FAO (best-effort) + test de parsing** — `fao-crop-calendar.provider.ts` : implémenter `CropCalendarProvider` avec `fetch` natif.
  - **Rechercher le contrat réel** : utiliser WebFetch/WebSearch pour confirmer l'endpoint FAO crop calendar (ex. `api-cropcalendar.apps.fao.org`), les paramètres (pays, culture, process=Sowing, stade Start/End) et la forme de la réponse. Implémenter la requête et le parsing en conséquence.
  - **Mapping pays** : petite table ISO2 → identifiant pays FAO (au moins BJ→Benin et quelques pays d'Afrique de l'Ouest) ; pays inconnu → `null`.
  - **Mois → dates** : mapper le mois de début de semis → `AAAA-MM-01` et le mois de fin → dernier jour du mois, **année neutre fixe `2000`** (ex. semis juin→juillet ⇒ `2000-06-01`/`2000-07-31`).
  - **`sourceRef`** : ex. `FAO Crop Calendar` (+ éventuellement l'URL/culture/pays).
  - **Robustesse** : **tout** échec (réseau, statut non-2xx, JSON invalide, données absentes) → `try/catch` → `null`. Ne jamais lever.
  - **Test de parsing** (`fao-crop-calendar.provider.spec.ts`) : mocker le `fetch` global pour renvoyer un **échantillon synthétique** de la forme attendue → asserter le mapping mois→dates ; mocker un `fetch` qui rejette / renvoie 502 → asserter `null`.
  - **Stub exporté pour les tests d'intégration** si utile ; sinon garder le stub inline dans les specs.

- [ ] **Step 7 : Endpoint + module** — `crop.controller.ts` : injecter `SuggestSowingWindowUseCase` ; handler :
```ts
  @Get(':id/calendar-suggestion')
  async calendarSuggestion(@Param('id') _id: string, @Query('faoCode') faoCode: string, @Query('zoneId') zoneId: string) {
    try { return (await this.suggestSowingWindow.execute({ faoCode, zoneId })) ?? null; }
    catch (e) { mapCropError(e, _id); }
  }
```
`crop.module.ts` : providers `{ provide: CROP_CALENDAR_PROVIDER, useClass: FaoCropCalendarProvider }` et `{ provide: SuggestSowingWindowUseCase, useFactory: (zr, prov) => new SuggestSowingWindowUseCase(zr, prov), inject: [ZONE_REPOSITORY, CROP_CALENDAR_PROVIDER] }`. (`ZoneNotFoundError` est déjà mappée par les handlers zone — vérifier que `mapCropError` la gère, sinon mapper localement `ZoneNotFoundError → NotFoundException`.)

- [ ] **Step 8 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert (les tests utilisent le stub/echantillon ; aucun appel FAO réseau réel en test).

- [ ] **Step 9 : Commit**
```bash
git add apps/api/src/application/crop/crop-calendar-provider.ts apps/api/src/application/crop/suggest-sowing-window.use-case.ts apps/api/src/application/crop/suggest-sowing-window.use-case.spec.ts apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts apps/api/src/infrastructure/fao/fao-crop-calendar.provider.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(api): suggestion de fenêtre de semis via le calendrier FAO (port + adaptateur best-effort)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Admin — import dans l'éditeur de fenêtre

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`

**Interfaces:**
- Consumes : `GET /fao/crops`, `GET /crops/:id/calendar-suggestion` (Tasks 1-2).

- [ ] **Step 1 : `lib/api.ts`** — ajouter :
```ts
export async function searchFaoCrops(q: string): Promise<{ code: string; nameFr: string; nameEn: string }[]> {
  const res = await fetch(`${BASE}/fao/crops?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}
export async function getCalendarSuggestion(cropId: string, faoCode: string, zoneId: string): Promise<{ sowingStart: string; sowingEnd: string; sourceRef: string } | null> {
  const res = await fetch(`${BASE}/crops/${cropId}/calendar-suggestion?faoCode=${encodeURIComponent(faoCode)}&zoneId=${encodeURIComponent(zoneId)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.sowingStart ? data : null;
}
```

- [ ] **Step 2 : `WindowEditor.tsx` — section d'import** — ajouter, au-dessus du bloc « Fenêtre de semis », une section d'import (client). Nouvel état : `faoQuery`, `faoResults`, `faoPicked` (`{ code, nameFr } | null`), `importing`, `importMsg`.
  - Autocomplétion : un `<Input>` `value={faoQuery}` ; à chaque changement (débounce léger via `useEffect`/timeout ou appel direct au submit), appeler `searchFaoCrops(faoQuery)` → `setFaoResults` ; afficher une liste déroulante des résultats (`nameFr`), cliquer un résultat → `setFaoPicked({ code, nameFr })` + `setFaoQuery(nameFr)` + vider la liste.
  - Bouton **« Importer le calendrier FAO »** : `disabled` si `!faoPicked || !zoneId` ; au clic → `setImporting(true)` ; `const s = await getCalendarSuggestion(cropId, faoPicked.code, zoneId)` ; si `s` → `setSowingStart(s.sowingStart); setSowingEnd(s.sowingEnd); setImportMsg('Importé depuis FAO — relisez puis enregistrez.')` ; sinon `setImportMsg('Source FAO indisponible — saisie manuelle.')` ; `finally setImporting(false)`.
  - `zoneId` est l'état zone déjà présent dans l'éditeur. Le message `importMsg` s'affiche sous le bouton.
  > Le reste de l'éditeur (validation, mode édition, opérations, DatePickers du semis) : inchangé. L'import ne fait que **pré-remplir** `sowingStart`/`sowingEnd` — l'expert enregistre normalement.

- [ ] **Step 3 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Dans l'éditeur de fenêtre d'une culture, choisir une zone (pays couvert, ex. Bénin), taper « Maïs » → sélectionner → « Importer le calendrier FAO » : si FAO répond, la fenêtre de semis se pré-remplit ; sinon message d'indisponibilité ; enregistrer fonctionne comme avant.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/WindowEditor.tsx
git commit -m "feat(admin): import du calendrier de semis FAO dans l'éditeur de fenêtre

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Catalogue** FAO embarqué + `GET /fao/crops?q=` (recherche accent/casse-insensible).
- **Suggestion** : port `CropCalendarProvider` + adaptateur FAO best-effort (**null gracieux** sur toute erreur) + use-case (dérive le pays de la zone) + `GET /crops/:id/calendar-suggestion`. Tests via **stub**/échantillon — aucun appel réseau réel en test.
- **Admin** : autocomplétion + Importer → **pré-remplit** la fenêtre de semis ; message si indisponible ; saisie manuelle préservée.
- Zéro changement de modèle ; suite API verte ; build admin vert. L'appel FAO réel = validé en smoke.

## Self-review (couverture spec)

- §4.1 catalogue → Task 1. §4.2 port/adaptateur/stub → Task 2 (Steps 1,6). §4.3 use-case/endpoints/module → Task 2 (Steps 4,7) + Task 1 (FaoController). §4.4 tests → Tasks 1-2. ✅
- §5 admin (api + éditeur import) → Task 3. ✅
- §3 best-effort / gates indépendants de FAO → Global Constraints + Task 2 Steps 6,8. ✅
- §3 zéro changement de modèle → Global Constraints + Notes. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
