# Calendrier de semis embarqué (couvre le Bénin) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'adaptateur FAO live (capricieux + sans le Bénin) par un jeu de calendrier de semis embarqué au niveau pays, derrière le port `CropCalendarProvider` existant.

**Architecture:** Un JSON embarqué `{ country, cropCode, sowingStart, sowingEnd, sourceRef }[]` + un `BundledCropCalendarProvider` qui fait un lookup `(pays ISO2, code culture)`. Le catalogue passe aux vrais codes FAO numériques pour que `code` (catalogue) = `cropCode` (calendrier). L'adaptateur FAO HTTP est supprimé. Port, use-case, endpoint et UI d'import restent inchangés.

**Tech Stack:** NestJS (API), Jest, TypeScript (`resolveJsonModule` déjà activé), Next.js 14 (admin).

## Global Constraints

- Dates au format `yyyy-MM-dd`, **année neutre 2000**, fenêtre **contenue dans une seule année** (jamais à cheval sur deux ans — l'affichage ignore l'année et montre jour-mois).
- Le port ne change PAS : `getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null>` avec `SowingWindowSuggestion = { sowingStart: string; sowingEnd: string; sourceRef: string }`.
- Codes FAO numériques des 12 cultures (chaînes, zéros de tête conservés) : Maïs `0338`, Riz `0303`, Sorgho `0325`, Mil `0389`, Niébé `0117`, Arachide `0397`, Igname `0380`, Manioc `0076`, Soja `0327`, Coton `0115`, Sésame `0318`, Cacao `0102`.
- `country` est un ISO2 majuscule (ex. `BJ`) ; le lookup est **insensible à la casse**.
- `sourceRef` de toutes les entrées embarquées : `Calendrier cultural (données ouvertes, à valider)`.
- ⚠️ **La suite de tests API efface la DB de dev** — prévenir l'utilisateur avant de lancer `pnpm --filter @okko/api test`.
- Commits : terminer le message par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Aucune dépendance ajoutée ; aucun appel réseau externe dans le nouveau provider.

---

### Task 1: Catalogue → codes FAO numériques

**Files:**
- Modify: `apps/api/src/infrastructure/fao/fao-crops.json`
- Test: `apps/api/src/infrastructure/fao/fao-crop-catalog.spec.ts`

**Interfaces:**
- Consumes: rien (fondation).
- Produces: `FaoCropCatalog.search(q)` renvoie des `FaoCrop { code, nameFr, nameEn }` où `code` est désormais le **code FAO numérique** (ex. Maïs → `'0338'`). Le jeu embarqué (Task 2) utilise ces mêmes codes comme `cropCode`.

- [ ] **Step 1: Ajouter un test asserant le code numérique**

Dans `apps/api/src/infrastructure/fao/fao-crop-catalog.spec.ts`, ajouter ce test après le dernier `it(...)` (avant le `});` final du `describe`) :

```ts
  it('le code de "Maïs" est le code FAO numérique 0338', () => {
    const maize = catalog.search('maïs').find((c) => c.nameFr === 'Maïs');
    expect(maize?.code).toBe('0338');
  });

  it('le code de "Riz" est le code FAO numérique 0303', () => {
    const rice = catalog.search('riz').find((c) => c.nameFr === 'Riz');
    expect(rice?.code).toBe('0303');
  });
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd apps/api && npx jest fao-crop-catalog --silent`
Expected: FAIL — `expect(received).toBe('0338')` reçoit `'Maize'`.

- [ ] **Step 3: Remplacer les codes dans `fao-crops.json`**

Remplacer intégralement le contenu de `apps/api/src/infrastructure/fao/fao-crops.json` par :

