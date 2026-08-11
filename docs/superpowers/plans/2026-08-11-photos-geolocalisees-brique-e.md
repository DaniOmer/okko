# Module 2 / Brique E « Photos géolocalisées » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacher des photos (réutilisant `MediaImage`) et une position GPS optionnelle aux opérations du journal, avec capture navigateur pré-remplie depuis le GPS de la parcelle, et affichage vignettes + repère dans la timeline.

**Architecture:** 3 champs additifs sur `OperationLog` (`photos: MediaImageJSON[]`, `gpsLat?`, `gpsLng?`) suivant exactement la mécanique de `inputs` (JSON) et des champs optionnels existants. Le contrôleur injecte `StoragePort` et convertit `photos[].key` → URL via `toImageDto` sur toutes les réponses (comme `zone.controller`). `POST /media` s'ouvre aux 3 rôles d'écriture tenant par un `@Roles` method-level (technique des briques A/B). Côté admin, on rebranche `ImageGalleryUploader` et l'action `uploadImage` existants, plus un bouton de géolocalisation navigateur.

**Tech Stack:** NestJS + Prisma (Postgres) + Jest (API) ; Next.js App Router + shadcn/ui + TypeScript (admin).

**Spec de référence :** `docs/superpowers/specs/2026-08-11-photos-geolocalisees-brique-e-design.md`

## Global Constraints

- `organizationId` et `recordedByUserId` proviennent TOUJOURS du JWT (`@CurrentUser()`), jamais du body. Inchangé par cette brique.
- Migration Prisma **additive** uniquement. NE JAMAIS lancer `prisma migrate dev`, `prisma migrate reset` ni `prisma db push` (ils réinitialisent la base de dev). Créer le dossier `migration.sql` à la main, puis `npx prisma generate` (régénère seulement le client, ne touche pas la base).
- **La suite de tests API complète est destructrice** (efface la base de dev, pas de `.env.test`). Ne lancer QUE les specs ciblées par chemin exact (elles utilisent des repos in-memory, aucune I/O). NE JAMAIS lancer `npx jest` seul.
- Portes de type-check : `npx tsc --noEmit` vert côté API **et** côté admin.
- `photos` est optionnel sur le snapshot domaine (`photos?: MediaImageJSON[]`) pour ne pas casser les fixtures littérales existantes ; `create` pose toujours `photos: input.photos ?? []`, la colonne a un défaut `'[]'`, et les réponses API mappent toujours `(op.photos ?? [])` → tableau.
- Apostrophes : n'écrire AUCUNE apostrophe courbe (`’`) dans un littéral JS entre guillemets simples (casse le parse TS). Utiliser guillemets doubles ou backticks pour les libellés français, et `&apos;`/`&rsquo;` dans le JSX texte comme le code existant.
- Rôles d'écriture tenant = `ORG_ADMIN`, `AGRONOMIST`, `FIELD_AGENT`. Rôles plateforme = `superadmin`, `admin`, `editor`.
- Messages de commit terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**API**
- `apps/api/src/domain/parcel/operation-log.ts` — +3 champs sur `OperationLogSnapshot`.
- `apps/api/src/application/parcel/operation-log.use-cases.ts` — inputs + create/update.
- `apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts` — `toSnap`/`save` + `Row`.
- `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/20260811130000_operation_log_photos_gps/migration.sql` — colonnes.
- `apps/api/src/application/parcel/operation-log.use-cases.spec.ts` — round-trip photos + gps.
- `apps/api/src/presentation/parcel/operation-log.controller.ts` — `OpBody` + injection `StoragePort` + `toImageDto` sur les réponses.
- `apps/api/src/suivi.module.ts` — provider `STORAGE_PORT`.
- `apps/api/src/presentation/media/media.controller.ts` — ouverture `POST /media` aux rôles tenant.
- `apps/api/src/presentation/media/media-roles.spec.ts` (create) — métadonnées `@Roles`.

