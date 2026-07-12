# Spec — Calendrier de semis embarqué (couvre le Bénin) — sources ouvertes tranche 1b

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-12
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Remplacer l'appel FAO live (capricieux **et** ne couvrant pas le Bénin) par un **jeu de calendrier de semis embarqué**, au niveau **pays**, couvrant le **Bénin + les pays d'Afrique de l'Ouest** × les cultures du catalogue. Le tout derrière le **port `CropCalendarProvider` déjà en place** : autocomplétion, use-case, endpoint et bouton « Importer » sont conservés.

Contexte : la tranche 1 a livré catalogue + port + use-case + endpoint + UI d'import ; l'adaptateur FAO live retombait toujours sur « indisponible » (endpoint HTTP non finalisable + Bénin absent des ~50 pays FAO). Décision : **abandonner l'appel FAO live** au profit d'un **jeu embarqué** (fiable, testable, couvre le Bénin, validé par l'agronome).

## 2. Contexte (vérifié)

- Contrat FAO réel confirmé (via SQL/schéma publiés, CC-BY) : vue `vw_crop_calendar_by_stage`, filtres `cropProcess`/`cropId` (**codes numériques** 0003–0409), colonnes `start_date`/`end_date`/`period` par pays. **Codes FAO réels des 12 cultures** : Maïs 0338, Riz 0303, Sorgho 0325, Mil 0389, Niébé 0117, Arachide 0397, Igname 0380, Manioc 0076, Soja 0327, Coton 0115, Sésame 0318, Cacao 0102.
- Existant (branche `main`) : `fao-crops.json` (catalogue, `code`=nom anglais aujourd'hui), `fao-crop-catalog.ts` (recherche par nom), `FaoController` (`GET /fao/crops`), **`fao-crop-calendar.provider.ts`** (adaptateur HTTP FAO, à supprimer), port `CropCalendarProvider` + `SuggestSowingWindowUseCase` + `GET /crops/:id/calendar-suggestion` (conservés). Admin : `WindowEditor` autocomplétion + Importer (conservé ; messages à ajuster).
- Les zones portent `country` (ISO2) → le jeu embarqué est indexé **par pays ISO2** (aucune coordonnée requise).
- Le port renvoie `{ sowingStart, sowingEnd, sourceRef }` en `yyyy-MM-dd` (année neutre, affichée jour-mois — D1).
- ⚠️ La suite de tests API **efface la DB** — prévenir.
- **Décisions** : jeu **embarqué** niveau pays ; **abandon de l'appel FAO live** ; **l'agronome valide** les fenêtres de départ.

## 3. Périmètre

### Dans le lot
- **Jeu embarqué** `crop-calendar.json` : `{ country (ISO2), cropCode, sowingStart, sowingEnd, sourceRef }[]`, couvrant Bénin + voisins × cultures (fenêtres de semis principales de départ, **à valider par l'agronome**).
- **`BundledCropCalendarProvider`** (implémente `CropCalendarProvider`) → branché sur `CROP_CALENDAR_PROVIDER`.
- **Catalogue** : `fao-crops.json` — `code` passe aux **codes FAO numériques réels** (0338, 0303, …).
- **Suppression** de l'adaptateur FAO live (`fao-crop-calendar.provider.ts` + son spec).
- **Admin** : messages d'import ajustés (« Importé depuis le calendrier cultural… » / « Pas de calendrier disponible pour cette culture/ce pays… »).

### Hors périmètre
- Intégration **live/raster** de GAEZ/Sacks (nécessiterait des coordonnées de zone + traitement raster) → tranche future.
- Récolte + opérations ; provenance EXTERNAL sur la fenêtre ; distinction bimodale sud/nord (une **fenêtre principale par pays×culture** pour l'instant) ; autres sources.

### Comportement préservé
- Port, use-case, endpoint, autocomplétion, bouton Importer, mode « suggérer & pré-remplir » (donnée validée = MANUELLE) : **inchangés**.
- Fenêtre non couverte (pays/culture absent du jeu) → `null` → message admin clair, saisie manuelle. Aucun crash.

## 4. Architecture — API

### 4.1 Jeu embarqué — `apps/api/src/infrastructure/calendar/crop-calendar.json`
- Entrées `{ country: string /* ISO2 majuscule */, cropCode: string /* = code catalogue */, sowingStart: string /* 'AAAA-MM-JJ', année 2000 */, sowingEnd: string, sourceRef: string }`.
- **Couverture de départ** : pays `BJ, TG, GH, CI, NE, SN, BF, ML, NG` × cultures du catalogue **là où c'est agronomiquement pertinent** (ex. cacao seulement zones forestières CI/GH ; igname dans la ceinture à ignames ; mil/sorgho au nord…). Fenêtres = **saison principale** de semis, valeurs de **départ à valider** par l'agronome.
- `sourceRef` : ex. `Calendrier cultural (données ouvertes, à valider)`.

### 4.2 Provider — `apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.ts`
```ts
import data from './crop-calendar.json';
import { CropCalendarProvider, SowingWindowSuggestion } from '../../application/crop/crop-calendar-provider';

interface Row { country: string; cropCode: string; sowingStart: string; sowingEnd: string; sourceRef: string; }

export class BundledCropCalendarProvider implements CropCalendarProvider {
  private readonly rows = data as Row[];
  async getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null> {
    const c = input.country.toUpperCase();
    const r = this.rows.find((x) => x.country.toUpperCase() === c && x.cropCode === input.faoCode);
    return r ? { sowingStart: r.sowingStart, sowingEnd: r.sowingEnd, sourceRef: r.sourceRef } : null;
  }
}
```

### 4.3 Catalogue — `fao-crops.json`
- Remplacer chaque `code` (nom anglais) par le **code FAO numérique** correspondant (Maïs→`0338`, Riz→`0303`, Sorgho→`0325`, Mil→`0389`, Niébé→`0117`, Arachide→`0397`, Igname→`0380`, Manioc→`0076`, Soja→`0327`, Coton→`0115`, Sésame→`0318`, Cacao→`0102`). `nameFr`/`nameEn` inchangés (la recherche reste par nom).

### 4.4 Module & suppression
- `crop.module.ts` : `{ provide: CROP_CALENDAR_PROVIDER, useClass: FaoCropCalendarProvider }` → `useClass: BundledCropCalendarProvider` (import mis à jour).
- **Supprimer** `fao-crop-calendar.provider.ts` et `fao-crop-calendar.provider.spec.ts`.

### 4.5 Tests (TDD)
- `bundled-crop-calendar.provider.spec` : `getSowingWindow({ faoCode: '0338', country: 'BJ' })` → une fenêtre (`sowingStart`/`sowingEnd` non vides) ; pays insensible à la casse ; `(country, cropCode)` absent → `null`.
- `fao-crop-catalog.spec` : la recherche par nom reste verte ; si une assertion portait sur un `code`, l'adapter aux nouveaux codes numériques.
- `suggest-sowing-window.use-case.spec` : inchangé (utilise un stub).
- Non-régression : suite API verte après suppression de l'adaptateur FAO.

## 5. Architecture — Admin

`WindowEditor.tsx` : ajuster les deux messages d'import :
- succès → « Importé depuis le calendrier cultural — relisez puis enregistrez. »
- `null` → « Pas de calendrier disponible pour cette culture/ce pays — saisie manuelle. »
Le reste (autocomplétion, bouton, pré-remplissage `sowingStart`/`sowingEnd`) : **inchangé**.

## 6. Gestion d'erreur
- `(pays, culture)` absent du jeu → `null` → message « pas de calendrier disponible ». Zone absente → 404 (inchangé). Aucun appel réseau externe → pas d'indisponibilité aléatoire.

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : dans une zone **Bénin (BJ)**, chercher « Maïs » → Importer → la fenêtre de semis se pré-remplit (valeur du jeu embarqué, à valider) ; culture/pays non couvert → message « pas de calendrier disponible ».

## 8. Critères de succès
- [ ] Jeu embarqué `crop-calendar.json` (Bénin + voisins × cultures) + `BundledCropCalendarProvider` branché.
- [ ] Catalogue avec les **codes FAO numériques** ; recherche par nom inchangée.
- [ ] Adaptateur FAO live **supprimé** ; `GET /crops/:id/calendar-suggestion` renvoie désormais des données pour le Bénin.
- [ ] Admin : messages clairs (importé / pas de calendrier).
- [ ] Suite API verte ; build admin vert. Aucun appel réseau externe ; hors-périmètre respecté.

## Références
- Contrat FAO : vue `vw_crop_calendar_by_stage`, codes cropId numériques (cf. tranche 1a).
- API : `src/infrastructure/calendar/{crop-calendar.json,bundled-crop-calendar.provider.ts}` (nouveaux), `src/infrastructure/fao/{fao-crops.json,fao-crop-catalog.ts}` (catalogue), suppression `src/infrastructure/fao/fao-crop-calendar.provider.ts`(+spec), `src/crop.module.ts`.
- Admin : `src/app/crops/[id]/editors/WindowEditor.tsx`.