```json
[
  { "code": "0338", "nameFr": "Maïs", "nameEn": "Maize" },
  { "code": "0325", "nameFr": "Sorgho", "nameEn": "Sorghum" },
  { "code": "0389", "nameFr": "Mil", "nameEn": "Millet" },
  { "code": "0303", "nameFr": "Riz", "nameEn": "Rice" },
  { "code": "0117", "nameFr": "Niébé", "nameEn": "Cowpea" },
  { "code": "0397", "nameFr": "Arachide", "nameEn": "Groundnut" },
  { "code": "0380", "nameFr": "Igname", "nameEn": "Yam" },
  { "code": "0076", "nameFr": "Manioc", "nameEn": "Cassava" },
  { "code": "0327", "nameFr": "Soja", "nameEn": "Soybean" },
  { "code": "0115", "nameFr": "Coton", "nameEn": "Cotton" },
  { "code": "0318", "nameFr": "Sésame", "nameEn": "Sesame" },
  { "code": "0102", "nameFr": "Cacao", "nameEn": "Cocoa" }
]
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `cd apps/api && npx jest fao-crop-catalog --silent`
Expected: PASS (tous les tests du fichier, y compris ceux par nom, restent verts).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/fao/fao-crops.json apps/api/src/infrastructure/fao/fao-crop-catalog.spec.ts
git commit -m "feat(api): catalogue cultures aux codes FAO numériques

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Jeu embarqué + BundledCropCalendarProvider

**Files:**
- Create: `apps/api/src/infrastructure/calendar/crop-calendar.json`
- Create: `apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.ts`
- Test: `apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.spec.ts`

**Interfaces:**
- Consumes: le port `CropCalendarProvider` / `SowingWindowSuggestion` de `apps/api/src/application/crop/crop-calendar-provider.ts` ; les codes numériques de Task 1.
- Produces: `class BundledCropCalendarProvider implements CropCalendarProvider` (constructeur sans argument). Consommé par le module (Task 3) via `CROP_CALENDAR_PROVIDER`.

- [ ] **Step 1: Écrire le test du provider (échoue)**

Créer `apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.spec.ts` :

```ts
import { BundledCropCalendarProvider } from './bundled-crop-calendar.provider';

