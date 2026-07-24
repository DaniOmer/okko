# Bioagresseurs — Adventices via un discriminant `kind`

_Design validé en brainstorming le 2026-07-25._

## Contexte

L'entité `Pest` est une fiche riche et **générique** (6 sections optionnelles + photos + dates),
mais aujourd'hui scopée aux **ravageurs animaux** (enum catégorie animal, libellés
prédateurs/parasitoïdes). Les cultures y sont liées via `CropPestControl` (section « Ravageurs &
maladies »). On veut ajouter les **adventices** (mauvaises herbes) en **réutilisant** cette infra
plutôt qu'en dupliquant, via un discriminant `kind`. Les **maladies** suivront (même mécanisme),
plus tard.

## Décisions actées (brainstorming)

1. **Réutilisation, pas duplication.** On ajoute un champ **`kind` (ANIMAL / DISEASE / WEED)** à
   l'entité unique. DRY : un seul agrégat, read-model, lien culture. On garde le nom interne
   `Pest` (pas de renommage ~60 fichiers) ; libellés « bioagresseur / adventice » côté UI.
2. **Honnêteté du modèle via `kind`.** La fiche et les éditeurs deviennent **conscients du
   kind** : ils n'affichent que les sections/champs pertinents et les libellés adaptés (pas de
   « prédateurs » sur une adventice, pas d'« organes attaqués » sur une plante).
3. **Adventices d'abord** (le cas divergent), pour valider le mécanisme sur le cas dur.
4. **Navigation** : une **liste unique** `/pests` (« Bioagresseurs ») avec **badge kind** +
   **filtre** (Tous / Ravageurs / Adventices). Pas de page séparée.
5. **Modèle adventice riche.**

## Modèle

### `kind` (champ cœur)
`kind: 'ANIMAL' | 'DISEASE' | 'WEED'`. Les lignes existantes migrent en `ANIMAL` (défaut).
Choisi à la création, modifiable via l'édition identité. Enum domaine `PestKind`.

### Catégorie (`type`, enum `PestType` existant) — scopée par kind
On **enrichit** `PestType` avec les catégories adventice : `ANNUAL_GRASS`, `PERENNIAL_GRASS`,
`ANNUAL_BROADLEAF`, `PERENNIAL_BROADLEAF`, `SEDGE` (`OTHER` réutilisé). Les valeurs animales
restent. L'admin propose les bonnes options **selon le kind** (label maps `PEST_TYPE_LABELS`
animal, `WEED_CATEGORY_LABELS` adventice). Le domaine ne valide pas catégorie×kind (comme
`activityPeriods`) — la contrainte est portée par le Select admin.

### Nuisibilité adventice → dans le bloc `_damage`
Le bloc dégâts existant gagne **`nuisanceTypes?: string[]`** (concurrence eau/lumière/nutriments,
allélopathie, plante-hôte, gêne récolte). Pour une adventice, la section « Dégâts » devient
« **Nuisibilité** » et affiche `nuisanceTypes` + `harmfulnessLevel` (réutilisé) + `symptoms`
réutilisé mais libellé « **Effets observés** » ; `attackedOrgans`/`damageTypes` sont masqués.
`setDamage` + `PATCH /pests/:id/damage` acceptent `nuisanceTypes` (additif).

### Traits adventice → nouveau bloc `_weed`
```ts
export interface WeedSnapshot {
  reproductionMode?: string[];        // SEEDS, RHIZOMES, STOLONS, TUBERS
  disseminationCapacity?: string;     // LOW | MEDIUM | HIGH
  emergenceDepth?: MinMaxRangeJSON;   // profondeur de levée (cm)
  seedBankLongevity?: MinMaxRangeJSON;// longévité banque de graines (ans)
}
```
Méthode domaine `setWeed()` (remplacement complet) + endpoint `PATCH /pests/:id/weed`. Ces
champs ne sont pertinents/affichés que pour `kind = WEED`.

### Domaine — constructeur
Le constructeur positionnel gagne **2 params** : `_kind` (cœur, avec le défaut `ANIMAL`) et
`_weed` (bloc). Tous les sites d'appel (`create`, `update`, les 6 `setX`, `setWeed`,
`fromSnapshot`) passent les nouveaux args dans le bon ordre. `create`/`update` gèrent `kind` ;
les `setX` préservent `this._kind`/`this._weed` ; `setWeed` remplace le bloc.
_Note (dette technique)_ : le constructeur atteint ~17 params — c'est un signal qu'un
constructeur à **objet de props** serait plus sain. On garde le positionnel pour cohérence avec
l'existant et pour ne pas bloquer la feature, mais un refactor vers un props-object est à
envisager après cette brique.

