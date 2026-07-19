# Galerie d'images (cultures, zones, ravageurs) + storage S3 — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Attacher une galerie d'images (plusieurs, légende, ordre) aux cultures, zones et ravageurs, stockées dans un storage S3-compatible (R2) derrière un port DDD interchangeable ; upload multipart via l'API ; le domaine ne stocke que la clé, l'URL est dérivée à la lecture.

**Architecture:** API NestJS hexagonale (VO `MediaImage` ; port `StoragePort` + adapters `S3Storage`/`InMemoryStorage` ; `UploadImageUseCase` ; `MediaController`). Culture event-sourcée (miroir de `commercialization`) ; Zone/Ravageur CRUD (colonnes JSON). Admin Next.js : `ImageGalleryUploader` réutilisable + Server Action multipart.

**Tech Stack:** TypeScript, NestJS 10, `@aws-sdk/client-s3`, multer (`@nestjs/platform-express`), Prisma 5, Jest ; Next.js 14, shadcn/ui, Server Actions.

## Global Constraints

- **Domaine agnostique du provider** : les entités stockent `MediaImage { key, caption? }` (clé seule). L'`url` est dérivée en **présentation** via `STORAGE_PORT.publicUrl(key)` ; les DTO de lecture renvoient `{ key, url, caption? }`.
- Validation upload : `contentType ∈ {image/jpeg, image/png, image/webp}` ; taille ≤ **5 Mo** (`5 * 1024 * 1024`).
- Images **optionnelles**, **hors complétude** — ne PAS toucher `computeCompleteness` ni le gate publish.
- Migrations manuelles (comme le dépôt) : `images Json?` sur `Crop` et `AgroEcologicalZone`. **Pest réutilise sa colonne `photos`** (aucune migration Pest) pour y stocker `MediaImage[]`.
- Tests : jamais de S3 réel — `InMemoryStorage` injecté.
- Ext dérivée : `image/jpeg→jpg`, `image/png→png`, `image/webp→webp`. Clé générée : `images/${randomUUID()}.${ext}`.
- Env (API) : `S3_ENDPOINT`, `S3_REGION` (défaut `auto`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE?`.
- Chaque commit se termine par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Fondation storage (API) — port, adapters, upload

**Files:**
- Modify: `apps/api/package.json` (deps `@aws-sdk/client-s3`, dev `@types/multer`)
- Create: `apps/api/src/domain/media/media-image.ts` + `.spec.ts`
- Create: `apps/api/src/application/media/storage.port.ts`
- Create: `apps/api/src/application/media/in-memory-storage.ts`
- Create: `apps/api/src/application/media/upload-image.use-case.ts` + `.spec.ts`
- Create: `apps/api/src/infrastructure/media/s3-storage.ts`
- Create: `apps/api/src/presentation/media/media.controller.ts`
- Modify: `apps/api/src/crop.module.ts` (register `STORAGE_PORT`, `UploadImageUseCase`, `MediaController`)
- Modify: `apps/api/.env.example`

**Interfaces (produced, consumed by Tasks 2–3 & 5):** `MediaImage`/`MediaImageJSON` ; `STORAGE_PORT` token + `StoragePort` (`save`/`remove`/`publicUrl`) ; `UploadImageUseCase`.

- [ ] **Step 1: Installer les deps.** Run: `cd apps/api && pnpm add @aws-sdk/client-s3 && pnpm add -D @types/multer`. Vérifier qu'elles apparaissent dans `package.json`.

- [ ] **Step 2: Test rouge `MediaImage`.** Créer `media-image.spec.ts` :

```ts
import { MediaImage } from './media-image';
describe('MediaImage', () => {
  it('round-trips key + caption', () => {
    const r = MediaImage.fromJSON(MediaImage.create({ key: 'images/a.jpg', caption: 'Feuille' }).toJSON());
    expect(r.key).toBe('images/a.jpg');
    expect(r.caption).toBe('Feuille');
  });
  it('omet caption si absente', () => {
    expect(MediaImage.create({ key: 'images/b.png' }).toJSON()).toEqual({ key: 'images/b.png' });
  });
});
```

- [ ] **Step 3: Lancer → échec.** Run: `cd apps/api && npx jest media-image.spec`. Expected: FAIL.

- [ ] **Step 4: `media-image.ts`.**

```ts
export interface MediaImageJSON { key: string; caption?: string; }
interface CreateProps { key: string; caption?: string; }

export class MediaImage {
  private constructor(private readonly _key: string, private readonly _caption?: string) {}
  static create(props: CreateProps): MediaImage { return new MediaImage(props.key, props.caption); }
  get key(): string { return this._key; }
  get caption(): string | undefined { return this._caption; }
  toJSON(): MediaImageJSON { return this._caption ? { key: this._key, caption: this._caption } : { key: this._key }; }
  static fromJSON(json: MediaImageJSON): MediaImage { return new MediaImage(json.key, json.caption); }
}
```

- [ ] **Step 5: Vert.** Run: `cd apps/api && npx jest media-image.spec`. Expected: PASS.

- [ ] **Step 6: `storage.port.ts`.**

```ts
export const STORAGE_PORT = Symbol('STORAGE_PORT');
export interface SaveImageInput { bytes: Buffer; contentType: string; ext: string; }
export interface StoragePort {
  save(input: SaveImageInput): Promise<{ key: string }>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}
```

- [ ] **Step 7: `in-memory-storage.ts`.**

```ts
import { randomUUID } from 'crypto';
import { StoragePort, SaveImageInput } from './storage.port';

export class InMemoryStorage implements StoragePort {
  readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();
  async save(input: SaveImageInput): Promise<{ key: string }> {
    const key = `images/${randomUUID()}.${input.ext}`;
    this.objects.set(key, { bytes: input.bytes, contentType: input.contentType });
    return { key };
  }
  async remove(key: string): Promise<void> { this.objects.delete(key); }
  publicUrl(key: string): string { return `memory://${key}`; }
}
```

- [ ] **Step 8: Test rouge `UploadImageUseCase`.** Créer `upload-image.use-case.spec.ts` :

```ts
import { UploadImageUseCase, UnsupportedImageTypeError, ImageTooLargeError } from './upload-image.use-case';
import { InMemoryStorage } from './in-memory-storage';

describe('UploadImageUseCase', () => {
  it('accepte jpeg/png/webp et stocke → clé', async () => {
    const storage = new InMemoryStorage();
    const out = await new UploadImageUseCase(storage).execute({ bytes: Buffer.from('x'), contentType: 'image/png', actor: 'a' });
    expect(out.key).toMatch(/^images\/.+\.png$/);
    expect(storage.objects.has(out.key)).toBe(true);
  });
  it('rejette un type non supporté', async () => {
    await expect(new UploadImageUseCase(new InMemoryStorage()).execute({ bytes: Buffer.from('x'), contentType: 'application/pdf', actor: 'a' }))
      .rejects.toThrow(UnsupportedImageTypeError);
  });
  it('rejette > 5 Mo', async () => {
    await expect(new UploadImageUseCase(new InMemoryStorage()).execute({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1), contentType: 'image/jpeg', actor: 'a' }))
      .rejects.toThrow(ImageTooLargeError);
  });
});
```

- [ ] **Step 9: Lancer → échec.** Run: `cd apps/api && npx jest upload-image.use-case.spec`. Expected: FAIL.

- [ ] **Step 10: `upload-image.use-case.ts`.**

```ts
import { StoragePort } from './storage.port';

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

