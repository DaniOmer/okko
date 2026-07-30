# Spec — Brique « exigences ECOCROP » (fiche Culture)

**Date** : 2026-07-30
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 1 (socle — base de connaissances agronomique)

## Contexte

L'audit de complétude du modèle (juillet 2026) a confronté la fiche Culture d'Okko aux
descripteurs de référence **FAO ECOCROP** et **GAEZ v4**. Le modèle couvre déjà les 10
sections de la vision (§5), mais il manque quelques **descripteurs écologiques ECOCROP**
sur les exigences climatiques et édaphiques de la culture. Ces champs sont peu coûteux à
ajouter et il vaut mieux les poser **avant la saisie de masse** (culture pilote maïs) pour
ne pas re-toucher chaque fiche ensuite.

Descripteurs ECOCROP visés et non encore modélisés :
- **Photopériode** (sensibilité à la longueur du jour) — déterminante pour les cultures
  africaines photopériodiques (sorgho, mil, niébé).
- **Profondeur de sol** exigée.
- **Fertilité** requise du sol.
- **Tolérance à la salinité**.
- **Drainage** : déjà présent dans le domaine (`EdaphicRequirements.drainage`, texte libre)
  mais **jamais câblé à l'éditeur** — donc inaccessible en pratique.

## Objectifs

1. Ajouter 2 champs climatiques et 3 champs édaphiques (+ câbler le drainage existant).
2. Rester dans le style **additif** des briques précédentes : extension des value objects
   partagés `ClimaticRequirements` / `EdaphicRequirements`, sans refonte.
3. Tout champ enum passe par un `Select` shadcn (convention admin) ; tout champ quantitatif
   passe par un `RangeValue` min·optimal·max (convention du modèle).

## Non-objectifs (hors périmètre)

- Longueur de la période de croissance (LGP) sur la **Zone** — brique séparée ultérieure.
- Intensité lumineuse / tolérance à l'ombrage, latitude, Köppen au niveau culture.
- Traits qualité/nutritionnels des variétés (Bioversity).
- Provenance/notes sur les blocs climat/sol (déjà modélisés, non éditables — inchangé).
- Rattachement à des sources externes (auto-remplissage ECOCROP) — chantier « sources ».

## Modèle de données

### `ClimaticRequirements` (apps/api/src/domain/shared/climatic-requirements.ts)

Ajout de 2 champs optionnels :

| Champ | Type | Valeurs / unité |
|---|---|---|
| `photoperiodResponse` | `string` (enum) | `DAY_NEUTRAL` \| `SHORT_DAY` \| `LONG_DAY` |
| `criticalDayLength` | `RangeValue` (optionnel) | min·optimal·max, unité `h` |

### `EdaphicRequirements` (apps/api/src/domain/shared/edaphic-requirements.ts)

Ajout de 3 champs optionnels + évolution du drainage existant :

| Champ | Type | Valeurs / unité |
|---|---|---|
| `soilDepth` | `RangeValue` | min·optimal·max, unité `cm` |
| `fertilityRequirement` | `string` (enum) | `LOW` \| `MEDIUM` \| `HIGH` |
| `salinityTolerance` | `string` (enum) | `SENSITIVE` \| `MODERATELY_TOLERANT` \| `TOLERANT` |
| `drainage` (existant) | `string` (enum) | `POOR` \| `MODERATE` \| `WELL` \| `EXCESSIVE` |

**Note drainage** : le champ existe déjà comme texte libre mais aucune donnée n'a jamais pu
être saisie (pas d'input dans l'éditeur). On le traite donc désormais comme un enum ; pas de
donnée à migrer, aucun risque.

Pour chaque value object : mettre à jour l'interface de props, l'interface `...JSON`, les
getters, `toJSON()` et `fromJSON()`.

## Libellés FR (apps/admin/src/lib/labels.ts)

Nouveaux maps :

```ts
export const PHOTOPERIOD_RESPONSE_LABELS: Record<string, string> = {
  DAY_NEUTRAL: 'Indifférente (jour-neutre)', SHORT_DAY: 'Jour court', LONG_DAY: 'Jour long',
};
export const SALINITY_TOLERANCE_LABELS: Record<string, string> = {
  SENSITIVE: 'Sensible', MODERATELY_TOLERANT: 'Moyennement tolérante', TOLERANT: 'Tolérante',
};
export const DRAINAGE_LABELS: Record<string, string> = {
  POOR: 'Mauvais (hydromorphe)', MODERATE: 'Modéré', WELL: 'Bon (drainant)', EXCESSIVE: 'Excessif',
};
```

