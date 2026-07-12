# Spec — Import du calendrier de semis FAO (tranche 1 des sources ouvertes)

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-12
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Première tranche de l'agrégation de sources ouvertes : permettre à l'expert d'**importer la fenêtre de semis** d'une culture depuis le **calendrier cultural FAO**, en cherchant la culture par son nom (autocomplétion), pour **pré-remplir** l'éditeur de fenêtre. L'expert relit et enregistre.

Référence : vision §6 (FAO Crop Calendar, CC-BY 3.0 IGO).

## 2. Contexte (vérifié)

- La FAO expose un **calendrier cultural** (>100 cultures, >50 pays) — dates de **semis**/récolte par **pays × culture (code) × activité (Sowing) × stade (Start/End) → mois**. Endpoints réels (`api-cropcalendar.apps.fao.org`, endpoint BigQuery), **mais contrat JSON non documenté proprement et accès parfois indisponible (502/403)**. → **appel FAO best-effort, repli gracieux**.
- **`Provenance` VO** existe (`MANUAL`/`EXTERNAL`) — mais on **ne le touche pas** dans cette tranche (mode « suggérer & pré-remplir » : donnée validée par l'expert = MANUELLE ; pas de changement du modèle `CroppingWindow`).
- **Pas d'infra HTTP** dans l'API → on utilise le `fetch` **natif** (Node 18+/Nest runtime), pas de dépendance.
- Les zones portent `country` (ISO2, ex. `BJ`) ; `ZoneRepository.findById` existe → dérive le pays depuis la zone sélectionnée.
- La fenêtre de semis (`sowingStart`/`sowingEnd`, `yyyy-MM-dd`, année ignorée, affichée jour-mois — D1) est la cible de l'import.
- ⚠️ La suite de tests API **efface la DB** — prévenir.
- **Décisions brainstorming** : catalogue FAO **embarqué** (JSON dans le repo) + recherche par nom ; import = **suggérer & pré-remplir** ; appel calendrier **best-effort**.

## 3. Périmètre

### Dans le lot
- **Catalogue cultures FAO** embarqué (`{ code, nameFr, nameEn }[]`) + endpoint de recherche `GET /fao/crops?q=`.
- **Port** `CropCalendarProvider` + **adaptateur FAO** (`fetch`, best-effort) + **stub** de test.
- **Use-case + endpoint** de suggestion : `GET /crops/:id/calendar-suggestion?faoCode=&zoneId=` → fenêtre de semis suggérée (ou vide).
- **Admin** : section « Importer depuis le calendrier FAO » dans `WindowEditor` (autocomplétion + Importer → pré-remplit `sowingStart`/`sowingEnd`).

### Hors périmètre (tranches suivantes)
- Récolte + opérations de l'itinéraire ; **provenance EXTERNAL** sur la fenêtre (vrai « double mode ») ; mémoriser le code FAO sur la culture ; régénération auto du catalogue ; autres sources (sol/climat/prix/rendements).
- **L'acceptation ne dépend PAS d'un appel FAO réussi** : les gates automatisés (tests catalogue + use-case avec **stub**, build admin) passent quoi qu'il arrive ; l'appel FAO réel est validé en **smoke manuel**.

### Comportement préservé
- L'éditeur de fenêtre (ajout/édition, D1/D3) : inchangé, on **ajoute** une section d'import optionnelle. Saisie manuelle toujours possible.
- Aucune autre section touchée ; aucun changement du modèle `CroppingWindow`.

## 4. Architecture — API

### 4.1 Catalogue cultures FAO — `apps/api/src/infrastructure/fao/`
- `fao-crops.json` : liste embarquée `{ code: string; nameFr: string; nameEn: string }[]`. **Amorcée depuis la ressource FAO « Crops »** si accessible à l'implémentation ; sinon une **liste de départ curée** des cultures d'Afrique de l'Ouest (maïs, sorgho, mil, riz, niébé, arachide, igname, manioc, …) avec leurs codes FAO. Extensible.
- `fao-crop-catalog.ts` : `FaoCropCatalog.search(q: string): { code; nameFr; nameEn }[]` — filtre insensible à la casse/accents sur `nameFr`/`nameEn` (limite ~20 résultats).

### 4.2 Port + adaptateur calendrier
- **Port** (`apps/api/src/application/crop/crop-calendar-provider.ts`) :
```ts
export interface SowingWindowSuggestion { sowingStart: string; sowingEnd: string; sourceRef: string; }
export interface CropCalendarProvider {
  getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null>;
}
export const CROP_CALENDAR_PROVIDER = Symbol('CROP_CALENDAR_PROVIDER');
```
- **Adaptateur FAO** (`apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts`) : `fetch` vers l'API FAO (process = Sowing, stades Start/End), mappe les **mois** → dates `yyyy-MM-dd` (année neutre fixe, ex. `2000` ; le semis « juin→juillet » ⇒ `2000-06-01`/`2000-07-31`) ; mappe `country` (ISO2) → identifiant pays FAO via une petite table interne ; **`try/catch` → `null`** sur toute erreur (réseau, parse, vide, pays/culture inconnus). Le format exact de la requête FAO est finalisé par l'implémenteur contre l'API réelle ; à défaut, l'adaptateur renvoie `null` (repli gracieux) et le parsing est couvert par un test sur un échantillon synthétique.
- **Stub** (test) : `StubCropCalendarProvider` renvoyant une valeur fixe (ou `null`).

### 4.3 Use-case + endpoints
- `SuggestSowingWindowUseCase.execute({ faoCode, zoneId }): Promise<SowingWindowSuggestion | null>` : `zones.findById(zoneId)` → si absente, `ZoneNotFoundError` ; appelle `provider.getSowingWindow({ faoCode, country: zone.country })` ; renvoie le résultat (ou `null`).
- **`FaoController`** (`@Controller('fao')`) : `GET /fao/crops?q=` → `catalog.search(q)`.
- **Crop controller** : `GET /crops/:id/calendar-suggestion?faoCode=&zoneId=` → `SuggestSowingWindowUseCase.execute(...)` ; renvoie `{ sowingStart, sowingEnd, sourceRef }` ou `204/null` si rien. (Le `:id` n'est pas requis par la logique mais garde l'endpoint crop-scopé et cohérent.)
- Providers câblés dans `crop.module.ts` (`CROP_CALENDAR_PROVIDER` → `FaoCropCalendarProvider` ; `FaoCropCatalog` ; `SuggestSowingWindowUseCase`).

### 4.4 Tests (TDD)
- `fao-crop-catalog.spec` : `search('maï')` trouve « Maïs » (accents/casse) ; requête vide → liste courte/vide.
- `suggest-sowing-window.use-case.spec` : avec un **stub** provider renvoyant une fenêtre → l'use-case la renvoie (pays dérivé de la zone) ; provider `null` → `null` ; zone absente → `ZoneNotFoundError`.
- `fao-crop-calendar.provider.spec` : test de **parsing** sur un échantillon synthétique (mois → dates) ; `fetch` en échec → `null` (mock du `fetch` global).
- Non-régression : suite API verte.

## 5. Architecture — Admin

### 5.1 `lib/api.ts`
- `searchFaoCrops(q: string): Promise<{ code: string; nameFr: string; nameEn: string }[]>` (`GET /fao/crops?q=`).
- `getCalendarSuggestion(cropId: string, faoCode: string, zoneId: string): Promise<{ sowingStart: string; sowingEnd: string; sourceRef: string } | null>` (`GET /crops/:id/calendar-suggestion?...`, `no-store`).

### 5.2 `WindowEditor.tsx` — section « Importer depuis le calendrier FAO »
- Bloc optionnel au-dessus/à côté de la fenêtre de semis :
  - Un champ **autocomplétion** : l'expert tape (ex. « Maïs ») → `searchFaoCrops(q)` (débounce) → liste déroulante de résultats ; sélectionner fixe le `faoCode`/nom choisi.
  - Un bouton **Importer** (actif si une culture FAO est choisie **et** une zone sélectionnée) → `getCalendarSuggestion(cropId, faoCode, zoneId)` → si résultat, **pré-remplit** `sowingStart`/`sowingEnd` (états existants) ; sinon un message « source FAO indisponible — saisie manuelle ».
  - État de chargement + message d'erreur inline.
- Le reste de l'éditeur (validation, mode édition, opérations) : inchangé. L'expert enregistre normalement (donnée validée = MANUELLE).

## 6. Gestion d'erreur
- FAO indisponible / culture ou pays inconnus / réseau → `null` côté API → message admin « source indisponible », **aucun crash**. Zone absente → 404. Pas de zone sélectionnée → bouton Importer désactivé.

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir) — gates = catalogue + use-case (stub) + parsing adaptateur.
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : chercher « Maïs » → sélectionner → Importer (zone d'un pays couvert) → si FAO répond, `sowingStart`/`sowingEnd` pré-remplis ; sinon message d'indisponibilité ; saisie manuelle toujours possible.

## 8. Critères de succès
- [ ] Catalogue FAO embarqué + `GET /fao/crops?q=` (recherche par nom).
- [ ] Port `CropCalendarProvider` + adaptateur FAO best-effort (null gracieux) + stub ; `SuggestSowingWindowUseCase` + `GET /crops/:id/calendar-suggestion`.
- [ ] Admin : autocomplétion + Importer → pré-remplit la fenêtre de semis ; message si indisponible ; saisie manuelle préservée.
- [ ] Gates automatisés (catalogue + use-case stub + parsing + build admin) verts **indépendamment de FAO** ; appel FAO réel validé en smoke.
- [ ] Zéro changement de modèle (`CroppingWindow`/`Provenance`) ; hors-périmètre respecté.

## Références
- Vision §6 ; FAO Crop Calendar : dataset `crop-calendar-by-country-crop-activity-and-stage`, API `api-cropcalendar.apps.fao.org`, ressource « Crops ». Licence CC-BY 3.0 IGO.
- API : `src/infrastructure/fao/{fao-crops.json,fao-crop-catalog.ts,fao-crop-calendar.provider.ts}`, `src/application/crop/{crop-calendar-provider.ts,suggest-sowing-window.use-case.ts}`, `src/presentation/{fao/fao.controller.ts,crop/crop.controller.ts}`, `src/crop.module.ts`.
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/editors/WindowEditor.tsx`.
