# Historique des versions publiées (Lot C1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conserver chaque version publiée d'une culture et permettre de lister ces versions et d'en consulter une passée, via une projection `PublishedCrop` multi-lignes `(cropId, revision)`.

**Architecture :** Extension de la projection publiée du Lot B. `PublishedCrop` passe de mono-ligne (clé `cropId`) à multi-lignes (clé `(cropId, revision)`) ; publier INSÈRE une nouvelle révision au lieu d'écraser. Le port gagne `findLatest`/`findRevision`/`listByCrop` ; deux endpoints de lecture s'ajoutent. Le flux d'événements reste la source de vérité.

**Tech Stack :** NestJS 10 + TypeScript + Prisma (PostgreSQL) + Jest.

## Global Constraints

- **Flux d'événements = source de vérité** ; `PublishedCrop` est une projection, désormais **append-only par version**.
- **`version` (compteur de contenu) inchangé** ; **`revision`** est un NOUVEAU compteur monotone **par culture** (1ʳᵉ publication → 1, republication → 2…), distinct de `version`.
- **`GET /crops/:id/published` inchangé côté client** : renvoie la dernière version publiée, désormais via `findLatest` (= `revision` max).
- **Lecture directe repo dans le contrôleur** (pas de nouveau use-case ; cohérent avec le Lot B où `/published` appelle `publishedCrops` directement).
- **Tests** : TDD (rouge d'abord). Après **chaque tâche**, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`. Suite single-worker ; ⚠️ `deleteMany` vide la base de dev — OK (base vide, contrainte projet).
- **Migrations** : `npx prisma migrate dev --name <nom>` (Docker `okko-db-1` doit être Up). La base de dev est **jetable** (les tests la vident) — si `migrate dev` bloque sur des lignes existantes en env non-interactif, faire `npx prisma migrate reset --force` puis relancer `migrate dev`.
- Commits préfixés `feat(api):`/`refactor(api):`/`test(api):`. Terminer **chaque** message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Modifiés :**
- `prisma/schema.prisma` — modèle `PublishedCrop` multi-lignes.
- `src/application/crop/published-crop.repository.ts` — `revision` sur le record, type `PublishedCropVersion`, méthodes `findLatest`/`findRevision`/`listByCrop`.
- `src/infrastructure/crop/prisma-published-crop.repository.ts` — adaptateur (INSERT + 3 lectures).
- `src/application/crop/in-memory-published-crop.repository.ts` — adaptateur mémoire (tableau de records).
- `src/application/crop/publish-crop.use-case.ts` — calcule `revision = max + 1` et insère.
- `src/application/crop/publish-crop.use-case.spec.ts` — `findByCrop → findLatest`, assertions `revision`.
- `src/presentation/crop/crop.controller.ts` — `findByCrop → findLatest` (Task 1) ; endpoints `/versions` (Task 2).

**Créés :**
- `src/application/crop/in-memory-published-crop.repository.spec.ts` — tests unitaires du repo (Task 1).
- `test/crop-version-history.e2e-spec.ts` — e2e (Task 2).

---

## Task 1 : Projection `PublishedCrop` multi-lignes (port + adaptateurs + use-case + schéma)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/application/crop/published-crop.repository.ts`
- Modify: `src/infrastructure/crop/prisma-published-crop.repository.ts`
- Modify: `src/application/crop/in-memory-published-crop.repository.ts`
- Modify: `src/application/crop/publish-crop.use-case.ts`
- Modify: `src/application/crop/publish-crop.use-case.spec.ts`
- Modify: `src/presentation/crop/crop.controller.ts`
- Create: `src/application/crop/in-memory-published-crop.repository.spec.ts`

**Interfaces:**
- Produces : `PublishedCropRecord` (+`revision: number`) ; `PublishedCropVersion { revision, version, publishedAt, publishedBy }` ; `PublishedCropRepository { save; findLatest(cropId); findRevision(cropId, revision); listByCrop(cropId) }`.

- [ ] **Step 1 : Réécrire le port** `published-crop.repository.ts` :
```ts
import { CropDocument } from './crop-read-model';

export const PUBLISHED_CROP_REPOSITORY = Symbol('PUBLISHED_CROP_REPOSITORY');

export interface PublishedCropRecord {
  cropId: string;
  revision: number;
  document: CropDocument;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedCropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedCropRepository {
  save(record: PublishedCropRecord): Promise<void>;
  findLatest(cropId: string): Promise<PublishedCropRecord | null>;
  findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null>;
  listByCrop(cropId: string): Promise<PublishedCropVersion[]>;
}
```

- [ ] **Step 2 : Réécrire l'adaptateur in-memory** `in-memory-published-crop.repository.ts` :
```ts
import { PublishedCropRecord, PublishedCropRepository, PublishedCropVersion } from './published-crop.repository';

export class InMemoryPublishedCropRepository implements PublishedCropRepository {
  private store: PublishedCropRecord[] = [];

  async save(record: PublishedCropRecord): Promise<void> {
    this.store = this.store.filter((r) => !(r.cropId === record.cropId && r.revision === record.revision)).concat(record);
  }

  async findLatest(cropId: string): Promise<PublishedCropRecord | null> {
    const rows = this.store.filter((r) => r.cropId === cropId);
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (b.revision > a.revision ? b : a));
  }

  async findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null> {
    return this.store.find((r) => r.cropId === cropId && r.revision === revision) ?? null;
  }

  async listByCrop(cropId: string): Promise<PublishedCropVersion[]> {
    return this.store
      .filter((r) => r.cropId === cropId)
      .sort((a, b) => b.revision - a.revision)
      .map((r) => ({ revision: r.revision, version: r.version, publishedAt: r.publishedAt, publishedBy: r.publishedBy }));
  }
}
```

- [ ] **Step 3 : Écrire les tests unitaires du repo (échouent)** — créer `in-memory-published-crop.repository.spec.ts` :
```ts
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { PublishedCropRecord } from './published-crop.repository';

const rec = (revision: number): PublishedCropRecord => ({
  cropId: 'c1', revision,
  document: { id: 'c1', name: `v${revision}` } as any,
  version: revision, publishedAt: `2026-07-10T0${revision}:00:00.000Z`, publishedBy: 'admin',
});

describe('InMemoryPublishedCropRepository', () => {
  it('findLatest renvoie la révision la plus haute', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    expect((await repo.findLatest('c1'))!.revision).toBe(2);
    expect(await repo.findLatest('absent')).toBeNull();
  });

  it('findRevision renvoie la version demandée avec son document', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    const r1 = await repo.findRevision('c1', 1);
    expect(r1!.document.name).toBe('v1');
    expect(await repo.findRevision('c1', 99)).toBeNull();
  });

  it('listByCrop renvoie les métadonnées triées décroissant, sans document', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    const list = await repo.listByCrop('c1');
    expect(list.map((v) => v.revision)).toEqual([2, 1]);
    expect((list[0] as any).document).toBeUndefined();
    expect(await repo.listByCrop('absent')).toEqual([]);
  });
});
```

Run: `npx jest -- in-memory-published-crop`
Expected: FAIL (les méthodes n'existent pas encore au moment où tu écris le test avant l'implémentation ; si tu as déjà fait Steps 1-2, ce test PASSE — dans ce cas garde-le comme filet et continue).

- [ ] **Step 4 : Réécrire l'adaptateur Prisma** `prisma-published-crop.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropDocument } from '../../application/crop/crop-read-model';
import { PublishedCropRecord, PublishedCropRepository, PublishedCropVersion } from '../../application/crop/published-crop.repository';

@Injectable()
export class PrismaPublishedCropRepository implements PublishedCropRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(r: PublishedCropRecord): Promise<void> {
    await this.prisma.publishedCrop.create({
      data: {
        cropId: r.cropId,
        revision: r.revision,
        document: r.document as unknown as Prisma.InputJsonValue,
        version: r.version,
        publishedAt: new Date(r.publishedAt),
        publishedBy: r.publishedBy,
      },
    });
  }

  async findLatest(cropId: string): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findFirst({ where: { cropId }, orderBy: { revision: 'desc' } });
    return row ? this.toRecord(row) : null;
  }

  async findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findUnique({ where: { cropId_revision: { cropId, revision } } });
    return row ? this.toRecord(row) : null;
  }

  async listByCrop(cropId: string): Promise<PublishedCropVersion[]> {
    const rows = await this.prisma.publishedCrop.findMany({
      where: { cropId },
      orderBy: { revision: 'desc' },
      select: { revision: true, version: true, publishedAt: true, publishedBy: true },
    });
    return rows.map((r) => ({ revision: r.revision, version: r.version, publishedAt: r.publishedAt.toISOString(), publishedBy: r.publishedBy }));
  }

  private toRecord(row: { cropId: string; revision: number; document: unknown; version: number; publishedAt: Date; publishedBy: string }): PublishedCropRecord {
    return {
      cropId: row.cropId,
      revision: row.revision,
      document: row.document as unknown as CropDocument,
      version: row.version,
      publishedAt: row.publishedAt.toISOString(),
      publishedBy: row.publishedBy,
    };
  }
}
```
> La clé composite `@@id([cropId, revision])` génère l'accès Prisma `cropId_revision` utilisé par `findUnique`.

- [ ] **Step 5 : Modifier le schéma Prisma** — remplacer le modèle `PublishedCrop` dans `schema.prisma` :
```prisma
model PublishedCrop {
  cropId      String
  revision    Int
  document    Json
  version     Int
  publishedAt DateTime
  publishedBy String

  @@id([cropId, revision])
}
```

- [ ] **Step 6 : Migration**

Run: `npx prisma migrate dev --name published_crop_versions`
Expected: migration créée + client régénéré. (Si l'opération bloque sur des lignes existantes en env non-interactif : `npx prisma migrate reset --force` puis relancer la commande. Base de dev jetable.)

- [ ] **Step 7 : Modifier `publish-crop.use-case.ts`** — remplacer la ligne `await this.published.save({ cropId: input.id, document, version: next.version, publishedAt: at, publishedBy: input.actor });` par :
```ts
    const latest = await this.published.findLatest(input.id);
    const revision = latest ? latest.revision + 1 : 1;
    await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor });
```

- [ ] **Step 8 : Contrôleur** — dans `crop.controller.ts`, méthode `published` (≈ ligne 269), remplacer `this.publishedCrops.findByCrop(id)` par `this.publishedCrops.findLatest(id)`.

- [ ] **Step 9 : Mettre à jour `publish-crop.use-case.spec.ts`** :
  - Remplacer l'appel `localPublished.findByCrop('c2')` par `localPublished.findLatest('c2')` (le test de figeage existant).
  - Ajouter juste après l'assertion existante sur ce record : `expect(rec!.revision).toBe(1);`
  - Ajouter un test de republication (réutiliser le bootstrap `arrange`/beforeEach du fichier ; publier deux fois la même culture) :
```ts
  it('incrémente la révision à chaque publication', async () => {
    // amorcer un crop 'c3' via CreateCropUseCase comme les autres tests du fichier, puis :
    const uc = new PublishCropUseCase(events, repo, publishAudit, clock, composer, published);
    await uc.execute({ id: 'c3', actor: 'admin' });
    await uc.execute({ id: 'c3', actor: 'admin' }); // republication (PUBLISHED->PUBLISHED autorisé)
    expect((await published.findLatest('c3'))!.revision).toBe(2);
    expect((await published.listByCrop('c3')).map((v) => v.revision)).toEqual([2, 1]);
  });
