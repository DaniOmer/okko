# Ravageurs — Brique 2 : Biologie

_Design validé en brainstorming le 2026-07-22._

## Contexte

La Brique 1 a posé l'entité `Pest` (CRUD, non event-sourcée), sa fiche `/pests/[id]`, et
l'identité (nom, catégorie animale, famille, description, photos catégorisées). Cette brique
ajoute la section **Biologie** de la fiche ravageur, en données **structurées**, et introduit
le pattern d'**édition par section** sur la page détail (qui accueillera les briques suivantes).

## Décisions actées (brainstorming)

1. **Modèle structuré (niveau B).** Pas de tout-texte : les champs numériques sont des plages,
   les stades une liste, les périodes des mois, les conditions favorables des plages.
2. **Nouveau VO `MinMaxRange`** (`{ min, max, unit? }`, valide `min ≤ max`) — pas d'« optimal »
   forcé comme `RangeValue`. Réutilisé pour durée du cycle, générations/an et conditions
   favorables.
3. **Stades de développement = liste `{ nom (traduisible), durée? (MinMaxRange jours) }`**,
   ordonnée.
4. **Édition par section sur `/pests/[id]`** (comme les cultures), en commençant par un
   `PestBiologyEditor`. `EditorShell` est promu en composant partagé.
5. **Remplacement complet** à l'enregistrement (cohérent avec le fix Brique 1 : pas de
   préservation `??` masquée).
6. **Intrinsèque au ravageur.** `CropPestControl` n'est pas touché.

## Périmètre de la Brique 2

Dans le périmètre :

1. **VO `MinMaxRange`** (`apps/api/src/domain/shared/min-max-range.ts`) + spec.
2. **Champs Biologie** sur `Pest` (tous optionnels) :
   - `lifeCycle?: Record<string,string>` — cycle de vie (texte traduisible).
   - `cycleDurationDays?: MinMaxRangeJSON` — durée du cycle (jours).
   - `developmentStages?: { name: Record<string,string>; durationDays?: MinMaxRangeJSON }[]` —
     stades ordonnés.
   - `generationsPerYear?: MinMaxRangeJSON` — générations par an.
   - `activityPeriods?: string[]` — mois d'activité (codes `JAN`…`DEC`).
   - `favorableConditions?: { temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; notes?: Record<string,string> }`.
3. **Domaine** : méthode `setBiology(fields)` (remplacement complet des champs biologie,
   identité/photos préservées) ; getters ; `toSnapshot`/`fromSnapshot` étendus.
4. **Migration** additive : 6 colonnes JSON nullables sur `Pest`.
5. **API** : `SetPestBiologyUseCase` + endpoint `PATCH /pests/:id/biology` ; document read-model
   expose les champs biologie.
6. **Admin** :
   - Composants réutilisables `MinMaxRangeInput`, `MonthMultiSelect`, `DevelopmentStagesEditor`.
   - `PestBiologyEditor` (dialog via `EditorShell` partagé) → action `setPestBiology`.
   - `EditorShell` promu partagé (`apps/admin/src/components/EditorShell.tsx`), l'ancien
     `crops/[id]/editors/EditorShell.tsx` ré-exporte le partagé (imports cultures inchangés).
   - `MONTH_LABELS` (JAN…DEC → Janvier…Décembre) dans `labels.ts`.
   - **Section « Biologie »** affichée dans `PestFicheView` (lecture) + bouton « Modifier la
     biologie » (le `PestBiologyEditor`) sur la page `/pests/[id]`.

Hors périmètre (briques suivantes) : Dégâts (3), Répartition (4), Gestion (5), Sources (6).
Pas de workflow de publication. L'édition identité/photos reste dans la pop-up de la liste
pour l'instant (sa migration vers la page détail est une brique de nettoyage ultérieure).

## Modèle de données

### VO `MinMaxRange`
```ts
export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }
// create(props) valide min <= max, sinon MinMaxRangeError ; toJSON/fromJSON symétriques.
```

### Prisma (`model Pest`) — 6 colonnes additives nullables
```prisma
  lifeCycle           Json?
  cycleDurationDays   Json?
  developmentStages   Json?
  generationsPerYear  Json?
  activityPeriods     Json?
  favorableConditions Json?
```
Migration `ADD COLUMN` uniquement ; l'unique ligne existante reste valide (tout nullable).

## Domaine

- `Pest` gagne les 6 props biologie (optionnelles), un getter chacune, et une méthode
  **`setBiology(fields: BiologyFields): Pest`** qui retourne une nouvelle instance avec les
  champs biologie **remplacés en bloc** (identité, description, photos préservées).
  `BiologyFields` = les 6 champs sous forme domaine (TranslatableText pour les textes,
  `MinMaxRange` pour les plages, tableau de stades).
