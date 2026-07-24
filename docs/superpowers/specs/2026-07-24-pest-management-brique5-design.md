# Ravageurs — Brique 5 : Gestion

_Design validé en brainstorming le 2026-07-24._

## Contexte

Les Briques 1–4 (identité, biologie, dégâts, répartition) sont en place, avec l'édition par
section sur `/pests/[id]`. Cette brique ajoute la section **Gestion** : le savoir **général**
de gestion du ravageur (prévention, lutte biologique, ennemis naturels, produits homologués,
résistances). Elle suit le pattern des briques précédentes (`setBiology`/`setDamage`/`setDistribution`).

## Décisions actées (brainstorming)

1. **Gestion GÉNÉRALE, intrinsèque au ravageur** — distincte de la lutte **par culture** de
   `CropPestControl` (susceptibilité, seuil, `controlMethods` par culture, event-sourcée dans la
   culture). Complémentaire, pas redondante. **`CropPestControl` n'est pas touché.**
2. **Prédateurs et parasitoïdes = deux listes séparées** (agronomiquement distincts).
3. **Produits homologués = liste structurée `{ name, country? }`** (l'homologation est
   spécifique au pays) → nouveau composant `ApprovedProductsEditor`.
4. **Prévention / lutte biologique / résistances = textes traduisibles.**
5. **Remplacement complet** à l'enregistrement.

## Périmètre de la Brique 5

Dans le périmètre :

1. **Champs Gestion** sur `Pest` (tous optionnels) :
   - `prevention?: Record<string,string>` — moyens de prévention (texte).
   - `biologicalControl?: Record<string,string>` — méthodes de lutte biologique (texte).
   - `predators?: string[]` — prédateurs naturels (tags).
   - `parasitoids?: string[]` — parasitoïdes (tags).
   - `approvedProducts?: { name: string; country?: string }[]` — produits phytosanitaires
     homologués (liste structurée).
   - `knownResistances?: Record<string,string>` — résistances connues (texte).
2. **Domaine** : méthode `setManagement(fields)` — remplace en bloc les 6 champs, préserve
   identité / biologie / dégâts / répartition / photos.
3. **Migration** additive : 6 colonnes JSON nullables.
4. **API** : `SetPestManagementUseCase` + endpoint `PATCH /pests/:id/management` ; read-model
   expose les 6 champs.
5. **Admin** :
   - Nouveau composant **`ApprovedProductsEditor`** (`components/`) : lignes `{ nom, pays? }`
     avec ajout/suppression (comme `DevelopmentStagesEditor`).
   - `PestManagementEditor` (dialog via `EditorShell`) → action `setPestManagement`.
     Réutilise `TagListInput` (prédateurs, parasitoïdes) + textareas + `ApprovedProductsEditor`.
   - Section **« Gestion »** dans `PestFicheView` (lecture, masquée si tout vide), placée entre
     Répartition et Photos.
   - Le 4ᵉ éditeur monté sur `/pests/[id]` (à côté de Biologie, Dégâts, Répartition).

Hors périmètre (brique suivante) : Sources documentaires (6). Pas de workflow de publication.

## Modèle de données

### Prisma (`model Pest`) — 6 colonnes additives nullables
```prisma
  prevention        Json?
  biologicalControl Json?
  predators         Json?
  parasitoids       Json?
  approvedProducts  Json?
  knownResistances  Json?
```
Migration `ADD COLUMN` uniquement ; la ligne existante reste valide (nullable).

## Domaine

- `Pest` gagne les 6 champs (getters) + une méthode
  **`setManagement(m: ManagementFields): Pest`** qui retourne une nouvelle instance avec les
  6 champs **remplacés en bloc** (identité, biologie, dégâts, répartition, photos préservées).
  `ManagementFields = { prevention?: TranslatableText; biologicalControl?: TranslatableText; predators?: string[]; parasitoids?: string[]; approvedProducts?: { name: string; country?: string }[]; knownResistances?: TranslatableText }`.
- Regrouper les 6 champs dans un `_management: ManagementSnapshot` (comme les blocs précédents) ;
  types exportés `ApprovedProductJSON = { name: string; country?: string }` et
  `ManagementSnapshot`.
