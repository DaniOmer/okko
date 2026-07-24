# Ravageurs — Brique 6 (Sources) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les sources documentaires (`{titre, url?}`) et l'affichage des dates (création / MàJ) à la fiche ravageur — dernière brique.

**Architecture:** Mirroir des Briques 2–5. `sources` est un champ éditable (colonne JSON, méthode domaine `setSources()`, endpoint `PATCH /pests/:id/sources`). `createdAt` est géré par la base : remonté au read-model comme `updatedAt` (lecture seule), affiché en pied de fiche. Admin : nouveau composant `SourcesEditor`, `PestSourcesEditor` via `EditorShell`, section Sources + pied de dates.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migration additive uniquement** : `ADD COLUMN`, inspecter le SQL, appliquer. La base a 1 ligne `Pest` à préserver (nullable → sûr). Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Remplacement complet** à l'enregistrement des sources (pas de préservation `??`).
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- Le constructeur `Pest` est POSITIONNEL (14 params, `_management` en dernier). Ce plan ajoute UN param `_sources` (15ᵉ, dernier). TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources`, `fromSnapshot`) doivent passer 15 args dans le bon ordre — un décalage corrompt silencieusement des champs.
- `createdAt` est géré par la base : lu par le repo (`row.createdAt.toISOString()`), ajouté à `PestSnapshot`/document/admin, mais **PAS** un param de constructeur et **PAS** émis par le `toSnapshot()` du domaine (exactement comme `updatedAt`).
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine `Pest` — champ sources + `setSources()` + `createdAt` (snapshot)

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.sources.spec.ts` (create)

**Interfaces:**
- Produces (added to `pest.ts`):
  ```ts
  export interface SourceJSON { title: string; url?: string; }
  // PestSnapshot += sources?: SourceJSON[] (éditable) ; createdAt?: string (lecture seule)
  // Pest: get sources(): SourceJSON[] ; setSources(sources: SourceJSON[]): Pest
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.sources.spec.ts`:
```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setManagement({ predators: ['Coccinelle'] });

describe('Pest.setSources', () => {
  it('remplace en bloc et préserve identité + gestion', () => {
    const p = base().setSources([{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }]);
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');           // identité préservée
    expect(s.predators).toEqual(['Coccinelle']);           // gestion préservée
    expect(s.sources).toEqual([{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }]);
  });

  it('efface les sources quand la liste est vide', () => {
    const p = base().setSources([{ title: 'X' }]).setSources([]);
    expect(p.toSnapshot().sources).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.sources.spec.ts` → FAIL (`setSources` inexistant).

- [ ] **Step 3: Implement domaine**

In `apps/api/src/domain/pest/pest.ts`:

3a. Add exported type (after `ManagementSnapshot`, before `PestSnapshot`):
```ts
export interface SourceJSON { title: string; url?: string; }
```

3b. Extend `PestSnapshot` — add after the management fields:
```ts
  sources?: SourceJSON[];
  createdAt?: string;
```

3c. Add constructor param (after `_management`):
```ts
    private readonly _sources: SourceJSON[],
```