**Réutilise** `FERTILITY_LABELS` existant (`LOW: 'Faible'`, `MEDIUM: 'Moyenne'`, `HIGH: 'Élevée'`)
pour `fertilityRequirement`.

## Persistance

**Aucune migration DB.** `Crop.climatic` / `Crop.edaphic` sont des colonnes `Json?`
(prisma/schema.prisma) : les value objects sont sérialisés en bloc via `toJSON()`. Les nouveaux champs optionnels transitent automatiquement par le repository
(`prisma-crop.repository.ts`, mapping `s.climatic`/`s.edaphic` inchangé) et par l'event store.

## Couche application / présentation

- **`SetCropRequirementsUseCase`** : **inchangé**. Sémantique *full-replace* par bloc, il
  reconstruit via `ClimaticRequirements.fromJSON` / `EdaphicRequirements.fromJSON`.
- **`crop.controller.ts`** (`PATCH :id/requirements`) : **inchangé**. Le `@Body` est typé par
  `ClimaticRequirementsJSON` / `EdaphicRequirementsJSON`, qui s'étendent automatiquement.
- **`crop-read-model.ts`** : le document recopie `climatic`/`edaphic` en bloc (type
  `CropSnapshot['climatic']`) → aucun changement requis. *Optionnel* : ajouter les nouveaux
  champs au `serializedText` (représentation texte pour l'IA) — non bloquant, à faire pour
  cohérence si rapide. Le rapport de complétude (`climatic: !!s.climatic`) est inchangé.

## UI & fiche (apps/admin)

### `RequirementsEditor.tsx` (+ son `page.tsx`)

- Étendre le type `RequirementsInitial` : `climatic` gagne `photoperiodResponse?`,
  `criticalDayLength?: Range` ; `edaphic` gagne `soilDepth?: Range`, `drainage?`,
  `fertilityRequirement?`, `salinityTolerance?`.
- Étendre le mapping `initial` (dans la page qui monte l'éditeur) pour pré-remplir depuis le
  snapshot.
- **Climat** : ajouter un `Select` « Photopériode » (`PHOTOPERIOD_RESPONSE_LABELS`) et une
  ligne range « Jour critique — min·opt·max (h) » (3 `Input`, unité `h`).
- **Sol** : ajouter une ligne range « Profondeur de sol — min·opt·max (cm) » (unité `cm`), et
  3 `Select` : « Drainage » (`DRAINAGE_LABELS`), « Fertilité requise » (`FERTILITY_LABELS`),
  « Tolérance à la salinité » (`SALINITY_TOLERANCE_LABELS`).
- Construction du payload : même logique conditionnelle que l'existant (un range n'est ajouté
  que si min/opt/max sont remplis ; un enum que s'il est choisi).

### Fiche culture (vue lecture)

Dans les sections Climat / Sol existantes, afficher chaque nouveau champ s'il est renseigné :
- enums via `labelOf(<MAP>, code)` ;
- ranges au format `min–max unité` (comme T°, pH, altitude), en suivant le style des lignes
  voisines.

## Tests

- **Value objects** : round-trip `toJSON()` → `fromJSON()` sur `ClimaticRequirements` et
  `EdaphicRequirements` vérifiant que les nouveaux champs sont préservés.
- **Use-case** : dans `set-crop-requirements.use-case.spec.ts`, une assertion qu'un nouveau
  champ (ex. `edaphic.salinityTolerance`, `climatic.photoperiodResponse`) persiste après
  `execute` puis relecture.
- **Type-check** : `tsc --noEmit` vert côté API et admin (gate des briques précédentes).

## Points de touche (récap)

1. `apps/api/src/domain/shared/climatic-requirements.ts` — +2 champs
2. `apps/api/src/domain/shared/edaphic-requirements.ts` — +3 champs + drainage
3. `apps/admin/src/lib/labels.ts` — 3 nouveaux maps
4. `apps/admin/.../editors/RequirementsEditor.tsx` — inputs + payload + `RequirementsInitial`
5. La page montant l'éditeur — mapping `initial`
6. La fiche culture (vue lecture) — affichage
7. (optionnel) `apps/api/src/application/crop/crop-read-model.ts` — `serializedText`
8. Tests : specs des 2 value objects + `set-crop-requirements.use-case.spec.ts`

**Sans** : migration Prisma, changement de use-case, changement de contrôleur.
