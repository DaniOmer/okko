# Ravageurs — Brique 5 (Gestion) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la section Gestion (prévention, lutte biologique, prédateurs, parasitoïdes, produits homologués, résistances) à l'entité `Pest` et à sa fiche.

**Architecture:** Mirroir des Briques 2/3/4. Champs intrinsèques (savoir général) stockés en colonnes JSON Prisma. Méthode domaine `setManagement()` en remplacement complet. Endpoint de section `PATCH /pests/:id/management`. Admin : nouveau composant `ApprovedProductsEditor` (lignes {nom, pays}), réutilise `TagListInput`, `PestManagementEditor` via `EditorShell`, section Gestion sur la fiche.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migration additive uniquement** : `ADD COLUMN`, inspecter le SQL, appliquer. La base a 1 ligne `Pest` à préserver (nullable → sûr). Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Remplacement complet** à l'enregistrement de la gestion (pas de préservation `??`).
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- Le constructeur `Pest` est POSITIONNEL (13 params, `_distribution` en dernier). Ce plan ajoute UN param `_management` (14ᵉ, dernier). TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `fromSnapshot`) doivent passer 14 args dans le bon ordre — un décalage corrompt silencieusement des champs.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine `Pest` — champs gestion + `setManagement()`

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.management.spec.ts` (create)

**Interfaces:**
- Produces (added to `pest.ts`):
  ```ts
  export interface ApprovedProductJSON { name: string; country?: string; }
  export interface ManagementSnapshot { prevention?: Record<string,string>; biologicalControl?: Record<string,string>; predators?: string[]; parasitoids?: string[]; approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string,string>; }
  // PestSnapshot += the 6 flat fields
  // Pest: get management(): ManagementSnapshot ; setManagement(m: { prevention?: TranslatableText; biologicalControl?: TranslatableText; predators?: string[]; parasitoids?: string[]; approvedProducts?: ApprovedProductJSON[]; knownResistances?: TranslatableText }): Pest
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.management.spec.ts`:
```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } }).setDamage({ attackedOrgans: ['LEAVES'] })
  .setDistribution({ geographicAreas: ['Afrique'] });

