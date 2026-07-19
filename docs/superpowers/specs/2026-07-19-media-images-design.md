# Galerie d'images (cultures, zones, ravageurs) + storage S3 — Design

**Statut :** validé (brainstorming), prêt pour le plan.

## Objectif

Permettre d'attacher une **galerie d'images** (plusieurs, avec légende + ordre) aux **cultures**, **zones agroécologiques** et **ravageurs/maladies**, stockées dans un **storage S3-compatible** (Cloudflare R2 au départ), derrière une **abstraction DDD** permettant de changer de provider sans toucher au domaine.

## Décisions (validées)

- **Provider** : S3-compatible générique (adapter unique, endpoint configurable) ; **Cloudflare R2** en premier (free tier, zéro egress). Tests via un `StoragePort` en mémoire (pas de S3 réel requis).
- **Galerie** : plusieurs images par entité, chacune `{ key, caption? }`, ordre = position dans la liste.
- **Upload via l'API** (multipart) : le navigateur envoie le fichier à l'API, qui le confie au port ; l'entité ne stocke que la **clé**.
- **Stocker tel quel** : valider type (`image/jpeg|png|webp`) + taille (≤ 5 Mo) ; pas de redimensionnement (brique future).
- **Clé seule stockée** ; l'`url` publique est dérivée à la lecture (`StoragePort.publicUrl(key)`) → changer de provider ne casse aucune URL persistée.
- Images **optionnelles**, **hors complétude** (ne bloquent pas la publication).
- **Orphelins** : supprimer une image d'une entité ne supprime pas (encore) l'objet du bucket (nettoyage = itération future).

## Contexte & existant

