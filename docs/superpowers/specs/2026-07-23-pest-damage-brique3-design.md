# Ravageurs — Brique 3 : Dégâts

_Design validé en brainstorming le 2026-07-23._

## Contexte

Les Briques 1 (identité + fiche) et 2 (biologie + édition par section) sont en place. Cette
brique ajoute la section **Dégâts** de la fiche ravageur : quels organes sont attaqués, par
quels types de dégâts, avec quels symptômes, et à quel niveau de nuisibilité général. Elle
suit exactement le pattern de la Biologie (Brique 2).

## Décisions actées (brainstorming)

1. **Champs intrinsèques au ravageur** (savoir général). `CropPestControl` (susceptibilité,
   seuil, lutte *par culture*) n'est pas touché — la nuisibilité ici est **générale**, distincte
   de la susceptibilité par culture.
2. **Réutilise le champ `symptoms` existant** (traduisible, déjà dans le domaine + read-model
   mais éditable seulement à la création) — désormais éditable et affiché.
3. **Niveau de nuisibilité = Mineur / Modéré / Majeur** (`MINOR`/`MODERATE`/`MAJOR`),
   vocabulaire distinct de la susceptibilité par culture (Faible/Modérée/Élevée) pour éviter la
   confusion.
4. **Remplacement complet** à l'enregistrement (comme `setBiology`).
5. **Composant `ChipMultiSelect` générique** pour les deux multi-selects (organes, types).
   `MonthMultiSelect` (Biologie) reste tel quel.

## Périmètre de la Brique 3

Dans le périmètre :

1. **Champs Dégâts** sur `Pest` (tous optionnels) :
   - `attackedOrgans?: string[]` — organes attaqués (codes).
   - `damageTypes?: string[]` — types de dégâts (codes).
   - `harmfulnessLevel?: string` — niveau de nuisibilité (`MINOR`/`MODERATE`/`MAJOR`).
   - `symptoms` — **champ existant**, exposé (traduisible).
2. **Domaine** : méthode `setDamage(fields)` — remplace en bloc `symptoms` + les 3 champs
   dégâts, préserve identité / biologie / photos.
3. **Migration** additive : 3 colonnes (`attackedOrgans` Json?, `damageTypes` Json?,
   `harmfulnessLevel` String?). `symptoms` existe déjà.
4. **API** : `SetPestDamageUseCase` + endpoint `PATCH /pests/:id/damage` ; read-model expose les
   3 champs (symptoms déjà exposé).
5. **Admin** :
   - Composant générique **`ChipMultiSelect`** (`{ options: Record<string,string>; value: string[]; onChange }`, ordre des options préservé).
   - Libellés `ATTACKED_ORGAN_LABELS`, `DAMAGE_TYPE_LABELS`, `HARMFULNESS_LABELS`.
   - `PestDamageEditor` (dialog via `EditorShell`) → action `setPestDamage`.
   - Section **« Dégâts »** dans `PestFicheView` (lecture, masquée si tout vide).
   - Le second éditeur monté sur `/pests/[id]` (à côté de « Modifier la biologie »).

Hors périmètre (briques suivantes) : Répartition (4), Gestion (5), Sources (6). Pas de
workflow de publication.

## Modèle de données

### Enums (codes → libellés FR, côté admin)
```
ATTACKED_ORGAN_LABELS = { ROOTS:'Racines', STEMS:'Tiges', LEAVES:'Feuilles', FLOWERS:'Fleurs', FRUITS:'Fruits', SEEDS:'Graines' }
DAMAGE_TYPE_LABELS    = { BITES:'Morsures', MINES:'Mines', GALLERIES:'Galeries', SUCKING:'Succion', DEFOLIATION:'Défoliation', PERFORATIONS:'Perforations', DISEASE_TRANSMISSION:'Transmission de maladies' }
HARMFULNESS_LABELS    = { MINOR:'Mineur', MODERATE:'Modéré', MAJOR:'Majeur' }
```
Les codes sont stockés tels quels (string) ; pas d'enum TypeScript côté domaine (cohérent avec
`activityPeriods` en Brique 2 — validation par le Select côté admin).

### Prisma (`model Pest`) — 3 colonnes additives nullables
```prisma
  attackedOrgans   Json?
  damageTypes      Json?
  harmfulnessLevel String?
```
`symptoms Json?` existe déjà. Migration `ADD COLUMN` uniquement ; la ligne existante reste
valide.

## Domaine

- `Pest` gagne les 3 champs dégâts (getters) + une méthode **`setDamage(d: DamageFields): Pest`**
  qui retourne une nouvelle instance avec `symptoms` et les 3 champs **remplacés en bloc**
  (identité, biologie, photos préservées).
  `DamageFields = { symptoms?: TranslatableText; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string }`.