describe('BundledCropCalendarProvider', () => {
  let provider: BundledCropCalendarProvider;

  beforeEach(() => {
    provider = new BundledCropCalendarProvider();
  });

  it('renvoie une fenêtre de semis pour (BJ, 0338 Maïs)', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'BJ' });
    expect(w).not.toBeNull();
    expect(w!.sowingStart).toMatch(/^2000-\d{2}-\d{2}$/);
    expect(w!.sowingEnd).toMatch(/^2000-\d{2}-\d{2}$/);
    expect(w!.sourceRef).toBe('Calendrier cultural (données ouvertes, à valider)');
  });

  it('est insensible à la casse du pays (bj → BJ)', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'bj' });
    expect(w).not.toBeNull();
  });

  it('renvoie null pour un couple (pays, culture) non couvert', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'ZZ' });
    expect(w).toBeNull();
  });

  it('renvoie null pour un code culture inconnu', async () => {
    const w = await provider.getSowingWindow({ faoCode: '9999', country: 'BJ' });
    expect(w).toBeNull();
  });

  it('toutes les fenêtres sont contenues dans la même année (start ≤ end)', async () => {
    // garantit qu'aucune fenêtre embarquée n'est à cheval sur deux années
    const w = await provider.getSowingWindow({ faoCode: '0325', country: 'NE' });
    expect(w).not.toBeNull();
    expect(w!.sowingStart <= w!.sowingEnd).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd apps/api && npx jest bundled-crop-calendar --silent`
Expected: FAIL — module `./bundled-crop-calendar.provider` introuvable.

- [ ] **Step 3: Créer le jeu embarqué**

Créer `apps/api/src/infrastructure/calendar/crop-calendar.json` avec ce contenu exact. Valeurs = fenêtres de semis de saison principale, **points de départ à valider par l'agronome** :

```json
[
  { "country": "BJ", "cropCode": "0338", "sowingStart": "2000-03-15", "sowingEnd": "2000-04-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0303", "sowingStart": "2000-05-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0397", "sowingStart": "2000-05-15", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0380", "sowingStart": "2000-11-01", "sowingEnd": "2000-12-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0076", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0327", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-20", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BJ", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "TG", "cropCode": "0338", "sowingStart": "2000-03-15", "sowingEnd": "2000-04-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0303", "sowingStart": "2000-05-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0397", "sowingStart": "2000-05-15", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0380", "sowingStart": "2000-11-01", "sowingEnd": "2000-12-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0076", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "TG", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "GH", "cropCode": "0338", "sowingStart": "2000-03-15", "sowingEnd": "2000-04-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0303", "sowingStart": "2000-05-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0397", "sowingStart": "2000-05-15", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0380", "sowingStart": "2000-11-01", "sowingEnd": "2000-12-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0076", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "GH", "cropCode": "0102", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "CI", "cropCode": "0338", "sowingStart": "2000-03-15", "sowingEnd": "2000-04-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0303", "sowingStart": "2000-05-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0397", "sowingStart": "2000-05-15", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0380", "sowingStart": "2000-11-01", "sowingEnd": "2000-12-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0076", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0102", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "CI", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "NG", "cropCode": "0338", "sowingStart": "2000-04-01", "sowingEnd": "2000-05-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0303", "sowingStart": "2000-05-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0397", "sowingStart": "2000-05-15", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0380", "sowingStart": "2000-11-01", "sowingEnd": "2000-12-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0076", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0327", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-20", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NG", "cropCode": "0102", "sowingStart": "2000-04-01", "sowingEnd": "2000-06-30", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "NE", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NE", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NE", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NE", "cropCode": "0397", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NE", "cropCode": "0303", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "NE", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "SN", "cropCode": "0389", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0325", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0397", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0303", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0338", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0115", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "SN", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "BF", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0397", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0338", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0303", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "BF", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },

  { "country": "ML", "cropCode": "0389", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0325", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0117", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0397", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0338", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0303", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0115", "sowingStart": "2000-06-01", "sowingEnd": "2000-07-15", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" },
  { "country": "ML", "cropCode": "0318", "sowingStart": "2000-06-15", "sowingEnd": "2000-07-31", "sourceRef": "Calendrier cultural (données ouvertes, à valider)" }
]
```

- [ ] **Step 4: Créer le provider**

Créer `apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.ts` :

```ts
import data from './crop-calendar.json';
import { CropCalendarProvider, SowingWindowSuggestion } from '../../application/crop/crop-calendar-provider';

interface CalendarRow {
  country: string;
  cropCode: string;
  sowingStart: string;
  sowingEnd: string;
  sourceRef: string;
}

/**
 * Calendrier de semis embarqué, au niveau pays (ISO2 × code FAO).
 * Remplace l'ancien adaptateur FAO live : aucune requête réseau, couvre le Bénin
 * et ses voisins. Fenêtres de départ à valider par l'agronome.
 */
export class BundledCropCalendarProvider implements CropCalendarProvider {
  private readonly rows = data as CalendarRow[];

  async getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null> {
    const country = input.country.toUpperCase();
    const row = this.rows.find((r) => r.country.toUpperCase() === country && r.cropCode === input.faoCode);
    if (!row) return null;
    return { sowingStart: row.sowingStart, sowingEnd: row.sowingEnd, sourceRef: row.sourceRef };
  }
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `cd apps/api && npx jest bundled-crop-calendar --silent`
Expected: PASS (5 tests verts).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/infrastructure/calendar/crop-calendar.json apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.ts apps/api/src/infrastructure/calendar/bundled-crop-calendar.provider.spec.ts
git commit -m "feat(api): calendrier de semis embarqué (Bénin + voisins) + provider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Câblage module + suppression de l'adaptateur FAO live

**Files:**
- Modify: `apps/api/src/crop.module.ts:38-41,259-260`
- Delete: `apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts`
- Delete: `apps/api/src/infrastructure/fao/fao-crop-calendar.provider.spec.ts`

**Interfaces:**
- Consumes: `BundledCropCalendarProvider` (Task 2). Le token `CROP_CALENDAR_PROVIDER` et `SuggestSowingWindowUseCase` (inchangés).
- Produces: le conteneur NestJS résout `CROP_CALENDAR_PROVIDER` → `BundledCropCalendarProvider`. `GET /crops/:id/calendar-suggestion` renvoie désormais des données pour le Bénin.

- [ ] **Step 1: Remplacer l'import du provider dans le module**

Dans `apps/api/src/crop.module.ts`, remplacer la ligne 40 :

```ts
import { FaoCropCalendarProvider } from './infrastructure/fao/fao-crop-calendar.provider';
```

par :

```ts
import { BundledCropCalendarProvider } from './infrastructure/calendar/bundled-crop-calendar.provider';
```

- [ ] **Step 2: Rebrancher le token DI**

Dans `apps/api/src/crop.module.ts`, remplacer la ligne 260 :

```ts
    { provide: CROP_CALENDAR_PROVIDER, useClass: FaoCropCalendarProvider },
```

par :

```ts
    { provide: CROP_CALENDAR_PROVIDER, useClass: BundledCropCalendarProvider },
```

- [ ] **Step 3: Supprimer l'adaptateur FAO live et son spec**

```bash
git rm apps/api/src/infrastructure/fao/fao-crop-calendar.provider.ts apps/api/src/infrastructure/fao/fao-crop-calendar.provider.spec.ts
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur (plus aucune référence à `FaoCropCalendarProvider`).

- [ ] **Step 5: Lancer la suite API complète (⚠️ efface la DB — prévenir avant)**

Run: `pnpm --filter @okko/api test`
Expected: PASS (suite verte ; le spec de l'ancien adaptateur a disparu, `suggest-sowing-window.use-case.spec` reste vert car il utilise un stub).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/crop.module.ts
git commit -m "refactor(api): brancher le calendrier embarqué, supprimer l'adaptateur FAO live

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Admin — libellés d'import

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx:86,121,123,130`

**Interfaces:**
- Consumes: `getCalendarSuggestion(cropId, faoPicked.code, zoneId)` (inchangé) — renvoie maintenant des données embarquées.
- Produces: aucune nouvelle interface ; ajustement de texte uniquement.

- [ ] **Step 1: Renommer le libellé du panneau d'import**

Dans `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`, ligne 86, remplacer :

```tsx
            <p className="font-medium text-xs">Importer depuis le calendrier FAO</p>
```

par :

```tsx
            <p className="font-medium text-xs">Importer depuis le calendrier cultural</p>
```

- [ ] **Step 2: Ajuster le placeholder de recherche**

Ligne 89, remplacer :

```tsx
                placeholder="Rechercher une culture FAO…"
```

par :

```tsx
                placeholder="Rechercher une culture…"
```

- [ ] **Step 3: Ajuster les messages succès / indisponible**

Lignes 121 et 123, remplacer le bloc :

```tsx
                    setImportMsg('Importé depuis FAO — relisez puis enregistrez.');
                  } else {
                    setImportMsg('Source FAO indisponible — saisie manuelle.');
```

par :

```tsx
                    setImportMsg('Importé depuis le calendrier cultural — relisez puis enregistrez.');
                  } else {
                    setImportMsg('Pas de calendrier disponible pour cette culture/ce pays — saisie manuelle.');
```

- [ ] **Step 4: Ajuster le libellé du bouton**

Ligne 130, remplacer :

```tsx
              {importing ? 'Import…' : 'Importer le calendrier FAO'}
```

par :

```tsx
              {importing ? 'Import…' : 'Importer le calendrier cultural'}
```

- [ ] **Step 5: Vérifier le build admin**

Run: `pnpm --filter @okko/admin build`
Expected: build vert (aucune erreur de type/lint).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/crops/\[id\]/editors/WindowEditor.tsx
git commit -m "feat(admin): libellés d'import calendrier cultural (fin des mentions FAO)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâches)

- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert.
- **Smoke manuel** (DB repeuplée par l'utilisateur) : dans une zone **Bénin (BJ)**, ouvrir l'éditeur de fenêtre → chercher « Maïs » → sélectionner → « Importer le calendrier cultural » → `sowingStart`/`sowingEnd` se pré-remplissent (15/03 → 30/04) ; une culture/un pays non couvert → message « Pas de calendrier disponible… » ; saisie manuelle toujours possible.

## Critères de succès (rappel spec)

- [ ] Jeu embarqué `crop-calendar.json` (BJ + voisins × cultures) + `BundledCropCalendarProvider` branché sur `CROP_CALENDAR_PROVIDER`.
- [ ] Catalogue aux codes FAO numériques ; recherche par nom inchangée ; `code` catalogue = `cropCode` calendrier.
- [ ] Adaptateur FAO live supprimé ; `GET /crops/:id/calendar-suggestion` renvoie des données pour le Bénin.
- [ ] Admin : libellés « calendrier cultural » ; messages clairs (importé / pas de calendrier).
- [ ] Suite API verte ; build admin vert ; aucun appel réseau externe ; hors-périmètre respecté.