export class UnsupportedImageTypeError extends Error {
  constructor(t: string) { super(`Type d'image non supporté : ${t}`); this.name = 'UnsupportedImageTypeError'; }
}
export class ImageTooLargeError extends Error {
  constructor() { super('Image supérieure à 5 Mo'); this.name = 'ImageTooLargeError'; }
}

export interface UploadImageInput { bytes: Buffer; contentType: string; actor: string; }

export class UploadImageUseCase {
  constructor(private readonly storage: StoragePort) {}
  async execute(input: UploadImageInput): Promise<{ key: string }> {
    const ext = ALLOWED[input.contentType];
    if (!ext) throw new UnsupportedImageTypeError(input.contentType);
    if (input.bytes.length > MAX_BYTES) throw new ImageTooLargeError();
    return this.storage.save({ bytes: input.bytes, contentType: input.contentType, ext });
  }
}
```

- [ ] **Step 11: Vert.** Run: `cd apps/api && npx jest upload-image.use-case.spec`. Expected: PASS.

- [ ] **Step 12: `s3-storage.ts` (adapter R2).**

```ts
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StoragePort, SaveImageInput } from '../../application/media/storage.port';

export class S3Storage implements StoragePort {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
    opts: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle?: boolean },
  ) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      forcePathStyle: opts.forcePathStyle ?? false,
    });
  }
  async save(input: SaveImageInput): Promise<{ key: string }> {
    const key = `images/${randomUUID()}.${input.ext}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.bytes, ContentType: input.contentType }));
    return { key };
  }
  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  publicUrl(key: string): string { return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`; }

  static fromEnv(): S3Storage {
    return new S3Storage(
      process.env.S3_BUCKET ?? '',
      process.env.S3_PUBLIC_BASE_URL ?? '',
      {
        endpoint: process.env.S3_ENDPOINT ?? '',
        region: process.env.S3_REGION ?? 'auto',
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      },
    );
  }
}
```

- [ ] **Step 13: `media.controller.ts`.** (Mappe les erreurs domaine → 400.)

```ts
import { BadRequestException, Controller, Inject, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { UploadImageUseCase, UnsupportedImageTypeError, ImageTooLargeError } from '../../application/media/upload-image.use-case';

@Controller('media')
@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
export class MediaController {
  constructor(
    @Inject(UploadImageUseCase) private readonly upload: UploadImageUseCase,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadFile(@CurrentUser() user: { email: string }, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    try {
      const { key } = await this.upload.execute({ bytes: file.buffer, contentType: file.mimetype, actor: user.email });
      return { key, url: this.storage.publicUrl(key) };
    } catch (e) {
      if (e instanceof UnsupportedImageTypeError || e instanceof ImageTooLargeError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
```
**Note :** vérifier les chemins d'import réels des `AuthGuard`/`RolesGuard`/`Roles`/`CurrentUser` en s'alignant sur `zone.controller.ts` (mêmes imports). Ajuster si nécessaire.

- [ ] **Step 14: Enregistrer dans `crop.module.ts`.** (On réutilise `CropModule` — il porte déjà les guards + `ZoneController`/`PestController`.) Ajouter aux `providers` :

```ts
{ provide: STORAGE_PORT, useFactory: () => S3Storage.fromEnv() },
{ provide: UploadImageUseCase, useFactory: (s: StoragePort) => new UploadImageUseCase(s), inject: [STORAGE_PORT] },
```
Ajouter `MediaController` au tableau `controllers`. Importer `STORAGE_PORT`, `StoragePort`, `UploadImageUseCase`, `S3Storage`, `MediaController` en haut. (Ces providers restent disponibles pour les Tasks 2–3 qui injecteront `STORAGE_PORT` pour l'enrichissement URL.)

- [ ] **Step 15: `.env.example`.** Ajouter le bloc :

```
# Storage S3-compatible (Cloudflare R2)
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
# S3_FORCE_PATH_STYLE=true   # pour MinIO
```

- [ ] **Step 16: Typecheck + tests.** Run: `cd apps/api && npx tsc --noEmit && npx jest media`. Expected: aucune erreur ; suites `media` vertes.

- [ ] **Step 17: Commit.**
```bash
git add apps/api
git commit -m "feat(media): fondation storage — StoragePort + S3/InMemory + upload + POST /media"
```

---

### Task 2: Images de culture (API, event-sourcé)

**Files:**
- Modify: `apps/api/src/domain/crop/media-image` import + `crop-event.ts` + `crop.ts`
- Modify: `apps/api/prisma/schema.prisma` + Create migration `apps/api/prisma/migrations/20260719120000_crop_images/migration.sql`
- Modify: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts` (ou l'endroit du mapping snapshot)
- Modify: `apps/api/src/application/crop/crop-read-model.ts`
- Create: `apps/api/src/application/crop/set-crop-images.use-case.ts` + `.spec.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` + `crop.module.ts`
- Modify: `apps/api/src/domain/crop/crop.spec.ts` (round-trip event)

**Interfaces:** `Crop` gagne `images: MediaImage[]` (getter), `setImages(list)`, event `CropImagesSet`. `CropDocument.images: MediaImageJSON[]`. Endpoint `POST /crops/:id/images` body `{ images: MediaImageJSON[] }`.

**Miroir exact de `commercialization`** (voir `set-crop-commercialization.use-case.ts`, l'event `CommercializationSet`, et dans `crop.ts` les lignes citées par la cartographie). Reproduire le même câblage pour `images`.

- [ ] **Step 1: Test rouge — l'agrégat rejoue `CropImagesSet`.** Dans `crop.spec.ts`, ajouter un test : créer une culture, `crop.setImages([MediaImage.create({key:'images/a.jpg',caption:'x'})])`, rejouer via `Crop.fromEvents`, vérifier `crop.images[0].key==='images/a.jpg'` et que `toSnapshot().images` contient l'entrée ; vérifier round-trip `fromSnapshot(toSnapshot())`.

- [ ] **Step 2: Lancer → échec.** Run: `cd apps/api && npx jest crop.spec`. Expected: FAIL.

- [ ] **Step 3: Implémenter dans le domaine.** `crop-event.ts` : `| { type: 'CropImagesSet'; images: MediaImageJSON[] }`. Dans `crop.ts` : importer `MediaImage`/`MediaImageJSON` ; champ `_images: MediaImage[] = []` ; getter `get images()` ; `setImages(list: MediaImage[])` → `this.raise({ type:'CropImagesSet', images: list.map(i=>i.toJSON()) })` ; `apply('CropImagesSet')` → `this._images = e.images.map(MediaImage.fromJSON); this._version += 1; this._hasUnpublishedChanges = true;` ; `toSnapshot().images = this._images.map(i=>i.toJSON())` ; `fromSnapshot` → `(s.images ?? []).map(MediaImage.fromJSON)` ; `CropSnapshot.images: MediaImageJSON[]` ; **Checkpoint** capture `images:[...this._images]` + restore. Aligner sur `commercialization`.

- [ ] **Step 4: Vert domaine.** Run: `cd apps/api && npx jest crop.spec`. Expected: PASS.

- [ ] **Step 5: Migration Prisma.** `schema.prisma` modèle `Crop` : ajouter `images Json?` (après `commercialization`). Créer `20260719120000_crop_images/migration.sql` :
```sql
ALTER TABLE "Crop" ADD COLUMN "images" JSONB;
```
Appliquer : `cd apps/api && npx prisma db execute --file prisma/migrations/20260719120000_crop_images/migration.sql --schema prisma/schema.prisma && npx prisma migrate resolve --applied 20260719120000_crop_images && npx prisma generate && npx prisma migrate status`. Expected : « up to date ».

- [ ] **Step 6: Repo crop.** Là où le snapshot Crop est mappé (colonnes JSON `commercialization`, `yields`…), ajouter `images` dans les deux sens (`toRow`/`toSnapshot` ou équivalent), défaut `[]`.

- [ ] **Step 7: Read-model passe-plat (PAS de complétude).** `crop-read-model.ts` : `CropDocument.images: MediaImageJSON[]` ; `const images = s.images ?? []` ; l'inclure dans l'objet retourné. **NE PAS** l'ajouter à `computeCompleteness`/`CompletenessInput`.

- [ ] **Step 8: Use-case + test.** `set-crop-images.use-case.ts` = copie de `set-crop-commercialization.use-case.ts` (renommer, `setImages`, audit `images`). `.spec.ts` : set images → `List/GetCrop` expose les images. (Suivre le spec existant de commercialization.)

- [ ] **Step 9: Endpoint + DI.** `crop.controller.ts` : `@Post(':id/images')` `@Body() body:{ images:{key:string;caption?:string}[] }` → `setCropImages.execute({ cropId:id, images:body.images, actor:user.email })`. `crop.module.ts` : provider `SetCropImagesUseCase` (inject `[CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK]`, comme commercialization).

- [ ] **Step 10: Enrichissement URL (présentation).** Là où le contrôleur renvoie le `CropDocument` (get brouillon + published), mapper `images: doc.images.map(i => ({ key:i.key, url: storage.publicUrl(i.key), caption:i.caption }))`. Injecter `@Inject(STORAGE_PORT) storage` dans `CropController`. Créer un helper partagé `toImageDto(img, storage)` dans `presentation/media/` réutilisable Tasks 2–3.

- [ ] **Step 11: Typecheck + tests + migrate status.** Run: `cd apps/api && npx tsc --noEmit && npx jest crop && npx prisma migrate status`. Expected: verts ; complétude toujours à 11 catégories (non modifiée).

- [ ] **Step 12: Commit.**
```bash
git add apps/api
git commit -m "feat(crop): section images event-sourcée (CropImagesSet) + endpoint + URL dérivée"
```

---

### Task 3: Images de zone & ravageur (API, CRUD)

**Files:**
- Modify: `apps/api/src/domain/zone/agro-ecological-zone.ts` + `.spec.ts`
- Modify: `apps/api/src/application/zone/create-zone.use-case.ts`, `update-zone.use-case.ts` (+ specs)
- Modify: `apps/api/src/presentation/zone/zone.controller.ts`
- Modify: `apps/api/src/infrastructure/zone/prisma-zone.repository.ts`
- Modify: `apps/api/prisma/schema.prisma` + Create `apps/api/prisma/migrations/20260719120100_zone_images/migration.sql`
- Modify: `apps/api/src/domain/pest/pest-disease.ts` + `.spec.ts`
- Modify: `apps/api/src/application/pest/create-pest.use-case.ts`, `update-pest.use-case.ts` (+ specs)
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`

**Interfaces:** `AgroEcologicalZone` et `PestDisease` gagnent `images: MediaImage[]` ; create/update inputs + controllers acceptent `images?: MediaImageJSON[]`. Lectures enrichissent `url` via `toImageDto`.

- [ ] **Step 1: Test rouge Zone.** Dans `agro-ecological-zone.spec.ts` : `create({..., images:[{key:'images/z.jpg'}]})` → `toSnapshot().images` contient l'entrée ; `update({ name, country, koppen, images:[...] })` remplace `images` ; round-trip `fromSnapshot`.

- [ ] **Step 2: Zone domaine.** `ZoneSnapshot.images: MediaImageJSON[]` ; champ `_images: MediaImage[]` ; `create` accepte `images?` (défaut `[]`) ; `update({ name, country, koppen, images })` remplace aussi `_images` (défaut : conserver si non fourni — accepter `images?` et ne remplacer que si défini) ; `toSnapshot`/`fromSnapshot` map `images` (défaut `[]`). Lancer `npx jest agro-ecological-zone.spec` → PASS.

- [ ] **Step 3: Zone use-cases + controller.** `CreateZoneInput`/`UpdateZoneInput` gagnent `images?: MediaImageJSON[]` (convertir en `MediaImage[]` pour le VO). `zone.controller` POST + PATCH bodies gagnent `images?: {key:string;caption?:string}[]`, passés aux use-cases. Mettre à jour les specs des use-cases (ajouter `images` dans un cas).

- [ ] **Step 4: Zone migration + repo.** `schema.prisma` `AgroEcologicalZone` : `images Json?`. Migration `20260719120100_zone_images/migration.sql` : `ALTER TABLE "AgroEcologicalZone" ADD COLUMN "images" JSONB;` puis db execute + resolve + generate + status. Repo `toRow`/`toSnapshot` map `images` (défaut `[]`).

- [ ] **Step 5: Test rouge Pest.** Dans `pest-disease.spec.ts` : remplacer les usages `photos:string[]` par `images: MediaImageJSON[]` ; `create({..., images:[{key:'images/p.jpg',caption:'Larve'}]})` → snapshot ; `update({ name, type, scientificName, images:[...] })` remplace `images` ; round-trip.

- [ ] **Step 6: Pest domaine.** `PestDiseaseSnapshot` : remplacer `photos: string[]` par `images: MediaImageJSON[]`. Champ `_images: MediaImage[]` (remplace `_photos`). `create` accepte `images?` (défaut `[]`). `update({ name, type, scientificName, images? })` remplace `_images` si fourni. `toSnapshot().images` / `fromSnapshot` (`(s.images ?? []).map(MediaImage.fromJSON)`). Lancer `npx jest pest-disease.spec` → PASS.

- [ ] **Step 7: Pest use-cases + controller.** `CreatePestInput` : `photos?: string[]` → `images?: MediaImageJSON[]`. `UpdatePestInput` gagne `images?: MediaImageJSON[]`. `pest.controller` POST body `photos?` → `images?: {key;caption?}[]` ; PATCH body gagne `images?`. Passer aux use-cases. Mettre à jour les specs.

- [ ] **Step 8: Pest repo (réutilise la colonne `photos`).** `prisma-pest.repository.ts` : `toRow` → `photos: p.images as unknown as Prisma.InputJsonValue` (la colonne DB reste `photos`, elle stocke maintenant `MediaImageJSON[]`) ; `toSnapshot` → `images: (row.photos ?? []) as unknown as MediaImageJSON[]`. **Pas** de migration Pest.

- [ ] **Step 9: Enrichissement URL lectures Zone/Pest.** Endpoints `GET /zones`, `GET /pests` (et get-by-id le cas échéant) : mapper `images` via `toImageDto(img, storage)` (injecter `STORAGE_PORT` dans `ZoneController`/`PestController`). Les DTO renvoient `{ key, url, caption? }`.

- [ ] **Step 10: Typecheck + tests + status.** Run: `cd apps/api && npx tsc --noEmit && npx jest zone pest && npx prisma migrate status`. Expected: verts ; « up to date ».

- [ ] **Step 11: Commit.**
```bash
git add apps/api
git commit -m "feat(zone,pest): galerie d'images (zone: colonne images ; pest: réutilise photos)"
```

---

### Task 4: Admin — plomberie upload + composant galerie

**Files:**
- Modify: `apps/admin/src/lib/http.ts` (`multipartInit`)
- Modify: `apps/admin/src/lib/actions.ts` (`uploadImage`, `setCropImages`) + les actions zone/pest pour transmettre `images`
- Create: `apps/admin/src/components/ImageGalleryUploader.tsx`
- Modify: `apps/admin/src/lib/api.ts` (`ImageRef` ; `Zone`/`Pest`/`CropDetail` gagnent `images`)

**Interfaces:** `ImageRef = { key: string; url: string; caption?: string }`. `<ImageGalleryUploader value={ImageRef[]} onChange={(v)=>...} />`. `uploadImage(fd) → { key, url }`.

- [ ] **Step 1: `multipartInit` (http.ts).**
```ts
export function multipartInit(method: string, fd: FormData): RequestInit {
  return { method, body: fd }; // pas de Content-Type : le navigateur pose la boundary multipart
}
```

- [ ] **Step 2: Server Action `uploadImage` (actions.ts).**
```ts
export async function uploadImage(fd: FormData): Promise<{ key: string; url: string }> {
  const res = await authFetch('/media', multipartInit('POST', fd));
  return res.json();
}
```
Importer `multipartInit`. Ajouter aussi `setCropImages(cropId, images: { key: string; caption?: string }[])` → `authFetch('/crops/${cropId}/images', jsonInit('POST', { images }))`.

- [ ] **Step 3: `lib/api.ts` types.** Ajouter `export interface ImageRef { key: string; url: string; caption?: string }`. `Zone`, `Pest`, `CropDetail` gagnent `images: ImageRef[]`.

- [ ] **Step 4: `ImageGalleryUploader.tsx` (client).**

```tsx
'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadImage } from '@/lib/actions';
import type { ImageRef } from '@/lib/api';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024;

export function ImageGalleryUploader({ value, onChange }: { value: ImageRef[]; onChange: (v: ImageRef[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError('Formats acceptés : JPG, PNG, WebP.'); return; }
    if (file.size > MAX) { setError('Image trop lourde (max 5 Mo).'); return; }
    setError(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { key, url } = await uploadImage(fd);
      onChange([...value, { key, url, caption: '' }]);
    } catch { setError("Échec de l'upload."); }
    finally { setBusy(false); }
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setCaption = (i: number, caption: string) => onChange(value.map((img, k) => (k === i ? { ...img, caption } : img)));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((img, i) => (
          <div key={img.key} className="w-32 space-y-1 rounded-md border p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption || ''} className="h-20 w-full rounded object-cover" />
            <Input className="h-7 text-xs" placeholder="légende" value={img.caption ?? ''} onChange={(e) => setCaption(i, e.target.value)} />
            <div className="flex justify-between">
              <button type="button" className="text-xs text-muted-foreground" onClick={() => move(i, -1)} disabled={i === 0}>←</button>
              <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
              <button type="button" className="text-xs text-muted-foreground" onClick={() => move(i, 1)} disabled={i === value.length - 1}>→</button>
            </div>
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={onFile} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Envoi…' : '+ Ajouter une image'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Actions zone/pest transmettent `images`.** Dans `actions.ts`, étendre `createZone`/`updateZone` et `createPest`/`updatePest` pour accepter et transmettre `images: { key: string; caption?: string }[]` dans le body (aligné aux nouveaux champs API Task 3).

- [ ] **Step 6: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 7: Commit.**
```bash
git add apps/admin
git commit -m "feat(admin): plomberie upload multipart + ImageGalleryUploader réutilisable"
```

---

### Task 5: Admin — câblage éditeurs + affichage

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/ImagesEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (carte Photos)
- Modify: `apps/admin/src/app/zones/new/page.tsx`, `apps/admin/src/app/zones/ZoneRowActions.tsx`
- Modify: `apps/admin/src/app/pests/new/page.tsx`, `apps/admin/src/app/pests/PestRowActions.tsx`
- Modify: `apps/admin/src/app/crops/[id]/FicheClientView.tsx` (hero 1ʳᵉ image + section Photos + vignettes zones/ravageurs)
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx` (vignettes)
- Modify: `apps/admin/src/app/zones/page.tsx`, `apps/admin/src/app/pests/page.tsx` (vignette par ligne)

- [ ] **Step 1: `ImagesEditor.tsx` (culture).** Éditeur (via `EditorShell`) contenant `<ImageGalleryUploader value={current} onChange={setLocal} />` + bouton Enregistrer → `setCropImages(cropId, local.map(i => ({ key: i.key, caption: i.caption })))`. Props `{ cropId, current: ImageRef[] }`.

- [ ] **Step 2: Monter sur `crops/[id]/page.tsx`.** Ajouter une carte « Photos ({crop.images.length}) » avec `<ImagesEditor cropId={params.id} current={crop.images ?? []} />` + un aperçu des vignettes (comme les autres cartes de section).

- [ ] **Step 3: Zone forms.** Dans `zones/new/page.tsx` et `ZoneRowActions.tsx` : état `images: ImageRef[]` (initialisé depuis `zone.images ?? []` en édition) + `<ImageGalleryUploader>` ; transmettre `images.map(i=>({key:i.key,caption:i.caption}))` à `createZone`/`updateZone`.

- [ ] **Step 4: Pest forms.** Idem dans `pests/new/page.tsx` et `PestRowActions.tsx`.

- [ ] **Step 5: Affichage fiche client.** `FicheClientView.tsx` : si `crop.images?.length`, le hero affiche `crop.images[0].url` (à la place de l'encart « Photo à venir ») ; ajouter une **section « Photos »** (icône `Images` lucide) avec la galerie (miniatures + légendes). Dans la section Zones, afficher les vignettes de `z.images` ; dans Ravageurs, celles de `p.images`. (Ces objets doivent exposer `images` — s'assurer que les DTO zone/pest de la fiche les portent ; sinon afficher rien.)

- [ ] **Step 6: Vue publiée + listes.** `CropReadView.tsx` : petite rangée de vignettes dans une carte « Photos » si présentes. `zones/page.tsx` + `pests/page.tsx` : vignette (première image) par ligne si dispo.

- [ ] **Step 7: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 8: Commit.**
```bash
git add apps/admin
git commit -m "feat(admin): galeries d'images branchées (culture/zone/ravageur) + affichage fiche/listes"
```

---

### Task 6: Vérification finale

**Files:** aucun.

- [ ] **Step 1: Suite API complète.** ⚠️ **efface la DB dev.** Run: `pnpm --filter @okko/api test`. Expected: toutes suites vertes ; complétude inchangée (images non comptées).
- [ ] **Step 2: `migrate status`.** Run: `cd apps/api && npx prisma migrate status`. Expected: « up to date » (2 nouvelles migrations : crop_images, zone_images).
- [ ] **Step 3: Admin.** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit && pnpm build`. Expected: verts + « Compiled successfully ».
- [ ] **Step 4: Smoke manuel (à relayer à l'utilisateur).** Configurer R2 (env) → uploader une image sur une culture, une zone, un ravageur → vérifier stockage R2, affichage fiche (hero + galerie), vignettes zones/ravageurs, listes ; réordonner + légender ; supprimer.