- Regrouper les 3 champs dégâts dans un `_damage: DamageSnapshot` (comme `_biology`) pour garder
  le constructeur lisible ; `symptoms` reste le param existant `_symptoms`.
- `PestSnapshot` gagne `attackedOrgans?`, `damageTypes?`, `harmfulnessLevel?` (flat) ;
  `toSnapshot` les sérialise, `fromSnapshot` les reconstruit.
- **Constructeur positionnel** : ajout d'UN param `_damage` (dernier). Mettre à jour TOUS les
  sites d'appel du constructeur (`create`, `update`, `setBiology`, `setDamage`, `fromSnapshot`)
  — `create` passe `{}`, `update`/`setBiology` passent `this._damage` pour préserver les dégâts,
  `setDamage` passe le bloc fraîchement construit, `fromSnapshot` le reconstruit depuis les
  3 champs plats du snapshot.

## API

- **`SetPestDamageUseCase`** : charge le `Pest`, `setDamage`, sauvegarde, journalise
  (`entityType: 'Pest'`). `PestNotFoundError` si absent (réutilisé).
- **`PATCH /pests/:id/damage`** : body = `{ symptoms?, attackedOrgans?, damageTypes?, harmfulnessLevel? }` ; renvoie le document pest complet ; 404 si inconnu.
- Read-model `PestDocument` + `toPestDocument` exposent les 3 champs (passe-plat) ;
  `serializedText` enrichi (organes, types, nuisibilité). La ligne `symptoms` existe déjà.
- Repo `toRow`/`toSnapshot` persistent/relisent les 3 colonnes.

## Admin

- **`ChipMultiSelect`** (`components/`) : puces toggle sur `Object.entries(options)`, ordre des
  options préservé (comme `MonthMultiSelect`), `value: string[]`, `onChange`.
- **`labels.ts`** : `ATTACKED_ORGAN_LABELS`, `DAMAGE_TYPE_LABELS`, `HARMFULNESS_LABELS`.
- **`api.ts`** : interface `Pest` gagne `attackedOrgans?`, `damageTypes?`, `harmfulnessLevel?`,
  `symptoms?` (traduisible) ; type `PestDamage`.
- **`actions.ts`** : `setPestDamage(id, damage)` → `PATCH /pests/:id/damage`.
- **`PestDamageEditor`** (`app/pests/[id]/editors/`) : `EditorShell`, seed depuis le pest ;
  Symptômes (textarea), Organes attaqués (`ChipMultiSelect`), Types de dégâts
  (`ChipMultiSelect`), Niveau de nuisibilité (shadcn `Select`). Appelle `setPestDamage`.
- **`PestFicheView`** : section « Dégâts » (organes en puces, types en puces, nuisibilité en
  badge, symptômes en texte) — masquée si tout vide. Placée entre Biologie et Photos.
- **`/pests/[id]/page.tsx`** : monte `PestDamageEditor` à côté de `PestBiologyEditor`.

## Migration & données

- 1 ligne `Pest` ; migration entièrement additive/nullable → sûr.
- Après `schema.prisma` : `prisma migrate dev` (inspecter le SQL = `ADD COLUMN` seulement) +
  `prisma generate`.

## Tests

- **Domaine** : `Pest.setDamage` (remplace en bloc symptoms + 3 champs ; préserve identité +
  biologie ; round-trip snapshot ; efface quand payload vide).
- **Use-case** : `SetPestDamageUseCase` (pest inconnu → erreur ; set puis relecture ;
  remplacement complet).
- **Read-model** : le document expose les 3 champs + texte indexé enrichi.
- Rappel : la suite e2e efface la base de dev — **uniquement specs unitaires ciblées**
  (`jest src/...`), jamais `apps/api/test/*.e2e-spec.ts`.

## Fichiers impactés (indicatif)

- **Nouveaux (API)** : `application/pest/set-pest-damage.use-case.ts` (+spec) ; migration.
- **Modifiés (API)** : `domain/pest/pest.ts` (+spec) ; `prisma-pest.repository.ts` ;
  `pest-read-model.ts` ; `pest.controller.ts` ; `schema.prisma` ; `crop.module.ts`.
- **Nouveaux (admin)** : `components/ChipMultiSelect.tsx` ;
  `app/pests/[id]/editors/PestDamageEditor.tsx`.
- **Modifiés (admin)** : `lib/api.ts`, `lib/actions.ts`, `lib/labels.ts`,
  `app/pests/[id]/PestFicheView.tsx`, `app/pests/[id]/page.tsx`.
