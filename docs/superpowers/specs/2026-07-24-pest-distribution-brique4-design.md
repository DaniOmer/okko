# Ravageurs — Brique 4 : Répartition

_Design validé en brainstorming le 2026-07-24._

## Contexte

Les Briques 1 (identité), 2 (biologie) et 3 (dégâts) sont en place, avec l'édition par section
sur `/pests/[id]`. Cette brique ajoute la section **Répartition** : où le ravageur est
distribué géographiquement, quel climat lui est favorable, et sa présence connue. Elle suit le
pattern des briques précédentes (`setBiology`, `setDamage`).

## Décisions actées (brainstorming)

1. **Champs intrinsèques au ravageur.** `CropPestControl` n'est pas touché.
2. **Zones géographiques = liste de tags texte libre** (pays/régions), PAS un lien vers l'entité
   `AgroEcologicalZone` — le référentiel ne contient qu'1 zone et reste local aux cultures,
   trop étroit pour une distribution internationale. → nouveau composant `TagListInput`.
3. **Climat favorable = texte** (type de climat, ex. « tropical humide »), **distinct** des
   plages température/humidité/pluie déjà saisies en Biologie (`favorableConditions`) — pas de
   doublon.
4. **Présence connue = texte** (statut/note, ex. « endémique en Afrique de l'Ouest »).
5. **Remplacement complet** à l'enregistrement (comme `setBiology`/`setDamage`).

## Périmètre de la Brique 4

Dans le périmètre :

1. **Champs Répartition** sur `Pest` (tous optionnels) :
   - `geographicAreas?: string[]` — zones/pays/régions (tags texte libre).
   - `favorableClimate?: Record<string,string>` — climat favorable (texte traduisible).
   - `knownPresence?: Record<string,string>` — présence connue (texte traduisible).
2. **Domaine** : méthode `setDistribution(fields)` — remplace en bloc les 3 champs, préserve
   identité / biologie / dégâts / photos.
3. **Migration** additive : 3 colonnes JSON nullables.
4. **API** : `SetPestDistributionUseCase` + endpoint `PATCH /pests/:id/distribution` ; read-model
   expose les 3 champs.
5. **Admin** :
   - Nouveau composant **`TagListInput`** (`{ value: string[]; onChange }`, saisie libre :
     input + ajout (Entrée/bouton), chips avec suppression).
   - `PestDistributionEditor` (dialog via `EditorShell`) → action `setPestDistribution`.
   - Section **« Répartition »** dans `PestFicheView` (lecture, masquée si tout vide), placée
     entre Dégâts et Photos.
   - Le troisième éditeur monté sur `/pests/[id]` (à côté de Biologie et Dégâts).

Hors périmètre (briques suivantes) : Gestion (5), Sources (6). Pas de workflow de publication.

## Modèle de données

### Prisma (`model Pest`) — 3 colonnes additives nullables
```prisma
  geographicAreas  Json?
  favorableClimate Json?
  knownPresence    Json?
```
Migration `ADD COLUMN` uniquement ; la ligne existante reste valide (nullable).

## Domaine

- `Pest` gagne les 3 champs (getters) + une méthode
  **`setDistribution(d: DistributionFields): Pest`** qui retourne une nouvelle instance avec les
  3 champs **remplacés en bloc** (identité, biologie, dégâts, photos préservées).
  `DistributionFields = { geographicAreas?: string[]; favorableClimate?: TranslatableText; knownPresence?: TranslatableText }`.
- Regrouper les 3 champs dans un `_distribution: DistributionSnapshot` (comme `_biology` et
  `_damage`).
- `PestSnapshot` gagne `geographicAreas?`, `favorableClimate?`, `knownPresence?` (flat) ;
  `toSnapshot` les sérialise (les textes via `.toJSON()`), `fromSnapshot` les reconstruit.
- **Constructeur positionnel** : ajout d'UN param `_distribution` (dernier, 13ᵉ). Mettre à jour
  TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`,
  `fromSnapshot`) — `create` passe `{}`, `update`/`setBiology`/`setDamage` passent
  `this._distribution` pour le préserver, `setDistribution` passe le bloc neuf, `fromSnapshot`
  le reconstruit depuis les 3 champs plats du snapshot.

## API

- **`SetPestDistributionUseCase`** : charge le `Pest`, convertit `favorableClimate`/`knownPresence`
  (`Record<string,string>`) en `TranslatableText`, `setDistribution`, sauvegarde, journalise
  (`entityType: 'Pest'`). `PestNotFoundError` si absent (réutilisé).
- **`PATCH /pests/:id/distribution`** : body = `{ geographicAreas?, favorableClimate?, knownPresence? }` ; renvoie le document pest complet ; 404 si inconnu.
- Read-model `PestDocument` + `toPestDocument` exposent les 3 champs (passe-plat) ;
  `serializedText` enrichi (zones, climat, présence).
- Repo `toRow`/`toSnapshot` persistent/relisent les 3 colonnes.

## Admin

- **`TagListInput`** (`components/`) : `value: string[]`, `onChange` ; un `Input` + bouton
  « Ajouter » (ou touche Entrée) ajoute la valeur saisie (trim, ignore vide/doublon) ; chips
  avec bouton de suppression. Composant client réutilisable.
- **`api.ts`** : interface `Pest` gagne `geographicAreas?`, `favorableClimate?`, `knownPresence?`
  ; type `PestDistribution`.
- **`actions.ts`** : `setPestDistribution(id, distribution)` → `PATCH /pests/:id/distribution`.
- **`PestDistributionEditor`** (`app/pests/[id]/editors/`) : `EditorShell`, seed depuis le pest ;
  Zones géographiques (`TagListInput`), Climat favorable (textarea), Présence connue (textarea).
  Appelle `setPestDistribution`.
- **`PestFicheView`** : section « Répartition » (zones en puces, climat en texte, présence en
  texte) — masquée si tout vide. Placée entre Dégâts et Photos.
- **`/pests/[id]/page.tsx`** : monte `PestDistributionEditor` à côté de Biologie et Dégâts.

## Migration & données

- 1 ligne `Pest` ; migration entièrement additive/nullable → sûr.
- Après `schema.prisma` : `prisma migrate dev` (inspecter le SQL = `ADD COLUMN` seulement) +
  `prisma generate`.

## Tests

- **Domaine** : `Pest.setDistribution` (remplace en bloc ; préserve identité + biologie +
  dégâts ; round-trip snapshot ; efface quand payload vide).
- **Use-case** : `SetPestDistributionUseCase` (pest inconnu → erreur ; set puis relecture ;
  remplacement complet).
- **Read-model** : le document expose les 3 champs + texte indexé enrichi.
- Rappel : la suite e2e efface la base de dev — **uniquement specs unitaires ciblées**
  (`jest src/...`), jamais `apps/api/test/*.e2e-spec.ts`.

## Fichiers impactés (indicatif)

- **Nouveaux (API)** : `application/pest/set-pest-distribution.use-case.ts` (+spec) ; migration.
- **Modifiés (API)** : `domain/pest/pest.ts` (+spec) ; `prisma-pest.repository.ts` ;
  `pest-read-model.ts` (+spec) ; `pest.controller.ts` ; `schema.prisma` ; `crop.module.ts`.
- **Nouveaux (admin)** : `components/TagListInput.tsx` ;
  `app/pests/[id]/editors/PestDistributionEditor.tsx`.
- **Modifiés (admin)** : `lib/api.ts`, `lib/actions.ts`,
  `app/pests/[id]/PestFicheView.tsx`, `app/pests/[id]/page.tsx`.