**Admin**
- `apps/admin/src/lib/api.ts` — `OperationLog` (+`photos`/`gpsLat`/`gpsLng`).
- `apps/admin/src/lib/suivi-actions.ts` — `OperationPayload` (+3 champs).
- `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx` — uploader + GPS + capture.
- `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationEditor.client.tsx` — prop `parcelGps`, prefill.
- `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx` — fetch parcelle → GPS, vignettes + repère.

---

## Task 1: API — champs `photos`/`gps` (domaine, use-cases, persistance, migration)

**Files:**
- Modify: `apps/api/src/domain/parcel/operation-log.ts`
- Modify: `apps/api/src/application/parcel/operation-log.use-cases.ts`
- Modify: `apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts`
- Modify: `apps/api/prisma/schema.prisma:326-340`
- Create: `apps/api/prisma/migrations/20260811130000_operation_log_photos_gps/migration.sql`
- Test: `apps/api/src/application/parcel/operation-log.use-cases.spec.ts`

**Interfaces:**
- Consumes: `MediaImageJSON` de `../../domain/media/media-image` (`{ key, caption?, category? }`).
- Produces (utilisés par Task 2) :
  - `OperationLogSnapshot` gagne `photos?: MediaImageJSON[]`, `gpsLat?: number`, `gpsLng?: number`.
  - `CreateOperationLogInput` / `UpdateOperationLogInput` gagnent `photos?: MediaImageJSON[]`, `gpsLat?: number`, `gpsLng?: number`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/api/src/application/parcel/operation-log.use-cases.spec.ts`, ajouter ces deux `it` à l'intérieur du `describe` existant (après le dernier `it`) :

```ts
  it('create persiste photos + gpsLat/gpsLng et se relit (round-trip)', async () => {
    const { create, list, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.PLANTING, date: '2026-05-01', recordedByUserId: 'u1', photos: [{ key: 'images/a.jpg', caption: 'plant' }], gpsLat: 6.37, gpsLng: 2.42 });
    expect(op.photos).toEqual([{ key: 'images/a.jpg', caption: 'plant' }]);
    expect(op.gpsLat).toBe(6.37);
    expect(op.gpsLng).toBe(2.42);
    const relu = await list.execute({ organizationId: 'o1', campaignId: 'c1' });
    expect(relu[0].photos).toEqual([{ key: 'images/a.jpg', caption: 'plant' }]);
    expect(relu[0].gpsLat).toBe(6.37);
    expect(relu[0].gpsLng).toBe(2.42);
  });

  it('create sans photos → photos: []', async () => {
    const { create, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.WEEDING, date: '2026-05-01', recordedByUserId: 'u1' });
    expect(op.photos).toEqual([]);
  });
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd apps/api && npx jest src/application/parcel/operation-log.use-cases.spec.ts`
Expected: FAIL (les deux nouveaux `it` échouent — `op.photos` vaut `undefined`, `op.gpsLat` vaut `undefined`).

- [ ] **Step 3: Ajouter les 3 champs au snapshot domaine**

Dans `apps/api/src/domain/parcel/operation-log.ts`, ajouter l'import et les 3 champs. Fichier résultant complet :

```ts
import { OperationType } from '../window/operation-type';
import { MediaImageJSON } from '../media/media-image';

export interface OperationInput { product: string; quantity?: number; unit?: string; cost?: number; }

