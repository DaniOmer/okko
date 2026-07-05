# CRUD Zones & Ravageurs (édition + suppression) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter Modifier + Supprimer aux catalogues Zone et Ravageur ; la suppression d'une entité rattachée à ≥1 culture est refusée (409 + nombre).

**Architecture :** Clean architecture existante (domaine pur / ports application / adaptateurs infra / présentation NestJS), patterns snapshot + use-case + `useFactory`/`inject` du `crop.module.ts`. Les agrégats immuables gagnent une méthode `update(...)` renvoyant un nouvel agrégat (champs avancés préservés) ; les repos gagnent `delete(id)` (la mise à jour réutilise `save`, déjà upsert). Le blocage de suppression compte les liens via `listByZone`/`listByPest` (déjà présents). Côté admin, colonne d'actions + modales d'édition/suppression sur les listes.

**Tech Stack :** NestJS 10 + TypeScript + Prisma + Jest (TDD) ; Next.js 14 + shadcn/ui (admin).

## Global Constraints

- **Clean architecture** : domaine sans import externe ; ports dans `application/**` ; adaptateurs Prisma dans `infrastructure/**` ; contrôleurs dans `presentation/**`. Ne pas contourner les couches.
- **Champs modifiables (parité création)** : Zone = `name.fr`, `country`, `koppen?` ; Ravageur = `name.fr`, `type` (`PestType`), `scientificName?`. Le `PATCH` **remplace** ces champs et **préserve** les champs avancés (`altitude`, `annualRainfall`, `notes`, `metadata` / `symptoms`, `photos`, `notes`, `metadata`).
- **Suppression** : si l'entité est référencée (`listByZone(id).length > 0` / `listByPest(id).length > 0`) → refuser avec une erreur portant le **count** ; sinon supprimer.
- **Audit** : la création est déjà auditée (`audit.record({ entityType, entityId, actor, at, changes })`). Par cohérence, `update` enregistre `{ updated: snap }` et `delete` enregistre `{ deleted: { id } }`. Injecter `AUDIT_LOG_REPOSITORY` + `CLOCK` dans les nouveaux use-cases.
- **HTTP** : `PATCH` → 200 (read-model) ; `DELETE` → 204 ; introuvable → 404 ; suppression rattachée → **409** (corps `{ message, count }`).
- **Tests** : nouveaux use-cases et endpoints en **TDD** (test qui échoue d'abord). Toute la suite API (`pnpm --filter @okko/api test`) reste verte. Admin : `pnpm --filter @okko/admin build` est la porte.
- **Jest maxWorkers** : la suite tourne déjà avec `--runInBand`/`maxWorkers:1` (DB partagée) ; ne pas paralléliser.
- ⚠️ **Ne pas lancer la suite e2e API sur une base contenant des données à conserver** : elle fait `deleteMany`. Ici la base de dev est vide, donc OK.
- Commits fréquents, préfixe `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**API — créés :**
- `apps/api/src/application/zone/update-zone.use-case.ts` (+ `.spec.ts`)
- `apps/api/src/application/zone/delete-zone.use-case.ts` (+ `.spec.ts`)
- `apps/api/src/application/pest/update-pest.use-case.ts` (+ `.spec.ts`)
- `apps/api/src/application/pest/delete-pest.use-case.ts` (+ `.spec.ts`)

**API — modifiés :**
- `apps/api/src/domain/zone/agro-ecological-zone.ts` (méthode `update`) + `.spec.ts`
- `apps/api/src/domain/pest/pest-disease.ts` (méthode `update`) + `.spec.ts`
- `apps/api/src/application/zone/zone.repository.ts`, `application/pest/pest.repository.ts` (`delete`)
- `apps/api/src/application/zone/in-memory-zone.repository.ts`, `application/pest/in-memory-pest.repository.ts` (`delete`)
- `apps/api/src/infrastructure/zone/prisma-zone.repository.ts`, `infrastructure/pest/prisma-pest.repository.ts` (`delete`)
- `apps/api/src/presentation/zone/zone.controller.ts`, `presentation/pest/pest.controller.ts` (endpoints)
- `apps/api/src/crop.module.ts` (câblage DI)
- `apps/api/test/*` (e2e des nouveaux endpoints)

**Admin — modifiés :**
- `apps/admin/src/lib/api.ts` (4 fonctions)
- `apps/admin/src/app/zones/page.tsx`, `apps/admin/src/app/pests/page.tsx` (colonne actions)
- **créés** : `apps/admin/src/app/zones/ZoneRowActions.tsx`, `apps/admin/src/app/pests/PestRowActions.tsx`

---

## Task 1 : Domaine `update` + repository `delete` (zone & ravageur)

**Files:**
- Modify: `apps/api/src/domain/zone/agro-ecological-zone.ts`
- Create: `apps/api/src/domain/zone/agro-ecological-zone.update.spec.ts`
- Modify: `apps/api/src/domain/pest/pest-disease.ts`
- Create: `apps/api/src/domain/pest/pest-disease.update.spec.ts`
- Modify: `apps/api/src/application/zone/zone.repository.ts`, `apps/api/src/application/pest/pest.repository.ts`
- Modify: `apps/api/src/application/zone/in-memory-zone.repository.ts`, `apps/api/src/application/pest/in-memory-pest.repository.ts`
- Modify: `apps/api/src/infrastructure/zone/prisma-zone.repository.ts`, `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`

**Interfaces:**
- Produces :
  - `AgroEcologicalZone.update(fields: { name: TranslatableText; country: string; koppen?: string }): AgroEcologicalZone`
  - `PestDisease.update(fields: { name: TranslatableText; type: PestType; scientificName?: string }): PestDisease`
  - `ZoneRepository.delete(id: string): Promise<void>` ; `PestRepository.delete(id: string): Promise<void>`

- [ ] **Step 1 : Test qui échoue — `agro-ecological-zone.update.spec.ts`**

```ts
import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone.update', () => {
  const base = () => AgroEcologicalZone.create({
    id: 'z1', name: TranslatableText.create({ fr: 'Sahel' }), country: 'BF', koppen: 'BSh',
    annualRainfall: RangeValue.create({ min: 300, optimal: 600, max: 900, unit: 'mm' }),
    notes: 'note conservée',
  });

  it('remplace les champs éditables et renvoie un nouvel agrégat', () => {
    const z = base().update({ name: TranslatableText.create({ fr: 'Sahel Nord' }), country: 'NE', koppen: 'BWh' });
    const s = z.toSnapshot();
    expect(s.name.fr).toBe('Sahel Nord');
    expect(s.country).toBe('NE');
    expect(s.koppen).toBe('BWh');
  });

  it('préserve les champs avancés non éditables', () => {
    const z = base().update({ name: TranslatableText.create({ fr: 'X' }), country: 'BF' });
    const s = z.toSnapshot();
    expect(s.notes).toBe('note conservée');
    expect(s.annualRainfall?.optimal).toBe(600);
    expect(s.koppen).toBeUndefined(); // koppen omis => effacé
  });
});
```

- [ ] **Step 2 : Lancer → échoue** (méthode absente)

Run: `pnpm --filter @okko/api test -- agro-ecological-zone.update`
Expected: FAIL (`update is not a function`).

- [ ] **Step 3 : Implémenter `update` dans `agro-ecological-zone.ts`** (ajouter la méthode après `toSnapshot`/avant `fromSnapshot`) :

```ts
  update(fields: { name: TranslatableText; country: string; koppen?: string }): AgroEcologicalZone {
    return new AgroEcologicalZone(
      this._id,
      fields.name,
      fields.country,
      fields.koppen,
      this._altitude,
      this._annualRainfall,
      this._notes,
      this._metadata,
    );
  }
```

- [ ] **Step 4 : Test qui échoue — `pest-disease.update.spec.ts`**

```ts
import { PestDisease } from './pest-disease';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

describe('PestDisease.update', () => {
  const base = () => PestDisease.create({
    id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT,
    scientificName: 'Spodoptera', notes: 'note conservée', photos: ['a.jpg'],
  });

  it('remplace les champs éditables', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'Chenille légionnaire' }), type: PestType.INSECT, scientificName: 'Spodoptera frugiperda' });
    const s = p.toSnapshot();
    expect(s.name.fr).toBe('Chenille légionnaire');
    expect(s.scientificName).toBe('Spodoptera frugiperda');
  });

  it('préserve les champs avancés', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'X' }), type: PestType.FUNGUS });
    const s = p.toSnapshot();
    expect(s.notes).toBe('note conservée');
    expect(s.photos).toEqual(['a.jpg']);
    expect(s.type).toBe(PestType.FUNGUS);
    expect(s.scientificName).toBeUndefined();
  });
});
```

- [ ] **Step 5 : Implémenter `update` dans `pest-disease.ts`** :

```ts
  update(fields: { name: TranslatableText; type: PestType; scientificName?: string }): PestDisease {
    return new PestDisease(
      this._id,
      fields.name,
      fields.type,
      fields.scientificName,
      this._symptoms,
      this._photos,
      this._notes,
      this._metadata,
    );
  }
```

- [ ] **Step 6 : Ajouter `delete` aux ports** — dans `zone.repository.ts` ajouter à l'interface `ZoneRepository` : `delete(id: string): Promise<void>;` ; idem `pest.repository.ts` (`PestRepository`).

- [ ] **Step 7 : Implémenter `delete` (in-memory)** — `in-memory-zone.repository.ts` : `async delete(id: string): Promise<void> { this.store.delete(id); }` (le store est une `Map`). `in-memory-pest.repository.ts` : idem (`this.store.delete(id)`).

- [ ] **Step 8 : Implémenter `delete` (Prisma)** — `prisma-zone.repository.ts` :

```ts
  async delete(id: string): Promise<void> {
    await this.prisma.agroEcologicalZone.delete({ where: { id } });
  }
```

`prisma-pest.repository.ts` : `await this.prisma.pestDisease.delete({ where: { id } });`

- [ ] **Step 9 : Lancer les tests domaine → passent**

Run: `pnpm --filter @okko/api test -- update.spec`
Expected: PASS (4 tests).

- [ ] **Step 10 : Commit**

```bash
git add apps/api/src/domain/zone/agro-ecological-zone.ts apps/api/src/domain/zone/agro-ecological-zone.update.spec.ts apps/api/src/domain/pest/pest-disease.ts apps/api/src/domain/pest/pest-disease.update.spec.ts apps/api/src/application/zone/zone.repository.ts apps/api/src/application/pest/pest.repository.ts apps/api/src/application/zone/in-memory-zone.repository.ts apps/api/src/application/pest/in-memory-pest.repository.ts apps/api/src/infrastructure/zone/prisma-zone.repository.ts apps/api/src/infrastructure/pest/prisma-pest.repository.ts
git commit -m "feat(api): update() sur agrégats zone/ravageur + delete() sur repos"
```

---

## Task 2 : Use-cases Update/Delete Zone (TDD)

**Files:**
- Create: `apps/api/src/application/zone/update-zone.use-case.ts` (+ `.spec.ts`)
- Create: `apps/api/src/application/zone/delete-zone.use-case.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes : `ZoneRepository` (`findById`, `save`, `delete`), `CropZoneSuitabilityRepository` (`listByZone`), `AuditLogRepository` (`record`), `Clock` (`nowIso`).
- Produces :
  - `class ZoneNotFoundError extends Error` ; `class ZoneInUseError extends Error { readonly count: number }`
  - `UpdateZoneUseCase.execute(input: { id: string; name: Record<string,string>; country: string; koppen?: string; actor: string }): Promise<ZoneSnapshot>`
  - `DeleteZoneUseCase.execute(input: { id: string; actor: string }): Promise<void>`

- [ ] **Step 1 : Test qui échoue — `update-zone.use-case.spec.ts`**

```ts
import { UpdateZoneUseCase, ZoneNotFoundError } from './update-zone.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { AgroEcologicalZone } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };

describe('UpdateZoneUseCase', () => {
  it('met à jour les champs éditables et préserve le reste', async () => {
    const zones = new InMemoryZoneRepository();
    await zones.save(AgroEcologicalZone.create({ id: 'z1', name: TranslatableText.create({ fr: 'A' }), country: 'BF', notes: 'garde' }).toSnapshot());
    const uc = new UpdateZoneUseCase(zones, audit() as any, clock);
    const out = await uc.execute({ id: 'z1', name: { fr: 'B' }, country: 'NE', koppen: 'BSh', actor: 'admin' });
    expect(out.name.fr).toBe('B');
    expect(out.country).toBe('NE');
    expect(out.notes).toBe('garde');
  });

  it('lève ZoneNotFoundError si absent', async () => {
    const uc = new UpdateZoneUseCase(new InMemoryZoneRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', name: { fr: 'B' }, country: 'NE', actor: 'admin' })).rejects.toBeInstanceOf(ZoneNotFoundError);
  });
});
```

- [ ] **Step 2 : Lancer → échoue** (`Cannot find module './update-zone.use-case'`).

Run: `pnpm --filter @okko/api test -- update-zone.use-case`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `update-zone.use-case.ts`**

```ts
import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class ZoneNotFoundError extends Error {
  constructor(id: string) { super(`Zone not found: ${id}`); this.name = 'ZoneNotFoundError'; }
}

export interface UpdateZoneInput {
  id: string; name: Record<string, string>; country: string; koppen?: string; actor: string;
}

export class UpdateZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateZoneInput): Promise<ZoneSnapshot> {
    const existing = await this.zones.findById(input.id);
    if (!existing) throw new ZoneNotFoundError(input.id);
    const updated = AgroEcologicalZone.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      country: input.country,
      koppen: input.koppen || undefined,
    });
    const snap = updated.toSnapshot();
    await this.zones.save(snap);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: snap },
    });
    return snap;
  }
}
```

- [ ] **Step 4 : Test qui échoue — `delete-zone.use-case.spec.ts`**

```ts
import { DeleteZoneUseCase, ZoneNotFoundError, ZoneInUseError } from './delete-zone.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { InMemoryCropZoneSuitabilityRepository } from './in-memory-crop-zone-suitability.repository';
import { AgroEcologicalZone } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };
const seedZone = async (zones: InMemoryZoneRepository, id = 'z1') =>
  zones.save(AgroEcologicalZone.create({ id, name: TranslatableText.create({ fr: 'A' }), country: 'BF' }).toSnapshot());

describe('DeleteZoneUseCase', () => {
  it('supprime une zone libre', async () => {
    const zones = new InMemoryZoneRepository(); await seedZone(zones);
    const links = new InMemoryCropZoneSuitabilityRepository();
    const uc = new DeleteZoneUseCase(zones, links, audit() as any, clock);
    await uc.execute({ id: 'z1', actor: 'admin' });
    expect(await zones.findById('z1')).toBeNull();
  });

  it('lève ZoneNotFoundError si absente', async () => {
    const uc = new DeleteZoneUseCase(new InMemoryZoneRepository(), new InMemoryCropZoneSuitabilityRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', actor: 'admin' })).rejects.toBeInstanceOf(ZoneNotFoundError);
  });

  it('refuse (ZoneInUseError avec count) si rattachée', async () => {
    const zones = new InMemoryZoneRepository(); await seedZone(zones);
    const links = new InMemoryCropZoneSuitabilityRepository();
    await links.save({ cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any);
    const uc = new DeleteZoneUseCase(zones, links, audit() as any, clock);
    await expect(uc.execute({ id: 'z1', actor: 'admin' })).rejects.toMatchObject({ name: 'ZoneInUseError', count: 1 });
    expect(await zones.findById('z1')).not.toBeNull(); // pas supprimée
  });
});
```

- [ ] **Step 5 : Lancer → échoue.**

Run: `pnpm --filter @okko/api test -- delete-zone.use-case`
Expected: FAIL.

- [ ] **Step 6 : Implémenter `delete-zone.use-case.ts`**

```ts
import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { ZoneNotFoundError } from './update-zone.use-case';

export { ZoneNotFoundError };

export class ZoneInUseError extends Error {
  constructor(public readonly count: number) {
    super(`Zone référencée par ${count} culture(s)`);
    this.name = 'ZoneInUseError';
  }
}

export class DeleteZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly links: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<void> {
    const existing = await this.zones.findById(input.id);
    if (!existing) throw new ZoneNotFoundError(input.id);
    const refs = await this.links.listByZone(input.id);
    if (refs.length > 0) throw new ZoneInUseError(refs.length);
    await this.zones.delete(input.id);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: input.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { deleted: { id: input.id } },
    });
  }
}
```

- [ ] **Step 7 : Lancer les tests zone → passent**

Run: `pnpm --filter @okko/api test -- zone.use-case`
Expected: PASS (5 tests : 2 update + 3 delete).

- [ ] **Step 8 : Commit**

```bash
git add apps/api/src/application/zone/update-zone.use-case.ts apps/api/src/application/zone/update-zone.use-case.spec.ts apps/api/src/application/zone/delete-zone.use-case.ts apps/api/src/application/zone/delete-zone.use-case.spec.ts
git commit -m "feat(api): use-cases UpdateZone/DeleteZone (blocage si rattachée) — TDD"
```

---

## Task 3 : Use-cases Update/Delete Pest (TDD)

**Files:**
- Create: `apps/api/src/application/pest/update-pest.use-case.ts` (+ `.spec.ts`)
- Create: `apps/api/src/application/pest/delete-pest.use-case.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes : `PestRepository` (`findById`, `save`, `delete`), `CropPestControlRepository` (`listByPest`), `AuditLogRepository`, `Clock`.
- Produces :
  - `class PestNotFoundError extends Error` ; `class PestInUseError extends Error { readonly count: number }`
  - `UpdatePestUseCase.execute(input: { id: string; name: Record<string,string>; type: PestType; scientificName?: string; actor: string }): Promise<PestDiseaseSnapshot>`
  - `DeletePestUseCase.execute(input: { id: string; actor: string }): Promise<void>`

Ce sont les **symétriques exacts** de la Task 2 pour le ravageur. Reproduire la même structure de tests et d'implémentation, en substituant : `PestRepository`/`InMemoryPestRepository`, `CropPestControlRepository`/`InMemoryCropPestControlRepository` (`listByPest`), `PestDisease.fromSnapshot(...).update({ name, type, scientificName })`, `entityType: 'PestDisease'`, et `type: PestType` (importer `PestType` depuis `../../domain/pest/pest-type`).

- [ ] **Step 1 : `update-pest.use-case.spec.ts`** — test qui échoue : met à jour `name.fr`/`type`/`scientificName`, préserve `notes`/`photos` ; lève `PestNotFoundError` si absent. Utiliser `PestType.INSECT`/`PestType.FUNGUS`.

- [ ] **Step 2 : Lancer → échoue.** `pnpm --filter @okko/api test -- update-pest.use-case` → FAIL.

- [ ] **Step 3 : `update-pest.use-case.ts`** — copie structurelle de `update-zone.use-case.ts` :

```ts
import { PestDisease, PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';
import { PestRepository } from './pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class PestNotFoundError extends Error {
  constructor(id: string) { super(`Pest not found: ${id}`); this.name = 'PestNotFoundError'; }
}

export interface UpdatePestInput {
  id: string; name: Record<string, string>; type: PestType; scientificName?: string; actor: string;
}

export class UpdatePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdatePestInput): Promise<PestDiseaseSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const updated = PestDisease.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      type: input.type,
      scientificName: input.scientificName || undefined,
    });
    const snap = updated.toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'PestDisease', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: snap },
    });
    return snap;
  }
}
```

- [ ] **Step 4 : `delete-pest.use-case.spec.ts`** — test qui échoue : supprime un ravageur libre ; `PestNotFoundError` si absent ; refuse avec `PestInUseError` (count) si un lien existe (`links.save({ cropId:'c1', pestId:'p1', susceptibility:'MEDIUM', sensitiveStages:[], controlMethods:[] } as any)`), non supprimé.

- [ ] **Step 5 : Lancer → échoue.**

- [ ] **Step 6 : `delete-pest.use-case.ts`** — copie de `delete-zone.use-case.ts` :

```ts
import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { PestNotFoundError } from './update-pest.use-case';

export { PestNotFoundError };

export class PestInUseError extends Error {
  constructor(public readonly count: number) {
    super(`Ravageur référencé par ${count} culture(s)`);
    this.name = 'PestInUseError';
  }
}

export class DeletePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly links: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<void> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const refs = await this.links.listByPest(input.id);
    if (refs.length > 0) throw new PestInUseError(refs.length);
    await this.pests.delete(input.id);
    await this.audit.record({
      entityType: 'PestDisease', entityId: input.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { deleted: { id: input.id } },
    });
  }
}
```

- [ ] **Step 7 : Lancer → passent.** `pnpm --filter @okko/api test -- pest.use-case` → PASS (5 tests).

- [ ] **Step 8 : Commit**

```bash
git add apps/api/src/application/pest/update-pest.use-case.ts apps/api/src/application/pest/update-pest.use-case.spec.ts apps/api/src/application/pest/delete-pest.use-case.ts apps/api/src/application/pest/delete-pest.use-case.spec.ts
git commit -m "feat(api): use-cases UpdatePest/DeletePest (blocage si rattaché) — TDD"
```

---

## Task 4 : Endpoints + câblage DI + e2e

**Files:**
- Modify: `apps/api/src/presentation/zone/zone.controller.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`
- Create: `apps/api/test/zone-pest-crud.e2e-spec.ts`

**Interfaces:**
- Consumes : les 4 use-cases (Task 2-3) + leurs erreurs.

- [ ] **Step 1 : Câbler les 4 use-cases dans `crop.module.ts`** — ajouter les imports puis, dans `providers`, à côté des providers zone/pest existants :

```ts
// imports (avec les autres)
import { UpdateZoneUseCase } from './application/zone/update-zone.use-case';
import { DeleteZoneUseCase } from './application/zone/delete-zone.use-case';
import { UpdatePestUseCase } from './application/pest/update-pest.use-case';
import { DeletePestUseCase } from './application/pest/delete-pest.use-case';

// providers (après ListZonesUseCase / ListPestsUseCase respectivement)
{
  provide: UpdateZoneUseCase,
  useFactory: (z, a, c) => new UpdateZoneUseCase(z, a, c),
  inject: [ZONE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
},
{
  provide: DeleteZoneUseCase,
  useFactory: (z, l, a, c) => new DeleteZoneUseCase(z, l, a, c),
  inject: [ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
},
{
  provide: UpdatePestUseCase,
  useFactory: (p, a, c) => new UpdatePestUseCase(p, a, c),
  inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
},
{
  provide: DeletePestUseCase,
  useFactory: (p, l, a, c) => new DeletePestUseCase(p, l, a, c),
  inject: [PEST_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
},
```

- [ ] **Step 2 : Endpoints zone** — dans `zone.controller.ts`, injecter les use-cases et ajouter les routes. Ajouter aux imports NestJS `Patch, Delete, HttpCode, ConflictException` et importer les use-cases + erreurs. Constructeur : ajouter `private readonly updateZone: UpdateZoneUseCase, private readonly deleteZone: DeleteZoneUseCase,`. Routes :

```ts
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name: Record<string, string>; country: string; koppen?: string }) {
    try {
      const snap = await this.updateZone.execute({ id, actor: ACTOR, ...body });
      return toZoneDocument(snap);
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    try {
      await this.deleteZone.execute({ id, actor: ACTOR });
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      if (e instanceof ZoneInUseError) throw new ConflictException({ message: `Rattachée à ${e.count} culture(s) — détachez-la d'abord.`, count: e.count });
      throw e;
    }
  }
```

Imports d'erreurs : `import { UpdateZoneUseCase, ZoneNotFoundError } from '../../application/zone/update-zone.use-case';` et `import { DeleteZoneUseCase, ZoneInUseError } from '../../application/zone/delete-zone.use-case';`.

- [ ] **Step 3 : Endpoints ravageur** — symétrique dans `pest.controller.ts` : injecter `UpdatePestUseCase`/`DeletePestUseCase`, mêmes routes `@Patch(':id')` (body `{ name, type, scientificName? }` → `toPestDocument`) et `@Delete(':id')` (`PestNotFoundError` → 404, `PestInUseError` → 409 `{ message: 'Rattaché à N culture(s)…', count }`). Importer les use-cases + erreurs correspondants.

- [ ] **Step 4 : e2e — `apps/api/test/zone-pest-crud.e2e-spec.ts`.** S'inspirer d'un e2e existant du dossier `apps/api/test` pour le bootstrap (`Test.createTestingModule({ imports: [AppModule] })`, `configureApp(app)`, nettoyage DB en `beforeEach`). Écrire les cas :

```ts
// PATCH /zones/:id renomme (200, nom mis à jour) ; PATCH inexistant → 404
// DELETE /zones/:id libre → 204 puis GET → 404
// créer zone + la rattacher à une culture (POST /crops, PUT /crops/:id/zones/:zoneId) puis DELETE /zones/:id → 409 avec body.count === 1
// idem pour /pests (PATCH, DELETE libre, DELETE rattaché → 409)
```

Chaque cas utilise `request(app.getHttpServer())`. Vérifier `expect(res.status).toBe(...)` et pour le 409 `expect(res.body.count).toBe(1)`.

- [ ] **Step 5 : Lancer toute la suite API → verte**

Run: `pnpm --filter @okko/api test`
Expected: PASS (existants + nouveaux ; ~145+ tests).

- [ ] **Step 6 : Commit**

```bash
git add apps/api/src/presentation/zone/zone.controller.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts apps/api/test/zone-pest-crud.e2e-spec.ts
git commit -m "feat(api): endpoints PATCH/DELETE zones & ravageurs (404/409) + e2e"
```

---

## Task 5 : Client API admin

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Produces : `updateZone(id, { name, country, koppen? })`, `deleteZone(id)`, `updatePest(id, { name, type, scientificName? })`, `deletePest(id)`.

- [ ] **Step 1 : Ajouter les 4 fonctions dans `api.ts`** (à côté de `createZone`/`createPest`). Elles lèvent sur `!res.ok` en propageant le message JSON (pour afficher le 409) :

```ts
async function readError(res: Response): Promise<string> {
  try { const b = await res.json(); return typeof b?.message === 'string' ? b.message : `API ${res.status}`; }
  catch { return `API ${res.status}`; }
}

export async function updateZone(id: string, input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await fetch(`${BASE}/zones/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteZone(id: string): Promise<void> {
  const res = await fetch(`${BASE}/zones/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export async function updatePest(id: string, input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await fetch(`${BASE}/pests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deletePest(id: string): Promise<void> {
  const res = await fetch(`${BASE}/pests/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}
```

Si un helper d'erreur analogue existe déjà dans `api.ts`, le réutiliser au lieu de dupliquer `readError`.

- [ ] **Step 2 : Vérifier le build admin**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3 : Commit**

```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): client API update/delete zones & ravageurs"
```

---

## Task 6 : Actions (Modifier / Supprimer) + modales dans les listes

**Files:**
- Create: `apps/admin/src/app/zones/ZoneRowActions.tsx`
- Create: `apps/admin/src/app/pests/PestRowActions.tsx`
- Modify: `apps/admin/src/app/zones/page.tsx`
- Modify: `apps/admin/src/app/pests/page.tsx`

**Interfaces:**
- Consumes : `Dialog…` (`@/components/ui/dialog`), `Input`, `Button`, `Label`, `Select…` (ravageur), `PEST_TYPE_LABELS` (`@/lib/labels`), `updateZone/deleteZone/updatePest/deletePest` (Task 5), `useRouter`.

- [ ] **Step 1 : Créer `zones/ZoneRowActions.tsx`** (Client Component : deux `Dialog` — édition pré-remplie + confirmation de suppression) :

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateZone, deleteZone } from '@/lib/api';

export function ZoneRowActions({ zone }: { zone: { id: string; name: string; country: string; koppen?: string } }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [name, setName] = useState(zone.name);
  const [country, setCountry] = useState(zone.country);
  const [koppen, setKoppen] = useState(zone.koppen ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onOk(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="outline" size="sm">Modifier</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la zone</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="z-name">Nom (fr) *</Label><Input id="z-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="z-country">Pays *</Label><Input id="z-country" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="z-koppen">Köppen</Label><Input id="z-koppen" value={koppen} onChange={(e) => setKoppen(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateZone(zone.id, { name: { fr: name }, country, koppen: koppen || undefined }), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer la zone &laquo;&nbsp;{zone.name}&nbsp;&raquo; ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deleteZone(zone.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `pests/PestRowActions.tsx`** — même structure, avec un `Select` de type via `PEST_TYPE_LABELS` (au lieu du champ pays/köppen). Props : `pest: { id: string; name: string; type: string; scientificName?: string }`. État `name`, `type` (init `pest.type`), `scientificName`. Le bouton Enregistrer appelle `updateZone`→`updatePest(pest.id, { name: { fr: name }, type, scientificName: scientificName || undefined })`. Le select :

```tsx
<Select value={type} onValueChange={setType}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {Object.entries(PEST_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
  </SelectContent>
</Select>
```
La modale de suppression appelle `deletePest(pest.id)` ; le titre « Supprimer le ravageur … ? ».

- [ ] **Step 3 : Brancher la colonne actions dans `zones/page.tsx`** — importer `ZoneRowActions`, ajouter un `<TableHead className="text-right">Actions</TableHead>` en fin d'en-tête et, par ligne, `<TableCell className="text-right"><ZoneRowActions zone={z} /></TableCell>`. `z` a déjà `{ id, name, country, koppen }`.

- [ ] **Step 4 : Brancher dans `pests/page.tsx`** — idem avec `PestRowActions pest={p}` (`p` a `{ id, name, type, scientificName }`). Conserver le rendu FR de `p.type` via `labelOf(PEST_TYPE_LABELS, p.type)` dans sa cellule (déjà en place).

- [ ] **Step 5 : Vérifier le build admin**

Run: `pnpm --filter @okko/admin build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6 : Commit**

```bash
git add apps/admin/src/app/zones/ZoneRowActions.tsx apps/admin/src/app/pests/PestRowActions.tsx apps/admin/src/app/zones/page.tsx apps/admin/src/app/pests/page.tsx
git commit -m "feat(admin): colonne actions + modales édition/suppression zones & ravageurs"
```

---

## Notes de vérification finale (revue de branche)

- **Blocage** : impossible de supprimer une zone/ravageur rattaché(e) — 409 + count, message affiché dans la modale ; l'entité reste en base.
- **Préservation** : un `PATCH` ne perd pas les champs avancés (`notes`, `annualRainfall`, `photos`…).
- **Renommage propagé** : renommer une zone/ravageur met à jour son nom sur les fiches culture (résolution par id).
- **Suite API verte** (existants + nouveaux) ; **build admin** OK ; aucune régression Créer/Lister.
- **Audit** cohérent : update/delete enregistrent une entrée comme la création.
