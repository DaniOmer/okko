# Ravageurs — Brique 6 : Sources (finale)

_Design validé en brainstorming le 2026-07-24._

## Contexte

Dernière brique de la fiche ravageur. Les Briques 1–5 (identité, biologie, dégâts, répartition,
gestion) sont en place. Cette brique ajoute les **sources documentaires** et affiche les
**dates** (création / dernière mise à jour). Elle finalise la fiche complète.

## Décisions actées (brainstorming)

1. **Sources = liste structurée `{ title, url? }`** — un lien optionnel cliquable par source
   (références vérifiables). Nouveau composant `SourcesEditor`.
2. **Dates non éditables** : `createdAt` et `updatedAt` sont gérées par la base. `updatedAt` est
   déjà remonté partout ; `createdAt` doit être ajouté au chemin de lecture (comme `updatedAt`).
   Affichées en pied de fiche, jamais éditées.
3. **Remplacement complet** à l'enregistrement des sources (comme les `setX` précédents).
4. `CropPestControl` n'est pas touché.

## Périmètre de la Brique 6

Dans le périmètre :

1. **Champ Sources** sur `Pest` : `sources?: { title: string; url?: string }[]` (éditable).
2. **`createdAt`** remonté : ajouté à `PestSnapshot` (lecture seule, comme `updatedAt`),
   au document read-model, et à l'interface admin `Pest`.
3. **Domaine** : méthode `setSources(sources)` — remplace en bloc le champ sources, préserve
   tout le reste.
4. **Migration** additive : 1 colonne `sources Json?` (`createdAt`/`updatedAt` existent déjà).
5. **API** : `SetPestSourcesUseCase` + endpoint `PATCH /pests/:id/sources` ; read-model expose
   `sources` + `createdAt`.
6. **Admin** :
   - Nouveau composant **`SourcesEditor`** (`components/`) : lignes `{ titre, url? }` avec
     ajout/suppression (comme `ApprovedProductsEditor`).
   - `PestSourcesEditor` (dialog via `EditorShell`) → action `setPestSources`.
   - Section **« Sources »** dans `PestFicheView` (lecture : liste de liens ; le titre est un
     `<a>` cliquable si `url`), masquée si vide, placée entre Gestion et Photos.
   - **Pied de métadonnées** discret en bas de la fiche : « Créé le {createdAt} · Mis à jour le
     {updatedAt} » (formaté fr-FR ; masqué si les dates sont absentes).
   - Le 5ᵉ éditeur monté sur `/pests/[id]` (à côté des quatre autres).

Hors périmètre : rien — c'est la dernière brique de la fiche.

## Modèle de données

### Prisma (`model Pest`) — 1 colonne additive nullable
```prisma
  sources Json?
```
`createdAt` et `updatedAt` existent déjà. Migration `ADD COLUMN` uniquement ; la ligne existante
reste valide.

## Domaine

- Type exporté `SourceJSON = { title: string; url?: string }`.
- `PestSnapshot` gagne `sources?: SourceJSON[]` (éditable) et `createdAt?: string` (lecture seule).
- `Pest` gagne un getter `sources` + une méthode **`setSources(sources: SourceJSON[]): Pest`**
  qui retourne une nouvelle instance avec le champ sources **remplacé en bloc** (tout le reste
  préservé).
- `sources` est un champ éditable → **param de constructeur** `_sources` (dernier, 15ᵉ) ;
  `toSnapshot` l'émet, `fromSnapshot` le reconstruit.
- `createdAt` est géré par la base → **PAS un param de constructeur** (comme `updatedAt`) :
  ajouté à `PestSnapshot`, peuplé par le repo `toSnapshot` (lecture de `row.createdAt`), non émis
  par le `toSnapshot()` du domaine.
- **Constructeur positionnel** : ajout d'UN param `_sources` (15ᵉ). Mettre à jour TOUS les sites
  d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`,
  `setSources`, `fromSnapshot`) — `create` passe `[]`, les `setX`/`update` passent `this._sources`
  pour le préserver, `setSources` passe la nouvelle liste, `fromSnapshot` la reconstruit depuis
  `s.sources`.

## API

- **`SetPestSourcesUseCase`** : charge le `Pest`, `setSources`, sauvegarde, journalise
  (`entityType: 'Pest'`). `PestNotFoundError` si absent (réutilisé).
- **`PATCH /pests/:id/sources`** : body = `{ sources?: { title: string; url?: string }[] }` ;
  renvoie le document pest complet ; 404 si inconnu.
- Read-model `PestDocument` + `toPestDocument` exposent `sources` + `createdAt` (`updatedAt` déjà
  exposé) ; `serializedText` enrichi (titres des sources). Repo `toRow` persiste `sources` ;
  `toSnapshot` lit `sources` + `createdAt`.

## Admin

- **`SourcesEditor`** (`components/`) : `value: { title: string; url?: string }[]`, `onChange` ;
  lignes avec deux `Input` (titre, url) + suppression ; bouton « + Ajouter une source ». Les
  lignes au titre vide sont filtrées à l'enregistrement.
- **`api.ts`** : interface `Pest` gagne `sources?: Source[]` et `createdAt?: string` ; types
  `Source` et `PestSources`.
- **`actions.ts`** : `setPestSources(id, sources)` → `PATCH /pests/:id/sources`.
- **`PestSourcesEditor`** (`app/pests/[id]/editors/`) : `EditorShell`, seed depuis le pest,
  compose `SourcesEditor`, appelle `setPestSources`.
- **`PestFicheView`** :
  - Section « Sources » (liste ; chaque source = un lien `<a href={url}>` si `url`, sinon le
    titre en texte), masquée si vide, entre Gestion et Photos.
  - **Pied de métadonnées** : sous la fiche, une ligne discrète
    « Créé le {createdAt fr-FR} · Mis à jour le {updatedAt fr-FR} », masquée si les deux dates
    sont absentes. Formatage via `new Date(iso).toLocaleDateString('fr-FR')`.
- **`/pests/[id]/page.tsx`** : monte `PestSourcesEditor` à côté des quatre autres éditeurs.

## Migration & données

- 1 ligne `Pest` ; migration entièrement additive/nullable → sûr.
- Après `schema.prisma` : `prisma migrate dev` (inspecter le SQL = `ADD COLUMN` seulement) +
  `prisma generate`.

## Tests

- **Domaine** : `Pest.setSources` (remplace en bloc ; préserve identité + gestion ; round-trip
  snapshot ; efface quand payload vide).
- **Use-case** : `SetPestSourcesUseCase` (pest inconnu → erreur ; set puis relecture ;
  remplacement complet).
- **Read-model** : le document expose `sources` + `createdAt` + texte indexé enrichi.
- Rappel : la suite e2e efface la base de dev — **uniquement specs unitaires ciblées**
  (`jest src/...`), jamais `apps/api/test/*.e2e-spec.ts`.

## Fichiers impactés (indicatif)

- **Nouveaux (API)** : `application/pest/set-pest-sources.use-case.ts` (+spec) ; migration.
- **Modifiés (API)** : `domain/pest/pest.ts` (+spec) ; `prisma-pest.repository.ts` ;
  `pest-read-model.ts` (+spec) ; `pest.controller.ts` ; `schema.prisma` ; `crop.module.ts`.
- **Nouveaux (admin)** : `components/SourcesEditor.tsx` ;
  `app/pests/[id]/editors/PestSourcesEditor.tsx`.
- **Modifiés (admin)** : `lib/api.ts`, `lib/actions.ts`,
  `app/pests/[id]/PestFicheView.tsx`, `app/pests/[id]/page.tsx`.
