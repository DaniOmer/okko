# Note de publication (E1 — API) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacher une note optionnelle à chaque publication : colonne `PublishedCrop.note`, `PublishCropUseCase` accepte `note?`, `POST /crops/:id/publish` lit un corps optionnel, `GET /crops/:id/versions` renvoie la note.

**Architecture :** Ajout additif et rétro-compatible à la projection `PublishedCrop`. `note String?` sur la table + `note: string | null` sur `PublishedCropRecord`/`PublishedCropVersion` + adaptateurs. Le use-case normalise (vide → null) et l'enregistre par révision ; l'endpoint publish lit `{ note? }`. Le document figé et `/versions/:revision` restent inchangés.

**Tech Stack :** NestJS 10 + TypeScript + Prisma + Jest.

## Global Constraints

- **Additif & rétro-compatible** : `note` optionnelle ; publier **sans corps** reste valide (note `null`) ; aucun appelant existant de `PublishCropUseCase.execute` cassé (paramètre optionnel).
- **`note: string | null`** sur `PublishedCropRecord` et `PublishedCropVersion` (requis dans le type → compléter les littéraux qui les construisent : adaptateurs + fixtures de test).
- **Normalisation** : `input.note?.trim() || null` (chaîne vide/espaces → `null`).
- **Surface** : la note vit sur l'enregistrement de révision et dans les métadonnées de `/versions` (`listByCrop`). `/versions/:revision` (document figé) : **inchangé**.
- **Tests** : TDD (rouge d'abord). Après chaque tâche, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`. ⚠️ `deleteMany` vide la base de dev (OK).
- **Migration** : `npx prisma migrate dev --name add_published_crop_note` (colonne **nullable additive** → pas de reset nécessaire ; Docker `okko-db-1` Up).
- Commits `feat(api):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Modifiés :**
- `prisma/schema.prisma` — `PublishedCrop.note`.
- `src/application/crop/published-crop.repository.ts` — `note` sur record + version.
- `src/infrastructure/crop/prisma-published-crop.repository.ts` — save/toRecord/listByCrop.
- `src/application/crop/in-memory-published-crop.repository.ts` — listByCrop.
- `src/application/crop/publish-crop.use-case.ts` — `note?` + normalisation.
- `src/application/crop/in-memory-published-crop.repository.spec.ts` — fixture `rec` + test note.
- `src/application/crop/publish-crop.use-case.spec.ts` — test note.
- `src/presentation/crop/crop.controller.ts` — endpoint publish lit `{ note? }` (Task 2).

**Créés :**
- `test/crop-publish-note.e2e-spec.ts` (Task 2).

---

## Task 1 : `note` sur la projection + use-case (TDD)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/application/crop/published-crop.repository.ts`
- Modify: `src/infrastructure/crop/prisma-published-crop.repository.ts`
- Modify: `src/application/crop/in-memory-published-crop.repository.ts`
- Modify: `src/application/crop/publish-crop.use-case.ts`
- Modify: `src/application/crop/in-memory-published-crop.repository.spec.ts`
- Modify: `src/application/crop/publish-crop.use-case.spec.ts`

**Interfaces:**
- Produces : `PublishedCropRecord`/`PublishedCropVersion` gagnent `note: string | null` ; `PublishCropUseCase.execute({ id, actor, note? })`.

- [ ] **Step 1 : Schéma** — ajouter `note String?` à `model PublishedCrop` (après `publishedBy`) :
```prisma
model PublishedCrop {
  cropId      String
  revision    Int
  document    Json
  version     Int
  publishedAt DateTime
  publishedBy String
  note        String?

  @@id([cropId, revision])
}
```

- [ ] **Step 2 : Migration**

Run: `npx prisma migrate dev --name add_published_crop_note`
Expected: migration créée + client régénéré (colonne nullable additive, pas de reset).

- [ ] **Step 3 : Port** — dans `published-crop.repository.ts`, ajouter `note: string | null` à **`PublishedCropRecord`** (après `publishedBy`) **et** à **`PublishedCropVersion`** (après `publishedBy`).

- [ ] **Step 4 : Adaptateur Prisma** (`prisma-published-crop.repository.ts`) :
  - `save` — ajouter au `data` : `note: r.note,`
  - `toRecord` — étendre le type du paramètre `row` avec `note: string | null` et ajouter au retour : `note: row.note,`
  - `listByCrop` — ajouter `note: true` au `select`, et `note: r.note` à l'objet mappé.

- [ ] **Step 5 : Adaptateur in-memory** (`in-memory-published-crop.repository.ts`) — dans `listByCrop`, ajouter `note: r.note` à l'objet mappé (le record est stocké tel quel → `findLatest`/`findRevision` portent déjà `note`).

- [ ] **Step 6 : Use-case** (`publish-crop.use-case.ts`) — changer la signature et la sauvegarde :
```ts
  async execute(input: { id: string; actor: string; note?: string }): Promise<CropSnapshot> {
```
et remplacer la ligne `await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor });` par :
```ts
    const note = input.note?.trim() || null;
    await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor, note });
```

- [ ] **Step 7 : Test repo (échoue d'abord)** — dans `in-memory-published-crop.repository.spec.ts` :
  - **Compléter la fixture** `rec(...)` : ajouter `note: null` (ou un paramètre) pour que le littéral reste un `PublishedCropRecord` valide.
  - Ajouter un test :
```ts
  it('porte la note sur le record et dans les métadonnées', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save({ cropId: 'c1', revision: 1, document: { id: 'c1' } as any, version: 1, publishedAt: '2026-07-11T01:00:00.000Z', publishedBy: 'admin', note: 'MAJ prix' });
    expect((await repo.findLatest('c1'))!.note).toBe('MAJ prix');
    expect((await repo.findRevision('c1', 1))!.note).toBe('MAJ prix');
    expect((await repo.listByCrop('c1'))[0].note).toBe('MAJ prix');
    expect((await repo.listByCrop('c1'))[0]).not.toHaveProperty('document');
  });
```

- [ ] **Step 8 : Test use-case (échoue d'abord)** — dans `publish-crop.use-case.spec.ts`, ajouter (réutiliser le bootstrap event-sourcé + `InMemoryPublishedCropRepository` déjà présents) :
```ts
  it('enregistre la note de publication (vide -> null)', async () => {
    // amorcer un crop 'c4' via CreateCropUseCase comme les autres tests, publier avec note
    const uc = new PublishCropUseCase(events, repo, publishAudit, clock, composer, published);
    await uc.execute({ id: 'c4', actor: 'admin', note: '  MAJ prix  ' });
    expect((await published.findLatest('c4'))!.note).toBe('MAJ prix'); // trim
    // republier sans note -> null
    await uc.execute({ id: 'c4', actor: 'admin' });
    expect((await published.findLatest('c4'))!.note).toBeNull();
    // note vide -> null
    await uc.execute({ id: 'c4', actor: 'admin', note: '   ' });
    expect((await published.findLatest('c4'))!.note).toBeNull();
  });
```
> Adapter `events`/`repo`/`published`/`composer`/`publishAudit`/`clock` et l'amorçage du crop aux fixtures RÉELLES du fichier (les recopier des tests voisins). Si une assertion existante asservit la forme complète d'un `PublishedCropRecord` (peu probable — les tests vérifient `revision`/`document`), la compléter avec `note`.

- [ ] **Step 9 : Lancer → verts + typage.**

Run: `npx jest -- in-memory-published-crop publish-crop && npx tsc --noEmit`
Expected: PASS (rouge attendu avant Steps 3-6 ; vert après).

- [ ] **Step 10 : Suite complète verte.**

Run: `npx jest`
Expected: PASS (les e2e/int existants restent verts ; `note` nullable additive).

- [ ] **Step 11 : Commit**
```bash
git add prisma/schema.prisma prisma/migrations src/application/crop/published-crop.repository.ts src/infrastructure/crop/prisma-published-crop.repository.ts src/application/crop/in-memory-published-crop.repository.ts src/application/crop/publish-crop.use-case.ts src/application/crop/in-memory-published-crop.repository.spec.ts src/application/crop/publish-crop.use-case.spec.ts
git commit -m "feat(api): note de publication stockée par révision (PublishedCrop.note)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Endpoint publish lit la note + e2e

**Files:**
- Modify: `src/presentation/crop/crop.controller.ts`
- Create: `test/crop-publish-note.e2e-spec.ts`

**Interfaces:**
- Consumes : `PublishCropUseCase.execute({ …, note? })` (Task 1), `listByCrop` renvoyant `note`.

- [ ] **Step 1 : Endpoint** — dans `crop.controller.ts`, remplacer le handler `publish` par (ajout d'un corps optionnel) :
```ts
  @Post(':id/publish')
  async publish(@Param('id') id: string, @Body() body?: { note?: string }) {
    try {
      const snap = await this.publishCrop.execute({ id, actor: ACTOR, note: body?.note });
      return toCropDocument(snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }
```
> `@Body` et `toCropDocument`/`mapCropError` sont déjà importés/utilisés dans ce fichier. La réponse du handler est inchangée.

- [ ] **Step 2 : e2e** — créer `test/crop-publish-note.e2e-spec.ts`, en mirrorant le bootstrap de `test/crop-versioning.e2e-spec.ts` (module `AppModule`, `PrismaService`, nettoyage `beforeAll`/`afterAll` **incluant `prisma.publishedCrop.deleteMany()`**, `supertest`) :
```ts
  it('publier avec une note la renvoie dans /versions ; sans corps -> null', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Arachide' }, scientificName: 'Arachis hypogaea', family: 'Fabaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // publier avec note
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).send({ note: 'MAJ prix' }).expect(201);
    const v1 = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(v1.body[0].note).toBe('MAJ prix');

    // éditer puis republier SANS corps -> note null
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Arachide 2' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const v2 = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(v2.body.map((v: any) => v.revision)).toEqual([2, 1]);
    expect(v2.body[0].note).toBeNull();      // révision 2 (la plus récente), publiée sans note
    expect(v2.body[1].note).toBe('MAJ prix'); // révision 1
  });
```
> Vérifier les codes réels (POST création 201, POST publish 201, PATCH 200) et adapter les `.expect(...)` au besoin. `cycleType: 'SEASONAL_ANNUAL'` est une valeur d'enum valide.

- [ ] **Step 3 : Lancer le nouvel e2e seul.**

Run: `npx jest -- crop-publish-note`
Expected: PASS.

- [ ] **Step 4 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (tout — non-régression des publications existantes sans corps).

- [ ] **Step 5 : Commit**
```bash
git add src/presentation/crop/crop.controller.ts test/crop-publish-note.e2e-spec.ts
git commit -m "feat(api): POST /crops/:id/publish lit une note optionnelle (renvoyée par /versions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Note optionnelle par révision** : publier avec `{ note }` → stockée + renvoyée par `/versions` ; sans corps → `null`.
- **Rétro-compat** : publications/republications existantes sans corps inchangées ; `/versions/:revision` et le document figé inchangés.
- **Normalisation** : vide/espaces → `null`.
- **Additif** : migration nullable ; suite verte ; câblage admin (E2) non inclus.