```
> Lire le haut du fichier pour réutiliser exactement les fixtures existantes (`events`, `repo`, `composer`, `published`, `clock`, `publishAudit`, et le helper de création de crop). Adapter l'id/amorçage au motif réel du fichier.

- [ ] **Step 10 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS. Les e2e Lot B (`crop-versioning`, `crop-sections-event-sourcing`, `crop`) passent via `findLatest`. Si une assertion existante asservit la forme d'un `PublishedCropRecord` sans `revision`, la compléter avec `revision`.

- [ ] **Step 11 : Commit**
```bash
git add prisma/schema.prisma prisma/migrations src/application/crop/published-crop.repository.ts src/infrastructure/crop/prisma-published-crop.repository.ts src/application/crop/in-memory-published-crop.repository.ts src/application/crop/in-memory-published-crop.repository.spec.ts src/application/crop/publish-crop.use-case.ts src/application/crop/publish-crop.use-case.spec.ts src/presentation/crop/crop.controller.ts
git commit -m "feat(api): PublishedCrop multi-lignes par révision (findLatest/findRevision/listByCrop)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Endpoints d'historique + e2e

**Files:**
- Modify: `src/presentation/crop/crop.controller.ts`
- Create: `test/crop-version-history.e2e-spec.ts`

**Interfaces:**
- Consumes : `publishedCrops.listByCrop(id)`, `publishedCrops.findRevision(id, revision)` (Task 1).
- Produces : `GET /crops/:id/versions` → `PublishedCropVersion[]` ; `GET /crops/:id/versions/:revision` → `CropDocument` (404 si absente).