3d. `create()` — add `[]` as the last arg (after the management `{}`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {}, {}, {}, [],
```

3e. Add getter (after `get management()`):
```ts
  get sources(): SourceJSON[] { return [...this._sources]; }
```

3f. `toSnapshot()` — add sources (emitted only when non-empty; `createdAt` is NOT emitted here — it is DB-managed) after `...this._management`:
```ts
      ...this._management,
      sources: this._sources.length ? this._sources : undefined,
```

3g. `update()` — add `this._sources` as the last arg (after `this._management`):
```ts
      this._management,
      this._sources,
```

3h. `setBiology()` — add `this._sources` as the last arg of its `new Pest(...)` (after `this._management`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, biology, this._damage, this._distribution, this._management, this._sources,
```

3i. `setDamage()` — add `this._sources` as the last arg (after `this._management`):
```ts
      this._distribution,
      this._management,
      this._sources,
```

3j. `setDistribution()` — add `this._sources` as the last arg (after `this._management`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, distribution, this._management, this._sources,
```

3k. `setManagement()` — add `this._sources` as the last arg (after `management`):
```ts
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, this._distribution, management, this._sources,
```

3l. Add the `setSources` method (after `setManagement`):
```ts
  setSources(sources: SourceJSON[]): Pest {
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, this._distribution, this._management,
      sources,
    );
  }
```

3m. `fromSnapshot()` — add `s.sources ?? []` as the last arg (after the management object):
```ts
      { prevention: s.prevention, biologicalControl: s.biologicalControl, predators: s.predators, parasitoids: s.parasitoids, approvedProducts: s.approvedProducts, knownResistances: s.knownResistances },
      s.sources ?? [],
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (sources + management + distribution + damage + biology + identity specs).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.sources.spec.ts
git commit -m "feat(pest): champ sources + setSources + createdAt (snapshot)"
```

---

### Task 2: Migration + repo + read-model (+ test)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_sources/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot` (`sources?`, `createdAt?`) (Task 1).
- Produces: `PestDocument` gains `sources?` and `createdAt?` (`updatedAt?` already present).

- [ ] **Step 1: Prisma schema — 1 colonne additive**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `knownResistances Json?`:
```prisma
  sources Json?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_sources
```
Inspect the generated `migration.sql` — must be `ADD COLUMN` only (1 nullable JSONB). Then apply:
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

- [ ] **Step 4: Repo — persist sources, read sources + createdAt**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:

`toRow` — add before the closing brace of the returned object:
```ts
      sources: (p.sources ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
```

`toSnapshot` — add before the closing brace (both new reads):
```ts
      sources: (row.sources ?? undefined) as PestSnapshot['sources'],
      createdAt: row.createdAt.toISOString(),
```

- [ ] **Step 5: Read-model — expose sources + createdAt**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface (near `updatedAt?`):
```ts
  sources?: PestSnapshot['sources'];
  createdAt?: string;
```

In `toPestDocument`, enrich the indexed text (after the existing management lines):
```ts
  if (p.sources?.length) lines.push(`Sources : ${p.sources.map((s) => s.title).join(', ')}`);
```
And add to the returned object (alongside `updatedAt: p.updatedAt`):
```ts
    sources: p.sources, createdAt: p.createdAt,
```

- [ ] **Step 6: Read-model test**

Open `apps/api/src/application/pest/pest-read-model.spec.ts`, READ the existing test cases to match style, then add one `it(...)`:
```ts
  it('expose les sources + createdAt et enrichit le texte indexé', () => {
    const doc = toPestDocument({
      id: 'p1', name: { fr: 'Chenille' }, type: PestType.INSECT, images: [], metadata: {},
      sources: [{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }],
      createdAt: '2026-07-21T00:00:00.000Z',
    } as never);
    expect(doc.sources).toEqual([{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }]);
    expect(doc.createdAt).toBe('2026-07-21T00:00:00.000Z');
    expect(doc.serializedText).toContain('Sources : FAO, Note interne');
  });
```
(Follow the existing spec's exact style — `PestType` should already be imported there.)

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance sources + read-model (sources + createdAt) + test"
```

---

### Task 3: Use-case `SetPestSources` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-sources.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-sources.use-case.spec.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest`, `PestSnapshot`, `SourceJSON` (Task 1) ; `PestRepository`, `PestNotFoundError` (from `update-pest.use-case.ts`).
- Produces:
  ```ts
  export interface SetPestSourcesInput { id: string; actor: string; sources?: SourceJSON[]; }
  export class SetPestSourcesUseCase { execute(input): Promise<PestSnapshot> }
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/application/pest/set-pest-sources.use-case.spec.ts`:
```ts
import { SetPestSourcesUseCase } from './set-pest-sources.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-24T00:00:00.000Z' };

describe('SetPestSourcesUseCase', () => {
  it('applique les sources et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestSourcesUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', sources: [{ title: 'FAO', url: 'https://fao.org' }] });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.sources).toEqual([{ title: 'FAO', url: 'https://fao.org' }]);
  });
  it('efface les sources quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setSources([{ title: 'X' }]).toSnapshot());
    const uc = new SetPestSourcesUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.sources).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestSourcesUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-sources.use-case.spec.ts` → FAIL.

- [ ] **Step 3: Implement use-case**

Create `apps/api/src/application/pest/set-pest-sources.use-case.ts`:
```ts
import { Pest, PestSnapshot, SourceJSON } from '../../domain/pest/pest';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestSourcesInput { id: string; actor: string; sources?: SourceJSON[]; }

export class SetPestSourcesUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestSourcesInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setSources(input.sources ?? []).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { sources: input.sources },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-sources.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/presentation/pest/pest.controller.ts`:

Import the use-case and the type:
```ts
import { SetPestSourcesUseCase } from '../../application/pest/set-pest-sources.use-case';
import { SourceJSON } from '../../domain/pest/pest';
```
Add to the constructor params (after `setPestManagement`):
```ts
    private readonly setPestSources: SetPestSourcesUseCase,
```
Add the endpoint (after the `management` endpoint):
```ts
  @Patch(':id/sources')
  async sources(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { sources?: SourceJSON[] }) {
    try {
      const snap = await this.setPestSources.execute({ id, actor: user.email, sources: body.sources });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module registration**

In `apps/api/src/crop.module.ts`:
- Import: `import { SetPestSourcesUseCase } from './application/pest/set-pest-sources.use-case';`
- Add a provider next to the other pest use-case providers (near `SetPestManagementUseCase`):
```ts
    {
      provide: SetPestSourcesUseCase,
      useFactory: (p, a, c) => new SetPestSourcesUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-sources.use-case.ts apps/api/src/application/pest/set-pest-sources.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): PATCH /pests/:id/sources (SetPestSourcesUseCase)"
```

---

### Task 4: Admin — `SourcesEditor` + plumbing

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/components/SourcesEditor.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api.ts
  export interface Source { title: string; url?: string; }
  export interface PestSources { sources?: Source[]; }
  // Pest += extends PestSources ; Pest body += createdAt?: string
  // actions.ts
  export async function setPestSources(id: string, sources: PestSources): Promise<Pest>
  // components
  export interface SourceRow { title: string; url?: string; }
  export function SourcesEditor({ value, onChange }): ...
  ```

- [ ] **Step 1: `api.ts` types**

In `apps/admin/src/lib/api.ts`, add near the other pest types:
```ts
export interface Source { title: string; url?: string; }
export interface PestSources { sources?: Source[]; }
```
Extend the `Pest` interface — add `PestSources` to its `extends` list AND `createdAt?: string` to its body:
```ts
export interface Pest extends PestBiology, PestDamage, PestDistribution, PestManagement, PestSources {
  id: string; name: string; type: string; scientificName?: string;
  family?: string; description?: Record<string, string>; images: ImageRef[]; createdAt?: string; updatedAt?: string;
}
```

- [ ] **Step 2: `actions.ts` — `setPestSources`**

In `apps/admin/src/lib/actions.ts`, add after `setPestManagement`:
```ts
export async function setPestSources(id: string, sources: import('./api').PestSources): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/sources`, jsonInit('PATCH', sources));
  return res.json();
}
```

- [ ] **Step 3: `SourcesEditor`**

Create `apps/admin/src/components/SourcesEditor.tsx`:
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface SourceRow { title: string; url?: string; }

export function SourcesEditor({ value, onChange }: { value: SourceRow[]; onChange: (v: SourceRow[]) => void }) {
  const add = () => onChange([...value, { title: '' }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setTitle = (i: number, title: string) => onChange(value.map((s, k) => (k === i ? { ...s, title } : s)));
  const setUrl = (i: number, url: string) => onChange(value.map((s, k) => (k === i ? { ...s, url: url || undefined } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8" placeholder="Titre de la source" value={s.title} onChange={(e) => setTitle(i, e.target.value)} />
          <Input className="h-8 flex-1" placeholder="Lien (optionnel)" value={s.url ?? ''} onChange={(e) => setUrl(i, e.target.value)} />
          <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter une source</Button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/SourcesEditor.tsx
git commit -m "feat(admin): SourcesEditor + types/action sources (+ createdAt exposé)"
```

