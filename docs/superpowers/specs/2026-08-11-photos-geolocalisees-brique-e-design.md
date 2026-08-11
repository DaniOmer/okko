# Spec — Module 2 / Brique E « Photos géolocalisées »

**Date** : 2026-08-11
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — collecte de données terrain (dernière brique)

## Contexte

Les briques A→D sont livrées (accès tenant, parcelles/bénéficiaires, campagnes/journal,
recommandations). La brique E ajoute des **photos géolocalisées** aux opérations du journal :
documenter le terrain et **constituer le carburant du futur diagnostic IA** (Module 3, hors
périmètre — la vision §7 dit de construire l'IA en dernier, après que le carnet ait collecté
des photos terrain). **Aucune IA ici** : uniquement de la collecte.

On réutilise l'**infra média existante** (upload d'images des cultures/zones/ravageurs) :
`MediaImage`, `POST /media`, la conversion clé→URL, et le composant admin `ImageGalleryUploader`.

### État actuel (audité, réutilisé)

- `MediaImage` (`domain/media/media-image.ts`) : `{ key, caption?, category? }` + `toJSON`/`fromJSON`.
- Upload : `POST /media` (multipart champ `file`, ≤ 5 Mo, JPG/PNG/WebP) → `{ key, url }` ;
  actuellement `@Roles('superadmin')`. `StoragePort.publicUrl(key)` (S3 public, clés `images/{uuid}.ext`).
- Lecture : `toImageDto(imgJson, storage)` → `{ key, url, caption?, category? }` (utilisé par le
  contrôleur zone : `images.map((img) => toImageDto(img, this.storage))`).
- Admin : `ImageGalleryUploader` (`components/ImageGalleryUploader.tsx`) — upload via l'action
  `uploadImage(FormData)` (`POST /media`), prévisualisation, légende/catégorie ; produit
  `ImageRef[] = { key, url, caption?, category? }`.
- `OperationLog` (brique C) : `campaignId`, `type`, `date`, `inputs`, `laborCost?`, `notes?`,
  `recordedByUserId` — **pas de photos ni de GPS**. Écriture = `ORG_ADMIN`/`AGRONOMIST`/`FIELD_AGENT`.
- `Parcel` (brique B) porte `gpsLat?`/`gpsLng?`.

## Objectifs

1. Attacher des **photos** (réutilisant `MediaImage`) et une **position GPS** optionnelle à une
   opération du journal.
2. Position **source-agnostique** (`gpsLat`/`gpsLng` = simples nombres du body) : capture par
   l'API de géolocalisation du **navigateur** (web), pré-remplie depuis le GPS de la parcelle,
   et **compatible mobile** plus tard sans changement backend.
3. Ouvrir l'**upload média** aux rôles tenant (écriture) pour qu'ils téléversent les photos.
4. Afficher photos + repère GPS dans la timeline du journal.

## Non-objectifs (plus tard)