## Rendu conscient du kind

**Création** : un `Select` « Type de bioagresseur » (Ravageur / Adventice — Maladie ajoutée plus
tard) pilote les options de catégorie et le kind enregistré.

**Liste `/pests`** : titre « Bioagresseurs » ; colonne/badge kind (Ravageur / Adventice) ; filtre
(Tous / Ravageurs / Adventices) via `searchParams`.

**Fiche (`PestFicheView`)** — selon `pest.kind` :
- **ANIMAL** : comportement actuel inchangé.
- **WEED** :
  - Hero : badge « Adventice ».
  - Biologie : cycle de vie, durée, stades, conditions favorables **+** reproduction,
    dissémination, profondeur de levée, banque de graines (du bloc `_weed`) ; « générations/an »
    masqué.
  - « Dégâts » → titre « **Nuisibilité** » : types de nuisibilité + niveau + effets (symptoms) ;
    organes attaqués / types de dégâts masqués.
  - Gestion : prédateurs/parasitoïdes masqués ; prévention/produits/résistances gardés.
  - Répartition, Sources, dates : inchangés.

**Éditeurs** (`/pests/[id]`) — conscients du kind :
- Éditeur identité (pop-up liste) : choix du kind + catégorie scopée.
- `PestBiologyEditor` : masque « générations/an » si WEED.
- `PestDamageEditor` : si WEED, titre « Nuisibilité », masque organes/types de dégâts, affiche
  `nuisanceTypes`, libelle symptoms « Effets observés ».
- `PestManagementEditor` : masque prédateurs/parasitoïdes si WEED.
- **`PestWeedEditor`** (nouveau, WEED seulement) : reproduction (`ChipMultiSelect`), dissémination
  (`Select`), profondeur de levée + banque de graines (`MinMaxRangeInput`). → `setPestWeed`.
- Les cinq éditeurs montés sur `/pests/[id]` restent ; `PestWeedEditor` s'ajoute pour les WEED.

## API

- `create`/`update` acceptent `kind` (défaut ANIMAL) ; `type` accepte les catégories adventice.
- `SetPestWeedUseCase` + `PATCH /pests/:id/weed` (bloc `_weed`). `setDamage` étendu avec
  `nuisanceTypes`.
- Read-model `PestDocument` + `toPestDocument` exposent `kind`, `nuisanceTypes` et les 4 champs
  `_weed` ; `serializedText` enrichi. `list()` renvoie `kind` (déjà via le document).

## Migration & données

- Colonnes additives : `kind` (String, **défaut `'ANIMAL'` NON NULL** pour couvrir la ligne
  existante), `nuisanceTypes` (Json?), `reproductionMode` (Json?), `disseminationCapacity`
  (String?), `emergenceDepth` (Json?), `seedBankLongevity` (Json?).
- 1 ligne `Pest` en base → devient `kind = ANIMAL`. Migration additive, `ADD COLUMN` uniquement
  (le défaut sur `kind` couvre la ligne existante).

## Tests

- **Domaine** : `kind` (création défaut ANIMAL, update) ; `Pest.setWeed` (remplace en bloc,
  préserve le reste, round-trip, efface si vide) ; `setDamage` avec `nuisanceTypes`.
- **Use-case** : `SetPestWeedUseCase` (inconnu → erreur ; set/relecture ; remplacement complet).
- **Read-model** : le document expose `kind` + `nuisanceTypes` + les 4 champs weed + texte indexé.
- Rappel : e2e efface la base de dev → **uniquement specs unitaires ciblées** (`jest src/...`).

## Décomposition (le plan aura ~2 phases)

1. **Fondation `kind`** : champ `kind` (domaine + migration + read-model + create/update + admin
   type api), liste badge+filtre, création avec choix du kind + catégories adventice.
2. **Contenu adventice** : `nuisanceTypes` sur `_damage`, bloc `_weed` + `setWeed` + endpoint,
   `PestWeedEditor`, et le rendu conscient du kind sur la fiche + les éditeurs.

## Hors périmètre

- **Maladies** (kind DISEASE) : même mécanisme, brique ultérieure.
- Refactor du constructeur positionnel vers un props-object (dette notée, pas dans cette brique).
- `CropPestControl` non touché (le lien culture reste par `pestId`, tous kinds confondus).