- [ ] **Step 1 : Ajouter les 2 endpoints** dans `crop.controller.ts`, juste après la méthode `published` :
```ts
  @Get(':id/versions')
  async versions(@Param('id') id: string) {
    return this.publishedCrops.listByCrop(id);
  }

  @Get(':id/versions/:revision')
  async version(@Param('id') id: string, @Param('revision') revision: string) {
    const rec = await this.publishedCrops.findRevision(id, Number(revision));
    if (!rec) throw new NotFoundException(id);
    return rec.document;
  }
```
> `NotFoundException` est déjà importé dans ce fichier. Ces routes ne conflictent pas avec `:id/published` ni les `:id/xxx/:yyy` existants.

- [ ] **Step 2 : Écrire l'e2e** — créer `test/crop-version-history.e2e-spec.ts`, en mirrorant le bootstrap de `test/crop-versioning.e2e-spec.ts` (module `AppModule`, `PrismaService`, nettoyage `beforeAll`/`afterAll` **incluant `prisma.publishedCrop.deleteMany()`**). Import `supertest` comme les e2e existants.
```ts
  it('conserve chaque version publiée, les liste et les consulte', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Sorgho' }, scientificName: 'Sorghum bicolor', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // publier v1
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    // éditer puis republier v2
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Sorgho commun' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // liste des versions : 2 entrées, tri décroissant, sans document
    const versions = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(versions.body.map((v: any) => v.revision)).toEqual([2, 1]);
    expect(versions.body[0].document).toBeUndefined();
    expect(versions.body[0].publishedBy).toBe('admin');

    // consulter chaque version figée
    const v1 = await request(app.getHttpServer()).get(`/crops/${id}/versions/1`).expect(200);
    expect(v1.body.name).toBe('Sorgho');
    const v2 = await request(app.getHttpServer()).get(`/crops/${id}/versions/2`).expect(200);
    expect(v2.body.name).toBe('Sorgho commun');

    // /published = dernière version
    const pub = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub.body.name).toBe('Sorgho commun');

    // révision inexistante -> 404
    await request(app.getHttpServer()).get(`/crops/${id}/versions/99`).expect(404);
  });

  it('renvoie une liste vide pour une culture jamais publiée', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Mil' }, scientificName: 'Pennisetum glaucum', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const versions = await request(app.getHttpServer()).get(`/crops/${created.body.id}/versions`).expect(200);
    expect(versions.body).toEqual([]);
  });
```
> Vérifier le champ exact du libellé dans le document (`name`) et les codes HTTP (`POST` création → 201, `PATCH` → 200, `POST /publish` → 201) en lisant `crop.controller.ts` / un e2e existant ; adapter les `.expect(...)` au réel si besoin.

- [ ] **Step 3 : Lancer le nouvel e2e seul.**

Run: `npx jest -- crop-version-history`
Expected: PASS.

- [ ] **Step 4 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (tout, e2e Lot B inclus — filet de non-régression).

- [ ] **Step 5 : Commit**
```bash
git add src/presentation/crop/crop.controller.ts test/crop-version-history.e2e-spec.ts
git commit -m "feat(api): endpoints historique des versions (GET /crops/:id/versions[/:revision])

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Historique conservé** : chaque publication insère une révision ; `listByCrop` les liste (tri décroissant, métadonnées) ; `findRevision` consulte un document figé passé.
- **Fidélité point-dans-le-temps** : `/versions/1` renvoie le document tel que figé à la 1ʳᵉ publication (anciennes valeurs), `/versions/2` les nouvelles.
- **Non-régression Lot B** : `/published` = dernière version via `findLatest` ; e2e Lot B verts.
- **`revision` ≠ `version`** : `revision` monotone par publication ; `version` = compteur de contenu inchangé.
- **Périmètre** : restauration (C2) et diff (C3) **non** inclus.
