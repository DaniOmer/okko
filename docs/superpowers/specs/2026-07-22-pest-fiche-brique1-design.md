# Ravageurs — Brique 1 : Fondation + fiche

_Design validé en brainstorming le 2026-07-22._

## Contexte

Les ravageurs existent aujourd'hui comme entité **CRUD simple** `PestDisease` (ravageurs
ET maladies mélangés), sans fiche de consultation. On veut bâtir une base de connaissance
ravageur riche (spec agronomique en 6 sections : Identification, Biologie, Dégâts,
Répartition, Gestion, Métadonnées). Ce document ne couvre que la **Brique 1** ; les autres
sections suivront en briques dédiées.

## Décisions actées (brainstorming)

1. **Périmètre = ravageurs animaux uniquement.** Les maladies (champignon/bactérie/virus) et
   adventices sortent du périmètre (entités séparées, plus tard). La catégorie devient
   purement animale.
2. **Workflow = CRUD (édition directe), pas d'event-sourcing.** Pas de brouillon/publication/
   versions comme les cultures. On ajoute en revanche une vraie **fiche de consultation**.
   Un workflow de publication reste ajoutable dans une brique ultérieure.
3. **Renommage `PestDisease` → `Pest`** dès maintenant (base quasi vide : 1 entrée, 1 lien).
   Aligne le backend sur l'interface `Pest` déjà utilisée côté admin.
4. **Séparation intrinsèque / spécifique-culture.** Ce qui est propre au ravageur (biologie,
   dégâts en général, répartition, ennemis naturels) va sur la **fiche ravageur**. Ce qui est
   propre à une culture (sensibilité, seuil, stades sensibles, lutte recommandée ici) reste
   dans `CropPestControl`. **On ne touche pas à `CropPestControl`.**

## Périmètre de la Brique 1

Dans le périmètre :

1. **Renommage `PestDisease` → `Pest`** — entité de domaine, table Prisma, dépôts, use-cases,
   contrôleur, specs, références admin. `CropPestControl` conserve son nom.
2. **Catégorie animale** — nouvel enum : `INSECT` (Insecte), `MITE` (Acarien),
   `NEMATODE` (Nématode), `MOLLUSC` (Mollusque), `BIRD` (Oiseau), `MAMMAL` (Mammifère),
   `OTHER` (Autre). Retrait de `FUNGUS`/`BACTERIA`/`VIRUS`/`WEED`.
3. **Nouveaux champs** sur `Pest` : `family` (famille taxonomique, texte), `description`
   (traduisible `Record<string,string>`), `updatedAt`.
4. **Photos catégorisées** : chaque photo porte une catégorie optionnelle
   `ADULT`/`LARVA`/`EGG`/`DAMAGE`/`OTHER` (adulte / larve / œufs / dégâts / autre).
5. **`update()` enrichi** : prend en charge les nouveaux champs (aujourd'hui bridé à
   name/type/scientificName/images).
6. **Formulaires admin** création/édition : Catégorie, Famille, Description ; l'uploader
   permet de taguer chaque photo par catégorie.
7. **Fiche ravageur `/pests/[id]`** (page inexistante aujourd'hui) : vue magazine réutilisant
   le kit fiche des cultures. Sections livrées en Brique 1 : hero d'identité (nom, nom
   scientifique, catégorie, famille, description) + section **Photos** (un carrousel, chaque
   photo étiquetée par sa catégorie). Lien depuis la liste `/pests`.

Hors périmètre (briques suivantes) : Biologie (2), Dégâts (3), Répartition (4),
Gestion générale (5), Sources documentaires (6). Aucun workflow de publication.

## Modèle de données (Prisma)

Renommer le modèle `PestDisease` → `Pest` (table renommée) et ajouter les champs :

```prisma
model Pest {
  id             String   @id
  name           Json               // Record<string,string> (traduisible)
  type           String             // catégorie animale (enum PestType)
  scientificName String?
  family         String?            // NOUVEAU — famille taxonomique
  description    Json?              // NOUVEAU — Record<string,string> (traduisible)
  symptoms       Json?              // conservé (exposé en Brique 3)
  photos         Json               // MediaImageJSON[] + category? par entrée
  notes          String?            // conservé
  metadata       Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt // NOUVEAU
}
```

