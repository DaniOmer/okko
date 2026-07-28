# Maladies — contenu (Brique 2a : symptômes détaillés + développement + impacts)

_Design validé en brainstorming le 2026-07-28._

## Contexte

La Brique 1 a rendu une maladie (`kind=DISEASE`) créable/filtrable/visible en réutilisant les sections
génériques. Cette Brique 2a ajoute le **contenu spécifique maladie** pour trois zones de la grille
métier — Symptômes détaillés, Développement, Impacts — via un nouveau bloc `_disease` (miroir du bloc
`_weed`) et un rendu de la fiche conscient du kind. La **prévention détaillée** (8 champs) fera l'objet
de la Brique 2b, qui étendra le même bloc `_disease`.

`Pest` est un agrégat immuable à constructeur positionnel (17 params, finissant par `_weed`). On ajoute
`_disease` comme 18ᵉ param (cohérent avec `_weed`). _Note (dette)_ : 18 params positionnels — un refactor
vers un constructeur à objet de props serait sain à terme, mais on garde le positionnel pour cohérence
et pour ne pas bloquer la feature.

## Décisions actées (brainstorming)

1. **Scinder** : 2a = symptômes/développement/impacts ; 2b = prévention détaillée.
2. **Réutiliser** `harmfulnessLevel` pour « Gravité » et `activityPeriods` pour « Périodes à risque »
   (mêmes champs, relibellés pour une maladie) — DRY.
3. **Pertes potentielles = texte** (flexible, ex. « 20-40% en conditions humides »).
4. Bloc `_disease` en 18ᵉ param positionnel du constructeur (dette notée).

## Modèle — bloc `_disease` (nouveau)

Fichier `apps/api/src/domain/pest/disease.ts` :
```ts
export interface DiseaseSnapshot {
  firstSymptoms?: Record<string, string>;      // Premiers symptômes
  advancedSymptoms?: Record<string, string>;   // Symptômes avancés
  confusionRisk?: Record<string, string>;      // Risque de confusion avec d'autres maladies
  pathogen?: Record<string, string>;           // Agent pathogène
  propagationModes?: string[];                 // WIND/WATER/SOIL/SEEDS/TOOLS/INSECT_VECTORS/CONTACT
  potentialLosses?: Record<string, string>;    // Pertes potentielles (texte)
  evolutionSpeed?: string;                     // SLOW/MODERATE/FAST
}
```
- `Pest` : `_disease` en 18ᵉ param ; `setDisease(d: DiseaseSnapshot)` (remplacement complet, comme
  `setWeed`) ; `get disease()` ; `toSnapshot()` émet `...this._disease` ; `fromSnapshot()` reconstruit ;
  tous les autres sites d'appel `new Pest(...)` (create/update/setBiology/setDamage/setDistribution/
  setManagement/setSources/setWeed) passent `this._disease` en 18ᵉ arg ; `create` met `{}`.
- `PestSnapshot` gagne les 7 champs.
- Le domaine ne valide pas les énums `propagationModes`/`evolutionSpeed` (contrainte portée par les
  Select admin, comme ailleurs).

### +Vent sur les conditions favorables (partagé)

`FavorableConditionsJSON` gagne `wind?: MinMaxRangeJSON`. `setBiology` normalise `wind` (via
`MinMaxRange`) comme les autres plages ; `fromSnapshot`/`toSnapshot` le propagent (déjà via le bloc
biology). Champ partagé (tous kinds), ajouté à l'éditeur biologie.

## API

- `SetPestDiseaseUseCase` (mirroir `SetPestWeedUseCase`) : charge, `setDisease(...)`, save, audit
  `entityType:'Pest'`, `changes:{ disease: {...} }` ; réutilise `PestNotFoundError`.
- `PATCH /pests/:id/disease` (body = les 7 champs `_disease`) ; 404 si inconnu ; module câblé.
- Read-model `PestDocument` + `toPestDocument` exposent les 7 champs (+ `wind` déjà via
  `favorableConditions`) ; `serializedText` enrichi.