- Diagnostic IA (Module 3) — la vision impose de le construire **après** la collecte.
- GPS **par photo** (EXIF ou natif mobile) — ajout additif ultérieur.
- Appli mobile native ; URLs média **signées** (v1 = URLs publiques, comme l'existant).

## Modèle de données

### `OperationLog` — 3 champs additifs

| Champ | Type | Notes |
|---|---|---|
| `photos` | `MediaImageJSON[]` | `{ key, caption?, category? }` ; défaut `[]` |
| `gpsLat` | `number?` | position de l'opération (capture navigateur ; repli = GPS parcelle) |
| `gpsLng` | `number?` | |

- Horodatage : déjà porté par `date` + `createdAt` (pas de champ dédié).
- **Compatibilité mobile** : `gpsLat/gpsLng` sont des nombres du body ; une future appli mobile
  enverra le même champ, même endpoint. Un GPS par photo resterait un ajout additif.

Table Prisma `OperationLog` : colonnes `photos Json @default("[]")` (ou `Json` + défaut appli),
`gpsLat Float?`, `gpsLng Float?`. Migration additive.

## API

- **Domaine** : `OperationLogSnapshot` gagne `photos: MediaImageJSON[]`, `gpsLat?`, `gpsLng?`
  (`MediaImageJSON` importé de `domain/media/media-image`).
- **Use-cases** : `CreateOperationLogInput`/`UpdateOperationLogInput` gagnent `photos?`,
  `gpsLat?`, `gpsLng?` ; `create` pose `photos: input.photos ?? []` ; `update` via `keep`.
- **Persistance** : `prisma-operation-log.repository.ts` — `toSnap`/`save` mappent `photos`
  (JSON, comme `inputs`) + `gpsLat`/`gpsLng` (`?? undefined` / `?? null`).
- **Contrôleur** (`operation-log.controller.ts`) :
  - `OpBody` gagne `photos?: { key: string; caption?: string }[]`, `gpsLat?: number`,
    `gpsLng?: number`.
  - **Injecter `StoragePort`** ; sur le `GET /operations` (list), mapper chaque opération pour
    convertir `photos[].key` → `{ key, url, caption? }` via `toImageDto`. (Create/patch renvoient
    aussi l'opération — appliquer la même conversion sur les réponses qui exposent des photos.)
  - `organizationId`/`recordedByUserId` inchangés (du JWT). Isolation et rôles inchangés.
- **Ouvrir l'upload** : sur `media.controller.ts`, le handler `POST /media` passe de
  `@Roles('superadmin')` (classe) à un `@Roles(...)` **method-level** incluant les rôles
  plateforme **et** les 3 rôles d'écriture tenant (`superadmin`, `admin`, `editor`, `ORG_ADMIN`,
  `AGRONOMIST`, `FIELD_AGENT`) — override du class-level (technique des briques A/B). Le
  `DELETE /media` (s'il existe) reste plateforme.

## Admin (une seule app, gatée par rôle)

- **Formulaire opération** (`app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx` + `.client`) :
  - **Photos** : brancher `ImageGalleryUploader` (`components/ImageGalleryUploader`) sur un champ
    `photos: ImageRef[]` (upload via `/media`, désormais tenant).
  - **Position** : champs `lat`/`lng` + bouton **« 📍 Capturer ma position »**
    (`navigator.geolocation.getCurrentPosition`). À la création, pré-remplis depuis le GPS de la
    **parcelle** (passé en prop) ; à l'édition, depuis la position de l'opération.
  - `operationToPayload` : ajoute `photos` (`{ key, caption? }[]`) + `gpsLat`/`gpsLng` (nombres,
    vide → `undefined`).
  - Le composant client `OperationEditor` reçoit `parcelGps?: { lat?: number; lng?: number }` en
    prop pour le pré-remplissage.
- **Page journal** (`.../campagnes/[cid]/page.tsx`) : elle récupère la parcelle
  (`listParcels().find`) pour passer son GPS à l'éditeur ; chaque opération de la timeline
  affiche ses **vignettes photos** et un **repère 📍** (coordonnées) si présent.
- **Types/clients** (`lib/api.ts`) : `OperationLog` gagne `photos: ImageRef[]` (avec URL) +
  `gpsLat?`/`gpsLng?` ; `OperationPayload` (`lib/suivi-actions.ts`) gagne
  `photos?: { key: string; caption?: string }[]`, `gpsLat?`, `gpsLng?`. Réutilise l'action
  `uploadImage` existante et le type `ImageRef`.

## Tests

- **Use-case** (`operation-log.use-cases.spec.ts`) : `create` persiste `photos` + `gpsLat/gpsLng`
  et se relit (round-trip) ; `create` sans photos → `photos: []`.
- **Média** : le handler `POST /media` porte bien les rôles tenant en plus des rôles plateforme
  (test de métadonnées `@Roles` via `Reflector`, comme les contrôleurs suivi).
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `domain/parcel/operation-log.ts` (+3 champs) ; `application/parcel/operation-log.use-cases.ts`
(inputs + create/update) ; `schema.prisma` + migration (`photos`, `gpsLat`, `gpsLng`) ;
`infrastructure/parcel/prisma-operation-log.repository.ts` ; `presentation/parcel/operation-log.controller.ts`
(OpBody + `StoragePort` + `toImageDto` sur les réponses) + module (injecter `StoragePort` dans
le contrôleur — vérifier qu'il est fourni au `SuiviModule`) ; `presentation/media/media.controller.ts`
(ouvrir `POST /media` aux rôles tenant).

**Admin** : `lib/api.ts` (`OperationLog` + `ImageRef`) ; `lib/suivi-actions.ts` (`OperationPayload`) ;
`OperationForm.tsx` (uploader + GPS + bouton capture) ; `OperationEditor.client.tsx` (prop
`parcelGps`, prefill) ; page journal (récupérer parcelle → GPS, vignettes + repère dans la timeline).

**Ordre de construction** : (1) domaine + use-cases + persistance + tests ; (2) contrôleur
opérations (photos→URL) + ouverture `POST /media` ; (3) admin (uploader + GPS + timeline).

**Sans** : IA (Module 3), GPS par photo (EXIF), mobile natif, URLs signées.