Migration Prisma : `RENAME TABLE "PestDisease" TO "Pest"` + `ADD COLUMN family`, `description`,
`updatedAt`. Additif et non destructif ; l'unique ligne existante (type `INSECT`, animal) reste
valide. `CropPestControl.pestId` continue de référencer la même clé (pas de FK déclarée à
migrer ; vérifier qu'aucune contrainte ne casse au renommage).

**Photos** : le tableau JSON `photos` passe d'entrées `{ key, caption? }` à
`{ key, caption?, category? }` où `category ∈ {ADULT,LARVA,EGG,DAMAGE,OTHER}`. Pas de migration
(champ JSON, `category` optionnel).

## Domaine

- Renommer la classe `PestDisease` → `Pest` (`pest.ts`), son snapshot `PestSnapshot`, et les
  fichiers/specs associés.
- Enum catégorie (`pest-type.ts`) : nouvelles valeurs animales.
- `create()` et `update()` acceptent `family`, `description`, et des photos avec `category`.
  `update()` cesse d'être bridé : il met à jour name, type, scientificName, family,
  description, images.
- Value object photo : porter `category?` (réutiliser le modèle média existant en l'étendant,
  ou mapper au niveau pest).

## API

Endpoints inchangés en surface (`POST/GET/PATCH/DELETE /pests`), shapes enrichies :

- `CreatePestInput` / `UpdatePestInput` : ajout `family?`, `description?`, et `images[]` avec
  `category?`.
- Réponse `Pest` (document) : ajout `family?`, `description?`, `updatedAt`, et `images[]` avec
  `category?` (+ URL dérivée via `toImageDto`, comme aujourd'hui).
- `GET /pests/:id` alimente la fiche (déjà existant).

## Admin

- **Libellés** (`labels.ts`) : `PEST_TYPE_LABELS` recadré sur les catégories animales ; nouveau
  `PEST_PHOTO_CATEGORY_LABELS` (Adulte/Larve/Œufs/Dégâts/Autre).
- **Formulaires** `pests/new` + édition (`PestRowActions`) : champs Catégorie, Famille,
  Description (textarea) ; l'`ImageGalleryUploader` gagne un sélecteur de catégorie par photo
  (extension optionnelle, rétro-compatible avec cultures/zones qui n'en passent pas).
- **Fiche `/pests/[id]`** : nouveau composant `PestFicheView` (magazine, réutilise
  `Section`, `PhotoCarousel`, `SECTION_ICON` du kit fiche). Hero : nom, nom scientifique,
  badge catégorie, famille, description. Section Photos : carrousel, légendes = catégorie +
  caption. Lien « fiche » depuis la ligne de liste.

## Migration & données existantes

- 1 seule entrée `Pest` (type `INSECT`) et 1 `CropPestControl` en base de dev → migration
  triviale, aucune donnée non-animale à convertir.
- Le renommage de table est fait via migration Prisma générée ; vérifier que
  `prisma migrate dev` produit bien un `RENAME` et non un drop/create (sinon écrire le SQL à la
  main pour préserver la ligne).

## Tests

- Specs de domaine renommées (`pest.spec.ts`, `pest.update.spec.ts`) + cas nouveaux :
  `update()` modifie family/description ; photo avec category.
- Specs use-case create/update adaptées aux nouveaux champs.
- Read-model : le document expose family/description/updatedAt/photos.category.
- Rappel : la suite de tests API efface la base de dev — ne pas la lancer sur des données
  réelles.

## Fichiers impactés (indicatif)

- **Rename** : 16 fichiers contenant `PestDisease` (domaine, application, infrastructure,
  présentation, specs) + `schema.prisma` + 3 fichiers admin (`pests/page.tsx`,
  `pests/new/page.tsx`, `PestRowActions.tsx`).
- **Nouveaux** : migration Prisma ; `apps/admin/src/app/pests/[id]/page.tsx` +
  `PestFicheView.tsx` ; libellés photo.
- **Étendus** : `ImageGalleryUploader` (catégorie optionnelle), `labels.ts`, `api.ts`
  (interface `Pest` + shapes).
