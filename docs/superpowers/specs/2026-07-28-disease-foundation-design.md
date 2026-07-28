# Maladies — fondation (kind=DISEASE, Brique 1)

_Design validé en brainstorming le 2026-07-28._

## Contexte

Le bioagresseur (`Pest`) a un discriminant `kind` (ANIMAL/DISEASE/WEED) posé en Phase 1. Les kinds
ANIMAL (ravageurs) et WEED (adventices) sont livrés ; **DISEASE existe dans l'enum mais n'est pas
proposé à la création** (le formulaire n'offre que Ravageur/Adventice). Cette brique rend une
**maladie créable, filtrable et visible** en réutilisant les sections génériques existantes
(Biologie, Dégâts, Répartition, Gestion, Sources). Le contenu spécifique aux maladies (agent
pathogène, propagation, symptômes détaillés, impacts, prévention détaillée, relibellé de la fiche)
fera l'objet de la **Brique 2**.

**Architecture actée** : les maladies restent des **bioagresseurs** (`kind = DISEASE`), pas une entité
séparée. C'est DRY (réutilise le CRUD, les éditeurs, la liste unique, et surtout les relations
existantes culture↔bioagresseur `CropPestControl` et zone↔bioagresseur `ZonePestPresence`) et
**agronomiquement juste** : « bioagresseur » est le terme générique qui englobe ravageurs, maladies
(agents pathogènes) et adventices.

## Décisions actées (brainstorming)

1. **Unifié** : maladie = `kind = DISEASE` (pas d'entité séparée).
2. **Fondation d'abord** (Brique 1) ; contenu spécifique = Brique 2.
3. **Carence incluse** comme type optionnel (seul type abiotique ; la grille la marque optionnelle).
   Réversible plus tard si on veut la retirer.

## Modèle — type de maladie (`PestType`)

Ajout à l'enum `PestType` (comme les catégories adventice, valeurs additives) :
`FUNGUS`, `BACTERIA`, `VIRUS`, `PHYTOPLASMA`, `OOMYCETE`, `DEFICIENCY` (+ `OTHER` réutilisé).

`DISEASE_CATEGORY_LABELS` (admin `labels.ts`) :
```ts
{ FUNGUS: 'Champignon', BACTERIA: 'Bactérie', VIRUS: 'Virus', PHYTOPLASMA: 'Phytoplasme',
  OOMYCETE: 'Oomycète', DEFICIENCY: 'Carence', OTHER: 'Autre' }
```
Le domaine ne valide pas catégorie×kind (contrainte portée par le Select admin, comme pour les
adventices).

## Organe « Collet »

Ajout de `COLLAR: 'Collet'` à `ATTACKED_ORGAN_LABELS`, entre `ROOTS` et `STEMS` :
```ts
{ ROOTS: 'Racines', COLLAR: 'Collet', STEMS: 'Tiges', LEAVES: 'Feuilles', FLOWERS: 'Fleurs', FRUITS: 'Fruits', SEEDS: 'Graines' }
```
Réutilisé par la section « Organes atteints » (bloc dégâts) déjà en place ; aucune donnée existante
impactée (nouveau code de valeur).

## Admin — création & édition

- `pests/new/page.tsx` : le Select « Type de bioagresseur » offre **Ravageur / Maladie / Adventice** ;
  `categoryLabels` scopé : `kind === 'WEED' ? WEED_CATEGORY_LABELS : kind === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS`.
  `onKindChange` réinitialise `type` sur la première catégorie du map scopé.
- `pests/PestRowActions.tsx` (édition) : même Select + même scoping des catégories.

## Admin — liste & fiche

- **Liste `/pests`** : ajouter l'onglet de filtre **Maladies** (`?kind=DISEASE`) à la barre
  Tous/Ravageurs/Adventices. Le badge kind (« Maladie » via `PEST_KIND_LABELS`) fonctionne déjà.
  La cellule catégorie choisit le bon map : `DISEASE → DISEASE_CATEGORY_LABELS`, `WEED → WEED_CATEGORY_LABELS`,
  sinon `PEST_TYPE_LABELS`.
- **Fiche `/pests/[id]` (`PestFicheView`)** : une maladie s'affiche avec les **sections génériques**
  inchangées (Biologie, Dégâts, Répartition, Gestion, Sources, Photos) + le chip kind « Maladie » +
  une **icône maladie** (🦠) au hero + la catégorie via `DISEASE_CATEGORY_LABELS`. Ajouter un drapeau
  `isDisease = pest.kind === 'DISEASE'` pour l'icône/chip/catégorie. **Pas** de relibellé de section ni
  de champ spécifique ici (Brique 2).

## Migration & données

- **Aucune migration** : `PestType` est une colonne texte ; `kind = DISEASE` persiste déjà. On ajoute
  seulement des valeurs d'énum (domaine) et des libellés (admin). Aucune donnée existante impactée.

## Tests (unitaires ciblés uniquement)

Rappel : **jamais** `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts` (ils effacent la base).

- **Domaine** : `pest-type.spec.ts` — assertion que `PestType` contient les 6 types maladie
  (`FUNGUS`/`BACTERIA`/`VIRUS`/`PHYTOPLASMA`/`OOMYCETE`/`DEFICIENCY`).
- **Admin** : `tsc --noEmit` comme garde (formulaires, liste, fiche kind-aware).

## Décomposition (Brique 1 — plan unique)

Brique 1 est petite et cohérente : elle tient dans **un seul plan** (domaine enum + libellés + création/édition + liste + fiche). Pas de sous-phases.

## Hors périmètre (→ Brique 2)

- Bloc `_disease` (agent pathogène, mode de propagation, premiers/avancés symptômes, risque de
  confusion, pertes potentielles, vitesse d'évolution, prévention détaillée : rotation, variétés
  résistantes, prophylaxie, irrigation, désinfection, chimique, culturale, curative).
- `PestDiseaseEditor` + rendu de la fiche conscient du kind (Dégâts → « Symptômes », masquages).
- `+Vent` sur les conditions favorables.