## Persistance & migration

- Migration **additive** : 7 colonnes sur `Pest` — `firstSymptoms`/`advancedSymptoms`/`confusionRisk`/
  `pathogen`/`potentialLosses` (`Json?`), `propagationModes` (`Json?`), `evolutionSpeed` (`String?`).
  Le **vent** va **dans** le Json `favorableConditions` (aucune colonne). Repo `toRow`/`toSnapshot`
  câblent les 7 champs.

## Admin

- `api.ts` : `Pest` gagne les 7 champs (`PestDisease` interface) + `wind?` sur `FavorableConditions` ;
  action `setPestDisease(id, disease)`.
- Libellés : `PROPAGATION_MODE_LABELS` (Vent/Eau/Sol/Semences/Outils/Insectes vecteurs/Contact),
  `EVOLUTION_SPEED_LABELS` (Lente/Modérée/Rapide).
- **`PestDiseaseEditor`** (nouveau, monté sur `/pests/[id]` seulement si `kind=DISEASE`) : premiers
  symptômes, symptômes avancés, risque de confusion, agent pathogène (textareas) ; mode de propagation
  (`ChipMultiSelect PROPAGATION_MODE_LABELS`) ; pertes potentielles (textarea) ; vitesse d'évolution
  (`Select EVOLUTION_SPEED_LABELS`). → `setPestDisease`.
- **`PestBiologyEditor`** : ajout d'un `MinMaxRangeInput` « Vent » (km/h) dans les conditions favorables
  (partagé, tous kinds).
- **Fiche `PestFicheView`** — drapeau `isDisease`, rendu conscient du kind :
  - Section « Dégâts » → titre « **Symptômes** » pour maladie : symptômes + organes atteints +
    premiers symptômes + symptômes avancés + risque de confusion ; masque types de dégâts / nuisibilité.
  - Section « Biologie » → titre « **Développement** » pour maladie : agent pathogène + mode de
    propagation + conditions favorables (+ vent) + périodes à risque (`activityPeriods`) ; masque
    cycle de vie / durée du cycle / stades / générations.
  - Nouvelle section « **Impacts** » (maladie seulement) : Gravité (`harmfulnessLevel` via
    `HARMFULNESS_LABELS`) + pertes potentielles + vitesse d'évolution.
  - Le comportement ravageur/adventice reste inchangé (chemins `isWeed`/générique intacts).

## Tests (unitaires ciblés uniquement)

Rappel : **jamais** `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`.

- **Domaine** : `setDisease` (round-trip des 7 champs, remplacement complet, préserve les autres blocs
  + `kind`, vide à la création) ; `setBiology` avec `wind` (round-trip).
- **Use-case** : `SetPestDiseaseUseCase` (inconnu → `PestNotFoundError` ; set + relecture ; remplacement).
- **Read-model** : le document expose les 7 champs + `wind` + texte indexé.
- **Admin** : `tsc --noEmit` comme garde.

## Décomposition (le plan aura ~2 phases)

1. **Backend** : bloc `_disease` + `setDisease` + `+wind` (domaine + specs) ; migration + repo +
   read-model ; `SetPestDiseaseUseCase` + endpoint + module.
2. **Admin** : plomberie (types/action/libellés) ; `PestDiseaseEditor` + vent dans l'éditeur biologie ;
   fiche conscient du kind (Symptômes/Développement/Impacts).

## Hors périmètre (→ Brique 2b)

- Prévention détaillée maladie : rotation des cultures, variétés résistantes, mesures prophylactiques,
  gestion de l'irrigation, désinfection du matériel, lutte chimique, lutte culturale, mesures curatives
  (8 champs qui étendront le bloc `_disease`) + section « Prévention » de la fiche conscient du kind.
- Refactor du constructeur `Pest` vers un objet de props (dette notée, hors périmètre).