export interface OperationLogSnapshot {
  id: string;
  organizationId: string;
  campaignId: string;
  type: OperationType;
  date: string;
  inputs: OperationInput[];
  laborCost?: number;
  notes?: string;
  photos?: MediaImageJSON[];
  gpsLat?: number;
  gpsLng?: number;
  recordedByUserId: string;
  createdAt: string;
}
```

- [ ] **Step 4: Étendre les use-cases (inputs + create + update)**

Dans `apps/api/src/application/parcel/operation-log.use-cases.ts` :

Ajouter `MediaImageJSON` à l'import du snapshot :
```ts
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { MediaImageJSON } from '../../domain/media/media-image';
```

Étendre les deux interfaces d'input :
```ts
export interface CreateOperationLogInput {
  organizationId: string; campaignId: string; type: OperationType; date: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string;
  photos?: MediaImageJSON[]; gpsLat?: number; gpsLng?: number;
  recordedByUserId: string;
}
export interface UpdateOperationLogInput {
  id: string; organizationId: string; type?: OperationType; date?: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string;
  photos?: MediaImageJSON[]; gpsLat?: number; gpsLng?: number;
}
```

Dans `CreateOperationLogUseCase.execute`, compléter la construction du snapshot :
```ts
    const snap: OperationLogSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, campaignId: input.campaignId,
      type: input.type, date: input.date, inputs: input.inputs ?? [], laborCost: input.laborCost,
      notes: input.notes, photos: input.photos ?? [], gpsLat: input.gpsLat, gpsLng: input.gpsLng,
      recordedByUserId: input.recordedByUserId, createdAt: this.clock.nowIso(),
    };
```

Dans `UpdateOperationLogUseCase.execute`, compléter le snapshot via `keep` :
```ts
    const snap: OperationLogSnapshot = {
      ...existing,
      type: keep(input.type, existing.type), date: keep(input.date, existing.date),
      inputs: keep(input.inputs, existing.inputs), laborCost: keep(input.laborCost, existing.laborCost),
      notes: keep(input.notes, existing.notes),
      photos: keep(input.photos, existing.photos), gpsLat: keep(input.gpsLat, existing.gpsLat), gpsLng: keep(input.gpsLng, existing.gpsLng),
    };
```

- [ ] **Step 5: Mapper photos + gps dans la persistance Prisma**

Dans `apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts` :

Ajouter `MediaImageJSON` à l'import domaine :
```ts
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { MediaImageJSON } from '../../domain/media/media-image';
```

Étendre le type `Row` :
```ts
type Row = { id: string; organizationId: string; campaignId: string; type: string; date: string; inputs: Prisma.JsonValue; laborCost: number | null; notes: string | null; photos: Prisma.JsonValue; gpsLat: number | null; gpsLng: number | null; recordedByUserId: string; createdAt: Date };
```

Compléter `toSnap` (ajouter photos/gpsLat/gpsLng avant `recordedByUserId`) :
```ts
  private toSnap(r: Row): OperationLogSnapshot {
    return { id: r.id, organizationId: r.organizationId, campaignId: r.campaignId, type: r.type as OperationType, date: r.date, inputs: (r.inputs ?? []) as unknown as OperationInput[], laborCost: r.laborCost ?? undefined, notes: r.notes ?? undefined, photos: (r.photos ?? []) as unknown as MediaImageJSON[], gpsLat: r.gpsLat ?? undefined, gpsLng: r.gpsLng ?? undefined, recordedByUserId: r.recordedByUserId, createdAt: r.createdAt.toISOString() };
  }
```

Compléter `save` (ajouter photos/gpsLat/gpsLng dans `data`) :
```ts
    const data = { id: o.id, organizationId: o.organizationId, campaignId: o.campaignId, type: o.type, date: o.date, inputs: (o.inputs ?? []) as unknown as Prisma.InputJsonValue, laborCost: o.laborCost ?? null, notes: o.notes ?? null, photos: (o.photos ?? []) as unknown as Prisma.InputJsonValue, gpsLat: o.gpsLat ?? null, gpsLng: o.gpsLng ?? null, recordedByUserId: o.recordedByUserId };