- **Culture** = agrégat event-sourcé (sections JSON via events, ex. `CommercializationSet`). **Zone** (`AgroEcologicalZone`) et **Ravageur** (`PestDisease`) = entités CRUD référentielles (`/zones`, `/pests` : create + update + delete, éditeurs admin existants).
- `PestDisease` a **déjà** une colonne `photos Json` (typée `string[]` dans le VO, jamais éditée par l'UI) → on la **réutilise** pour stocker `MediaImage[]` (repurposée, pas de migration Pest ; aucune donnée réelle à préserver).
- `AgroEcologicalZone` n'a pas de colonne images ; `Crop` non plus.
- Aucune infra storage/upload aujourd'hui ; `@nestjs/platform-express` (multer) présent ; `@aws-sdk/client-s3` **absent** (à ajouter) ; `@types/multer` absent (dev).
- Config par `process.env.*` direct (pas de ConfigModule). Auth admin = cookie httpOnly `okko_session` relayé en `Authorization: Bearer` par `authFetch` (server-only). `jsonInit` est JSON-only ; **pas** de helper multipart aujourd'hui.

## Architecture

### 1. Domaine — VO `MediaImage`
`domain/media/media-image.ts` : `MediaImage` `{ key: string; caption?: string }`, `toJSON()/fromJSON()`, copies défensives. `MediaImageJSON = { key: string; caption?: string }`. Réutilisé par les 3 entités.

### 2. Port + adapters (storage)
- `application/media/storage.port.ts` — `StoragePort` (token `STORAGE_PORT`) :
  - `save(input: { bytes: Buffer; contentType: string; ext: string }): Promise<{ key: string }>` — génère `images/${uuid}.${ext}`, écrit l'objet.
  - `remove(key: string): Promise<void>`
  - `publicUrl(key: string): string`
- `infrastructure/media/s3-storage.ts` — `S3Storage` (R2) via `@aws-sdk/client-s3` : `PutObjectCommand`/`DeleteObjectCommand` ; `publicUrl = ${S3_PUBLIC_BASE_URL}/${key}`. Config env : `S3_ENDPOINT`, `S3_REGION` (défaut `auto`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE?` (défaut false ; true pour MinIO).
- `application/media/in-memory-storage.ts` — `InMemoryStorage` (tests) : Map clé→bytes, `publicUrl = memory://${key}`.
- `MediaModule` : fournit `STORAGE_PORT` (useFactory → `S3Storage` depuis env), `UploadImageUseCase`, `MediaController` ; **exporte** `STORAGE_PORT` ; importé par `app.module` et `CropModule`.

### 3. Upload — `UploadImageUseCase` + `MediaController`
- `application/media/upload-image.use-case.ts` : `execute({ bytes, contentType, actor })` → valide `contentType ∈ {image/jpeg, image/png, image/webp}` (sinon `UnsupportedImageTypeError`), taille `≤ 5 Mo` (sinon `ImageTooLargeError`), dérive l'ext (jpeg→jpg, png→png, webp→webp), `storage.save(...)` → renvoie `{ key }`.
- `presentation/media/media.controller.ts` : `@Controller('media')`, `@UseGuards(AuthGuard, RolesGuard) @Roles('superadmin')`, `@Post()` `@UseInterceptors(FileInterceptor('file'))` `@UploadedFile() file: Express.Multer.File` → `uploadImage.execute({ bytes: file.buffer, contentType: file.mimetype, actor })` → renvoie `{ key, url: storage.publicUrl(key) }`. Multer en mémoire (limite 5 Mo au niveau interceptor aussi).

### 4. Rattachement aux entités
- **Culture** (event-sourcé, miroir de `commercialization`) : VO `MediaImage[]` ; event `CropImagesSet { images: MediaImageJSON[] }` ; `_images`, `setImages`, `apply('CropImagesSet')`, getter, `toSnapshot`/`fromSnapshot`, `CropSnapshot.images`, Checkpoint capture+restore ; migration colonne `images Json?` sur `Crop` ; repo map ; `crop-read-model` passe-plat (**pas** dans `computeCompleteness`) ; use-case `SetCropImagesUseCase` ; endpoint `POST /crops/:id/images` (body `{ images: MediaImageJSON[] }`).
- **Zone** (CRUD) : VO gagne `images: MediaImage[]` ; migration `images Json?` sur `AgroEcologicalZone` ; `create-zone`/`update-zone` inputs + `AgroEcologicalZone.update()` incluent `images` ; `zone.controller` POST/PATCH bodies gagnent `images?: MediaImageJSON[]` ; repo `toRow`/`toSnapshot` map `images`.
- **Ravageur** (CRUD) : VO `photos: string[]` → **`images: MediaImage[]`** (repurpose la colonne `photos`) ; `create-pest`/`update-pest` inputs + `PestDisease.update()` incluent `images` ; `pest.controller` POST/PATCH bodies gagnent `images?: MediaImageJSON[]` ; repo map la colonne `photos` ↔ `images`.

### 5. Enrichissement URL (lecture)
Les DTO de lecture renvoient chaque image en `{ key, url, caption? }`. L'`url` est calculée en **présentation** via `STORAGE_PORT.publicUrl(key)` (le domaine/read-model ne stocke que la clé) :
- Crop : les endpoints `GET /crops/:id` (brouillon) et published enrichissent `images[]`.
- Zone/Pest : les endpoints de lecture (`GET /zones`, `GET /pests`, get by id) enrichissent `images[]`.
- Un petit mapper partagé `toImageDto(img, storage)` évite la duplication.

### 6. Admin
- **Plomberie** : `lib/http.ts` gagne `multipartInit(method, fd: FormData): RequestInit` (pas de `Content-Type` — le navigateur pose la boundary) ; Server Action `uploadImage(fd)` → `authFetch('/media', multipartInit('POST', fd))` → `{ key, url }`.
- **Composant réutilisable** `components/ImageGalleryUploader.tsx` (client) : reçoit `value: ImageRef[]` (`{ key, url, caption? }`) + `onChange` ; `<input type="file" accept="image/*">` → upload via l'action → append `{ key, url, caption:'' }` ; miniatures ; supprimer ; **réordonner** (haut/bas) ; éditer la légende. Validation légère côté client (type/taille) avant envoi.
- **Câblage** :
  - Culture : nouvel éditeur `ImagesEditor` (galerie → `setCropImages(cropId, images.map(i=>({key:i.key,caption:i.caption})))` via `POST /crops/:id/images`) monté sur `crops/[id]/page.tsx`.
  - Zone : uploader dans `zones/new/page.tsx` + `ZoneRowActions.tsx` ; `createZone`/`updateZone` transmettent `images`.
  - Ravageur : uploader dans `pests/new/page.tsx` + `PestRowActions.tsx` ; `createPest`/`updatePest` transmettent `images`.
  - Types `lib/api.ts` : `Zone`, `Pest`, `CropDetail` gagnent `images: ImageRef[]`.

### 7. Affichage
- **Fiche client** : le hero utilise la **1ʳᵉ image** de la culture (remplace l'encart « Photo à venir ») ; une **section « Photos »** dédiée affiche la galerie (miniatures + légendes). Zones (section « Zones ») et ravageurs (section « Ravageurs ») affichent leurs vignettes en ligne.
- **Vue publiée** : vignettes compactes dans les cartes correspondantes.
- **Listes `/zones`, `/pests`** : petite vignette par ligne si image.

## Env / dépendances / migrations

- Dépendances API : `@aws-sdk/client-s3` (prod), `@types/multer` (dev).
- `.env` + `.env.example` (API) : `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE?`. (R2 : bucket public ou domaine public pour `PUBLIC_BASE_URL`.)
- Migrations manuelles : `images Json?` sur `Crop` et `AgroEcologicalZone` (Pest réutilise `photos`, pas de migration).

## Tests

- **Domaine** : `MediaImage` round-trip ; agrégat Crop rejoue `CropImagesSet` → snapshot/checkpoint conservent `images` ; `AgroEcologicalZone`/`PestDisease` round-trip `images`.
- **Application** : `UploadImageUseCase` (accepte jpeg/png/webp ≤ 5 Mo via `InMemoryStorage` ; rejette type/taille) ; `SetCropImagesUseCase` ; `create/update-zone` + `create/update-pest` acceptent `images`.
- **Non-régression** : suites crop/zone/pest vertes ; complétude **inchangée** (images non comptées).
- **Admin** : `tsc --noEmit` + `pnpm build` (uploader + éditeurs + affichage).
- **Manuel** : configurer R2 (env) → uploader une image sur une culture/zone/ravageur → vérifier stockage, affichage fiche (hero + galerie), listes.

## Critères de succès

- [ ] `StoragePort` + `S3Storage` (R2) + `InMemoryStorage` ; provider changeable par env, domaine agnostique (clé seule stockée).
- [ ] `POST /media` (multipart, superadmin) valide type/taille et renvoie `{ key, url }`.
- [ ] Galerie `MediaImage[]` attachée à Culture (event-sourcé), Zone et Ravageur (CRUD) ; migrations `images` sur Crop + Zone ; Pest réutilise `photos`.
- [ ] URL dérivée en lecture (`publicUrl`) ; DTO renvoient `{ key, url, caption? }`.
- [ ] Admin : `ImageGalleryUploader` réutilisable (upload, miniatures, suppression, réordonnancement, légende) branché sur les 3 éditeurs ; upload via Server Action + multipart.
- [ ] Affichage : hero fiche = 1ʳᵉ image, galerie, vignettes zones/ravageurs ; vue publiée + listes.
- [ ] Images hors complétude (publication non bloquée) ; clean architecture (domaine pur → application/port → infra/adapters → présentation) ; TDD ; suites + build verts.

## Suite

Suppression des orphelins (nettoyage du bucket) ; redimensionnement/vignettes (sharp) ; upload par URL pré-signée (gros fichiers) ; images par section/stade ; galeries publiques.
