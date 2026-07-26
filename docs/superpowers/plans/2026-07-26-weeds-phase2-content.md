# Bioagresseurs — Phase 2 : contenu adventice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le modèle `Pest` pour les adventices (kind=WEED) : nuisibilité (`nuisanceTypes` sur les dégâts), bloc de traits adventice `_weed` (reproduction, dissémination, profondeur de levée, banque de graines) avec son endpoint et son éditeur, et un rendu (fiche + éditeurs) conscient du kind.

**Architecture:** On étend l'agrégat immuable `Pest` (Phase 1 a posé `kind`). `nuisanceTypes` s'ajoute au bloc `_damage` existant. Un nouveau petit bloc `_weed` (17ᵉ param positionnel du constructeur) porte les 4 traits adventice, avec une méthode `setWeed()` (remplacement complet) et `PATCH /pests/:id/weed`. La fiche et les éditeurs deviennent conscients du kind : pour une adventice, on masque les champs animaux (générations/an, prédateurs, parasitoïdes, organes attaqués), on relibelle « Dégâts » → « Nuisibilité » / « Symptômes » → « Effets observés », et on affiche les traits `_weed`.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts` ni `*.int-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Migration additive uniquement** (`ADD COLUMN`, tout en `Json?`/`String?` nullable — aucun défaut requis, tout est optionnel). Inspecter le SQL généré ; si Prisma propose reset/drop → STOP + BLOCKED. Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- Le constructeur `Pest` est POSITIONNEL. Après Phase 1 il a 16 params (`_kind` en 16ᵉ, dernier). Ce plan ajoute UN param `_weed: WeedSnapshot` en 17ᵉ (dernier). TOUS les sites d'appel `new Pest(...)` (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources`, `setWeed`, `fromSnapshot`) doivent passer 17 args ; les setters préservent `this._weed` (sauf `setWeed` qui le remplace), `create` met `{}`, `fromSnapshot` reconstruit le bloc.
- `nuisanceTypes` vit DANS le bloc `_damage` (donc `toSnapshot` le propage via `...this._damage`, aucun nouveau param constructeur).
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- UI **française**, composants **shadcn** (Select/Calendar, jamais de `<select>` natif). `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.
- Nom interne `Pest` conservé ; libellés UI « bioagresseur / adventice / nuisibilité ».

---

### Task 1: Domaine — `nuisanceTypes` sur le bloc dégâts

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.nuisance.spec.ts` (create)

**Interfaces:**
- Produces: `DamageSnapshot.nuisanceTypes?: string[]`, `PestSnapshot.nuisanceTypes?: string[]`, `setDamage(...)` accepte `nuisanceTypes?: string[]`.

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.nuisance.spec.ts`:
```ts
import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });

describe('Pest damage nuisanceTypes', () => {
  it('setDamage enregistre nuisanceTypes et round-trip', () => {
    const s = base().setDamage({ nuisanceTypes: ['WATER_COMPETITION', 'ALLELOPATHY'], harmfulnessLevel: 'MAJOR' }).toSnapshot();
    expect(s.nuisanceTypes).toEqual(['WATER_COMPETITION', 'ALLELOPATHY']);
    expect(s.harmfulnessLevel).toBe('MAJOR');
  });
  it('setDamage sans nuisanceTypes laisse le champ absent', () => {
    const s = base().setDamage({ attackedOrgans: ['LEAF'] }).toSnapshot();
    expect(s.nuisanceTypes).toBeUndefined();
    expect(s.attackedOrgans).toEqual(['LEAF']);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.nuisance.spec.ts` → FAIL.

- [ ] **Step 3: Implement**

In `apps/api/src/domain/pest/pest.ts`:

3a. `DamageSnapshot` (currently line 20) — add `nuisanceTypes?: string[]`:
```ts
export interface DamageSnapshot { attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; nuisanceTypes?: string[]; }
```

3b. `PestSnapshot` — add near `harmfulnessLevel?: string;`:
```ts
  nuisanceTypes?: string[];
```

3c. `setDamage(...)` signature + built block — add `nuisanceTypes`:
```ts
  setDamage(d: { symptoms?: TranslatableText; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; nuisanceTypes?: string[] }): Pest {
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      d.symptoms,
      this._images, this._notes, this._metadata, this._biology,
      { attackedOrgans: d.attackedOrgans, damageTypes: d.damageTypes, harmfulnessLevel: d.harmfulnessLevel, nuisanceTypes: d.nuisanceTypes },
      this._distribution,
      this._management,
      this._sources, this._kind,
    );
  }
```

3d. `fromSnapshot()` — the damage block (currently `{ attackedOrgans: s.attackedOrgans, damageTypes: s.damageTypes, harmfulnessLevel: s.harmfulnessLevel }`) becomes:
```ts
      { attackedOrgans: s.attackedOrgans, damageTypes: s.damageTypes, harmfulnessLevel: s.harmfulnessLevel, nuisanceTypes: s.nuisanceTypes },
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS.

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.nuisance.spec.ts
git commit -m "feat(pest): nuisanceTypes sur le bloc dégâts (nuisibilité adventice)"
```

---

### Task 2: Domaine — bloc `_weed` + `setWeed`

**Files:**
- Create: `apps/api/src/domain/pest/weed.ts`
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.weed.spec.ts` (create)

**Interfaces:**
- Produces: `WeedSnapshot { reproductionMode?: string[]; disseminationCapacity?: string; emergenceDepth?: MinMaxRangeJSON; seedBankLongevity?: MinMaxRangeJSON }`; `Pest.setWeed(w: WeedSnapshot): Pest`; `get weed(): WeedSnapshot`; `PestSnapshot` gains the 4 weed fields; constructor gains 17ᵉ param `_weed`.

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.weed.spec.ts`:
```ts
import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });

describe('Pest setWeed', () => {
  it('enregistre les traits adventice et round-trip', () => {
    const s = base().setWeed({
      reproductionMode: ['SEEDS', 'RHIZOMES'],
      disseminationCapacity: 'HIGH',
      emergenceDepth: { min: 0, max: 5, unit: 'cm' },
      seedBankLongevity: { min: 2, max: 10, unit: 'ans' },
    }).toSnapshot();
    expect(s.reproductionMode).toEqual(['SEEDS', 'RHIZOMES']);
    expect(s.disseminationCapacity).toBe('HIGH');
    expect(s.emergenceDepth).toEqual({ min: 0, max: 5, unit: 'cm' });
    expect(s.seedBankLongevity).toEqual({ min: 2, max: 10, unit: 'ans' });
  });
  it('remplace le bloc en entier et préserve kind + autres blocs', () => {
    const p = base().setBiology({ lifeCycle: { fr: 'annuel' } }).setWeed({ disseminationCapacity: 'LOW' });
    const s = p.setWeed({ reproductionMode: ['SEEDS'] }).toSnapshot();
    expect(s.disseminationCapacity).toBeUndefined();      // remplacement complet
    expect(s.reproductionMode).toEqual(['SEEDS']);
    expect(s.lifeCycle).toEqual({ fr: 'annuel' });          // autre bloc préservé
    expect(s.kind).toBe(PestKind.WEED);                     // kind préservé
  });
  it('création : bloc weed vide (champs absents)', () => {
    const s = base().toSnapshot();
    expect(s.reproductionMode).toBeUndefined();
    expect(s.emergenceDepth).toBeUndefined();
  });
  it('valide min<=max sur les plages', () => {
    expect(() => base().setWeed({ emergenceDepth: { min: 5, max: 1 } })).toThrow();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.weed.spec.ts` → FAIL.

- [ ] **Step 3: Create `WeedSnapshot`**

Create `apps/api/src/domain/pest/weed.ts`:
```ts
import { MinMaxRangeJSON } from '../shared/min-max-range';

export interface WeedSnapshot {
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON;
  seedBankLongevity?: MinMaxRangeJSON;
}
```

- [ ] **Step 4: Thread `_weed` through `pest.ts`**

In `apps/api/src/domain/pest/pest.ts`:

4a. Import (near the other imports):
```ts
import { WeedSnapshot } from './weed';
```

4b. `PestSnapshot` — add the 4 weed fields (near `sources?`):
```ts
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON;
  seedBankLongevity?: MinMaxRangeJSON;
```

4c. Constructor — add `_weed` as the LAST (17ᵉ) param, after `_kind`:
```ts
    private readonly _weed: WeedSnapshot,
```

4d. `create()` — append `{}` as the 17ᵉ arg (after `props.kind ?? PestKind.ANIMAL`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {}, {}, {}, [], props.kind ?? PestKind.ANIMAL, {},
```

4e. Add getter (after `get kind()`):
```ts
  get weed(): WeedSnapshot { return { ...this._weed }; }
```

4f. `toSnapshot()` — add `...this._weed,` in the spread chain (after `...this._management,`):
```ts
      ...this._management,
      ...this._weed,
      sources: this._sources.length ? this._sources : undefined,
```

4g. `update()` — append `this._weed` as the 17ᵉ arg (after `fields.kind ?? this._kind`):
```ts
      fields.kind ?? this._kind,
      this._weed,
```

4h. `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources` — each currently ends `..., this._kind,`. Append `this._weed,` as the 17ᵉ arg in ALL FIVE. (For `setDamage` the tail becomes `this._sources, this._kind, this._weed,`.)

4i. Add `setWeed` (after `setSources`):
```ts
  setWeed(w: WeedSnapshot): Pest {
    const range = (r?: MinMaxRangeJSON) => (r ? MinMaxRange.create(r).toJSON() : undefined);
    const weed: WeedSnapshot = {
      reproductionMode: w.reproductionMode,
      disseminationCapacity: w.disseminationCapacity,
      emergenceDepth: range(w.emergenceDepth),
      seedBankLongevity: range(w.seedBankLongevity),
    };
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, this._distribution, this._management,
      this._sources, this._kind, weed,
    );
  }
```

4j. `fromSnapshot()` — append the weed block as the 17ᵉ arg (after `s.kind ?? PestKind.ANIMAL`):
```ts
      s.kind ?? PestKind.ANIMAL,
      { reproductionMode: s.reproductionMode, disseminationCapacity: s.disseminationCapacity, emergenceDepth: s.emergenceDepth, seedBankLongevity: s.seedBankLongevity },
```

- [ ] **Step 5: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (weed + all existing pest specs; every `new Pest(...)` now passes 17 args).

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/weed.ts apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.weed.spec.ts
git commit -m "feat(pest): bloc _weed (reproduction, dissémination, levée, banque de graines) + setWeed"
```

---

### Task 3: Persistance + read-model (nuisanceTypes + traits weed)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_weed_fields/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot` (Tasks 1-2).
- Produces: `PestDocument` gains `nuisanceTypes` + the 4 weed fields.

- [ ] **Step 1: Prisma schema — 5 nullable columns**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `harmfulnessLevel String?` (and the sources line region):
```prisma
  nuisanceTypes        Json?
  reproductionMode     Json?
  disseminationCapacity String?
  emergenceDepth       Json?
  seedBankLongevity    Json?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_weed_fields
```
Inspect the generated `migration.sql` — must be only `ADD COLUMN` statements (5 nullable columns, no NOT NULL, no default, no drop). Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
If Prisma proposes reset/drop → STOP + report BLOCKED.

- [ ] **Step 3: Verify row preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Expected: `1`.

- [ ] **Step 4: Repo `toRow` — write 5 fields**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`, `toRow`, add (near `harmfulnessLevel`/`sources`):
```ts
      nuisanceTypes: (p.nuisanceTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      reproductionMode: (p.reproductionMode ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      disseminationCapacity: p.disseminationCapacity ?? null,
      emergenceDepth: (p.emergenceDepth ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      seedBankLongevity: (p.seedBankLongevity ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
```

- [ ] **Step 5: Repo `toSnapshot` — read 5 fields**

In the same file, `toSnapshot`, add (near `harmfulnessLevel`/`sources`):
```ts
      nuisanceTypes: (row.nuisanceTypes ?? undefined) as string[] | undefined,
      reproductionMode: (row.reproductionMode ?? undefined) as string[] | undefined,
      disseminationCapacity: row.disseminationCapacity ?? undefined,
      emergenceDepth: (row.emergenceDepth ?? undefined) as PestSnapshot['emergenceDepth'],
      seedBankLongevity: (row.seedBankLongevity ?? undefined) as PestSnapshot['seedBankLongevity'],
```

- [ ] **Step 6: Read-model — expose + index**

In `apps/api/src/application/pest/pest-read-model.ts`:

6a. `PestDocument` interface — add (near `harmfulnessLevel`):
```ts
  nuisanceTypes?: string[];
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: PestSnapshot['emergenceDepth'];
  seedBankLongevity?: PestSnapshot['seedBankLongevity'];
```

6b. `toPestDocument` — serializedText lines (add after the `harmfulnessLevel` line, ~line 50):
```ts
  if (p.nuisanceTypes?.length) lines.push(`Nuisibilité : ${p.nuisanceTypes.join(', ')}`);
  if (p.reproductionMode?.length) lines.push(`Reproduction : ${p.reproductionMode.join(', ')}`);
  if (p.disseminationCapacity) lines.push(`Dissémination : ${p.disseminationCapacity}`);
  if (p.emergenceDepth) lines.push(`Profondeur de levée : ${p.emergenceDepth.min}–${p.emergenceDepth.max} cm`);
  if (p.seedBankLongevity) lines.push(`Banque de graines : ${p.seedBankLongevity.min}–${p.seedBankLongevity.max} ans`);
```

6c. `toPestDocument` return object — add (near `harmfulnessLevel`):
```ts
    nuisanceTypes: p.nuisanceTypes,
    reproductionMode: p.reproductionMode, disseminationCapacity: p.disseminationCapacity,
    emergenceDepth: p.emergenceDepth, seedBankLongevity: p.seedBankLongevity,
```

- [ ] **Step 7: Read-model test**

In `apps/api/src/application/pest/pest-read-model.spec.ts`, add (adapt the fixture shape to the existing cases' style with `as never`):
```ts
  it('expose nuisanceTypes et les traits weed', () => {
    const doc = toPestDocument({
      id: 'p1', name: { fr: 'Chiendent' }, type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED,
      images: [], metadata: {},
      nuisanceTypes: ['WATER_COMPETITION'], reproductionMode: ['RHIZOMES'],
      disseminationCapacity: 'HIGH', emergenceDepth: { min: 0, max: 5, unit: 'cm' },
      seedBankLongevity: { min: 2, max: 10, unit: 'ans' },
    } as never);
    expect(doc.nuisanceTypes).toEqual(['WATER_COMPETITION']);
    expect(doc.disseminationCapacity).toBe('HIGH');
    expect(doc.emergenceDepth).toEqual({ min: 0, max: 5, unit: 'cm' });
    expect(doc.serializedText).toContain('Dissémination');
  });
```

- [ ] **Step 8: Typecheck + spec + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance + read-model nuisanceTypes & traits weed (migration additive)"
```

---

### Task 4: API — `nuisanceTypes` sur dégâts + `SetPestWeedUseCase` + endpoint

**Files:**
- Modify: `apps/api/src/application/pest/set-pest-damage.use-case.ts`
- Create: `apps/api/src/application/pest/set-pest-weed.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-weed.use-case.spec.ts` (create)
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest.setWeed`, `setDamage` (Tasks 1-2); `PestNotFoundError` (from `update-pest.use-case`).
- Produces: `SetPestWeedUseCase`; `PATCH /pests/:id/weed`; `PATCH /pests/:id/damage` accepts `nuisanceTypes`.

- [ ] **Step 1: `set-pest-damage.use-case` accepte nuisanceTypes**

In `apps/api/src/application/pest/set-pest-damage.use-case.ts`:
- `SetPestDamageInput` — add `nuisanceTypes?: string[];`
- In `.setDamage({...})` — add `nuisanceTypes: input.nuisanceTypes,`
- In the audit `changes.damage` object — add `nuisanceTypes: input.nuisanceTypes`.

- [ ] **Step 2: Failing test for `SetPestWeedUseCase`**

Create `apps/api/src/application/pest/set-pest-weed.use-case.spec.ts` (mirror `set-pest-sources.use-case.spec.ts` — READ it first for the exact test harness: in-memory repo, fake audit, fake clock, seeding a pest). Cases:
```ts
// - inconnu -> throws PestNotFoundError
// - set puis relecture : findById renvoie les traits weed
// - remplacement complet : un 2e setWeed efface les champs non fournis
```
Use `SetPestWeedUseCase` with input `{ id, actor, reproductionMode, disseminationCapacity, emergenceDepth, seedBankLongevity }`.

- [ ] **Step 3: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-weed.use-case.spec.ts` → FAIL (module introuvable).

- [ ] **Step 4: Create `SetPestWeedUseCase`**

Create `apps/api/src/application/pest/set-pest-weed.use-case.ts`:
```ts
import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { MinMaxRangeJSON } from '../../domain/shared/min-max-range';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestWeedInput {
  id: string; actor: string;
  reproductionMode?: string[]; disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON; seedBankLongevity?: MinMaxRangeJSON;
}

export class SetPestWeedUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestWeedInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setWeed({
      reproductionMode: input.reproductionMode,
      disseminationCapacity: input.disseminationCapacity,
      emergenceDepth: input.emergenceDepth,
      seedBankLongevity: input.seedBankLongevity,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { weed: { reproductionMode: input.reproductionMode, disseminationCapacity: input.disseminationCapacity, emergenceDepth: input.emergenceDepth, seedBankLongevity: input.seedBankLongevity } },
    });
    return snap;
  }
}
```

- [ ] **Step 5: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-weed.use-case.spec.ts` → PASS.

- [ ] **Step 6: Controller — nuisanceTypes + endpoint weed**

In `apps/api/src/presentation/pest/pest.controller.ts`:
- Import: `import { SetPestWeedUseCase } from '../../application/pest/set-pest-weed.use-case';` and `import { MinMaxRangeJSON } from '../../domain/shared/min-max-range';`
- Constructor — inject `private readonly setPestWeed: SetPestWeedUseCase,` (after `setPestSources`).
- `@Patch(':id/damage')` body type — add `nuisanceTypes?: string[];` (the `...body` spread already forwards it).
- Add a new handler after `sources`:
```ts
  @Patch(':id/weed')
  async weed(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    reproductionMode?: string[]; disseminationCapacity?: string;
    emergenceDepth?: MinMaxRangeJSON; seedBankLongevity?: MinMaxRangeJSON;
  }) {
    try {
      const snap = await this.setPestWeed.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 7: Module wiring**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestWeedUseCase } from './application/pest/set-pest-weed.use-case';` (near the other `SetPest*` imports).
- Add a provider (mirror `SetPestSourcesUseCase`, after it):
```ts
    {
      provide: SetPestWeedUseCase,
      useFactory: (p, a, c) => new SetPestWeedUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```
(If the module has an explicit `controllers`/`providers` array, ensure `SetPestWeedUseCase` is in `providers` via this factory — the controller injects it by class token.)

- [ ] **Step 8: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-damage.use-case.ts apps/api/src/application/pest/set-pest-weed.use-case.ts apps/api/src/application/pest/set-pest-weed.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): API nuisanceTypes (dégâts) + SetPestWeedUseCase + PATCH /pests/:id/weed"
```

---

### Task 5: Admin — plomberie (types, action, libellés)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/labels.ts`

**Interfaces:**
- Produces: `PestDamage.nuisanceTypes?`, `PestWeed` interface, `Pest extends … PestWeed`, `setPestWeed(id, weed)`, `NUISANCE_TYPE_LABELS`, `REPRODUCTION_MODE_LABELS`, `DISSEMINATION_LABELS`.

- [ ] **Step 1: `api.ts`**

- `PestDamage` interface — add `nuisanceTypes?: string[];`
- Add a new interface after `PestManagement` (before `Source`):
```ts
export interface PestWeed {
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON;
  seedBankLongevity?: MinMaxRangeJSON;
}
```
- `Pest` — extend it:
```ts
export interface Pest extends PestBiology, PestDamage, PestDistribution, PestManagement, PestSources, PestWeed {
```

- [ ] **Step 2: `actions.ts`**

Add after `setPestSources`:
```ts
export async function setPestWeed(id: string, weed: import('./api').PestWeed): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/weed`, jsonInit('PATCH', weed));
  return res.json();
}
```
(`setPestDamage` already takes `PestDamage`, which now includes `nuisanceTypes` — no change needed there.)

- [ ] **Step 3: `labels.ts`**

Add:
```ts
export const NUISANCE_TYPE_LABELS: Record<string, string> = {
  WATER_COMPETITION: 'Concurrence hydrique', LIGHT_COMPETITION: 'Concurrence lumineuse',
  NUTRIENT_COMPETITION: 'Concurrence nutritive', ALLELOPATHY: 'Allélopathie',
  HOST_PLANT: 'Plante-hôte', HARVEST_HINDRANCE: 'Gêne à la récolte',
};
export const REPRODUCTION_MODE_LABELS: Record<string, string> = {
  SEEDS: 'Graines', RHIZOMES: 'Rhizomes', STOLONS: 'Stolons', TUBERS: 'Tubercules',
};
export const DISSEMINATION_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib/api.ts apps/admin/src/lib/actions.ts apps/admin/src/lib/labels.ts
git commit -m "feat(admin): plomberie nuisanceTypes + PestWeed (type, action, libellés)"
```

---

### Task 6: Admin — `PestWeedEditor` + éditeurs conscients du kind

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestWeedEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/editors/PestDamageEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/editors/PestManagementEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `setPestWeed`, `NUISANCE_TYPE_LABELS`, `REPRODUCTION_MODE_LABELS`, `DISSEMINATION_LABELS` (Task 5).

- [ ] **Step 1: `PestWeedEditor` (nouveau, adventice seulement)**

Create `apps/admin/src/app/pests/[id]/editors/PestWeedEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { REPRODUCTION_MODE_LABELS, DISSEMINATION_LABELS } from '@/lib/labels';
import { setPestWeed } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestWeedEditor({ pest }: { pest: Pest }) {
  const [reproduction, setReproduction] = useState<string[]>(pest.reproductionMode ?? []);
  const [dissemination, setDissemination] = useState(pest.disseminationCapacity ?? '');
  const [emergenceDepth, setEmergenceDepth] = useState<MinMax | undefined>(pest.emergenceDepth);
  const [seedBank, setSeedBank] = useState<MinMax | undefined>(pest.seedBankLongevity);

  return (
    <EditorShell label="Modifier les traits adventice">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Mode de reproduction</Label><ChipMultiSelect options={REPRODUCTION_MODE_LABELS} value={reproduction} onChange={setReproduction} /></div>
          <div className="space-y-1">
            <Label>Capacité de dissémination</Label>
            <Select value={dissemination} onValueChange={setDissemination}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DISSEMINATION_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <MinMaxRangeInput label="Profondeur de levée" unit="cm" value={emergenceDepth} onChange={setEmergenceDepth} />
          <MinMaxRangeInput label="Longévité de la banque de graines" unit="ans" value={seedBank} onChange={setSeedBank} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestWeed(pest.id, {
                reproductionMode: reproduction,
                disseminationCapacity: dissemination || undefined,
                emergenceDepth,
                seedBankLongevity: seedBank,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: `PestDamageEditor` conscient du kind**

In `apps/admin/src/app/pests/[id]/editors/PestDamageEditor.tsx`:
- Import `NUISANCE_TYPE_LABELS` (alongside the existing label imports).
- Add `const isWeed = pest.kind === 'WEED';` and `const [nuisance, setNuisance] = useState<string[]>(pest.nuisanceTypes ?? []);`
- `EditorShell label={isWeed ? 'Modifier la nuisibilité' : 'Modifier les dégâts'}`.
- Render kind-conditionally: when `isWeed`, replace the two blocks « Organes attaqués » and « Types de dégâts » with a single « Types de nuisibilité » `ChipMultiSelect options={NUISANCE_TYPE_LABELS} value={nuisance} onChange={setNuisance}`; keep « Niveau de nuisibilité »; relabel the symptoms `<Label>` to `{isWeed ? 'Effets observés' : 'Symptômes caractéristiques'}`.
- When NOT weed, keep the current organs/damageTypes blocks unchanged.
- Submit: pass `nuisanceTypes: isWeed ? nuisance : undefined`, and `attackedOrgans: isWeed ? undefined : organs`, `damageTypes: isWeed ? undefined : types` (avoid writing animal fields on a weed and vice-versa). Keep `symptoms` and `harmfulnessLevel` for both.

Concretely the submit becomes:
```tsx
              await setPestDamage(pest.id, {
                symptoms: symptoms ? { fr: symptoms } : undefined,
                attackedOrgans: isWeed ? undefined : organs,
                damageTypes: isWeed ? undefined : types,
                nuisanceTypes: isWeed ? nuisance : undefined,
                harmfulnessLevel: harmfulness || undefined,
              });
```

- [ ] **Step 3: `PestBiologyEditor` — masquer générations/an si adventice**

In `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`:
- Add `const isWeed = pest.kind === 'WEED';`
- Wrap the `<MinMaxRangeInput label="Générations par an" ... />` (line 33) in `{!isWeed && ( ... )}`.
- In submit, pass `generationsPerYear: isWeed ? undefined : generations`.

- [ ] **Step 4: `PestManagementEditor` — masquer prédateurs/parasitoïdes si adventice**

In `apps/admin/src/app/pests/[id]/editors/PestManagementEditor.tsx`:
- Add `const isWeed = pest.kind === 'WEED';`
- Wrap the « Prédateurs naturels » and « Parasitoïdes » blocks (lines 25-26) in `{!isWeed && ( <> ... </> )}`.
- In submit, pass `predators: isWeed ? undefined : predators` and `parasitoids: isWeed ? undefined : parasitoids`.

- [ ] **Step 5: Monter `PestWeedEditor` sur la fiche (adventice seulement)**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Import `import { PestWeedEditor } from './editors/PestWeedEditor';`
- In the editors bar, add (after `PestBiologyEditor` or near it) — conditionally:
```tsx
          {pest.kind === 'WEED' && <PestWeedEditor pest={pest} />}
```

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]/editors/PestWeedEditor.tsx" "apps/admin/src/app/pests/[id]/editors/PestDamageEditor.tsx" "apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx" "apps/admin/src/app/pests/[id]/editors/PestManagementEditor.tsx" "apps/admin/src/app/pests/[id]/page.tsx"
git commit -m "feat(admin): PestWeedEditor + éditeurs conscients du kind (nuisibilité, masquages adventice)"
```

---

### Task 7: Admin — fiche (`PestFicheView`) consciente du kind

**Files:**
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`

**Interfaces:**
- Consumes: `pest.kind`, `pest.nuisanceTypes`, the 4 weed fields, `NUISANCE_TYPE_LABELS`, `REPRODUCTION_MODE_LABELS`, `DISSEMINATION_LABELS`, `PEST_KIND_LABELS`, `WEED_CATEGORY_LABELS`.

- [ ] **Step 1: Rendu conscient du kind**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

1a. Imports — add to the `@/lib/labels` import: `PEST_KIND_LABELS, WEED_CATEGORY_LABELS, NUISANCE_TYPE_LABELS, REPRODUCTION_MODE_LABELS, DISSEMINATION_LABELS`. From `lucide-react`, add `Sprout` (icône adventice).

1b. Add near the top of the component (after `const b = pest;`):
```tsx
  const isWeed = pest.kind === 'WEED';
  const categoryLabel = isWeed ? labelOf(WEED_CATEGORY_LABELS, pest.type) : labelOf(PEST_TYPE_LABELS, pest.type);
  const hasWeedTraits = !!((b.reproductionMode?.length) || b.disseminationCapacity || b.emergenceDepth || b.seedBankLongevity);
```

1c. Hero badge — replace the `🐛 {labelOf(PEST_TYPE_LABELS, pest.type)}` span content with a kind-aware badge:
```tsx
              {isWeed ? '🌿' : '🐛'} {categoryLabel}
```
And add a kind chip before it (Ravageur/Adventice):
```tsx
            <span className="inline-block rounded-full bg-[#eef3f7] px-3 py-1 text-[13px] font-semibold text-[#2c5a8a]">
              {labelOf(PEST_KIND_LABELS, pest.kind ?? 'ANIMAL')}
            </span>
```

1d. Biology `hasBiology` — extend so the section shows when there are weed traits too:
```tsx
  const hasBiology = !!(b.lifeCycle?.fr || b.cycleDurationDays || (b.developmentStages?.length) || b.generationsPerYear || (b.activityPeriods?.length) ||
    b.favorableConditions?.temperature || b.favorableConditions?.humidity || b.favorableConditions?.rainfall || b.favorableConditions?.notes?.fr || (isWeed && hasWeedTraits));
```
- In the Biologie section, wrap the « Générations/an » line in `{!isWeed && ...}`.
- After the favorable-conditions block (still inside the Biologie `<div className="space-y-2 text-sm">`), add a weed-traits sub-block shown only for weeds:
```tsx
              {isWeed && (b.reproductionMode?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Reproduction : </span>
                  {b.reproductionMode!.map((r) => <span key={r} className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{labelOf(REPRODUCTION_MODE_LABELS, r)}</span>)}
                </div>
              )}
              {isWeed && b.disseminationCapacity && <p><span className="text-muted-foreground">Dissémination : </span>{labelOf(DISSEMINATION_LABELS, b.disseminationCapacity)}</p>}
              {isWeed && range(b.emergenceDepth) && <p><span className="text-muted-foreground">Profondeur de levée : </span>{range(b.emergenceDepth)}</p>}
              {isWeed && range(b.seedBankLongevity) && <p><span className="text-muted-foreground">Banque de graines : </span>{range(b.seedBankLongevity)}</p>}
```

1e. Damage section — kind-aware. Update `hasDamage`:
```tsx
  const hasDamage = !!((b.attackedOrgans?.length) || (b.damageTypes?.length) || b.harmfulnessLevel || b.symptoms?.fr || (b.nuisanceTypes?.length));
```
- Section title `Dégâts` → `{isWeed ? 'Nuisibilité' : 'Dégâts'}`.
- Wrap « Organes attaqués » and « Types de dégâts » blocks in `{!isWeed && (...)}`.
- Add a weed-only « Types de nuisibilité » block:
```tsx
              {isWeed && (b.nuisanceTypes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Nuisibilité : </span>
                  {b.nuisanceTypes!.map((n) => <span key={n} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(NUISANCE_TYPE_LABELS, n)}</span>)}
                </div>
              )}
```
- The symptoms line label → `{isWeed ? 'Effets observés' : 'Symptômes'}`.

1f. Management section — hide predators/parasitoids for weeds:
- Wrap the « Prédateurs » and « Parasitoïdes » blocks in `{!isWeed && (...)}`.
(Prévention, lutte biologique, produits, résistances restent pour tous.)

- [ ] **Step 2: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]/PestFicheView.tsx"
git commit -m "feat(admin): fiche bioagresseur consciente du kind (badge, traits adventice, nuisibilité, masquages)"
```

- [ ] **Step 3: Vérification manuelle**

Démarrer admin + API. Créer/ouvrir une **adventice** :
- Hero : chip « Adventice » + 🌿 + catégorie adventice.
- Bouton « Modifier les traits adventice » présent (absent pour un ravageur) ; renseigner reproduction/dissémination/levée/banque → visibles dans la Biologie.
- « Modifier la nuisibilité » : types de nuisibilité + effets observés ; pas d'organes attaqués.
- Biologie sans « Générations/an » ; Gestion sans prédateurs/parasitoïdes.
- Ouvrir un **ravageur** existant : rendu inchangé (Dégâts, générations/an, prédateurs, pas de bouton traits adventice).

---

## Notes de fin

- **DISEASE** (maladies) : même mécanisme, brique ultérieure (hors périmètre).
- **Dette** : le constructeur `Pest` atteint 17 params — refactor props-object à envisager après cette brique (déjà noté en Phase 1).
- `CropPestControl` non touché.