```

- [ ] **Step 6: Étendre le schéma Prisma**

Dans `apps/api/prisma/schema.prisma`, modèle `OperationLog` (lignes 326-340), ajouter les 3 colonnes après `notes` :

```prisma
model OperationLog {
  id               String   @id
  organizationId   String
  campaignId       String
  type             String
  date             String
  inputs           Json
  laborCost        Float?
  notes            String?
  photos           Json     @default("[]")
  gpsLat           Float?
  gpsLng           Float?
  recordedByUserId String
  createdAt        DateTime @default(now())

  @@index([organizationId])
  @@index([campaignId])
}
```

- [ ] **Step 7: Créer la migration SQL (additive, à la main)**

Créer `apps/api/prisma/migrations/20260811130000_operation_log_photos_gps/migration.sql` :

```sql
ALTER TABLE "OperationLog" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "gpsLat" DOUBLE PRECISION, ADD COLUMN "gpsLng" DOUBLE PRECISION;
```

- [ ] **Step 8: Régénérer le client Prisma (ne touche pas la base)**

Run: `cd apps/api && npx prisma generate`
Expected: « Generated Prisma Client » — le type `operationLog` connaît désormais `photos`/`gpsLat`/`gpsLng`.

- [ ] **Step 9: Lancer le test ciblé — il passe**

Run: `cd apps/api && npx jest src/application/parcel/operation-log.use-cases.spec.ts`
Expected: PASS (tous les `it`, dont les 2 nouveaux).

- [ ] **Step 10: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/domain/parcel/operation-log.ts apps/api/src/application/parcel/operation-log.use-cases.ts apps/api/src/application/parcel/operation-log.use-cases.spec.ts apps/api/src/infrastructure/parcel/prisma-operation-log.repository.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260811130000_operation_log_photos_gps/migration.sql
git commit -m "feat(suivi): OperationLog porte photos + GPS (domaine, use-cases, persistance, migration)"
```

---

## Task 2: API — contrôleur (photos→URL) + ouverture `POST /media` aux rôles tenant

**Files:**
- Modify: `apps/api/src/presentation/parcel/operation-log.controller.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Modify: `apps/api/src/presentation/media/media.controller.ts:26`
- Test: `apps/api/src/presentation/media/media-roles.spec.ts` (create)

**Interfaces:**
- Consumes (de Task 1) : `OperationLogSnapshot.photos?: MediaImageJSON[]`, `CreateOperationLogInput`/`UpdateOperationLogInput` avec `photos?`/`gpsLat?`/`gpsLng?`.
- Consumes (existant) : `toImageDto(img, storage)` de `../media/image-dto` ; `STORAGE_PORT`/`StoragePort` de `../../application/media/storage.port` ; `S3Storage.fromEnv()` de `./infrastructure/media/s3-storage` ; `ROLES_KEY` de `../auth/decorators`.
- Produces : réponses `GET`/`POST`/`PATCH /operations` avec `photos: ImageDto[]` (`{ key, url, caption?, category? }`). `POST /media` accepte les 3 rôles d'écriture tenant.

- [ ] **Step 1: Écrire le test de métadonnées `@Roles` (échoue)**

Créer `apps/api/src/presentation/media/media-roles.spec.ts` :

```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { MediaController } from './media.controller';

const reflector = new Reflector();