- `PestSnapshot` gagne les 6 champs (flat) ; `toSnapshot` les sérialise (textes via `.toJSON()`),
  `fromSnapshot` les reconstruit.
- **Constructeur positionnel** : ajout d'UN param `_management` (dernier, 14ᵉ). Mettre à jour
  TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`,
  `setManagement`, `fromSnapshot`) — `create` passe `{}`, `update`/`setBiology`/`setDamage`/
  `setDistribution` passent `this._management` pour le préserver, `setManagement` passe le bloc
  neuf, `fromSnapshot` le reconstruit depuis les 6 champs plats du snapshot.

## API

- **`SetPestManagementUseCase`** : charge le `Pest`, convertit `prevention`/`biologicalControl`/
  `knownResistances` (`Record<string,string>`) en `TranslatableText`, `setManagement`, sauvegarde,
  journalise (`entityType: 'Pest'`). `PestNotFoundError` si absent (réutilisé).
- **`PATCH /pests/:id/management`** : body = `{ prevention?, biologicalControl?, predators?, parasitoids?, approvedProducts?, knownResistances? }` ; renvoie le document pest complet ; 404 si inconnu.
- Read-model `PestDocument` + `toPestDocument` exposent les 6 champs (passe-plat) ;
  `serializedText` enrichi (prévention, lutte bio, prédateurs, parasitoïdes, produits, résistances).
- Repo `toRow`/`toSnapshot` persistent/relisent les 6 colonnes.

## Admin

- **`ApprovedProductsEditor`** (`components/`) : `value: { name: string; country?: string }[]`,
  `onChange` ; lignes avec deux `Input` (nom, pays) + suppression ; bouton « + Ajouter un
  produit ». À l'enregistrement, les lignes au nom vide sont filtrées.
- **`api.ts`** : interface `Pest` gagne les 6 champs ; types `ApprovedProduct` et `PestManagement`.
- **`actions.ts`** : `setPestManagement(id, management)` → `PATCH /pests/:id/management`.
- **`PestManagementEditor`** (`app/pests/[id]/editors/`) : `EditorShell`, seed depuis le pest ;
  Prévention (textarea), Lutte biologique (textarea), Prédateurs (`TagListInput`), Parasitoïdes
  (`TagListInput`), Produits homologués (`ApprovedProductsEditor`), Résistances connues
  (textarea). Appelle `setPestManagement`.
- **`PestFicheView`** : section « Gestion » (prévention + lutte bio en texte ; prédateurs +
  parasitoïdes en puces ; produits en liste « nom — pays » ; résistances en texte) — masquée si
  tout vide. Placée entre Répartition et Photos.
- **`/pests/[id]/page.tsx`** : monte `PestManagementEditor` à côté des trois autres éditeurs.

## Migration & données

- 1 ligne `Pest` ; migration entièrement additive/nullable → sûr.
- Après `schema.prisma` : `prisma migrate dev` (inspecter le SQL = `ADD COLUMN` seulement) +
  `prisma generate`.

## Tests

- **Domaine** : `Pest.setManagement` (remplace en bloc ; préserve identité + biologie + dégâts +
  répartition ; round-trip snapshot ; efface quand payload vide).
- **Use-case** : `SetPestManagementUseCase` (pest inconnu → erreur ; set puis relecture ;
  remplacement complet).
- **Read-model** : le document expose les 6 champs + texte indexé enrichi.
- Rappel : la suite e2e efface la base de dev — **uniquement specs unitaires ciblées**
  (`jest src/...`), jamais `apps/api/test/*.e2e-spec.ts`.

## Fichiers impactés (indicatif)

- **Nouveaux (API)** : `application/pest/set-pest-management.use-case.ts` (+spec) ; migration.
- **Modifiés (API)** : `domain/pest/pest.ts` (+spec) ; `prisma-pest.repository.ts` ;
  `pest-read-model.ts` (+spec) ; `pest.controller.ts` ; `schema.prisma` ; `crop.module.ts`.
- **Nouveaux (admin)** : `components/ApprovedProductsEditor.tsx` ;
  `app/pests/[id]/editors/PestManagementEditor.tsx`.
- **Modifiés (admin)** : `lib/api.ts`, `lib/actions.ts`,
  `app/pests/[id]/PestFicheView.tsx`, `app/pests/[id]/page.tsx`.