- `toSnapshot()` sérialise les 6 champs (via `.toJSON()`), `fromSnapshot()` les reconstruit.
- Validation : les plages passent par `MinMaxRange.create` (rejette `min > max`).
- `PestSnapshot` gagne les 6 champs en JSON (formes ci-dessus).

## API

- **`SetPestBiologyUseCase`** : charge le `Pest`, appelle `setBiology`, sauvegarde, journalise
  (audit `entityType: 'Pest'`). Erreur `PestNotFoundError` si absent.
- **`PATCH /pests/:id/biology`** (contrôleur) : body = les 6 champs biologie (JSON) ; renvoie le
  document pest complet (via `toResponse`). 404 si inconnu.
- Read-model `PestDocument` + `toPestDocument` exposent les 6 champs (passe-plat) ; le texte
  indexé (`serializedText`) inclut cycle de vie + durée + générations en clair.
- Repo `toRow`/`toSnapshot` persistent/relisent les 6 colonnes.

## Admin

- **`MinMaxRangeInput`** (`components/`) : deux `Input` numériques (min, max) + libellé d'unité
  optionnel ; `value?: MinMaxRangeJSON`, `onChange(v)`. Vide → `undefined`.
- **`MonthMultiSelect`** (`components/`) : 12 puces/toggles (Janvier…Décembre) ; `value: string[]`,
  `onChange`.
- **`DevelopmentStagesEditor`** (`components/`) : liste de lignes `{ nom, durée? }` avec
  ajout/suppression/réordonnancement (comme `ImageGalleryUploader`).
- **`PestBiologyEditor`** (`app/pests/[id]/editors/`) : `EditorShell` partagé, seed depuis le
  pest, compose les champs ci-dessus, appelle `setPestBiology(pestId, biology)`.
- **`setPestBiology(id, biology)`** (`lib/actions.ts`) → `PATCH /pests/:id/biology`.
- **`labels.ts`** : `MONTH_LABELS` (JAN…DEC).
- **`api.ts`** : interface `Pest` gagne les 6 champs biologie ; `MinMaxRangeJSON` type.
- **`PestFicheView`** : nouvelle section lecture « Biologie » (cycle de vie, durée, stades en
  mini-liste, générations, mois d'activité en puces, conditions favorables en lignes) — masquée
  si tout vide. La page `/pests/[id]` monte le `PestBiologyEditor` (bouton « Modifier la
  biologie »).

## Migration & données

- 1 ligne `Pest` en base ; migration entièrement additive/nullable → aucun risque.
- Après `schema.prisma` : `prisma migrate dev` (inspecter le SQL = `ADD COLUMN` seulement) +
  `prisma generate`.

## Tests

- **Domaine** : `MinMaxRange` (min≤max, rejet min>max, round-trip) ; `Pest.setBiology`
  (remplace en bloc, préserve identité/photos ; round-trip snapshot des 6 champs).
- **Use-case** : `SetPestBiologyUseCase` (pest inconnu → erreur ; set puis relecture ;
  remplacement complet — un champ absent du payload est effacé, pas préservé).
- **Read-model** : le document expose les 6 champs + texte indexé enrichi.
- Rappel : la suite e2e efface la base de dev — **ne lancer que des specs unitaires ciblées**
  (`jest src/...`), jamais `apps/api/test/*.e2e-spec.ts`.

## Fichiers impactés (indicatif)

- **Nouveaux (API)** : `domain/shared/min-max-range.ts` (+spec) ;
  `application/pest/set-pest-biology.use-case.ts` (+spec) ; migration Prisma.
- **Modifiés (API)** : `domain/pest/pest.ts` (+specs) ; `prisma-pest.repository.ts` ;
  `pest-read-model.ts` ; `pest.controller.ts` ; `schema.prisma` ; enregistrement du use-case
  dans le module.
- **Nouveaux (admin)** : `components/MinMaxRangeInput.tsx`, `components/MonthMultiSelect.tsx`,
  `components/DevelopmentStagesEditor.tsx`, `components/EditorShell.tsx` (partagé),
  `app/pests/[id]/editors/PestBiologyEditor.tsx`.
- **Modifiés (admin)** : `lib/api.ts`, `lib/actions.ts`, `lib/labels.ts`,
  `app/pests/[id]/PestFicheView.tsx`, `app/pests/[id]/page.tsx`,
  `crops/[id]/editors/EditorShell.tsx` (ré-export du partagé).