---

### Task 5: `PestSourcesEditor` + section fiche + pied de dates + page

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestSourcesEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditorShell`, `SourcesEditor` (+ `SourceRow`), `setPestSources`, `Pest`.

- [ ] **Step 1: `PestSourcesEditor`**

Create `apps/admin/src/app/pests/[id]/editors/PestSourcesEditor.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { SourcesEditor, type SourceRow } from '@/components/SourcesEditor';
import { Button } from '@/components/ui/button';
import { setPestSources } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestSourcesEditor({ pest }: { pest: Pest }) {
  const [sources, setSources] = useState<SourceRow[]>(pest.sources ?? []);

  return (
    <EditorShell label="Modifier les sources">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <SourcesEditor value={sources} onChange={setSources} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestSources(pest.id, { sources: sources.filter((s) => s.title.trim() !== '') });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: Section Sources + pied de dates dans `PestFicheView`**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Add the icon import (keep all existing imports):
```ts
import { BookOpen } from 'lucide-react';
```

2b. After the existing `hasManagement` computation, add:
```ts
  const hasSources = (b.sources?.length ?? 0) > 0;
  const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : null);
```

2c. Insert the Sources section INSIDE the `<div className="px-6">`, immediately AFTER the closing `</section>` of the Gestion block and BEFORE the `{photos.length > 0 && (` Photos block:
```tsx
        {hasSources && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><BookOpen className="h-4 w-4" /></span>
              Sources
            </h2>
            <ul className="space-y-1 text-sm">
              {b.sources!.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.title}</a>
                  ) : (
                    <span>{s.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
```

2d. Add the metadata footer AFTER the closing `</div>` of the `<div className="px-6">` sections wrapper (i.e., just before the final closing `</div>` of the component's returned root):
```tsx
      {(frDate(pest.createdAt) || frDate(pest.updatedAt)) && (
        <div className="px-6 pb-6 pt-2 text-xs text-muted-foreground">
          {frDate(pest.createdAt) && <>Créé le {frDate(pest.createdAt)}</>}
          {frDate(pest.createdAt) && frDate(pest.updatedAt) && ' · '}
          {frDate(pest.updatedAt) && <>Mis à jour le {frDate(pest.updatedAt)}</>}
        </div>
      )}
```

- [ ] **Step 3: Monter l'éditeur sur la page `/pests/[id]`**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Add import: `import { PestSourcesEditor } from './editors/PestSourcesEditor';`
- In the editors `<div className="flex gap-2">` (which already holds the four other editors), add after `PestManagementEditor`:
```tsx
          <PestSourcesEditor pest={pest} />
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]"
git commit -m "feat(admin): section Sources + pied de dates sur la fiche ravageur + PestSourcesEditor"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. Sur `/pests/<id>` : « Modifier les sources » ouvre l'éditeur (titre + lien) ; enregistrer ; la section Sources s'affiche (liens cliquables, masquée si vide) ; le pied « Créé le … · Mis à jour le … » apparaît ; recharger confirme la persistance ; vérifier que les autres sections ne sont pas affectées.

---

## Notes de fin

- **`setSources` remplace en bloc** — une liste vide efface le champ (cohérent avec les autres `setX`).
- **`createdAt`/`updatedAt`** sont gérées par la base (jamais éditées) ; seul l'affichage est ajouté.
- **Fin de la fiche ravageur** : identité + biologie + dégâts + répartition + gestion + sources.