describe('MediaController — upload ouvert aux rôles tenant (écriture)', () => {
  it('POST /media porte les rôles plateforme ET les 3 rôles tenant écriture', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, MediaController.prototype.uploadFile);
    expect(roles).toContain('superadmin');
    expect(roles).toContain('admin');
    expect(roles).toContain('editor');
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('AGRONOMIST');
    expect(roles).toContain('FIELD_AGENT');
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/presentation/media/media-roles.spec.ts`
Expected: FAIL (`roles` est `undefined` — pas de `@Roles` method-level, seul le class-level `superadmin` s'applique).

- [ ] **Step 3: Ouvrir `POST /media` aux rôles tenant (method-level override)**

Dans `apps/api/src/presentation/media/media.controller.ts`, ajouter un `@Roles(...)` juste au-dessus de `@Post()` sur `uploadFile` :

```ts
  @Post()
  @Roles('superadmin', 'admin', 'editor', 'ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadFile(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
```

(`@Roles` est déjà importé dans ce fichier ; le class-level `@Roles('superadmin')` reste, l'override method-level le remplace pour ce handler.)

- [ ] **Step 4: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/presentation/media/media-roles.spec.ts`
Expected: PASS.

- [ ] **Step 5: Injecter `StoragePort` + convertir photos→URL dans le contrôleur opérations**

Dans `apps/api/src/presentation/parcel/operation-log.controller.ts` :

Compléter les imports (ajouter `Inject` à `@nestjs/common`, plus 3 imports) :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode, Inject } from '@nestjs/common';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { toImageDto } from '../media/image-dto';
import { OperationInput, OperationLogSnapshot } from '../../domain/parcel/operation-log';
```
(Remplacer la ligne `import { OperationInput } from '../../domain/parcel/operation-log';` par la version ci-dessus qui ajoute `OperationLogSnapshot`.)

Étendre `OpBody` :
```ts
type OpBody = { campaignId: string; type: OperationType; date: string; inputs?: OperationInput[]; laborCost?: number; notes?: string; photos?: { key: string; caption?: string }[]; gpsLat?: number; gpsLng?: number };
```

Ajouter `StoragePort` au constructeur :
```ts
  constructor(
    private readonly listUC: ListOperationsByCampaignUseCase,
    private readonly createUC: CreateOperationLogUseCase,
    private readonly updateUC: UpdateOperationLogUseCase,
    private readonly deleteUC: DeleteOperationLogUseCase,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}
```

Ajouter la méthode privée de mapping (juste après `private org(...)`) :
```ts
  private toResponse(op: OperationLogSnapshot) {
    return { ...op, photos: (op.photos ?? []).map((p) => toImageDto(p, this.storage)) };
  }
```

Appliquer `toResponse` sur les 3 réponses qui exposent une opération :
```ts
  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('campaignId') campaignId: string) {
    if (!campaignId) throw new BadRequestException('campaignId requis');
    const ops = await this.listUC.execute({ organizationId: this.org(user), campaignId });
    return ops.map((o) => this.toResponse(o));
  }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: OpBody) {
    try { return this.toResponse(await this.createUC.execute({ organizationId: this.org(user), recordedByUserId: user.sub, ...body })); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new BadRequestException('campagne invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<Omit<OpBody, 'campaignId'>>) {
    try { return this.toResponse(await this.updateUC.execute({ id, organizationId: this.org(user), ...body })); }
    catch (e) { if (e instanceof OperationLogNotFoundError) throw new NotFoundException(); throw e; }
  }
```
(`remove` / `@Delete` inchangé — 204, pas de corps.)

- [ ] **Step 6: Fournir `STORAGE_PORT` au `SuiviModule`**

Dans `apps/api/src/suivi.module.ts`, ajouter deux imports (après les imports existants, ex. après la ligne 25) :
```ts
import { STORAGE_PORT } from './application/media/storage.port';
import { S3Storage } from './infrastructure/media/s3-storage';
```

Puis ajouter le provider dans le tableau `providers: [...]` (n'importe où dans la liste, par ex. juste après la ligne `{ provide: OPERATION_LOG_REPOSITORY, useClass: PrismaOperationLogRepository },`) :
```ts
    { provide: STORAGE_PORT, useFactory: () => S3Storage.fromEnv() },
```

- [ ] **Step 7: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur (le contrôleur résout `STORAGE_PORT` fourni par le module ; `OpBody.photos` `{ key, caption? }[]` est assignable à `MediaImageJSON[]`).

- [ ] **Step 8: Re-lancer les tests ciblés touchés**

Run: `cd apps/api && npx jest src/presentation/media/media-roles.spec.ts src/presentation/parcel/operation-log-roles.spec.ts`
Expected: PASS (les rôles du contrôleur opérations sont inchangés ; le test média passe).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/presentation/parcel/operation-log.controller.ts apps/api/src/suivi.module.ts apps/api/src/presentation/media/media.controller.ts apps/api/src/presentation/media/media-roles.spec.ts
git commit -m "feat(suivi): réponses opérations photos→URL + ouverture POST /media aux rôles tenant"
```

---

## Task 3: Admin — formulaire opération (photos + GPS + capture) + types

**Files:**
- Modify: `apps/admin/src/lib/api.ts:157`
- Modify: `apps/admin/src/lib/suivi-actions.ts:51`
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx`
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationEditor.client.tsx`

**Interfaces:**
- Consumes (existant) : `ImageRef` (`{ key, url, caption?, category? }`) et `ImageGalleryUploader` (`{ value: ImageRef[]; onChange: (v: ImageRef[]) => void; categories? }`) qui uploade via l'action `uploadImage` (`POST /media`, désormais ouvert aux rôles tenant par Task 2).
- Produces (utilisés par Task 4) :
  - `OperationLog` gagne `photos: ImageRef[]`, `gpsLat?: number`, `gpsLng?: number`.
  - `OperationEditor` accepte une prop `parcelGps?: { lat?: number; lng?: number }`.

- [ ] **Step 1: Étendre le type `OperationLog` (client API)**

Dans `apps/admin/src/lib/api.ts`, remplacer l'interface `OperationLog` (ligne 157) par :
```ts
export interface OperationLog { id: string; organizationId: string; campaignId: string; type: string; date: string; inputs: OperationInput[]; laborCost?: number; notes?: string; photos: ImageRef[]; gpsLat?: number; gpsLng?: number; recordedByUserId: string; createdAt: string; }
```
(`ImageRef` est déjà défini dans ce fichier, ligne 7.)

- [ ] **Step 2: Étendre `OperationPayload`**

Dans `apps/admin/src/lib/suivi-actions.ts`, remplacer la ligne 51 par :
```ts
export type OperationPayload = { campaignId?: string; type?: string; date?: string; inputs?: OperationInput[]; laborCost?: number; notes?: string; photos?: { key: string; caption?: string }[]; gpsLat?: number; gpsLng?: number };
```

- [ ] **Step 3: Étendre le formulaire (valeur, payload, UI photos + GPS)**

Réécrire `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx` en entier :

```tsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import { OPERATION_TYPE_LABELS } from '@/lib/labels';
import type { OperationInput, ImageRef } from '@/lib/api';

type InputRow = OperationInput & { _k?: string };
export interface OperationFormValue { type: string; date: string; inputs: InputRow[]; laborCost: string; notes: string; photos: ImageRef[]; lat: string; lng: string; }
export const emptyOperation = (): OperationFormValue => ({ type: 'PLANTING', date: '', inputs: [], laborCost: '', notes: '', photos: [], lat: '', lng: '' });
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
export const operationToPayload = (v: OperationFormValue) => ({
  type: v.type, date: v.date,
  inputs: v.inputs.filter((i) => i.product.trim() !== '').map((i) => ({ product: i.product, quantity: i.quantity, unit: i.unit, cost: i.cost })),
  laborCost: num(v.laborCost),
  notes: v.notes || undefined,
  photos: v.photos.map((p) => ({ key: p.key, caption: p.caption })),
  gpsLat: num(v.lat),
  gpsLng: num(v.lng),
});

export function OperationFields({ value, onChange }: { value: OperationFormValue; onChange: (v: OperationFormValue) => void }) {
  const [geoError, setGeoError] = useState<string | null>(null);
  const set = <K extends keyof OperationFormValue>(k: K, val: OperationFormValue[K]) => onChange({ ...value, [k]: val });
  const setInput = (i: number, patch: Partial<OperationInput>) => set('inputs', value.inputs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const capture = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoError('Géolocalisation indisponible sur cet appareil.'); return; }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ ...value, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
      () => setGeoError('Position indisponible (autorisation refusée ?).'),
    );
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Type d&apos;opération *</Label>
        <Select value={value.type} onValueChange={(v) => set('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Date *</Label><Input type="date" value={value.date} onChange={(e) => set('date', e.target.value)} required /></div>
      <div className="space-y-1">
        <Label>Intrants</Label>
        <div className="space-y-2">
          {value.inputs.map((inp, i) => (
            <div key={inp._k ?? i} className="flex gap-1 items-center">
              <Input className="flex-1" placeholder="produit" value={inp.product} onChange={(e) => setInput(i, { product: e.target.value })} />
              <Input className="w-20" type="number" placeholder="qté" value={inp.quantity ?? ''} onChange={(e) => setInput(i, { quantity: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Input className="w-16" placeholder="unité" value={inp.unit ?? ''} onChange={(e) => setInput(i, { unit: e.target.value || undefined })} />
              <Input className="w-20" type="number" placeholder="coût" value={inp.cost ?? ''} onChange={(e) => setInput(i, { cost: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => set('inputs', value.inputs.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('inputs', [...value.inputs, { product: '', _k: crypto.randomUUID() }])}>+ Ajouter un intrant</Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Photos</Label>
        <ImageGalleryUploader value={value.photos} onChange={(v) => set('photos', v)} />
      </div>
      <div className="space-y-1">
        <Label>Position GPS</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-32" placeholder="latitude" value={value.lat} onChange={(e) => set('lat', e.target.value)} />
          <Input className="w-32" placeholder="longitude" value={value.lng} onChange={(e) => set('lng', e.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={capture}>📍 Capturer ma position</Button>
        </div>
        {geoError && <p className="text-xs text-destructive">{geoError}</p>}
      </div>
      <div className="space-y-1"><Label>Coût main d&apos;œuvre</Label><Input className="w-32" type="number" value={value.laborCost} onChange={(e) => set('laborCost', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 4: Prop `parcelGps` + prefill dans l'éditeur**

Dans `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationEditor.client.tsx` :

Signature avec la nouvelle prop :
```tsx
export function OperationEditor({ campaignId, initial, trigger, parcelGps }: { campaignId: string; initial?: OperationLog; trigger: React.ReactNode; parcelGps?: { lat?: number; lng?: number } }) {
```

Initialisation du formulaire (remplacer le `useState` existant) :
```tsx
  const [form, setForm] = useState<OperationFormValue>(initial
    ? { type: initial.type, date: initial.date, inputs: initial.inputs, laborCost: initial.laborCost != null ? String(initial.laborCost) : '', notes: initial.notes ?? '', photos: initial.photos ?? [], lat: initial.gpsLat != null ? String(initial.gpsLat) : '', lng: initial.gpsLng != null ? String(initial.gpsLng) : '' }
    : { ...emptyOperation(), lat: parcelGps?.lat != null ? String(parcelGps.lat) : '', lng: parcelGps?.lng != null ? String(parcelGps.lng) : '' });
```
(Le reste du composant — `submit`, `operationToPayload`, JSX du Dialog — est inchangé : `operationToPayload(form)` transporte désormais photos + gps.)

- [ ] **Step 5: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/suivi-actions.ts "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationForm.tsx" "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/OperationEditor.client.tsx"
git commit -m "feat(admin): opération photos (ImageGalleryUploader) + position GPS + capture navigateur"
```

---

## Task 4: Admin — page journal (GPS parcelle → éditeur, vignettes + repère)

**Files:**
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx`

**Interfaces:**
- Consumes (de Task 3) : `OperationEditor` accepte `parcelGps?: { lat?: number; lng?: number }` ; `OperationLog.photos: ImageRef[]`, `gpsLat?`, `gpsLng?`.
- Consumes (existant) : `listParcels(): Promise<Parcel[]>` de `@/lib/api` ; `Parcel.gpsLat?`/`gpsLng?`.

- [ ] **Step 1: Récupérer la parcelle et passer son GPS à l'éditeur**

Dans `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx` :

Ajouter `listParcels` à l'import depuis `@/lib/api` :
```ts
import { listCampaigns, listOperations, getCampaignRecommendations, CampaignRecommendations, listParcels } from '@/lib/api';
```

Ajouter le chargement des parcelles au `Promise.all` et dériver la parcelle + son GPS :
```ts
  const [campaigns, operations, reco, parcels] = await Promise.all([
    listCampaigns(params.id).catch(() => []), listOperations(params.cid).catch(() => []),
    getCampaignRecommendations(params.cid).catch((): CampaignRecommendations => ({ hasReference: false, items: [] })),
    listParcels().catch(() => []),
  ]);
  const campaign = campaigns.find((c) => c.id === params.cid);
  if (!campaign) notFound();
  const parcel = parcels.find((p) => p.id === params.id);
  const parcelGps = { lat: parcel?.gpsLat, lng: parcel?.gpsLng };
```

Passer `parcelGps` au bouton « Nouvelle opération » :
```tsx
          {canWrite && <OperationEditor campaignId={campaign.id} parcelGps={parcelGps} trigger={<Button>Nouvelle opération</Button>} />}
```

- [ ] **Step 2: Afficher vignettes + repère GPS dans la timeline**

Toujours dans le même fichier, dans le `<div>` interne de chaque `<li>` (bloc de gauche, après le `{op.notes && ...}`), ajouter les vignettes et le repère :
```tsx
                  {op.notes && <p className="text-sm">{op.notes}</p>}
                  {op.photos.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {op.photos.map((img) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={img.key} src={img.url} alt={img.caption || ''} className="h-16 w-16 rounded object-cover" />
                      ))}
                    </div>
                  )}
                  {op.gpsLat != null && op.gpsLng != null && (
                    <p className="mt-1 text-xs text-muted-foreground">📍 {op.gpsLat.toFixed(5)}, {op.gpsLng.toFixed(5)}</p>
                  )}
```

- [ ] **Step 3: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Build admin (garde-fou rendu)**

Run: `cd apps/admin && npx next build`
Expected: build réussi (page journal compile avec le nouveau rendu).

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx"
git commit -m "feat(admin): journal — GPS parcelle pré-rempli + vignettes photos & repère dans la timeline"
```

---

## Self-Review

**1. Couverture du spec :**
- OperationLog +3 champs (domaine/use-cases/persistance/migration) → Task 1. ✅
- Contrôleur `OpBody` + injection `StoragePort` + `toImageDto` sur réponses → Task 2. ✅
- Ouverture `POST /media` aux 3 rôles tenant (method-level `@Roles`) → Task 2. ✅
- `SuiviModule` fournit `STORAGE_PORT` → Task 2 Step 6. ✅
- Admin `ImageGalleryUploader` + bouton capture GPS + prefill parcelle → Task 3. ✅
- Types `OperationLog`/`OperationPayload` → Task 3 Steps 1-2. ✅
- Page journal : parcelle→GPS, vignettes + repère → Task 4. ✅
- Tests : round-trip photos+gps (use-case), rôles média (métadonnées), tsc API+admin → Tasks 1/2/3/4. ✅

**2. Placeholders :** aucun — chaque step porte le code complet.

**3. Cohérence des types :** `photos?: MediaImageJSON[]` (domaine, optionnel) → `toResponse` mappe `(op.photos ?? [])` → `ImageDto[]` → admin `OperationLog.photos: ImageRef[]` (toujours un tableau côté réponse). `OpBody.photos: { key; caption? }[]` assignable à `MediaImageJSON[]`. `OperationPayload.photos` idem. Signatures `parcelGps: { lat?: number; lng?: number }` identiques Task 3 (produit) / Task 4 (consomme). ✅

**Non couvert (hors périmètre, conforme au spec) :** IA (Module 3), GPS par photo (EXIF), mobile natif, URLs signées.