describe('Pest.setManagement', () => {
  it('remplace en bloc et préserve identité + biologie + dégâts + répartition', () => {
    const p = base().setManagement({
      prevention: TranslatableText.create({ fr: 'Rotation des cultures' }),
      biologicalControl: TranslatableText.create({ fr: 'Lâchers de Trichogramma' }),
      predators: ['Coccinelle'],
      parasitoids: ['Trichogramma'],
      approvedProducts: [{ name: 'Bacillus thuringiensis', country: 'BJ' }, { name: 'Spinosad' }],
      knownResistances: TranslatableText.create({ fr: 'Résistance aux pyréthrinoïdes' }),
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.attackedOrgans).toEqual(['LEAVES']);                // dégâts préservés
    expect(s.geographicAreas).toEqual(['Afrique']);              // répartition préservée
    expect(s.prevention).toEqual({ fr: 'Rotation des cultures' });
    expect(s.predators).toEqual(['Coccinelle']);
    expect(s.parasitoids).toEqual(['Trichogramma']);
    expect(s.approvedProducts).toEqual([{ name: 'Bacillus thuringiensis', country: 'BJ' }, { name: 'Spinosad' }]);
    expect(s.knownResistances).toEqual({ fr: 'Résistance aux pyréthrinoïdes' });
  });

  it('efface les champs gestion quand le payload est vide', () => {
    const withMgmt = base().setManagement({ predators: ['X'], prevention: TranslatableText.create({ fr: 'Y' }) });
    const cleared = withMgmt.setManagement({});
    const s = cleared.toSnapshot();
    expect(s.predators).toBeUndefined();
    expect(s.prevention).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.management.spec.ts` → FAIL (`setManagement` inexistant).

- [ ] **Step 3: Implement domaine**

In `apps/api/src/domain/pest/pest.ts`:

3a. Add exported types (after `DistributionSnapshot`, before `PestSnapshot`):
```ts
export interface ApprovedProductJSON { name: string; country?: string; }
export interface ManagementSnapshot {
  prevention?: Record<string, string>;
  biologicalControl?: Record<string, string>;
  predators?: string[];
  parasitoids?: string[];
  approvedProducts?: ApprovedProductJSON[];
  knownResistances?: Record<string, string>;
}
```

3b. Extend `PestSnapshot` — add after `knownPresence?: Record<string, string>;`:
```ts
  prevention?: Record<string, string>;
  biologicalControl?: Record<string, string>;
  predators?: string[];
  parasitoids?: string[];
  approvedProducts?: ApprovedProductJSON[];
  knownResistances?: Record<string, string>;
```

3c. Add constructor param (after `_distribution`):
```ts
    private readonly _management: ManagementSnapshot,
```

3d. `create()` — add `{}` as the last arg (after the distribution `{}`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {}, {}, {},
```

3e. Add getter (after `get distribution()`):
```ts
  get management(): ManagementSnapshot { return { ...this._management }; }
```

3f. `toSnapshot()` — spread management after distribution:
```ts
      ...this._distribution,
      ...this._management,
```

3g. `update()` — add `this._management` as the last arg (after `this._distribution`):
```ts
      this._distribution,
      this._management,
```

3h. `setBiology()` — add `this._management` as the last arg of its `new Pest(...)` (after `this._distribution`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, biology, this._damage, this._distribution, this._management,
```

3i. `setDamage()` — add `this._management` as the last arg of its `new Pest(...)` (after `this._distribution`):
```ts
      this._biology,
      { attackedOrgans: d.attackedOrgans, damageTypes: d.damageTypes, harmfulnessLevel: d.harmfulnessLevel },
      this._distribution,
      this._management,
```

3j. `setDistribution()` — add `this._management` as the last arg of its `new Pest(...)` (after `distribution`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, distribution, this._management,
```

3k. Add the `setManagement` method (after `setDistribution`):
```ts
  setManagement(m: { prevention?: TranslatableText; biologicalControl?: TranslatableText; predators?: string[]; parasitoids?: string[]; approvedProducts?: ApprovedProductJSON[]; knownResistances?: TranslatableText }): Pest {
    const management: ManagementSnapshot = {
      prevention: m.prevention?.toJSON(),
      biologicalControl: m.biologicalControl?.toJSON(),
      predators: m.predators,
      parasitoids: m.parasitoids,
      approvedProducts: m.approvedProducts,
      knownResistances: m.knownResistances?.toJSON(),
    };
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, this._distribution, management,
    );
  }
```

3l. `fromSnapshot()` — add a management object as the last arg (after the distribution object):
```ts
      { geographicAreas: s.geographicAreas, favorableClimate: s.favorableClimate, knownPresence: s.knownPresence },
      { prevention: s.prevention, biologicalControl: s.biologicalControl, predators: s.predators, parasitoids: s.parasitoids, approvedProducts: s.approvedProducts, knownResistances: s.knownResistances },
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (management + distribution + damage + biology + identity specs).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.management.spec.ts
git commit -m "feat(pest): champs gestion + setManagement (remplacement complet, préserve identité/biologie/dégâts/répartition)"
```

---

### Task 2: Migration + repo + read-model (+ test read-model)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_management/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot` management fields (Task 1).
- Produces: `PestDocument` gains the 6 management fields.

- [ ] **Step 1: Prisma schema — 6 colonnes additives**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `knownPresence Json?`:
```prisma
  prevention        Json?
  biologicalControl Json?
  predators         Json?
  parasitoids       Json?
  approvedProducts  Json?
  knownResistances  Json?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_management
```
Inspect the generated `migration.sql` — must be `ADD COLUMN` only (6 nullable JSONB). Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
Expected: applied; client regenerated; existing row preserved. If Prisma asks to reset/drop, STOP and report BLOCKED.

- [ ] **Step 3: Verify row preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Expected: `1`.

- [ ] **Step 4: Repo — persist/read the 6 columns**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:

`toRow` — add before the closing brace of the returned object:
```ts
      prevention: (p.prevention ?? undefined) as Prisma.InputJsonValue | undefined,
      biologicalControl: (p.biologicalControl ?? undefined) as Prisma.InputJsonValue | undefined,
      predators: (p.predators ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      parasitoids: (p.parasitoids ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      approvedProducts: (p.approvedProducts ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      knownResistances: (p.knownResistances ?? undefined) as Prisma.InputJsonValue | undefined,
```

`toSnapshot` — add before the closing brace:
```ts
      prevention: (row.prevention ?? undefined) as Record<string, string> | undefined,
      biologicalControl: (row.biologicalControl ?? undefined) as Record<string, string> | undefined,
      predators: (row.predators ?? undefined) as string[] | undefined,
      parasitoids: (row.parasitoids ?? undefined) as string[] | undefined,
      approvedProducts: (row.approvedProducts ?? undefined) as PestSnapshot['approvedProducts'],
      knownResistances: (row.knownResistances ?? undefined) as Record<string, string> | undefined,
```

- [ ] **Step 5: Read-model — expose the 6 fields**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface:
```ts
  prevention?: Record<string, string>;
  biologicalControl?: Record<string, string>;
  predators?: string[];
  parasitoids?: string[];
  approvedProducts?: PestSnapshot['approvedProducts'];
  knownResistances?: Record<string, string>;
```

In `toPestDocument`, enrich the indexed text (after the existing `knownPresence`/`Présence connue` line):
```ts
  if (p.prevention) lines.push(`Prévention : ${p.prevention[locale] ?? p.prevention['fr']}`);
  if (p.biologicalControl) lines.push(`Lutte biologique : ${p.biologicalControl[locale] ?? p.biologicalControl['fr']}`);
  if (p.predators?.length) lines.push(`Prédateurs : ${p.predators.join(', ')}`);
  if (p.parasitoids?.length) lines.push(`Parasitoïdes : ${p.parasitoids.join(', ')}`);
  if (p.approvedProducts?.length) lines.push(`Produits homologués : ${p.approvedProducts.map((x) => x.name).join(', ')}`);
  if (p.knownResistances) lines.push(`Résistances : ${p.knownResistances[locale] ?? p.knownResistances['fr']}`);
```
And add to the returned object:
```ts
    prevention: p.prevention, biologicalControl: p.biologicalControl,
    predators: p.predators, parasitoids: p.parasitoids,
    approvedProducts: p.approvedProducts, knownResistances: p.knownResistances,
```

- [ ] **Step 6: Read-model test**

Open `apps/api/src/application/pest/pest-read-model.spec.ts`, READ the existing distribution/damage/biology test cases to match style, then add one `it(...)`:
```ts
  it('expose la gestion et enrichit le texte indexé', () => {
    const doc = toPestDocument({
      id: 'p1', name: { fr: 'Chenille' }, type: PestType.INSECT, images: [], metadata: {},
      prevention: { fr: 'Rotation' },
      predators: ['Coccinelle'],
      parasitoids: ['Trichogramma'],
      approvedProducts: [{ name: 'Bt', country: 'BJ' }, { name: 'Spinosad' }],
      knownResistances: { fr: 'Pyréthrinoïdes' },
    } as never);
    expect(doc.prevention).toEqual({ fr: 'Rotation' });
    expect(doc.predators).toEqual(['Coccinelle']);
    expect(doc.approvedProducts).toEqual([{ name: 'Bt', country: 'BJ' }, { name: 'Spinosad' }]);
    expect(doc.serializedText).toContain('Prévention : Rotation');
    expect(doc.serializedText).toContain('Prédateurs : Coccinelle');
    expect(doc.serializedText).toContain('Parasitoïdes : Trichogramma');
    expect(doc.serializedText).toContain('Produits homologués : Bt, Spinosad');
    expect(doc.serializedText).toContain('Résistances : Pyréthrinoïdes');
  });
```
(Follow the existing spec's exact style — `PestType` should already be imported there.)

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance + read-model gestion (migration additive + test)"
```

---

### Task 3: Use-case `SetPestManagement` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-management.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-management.use-case.spec.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest`, `PestSnapshot`, `ApprovedProductJSON` (Task 1) ; `PestRepository`, `PestNotFoundError` (from `update-pest.use-case.ts`) ; `TranslatableText`.
- Produces:
  ```ts
  export interface SetPestManagementInput { id: string; actor: string; prevention?: Record<string,string>; biologicalControl?: Record<string,string>; predators?: string[]; parasitoids?: string[]; approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string,string>; }
  export class SetPestManagementUseCase { execute(input): Promise<PestSnapshot> }
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/application/pest/set-pest-management.use-case.spec.ts`:
```ts
import { SetPestManagementUseCase } from './set-pest-management.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-24T00:00:00.000Z' };

describe('SetPestManagementUseCase', () => {
  it('applique la gestion et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestManagementUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', prevention: { fr: 'Rotation' }, predators: ['Coccinelle'], approvedProducts: [{ name: 'Bt' }] });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.prevention).toEqual({ fr: 'Rotation' });
    expect(out.predators).toEqual(['Coccinelle']);
    expect(out.approvedProducts).toEqual([{ name: 'Bt' }]);
  });
  it('efface la gestion quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setManagement({ predators: ['Coccinelle'] }).toSnapshot());
    const uc = new SetPestManagementUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.predators).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestManagementUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-management.use-case.spec.ts` → FAIL.

- [ ] **Step 3: Implement use-case**

Create `apps/api/src/application/pest/set-pest-management.use-case.ts`:
```ts
import { Pest, PestSnapshot, ApprovedProductJSON } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestManagementInput {
  id: string; actor: string;
  prevention?: Record<string, string>; biologicalControl?: Record<string, string>;
  predators?: string[]; parasitoids?: string[];
  approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string, string>;
}

export class SetPestManagementUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestManagementInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setManagement({
      prevention: input.prevention ? TranslatableText.create(input.prevention) : undefined,
      biologicalControl: input.biologicalControl ? TranslatableText.create(input.biologicalControl) : undefined,
      predators: input.predators,
      parasitoids: input.parasitoids,
      approvedProducts: input.approvedProducts,
      knownResistances: input.knownResistances ? TranslatableText.create(input.knownResistances) : undefined,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { management: { prevention: input.prevention, biologicalControl: input.biologicalControl, predators: input.predators, parasitoids: input.parasitoids, approvedProducts: input.approvedProducts, knownResistances: input.knownResistances } },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-management.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/presentation/pest/pest.controller.ts`:

Import the use-case and the type:
```ts
import { SetPestManagementUseCase } from '../../application/pest/set-pest-management.use-case';
import { ApprovedProductJSON } from '../../domain/pest/pest';
```
Add to the constructor params (after `setPestDistribution`):
```ts
    private readonly setPestManagement: SetPestManagementUseCase,
```
Add the endpoint (after the `distribution` endpoint):
```ts
  @Patch(':id/management')
  async management(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    prevention?: Record<string, string>; biologicalControl?: Record<string, string>;
    predators?: string[]; parasitoids?: string[];
    approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string, string>;
  }) {
    try {
      const snap = await this.setPestManagement.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module registration**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestManagementUseCase } from './application/pest/set-pest-management.use-case';`
- Add a provider next to the other pest use-case providers (near `SetPestDistributionUseCase`):
```ts
    {
      provide: SetPestManagementUseCase,
      useFactory: (p, a, c) => new SetPestManagementUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-management.use-case.ts apps/api/src/application/pest/set-pest-management.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): PATCH /pests/:id/management (SetPestManagementUseCase)"
```

---

### Task 4: Admin — `ApprovedProductsEditor` + plumbing

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/components/ApprovedProductsEditor.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api.ts
  export interface ApprovedProduct { name: string; country?: string; }
  export interface PestManagement { prevention?: Record<string,string>; biologicalControl?: Record<string,string>; predators?: string[]; parasitoids?: string[]; approvedProducts?: ApprovedProduct[]; knownResistances?: Record<string,string>; }
  // Pest += extends PestManagement
  // actions.ts
  export async function setPestManagement(id: string, management: PestManagement): Promise<Pest>
  // components
  export interface ApprovedProductRow { name: string; country?: string; }
  export function ApprovedProductsEditor({ value, onChange }): ...
  ```

- [ ] **Step 1: `api.ts` types**

In `apps/admin/src/lib/api.ts`, add near the other pest types:
```ts
export interface ApprovedProduct { name: string; country?: string; }
export interface PestManagement {
  prevention?: Record<string, string>;
  biologicalControl?: Record<string, string>;
  predators?: string[];
  parasitoids?: string[];
  approvedProducts?: ApprovedProduct[];
  knownResistances?: Record<string, string>;
}
```
Extend the `Pest` interface — add `PestManagement` to its `extends` list:
```ts
export interface Pest extends PestBiology, PestDamage, PestDistribution, PestManagement {
  id: string; name: string; type: string; scientificName?: string;
  family?: string; description?: Record<string, string>; images: ImageRef[]; updatedAt?: string;
}
```

- [ ] **Step 2: `actions.ts` — `setPestManagement`**

In `apps/admin/src/lib/actions.ts`, add after `setPestDistribution`:
```ts
export async function setPestManagement(id: string, management: import('./api').PestManagement): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/management`, jsonInit('PATCH', management));
  return res.json();
}
```

- [ ] **Step 3: `ApprovedProductsEditor`**

Create `apps/admin/src/components/ApprovedProductsEditor.tsx`:
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ApprovedProductRow { name: string; country?: string; }

export function ApprovedProductsEditor({ value, onChange }: { value: ApprovedProductRow[]; onChange: (v: ApprovedProductRow[]) => void }) {
  const add = () => onChange([...value, { name: '' }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setName = (i: number, name: string) => onChange(value.map((p, k) => (k === i ? { ...p, name } : p)));
  const setCountry = (i: number, country: string) => onChange(value.map((p, k) => (k === i ? { ...p, country: country || undefined } : p)));
  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8" placeholder="Produit / matière active" value={p.name} onChange={(e) => setName(i, e.target.value)} />
          <Input className="h-8 w-28" placeholder="Pays" value={p.country ?? ''} onChange={(e) => setCountry(i, e.target.value)} />
          <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter un produit</Button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/ApprovedProductsEditor.tsx
git commit -m "feat(admin): ApprovedProductsEditor + types/action gestion"
```

---

### Task 5: `PestManagementEditor` + section fiche + page

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestManagementEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `TagListInput`, `ApprovedProductsEditor` (+ `ApprovedProductRow`), `setPestManagement`, `Pest`.

- [ ] **Step 1: `PestManagementEditor`**

Create `apps/admin/src/app/pests/[id]/editors/PestManagementEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { TagListInput } from '@/components/TagListInput';
import { ApprovedProductsEditor, type ApprovedProductRow } from '@/components/ApprovedProductsEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestManagement } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestManagementEditor({ pest }: { pest: Pest }) {
  const [prevention, setPrevention] = useState(pest.prevention?.fr ?? '');
  const [biologicalControl, setBiologicalControl] = useState(pest.biologicalControl?.fr ?? '');
  const [predators, setPredators] = useState<string[]>(pest.predators ?? []);
  const [parasitoids, setParasitoids] = useState<string[]>(pest.parasitoids ?? []);
  const [products, setProducts] = useState<ApprovedProductRow[]>(pest.approvedProducts ?? []);
  const [knownResistances, setKnownResistances] = useState(pest.knownResistances?.fr ?? '');

  return (
    <EditorShell label="Modifier la gestion">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Prévention</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={prevention} onChange={(e) => setPrevention(e.target.value)} /></div>
          <div className="space-y-1"><Label>Lutte biologique</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={biologicalControl} onChange={(e) => setBiologicalControl(e.target.value)} /></div>
          <div className="space-y-1"><Label>Prédateurs naturels</Label><TagListInput value={predators} onChange={setPredators} placeholder="ex. Coccinelle" /></div>
          <div className="space-y-1"><Label>Parasitoïdes</Label><TagListInput value={parasitoids} onChange={setParasitoids} placeholder="ex. Trichogramma" /></div>
          <div className="space-y-1"><Label>Produits homologués <span className="font-normal text-muted-foreground">(selon le pays)</span></Label><ApprovedProductsEditor value={products} onChange={setProducts} /></div>
          <div className="space-y-1"><Label>Résistances connues</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={knownResistances} onChange={(e) => setKnownResistances(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestManagement(pest.id, {
                prevention: prevention ? { fr: prevention } : undefined,
                biologicalControl: biologicalControl ? { fr: biologicalControl } : undefined,
                predators,
                parasitoids,
                approvedProducts: products.filter((p) => p.name.trim() !== ''),
                knownResistances: knownResistances ? { fr: knownResistances } : undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Section Gestion (lecture) dans `PestFicheView`**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Add the icon import (keep all existing imports):
```ts
import { ShieldCheck } from 'lucide-react';
```

2b. After the existing `hasDistribution` computation, add:
```ts
  const hasManagement = !!(b.prevention?.fr || b.biologicalControl?.fr || (b.predators?.length) || (b.parasitoids?.length) || (b.approvedProducts?.length) || b.knownResistances?.fr);
```

2c. Insert the Gestion section INSIDE the `<div className="px-6">`, immediately AFTER the closing `</section>` of the Répartition block and BEFORE the `{photos.length > 0 && (` Photos block:
```tsx
        {hasManagement && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><ShieldCheck className="h-4 w-4" /></span>
              Gestion
            </h2>
            <div className="space-y-2 text-sm">
              {b.prevention?.fr && <p><span className="text-muted-foreground">Prévention : </span>{b.prevention.fr}</p>}
              {b.biologicalControl?.fr && <p><span className="text-muted-foreground">Lutte biologique : </span>{b.biologicalControl.fr}</p>}
              {(b.predators?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Prédateurs : </span>
                  {b.predators!.map((x) => <span key={x} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{x}</span>)}
                </div>
              )}
              {(b.parasitoids?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Parasitoïdes : </span>
                  {b.parasitoids!.map((x) => <span key={x} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{x}</span>)}
                </div>
              )}
              {(b.approvedProducts?.length ?? 0) > 0 && (
                <div>
                  <span className="text-muted-foreground">Produits homologués : </span>
                  {b.approvedProducts!.map((p, i) => (
                    <span key={i}>{i > 0 ? ' · ' : ''}{p.name}{p.country ? ` (${p.country})` : ''}</span>
                  ))}
                </div>
              )}
              {b.knownResistances?.fr && <p><span className="text-muted-foreground">Résistances : </span>{b.knownResistances.fr}</p>}
            </div>
          </section>
        )}
```

- [ ] **Step 3: Monter l'éditeur sur la page `/pests/[id]`**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Add import: `import { PestManagementEditor } from './editors/PestManagementEditor';`
- In the editors `<div className="flex gap-2">` (which already holds Biologie + Dégâts + Répartition editors), add after `PestDistributionEditor`:
```tsx
          <PestManagementEditor pest={pest} />
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]"
git commit -m "feat(admin): section Gestion sur la fiche ravageur + PestManagementEditor"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. Sur `/pests/<id>` : « Modifier la gestion » ouvre l'éditeur (prévention, lutte bio, prédateurs, parasitoïdes, produits {nom,pays}, résistances) ; enregistrer ; la section Gestion s'affiche (masquée si tout vide) ; recharger confirme la persistance ; vérifier que Biologie/Dégâts/Répartition ne sont pas affectés.

---

## Notes de fin

- **`setManagement` remplace en bloc** — un champ vidé est effacé (cohérent avec les autres `setX`).
- **Produits** : les lignes au nom vide sont filtrées à l'enregistrement (`.filter(p => p.name.trim() !== '')`).
- **Brique suivante** : Sources documentaires (dernière), même pattern.
