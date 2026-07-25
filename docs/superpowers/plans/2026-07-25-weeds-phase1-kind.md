# Bioagresseurs — Phase 1 : fondation `kind` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire un discriminant `kind` (ANIMAL / DISEASE / WEED) sur l'entité `Pest`, permettre de créer un « Adventice » (kind=WEED) avec ses catégories, et distinguer les kinds dans la liste. (Le rendu adventice riche = Phase 2.)

**Architecture:** Réutilise l'entité `Pest`. `kind` = champ cœur (défaut ANIMAL, les ravageurs existants migrent en ANIMAL). L'enum catégorie `PestType` gagne les catégories adventice. Fondation seule : la fiche animale reste inchangée ; la création choisit le kind et propose les bonnes catégories ; la liste affiche un badge + un filtre.

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet ni `apps/api/test/*.e2e-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin>`.
- **Migration additive uniquement** : `ADD COLUMN`, inspecter le SQL, appliquer. La base a 1 ligne `Pest` à préserver — la colonne `kind` a un **défaut `'ANIMAL'`** qui couvre cette ligne. Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- **Intrinsèque au ravageur** : ne pas toucher `CropPestControl`.
- Le constructeur `Pest` est POSITIONNEL (15 params, `_sources` en dernier). Ce plan ajoute UN param `_kind` (16ᵉ, dernier). TOUS les sites d'appel (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources`, `fromSnapshot`) doivent passer 16 args dans le bon ordre.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert avant chaque commit. Commit après chaque tâche.
- On garde le nom interne `Pest` ; libellés « bioagresseur / ravageur / adventice » côté UI.

---

### Task 1: Domaine — `PestKind` + catégories adventice + champ `kind`

**Files:**
- Create: `apps/api/src/domain/pest/pest-kind.ts`
- Modify: `apps/api/src/domain/pest/pest-type.ts`
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.kind.spec.ts` (create)

**Interfaces:**
- Produces:
  ```ts
  export enum PestKind { ANIMAL='ANIMAL', DISEASE='DISEASE', WEED='WEED' }
  // PestType += ANNUAL_GRASS, PERENNIAL_GRASS, ANNUAL_BROADLEAF, PERENNIAL_BROADLEAF, SEDGE
  // PestSnapshot += kind: PestKind ; CreateProps += kind?: PestKind ; Pest.update(fields += kind?: PestKind)
  // Pest: get kind(): PestKind
  ```

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.kind.spec.ts`:
```ts
import { Pest } from './pest';
import { PestKind } from './pest-kind';
import { PestType } from './pest-type';
import { TranslatableText } from '../shared/translatable-text';

describe('Pest kind', () => {
  it('défaut ANIMAL à la création', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT });
    expect(p.toSnapshot().kind).toBe(PestKind.ANIMAL);
  });
  it('création en WEED avec catégorie adventice', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });
    const s = p.toSnapshot();
    expect(s.kind).toBe(PestKind.WEED);
    expect(s.type).toBe(PestType.PERENNIAL_GRASS);
  });
  it('update change le kind et préserve les blocs', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT })
      .setBiology({ generationsPerYear: { min: 1, max: 2 } });
    const u = p.update({ name: TranslatableText.create({ fr: 'X' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });
    const s = u.toSnapshot();
    expect(s.kind).toBe(PestKind.WEED);
    expect(s.generationsPerYear).toEqual({ min: 1, max: 2 });
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.kind.spec.ts` → FAIL (`PestKind`/`kind` inexistants).

- [ ] **Step 3: Create `PestKind`**

Create `apps/api/src/domain/pest/pest-kind.ts`:
```ts
export enum PestKind {
  ANIMAL = 'ANIMAL',
  DISEASE = 'DISEASE',
  WEED = 'WEED',
}
```

- [ ] **Step 4: Add weed categories to `PestType`**

In `apps/api/src/domain/pest/pest-type.ts`, add before `OTHER = 'OTHER'`:
```ts
  ANNUAL_GRASS = 'ANNUAL_GRASS',
  PERENNIAL_GRASS = 'PERENNIAL_GRASS',
  ANNUAL_BROADLEAF = 'ANNUAL_BROADLEAF',
  PERENNIAL_BROADLEAF = 'PERENNIAL_BROADLEAF',
  SEDGE = 'SEDGE',
```

- [ ] **Step 5: Thread `kind` through the domain**

In `apps/api/src/domain/pest/pest.ts`:

5a. Import: `import { PestKind } from './pest-kind';`

5b. `PestSnapshot` — add after `id: string;` line region (e.g. right after `type: PestType;`):
```ts
  kind: PestKind;
```

5c. `CreateProps` — add:
```ts
  kind?: PestKind;
```

5d. Constructor — add as the LAST param (after `_sources`):
```ts
    private readonly _kind: PestKind,
```

5e. `create()` — add `props.kind ?? PestKind.ANIMAL` as the last arg (after `[]`):
```ts
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {}, {}, {}, {}, {}, [], props.kind ?? PestKind.ANIMAL,
```

5f. Add getter (after `get sources()`):
```ts
  get kind(): PestKind { return this._kind; }
```

5g. `toSnapshot()` — add `kind` (near `type`):
```ts
      id: this._id, name: this._name.toJSON(), type: this._type, kind: this._kind,
```

5h. `update()` — extend the fields type with `kind?: PestKind;` and pass `fields.kind ?? this._kind` as the last arg (after `this._sources`):
```ts
  update(fields: { name: TranslatableText; type: PestType; scientificName?: string; family?: string; description?: TranslatableText; images?: MediaImageJSON[]; kind?: PestKind }): Pest {
    return new Pest(
      this._id,
      fields.name,
      fields.type,
      fields.scientificName,
      fields.family,
      fields.description,
      this._symptoms,
      fields.images !== undefined ? fields.images.map(MediaImage.fromJSON) : this._images,
      this._notes,
      this._metadata,
      this._biology,
      this._damage,
      this._distribution,
      this._management,
      this._sources,
      fields.kind ?? this._kind,
    );
  }
```

5i. `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources` — each `new Pest(...)` ends with `..., this._sources` (or `sources`). Append `this._kind` as the new last arg in ALL FIVE:
- `setBiology`: `... this._management, this._sources, this._kind,`
- `setDamage`: `... this._management, this._sources, this._kind,`
- `setDistribution`: `... management/this._management, this._sources, this._kind,` (its call ends `..., this._management, this._sources,`)
- `setManagement`: `... management, this._sources, this._kind,`
- `setSources`: `... this._management, sources, this._kind,`

5j. `fromSnapshot()` — add `s.kind ?? PestKind.ANIMAL` as the last arg (after `s.sources ?? []`):
```ts
      s.sources ?? [],
      s.kind ?? PestKind.ANIMAL,
```

- [ ] **Step 6: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (kind + all existing pest specs; every `new Pest(...)` now passes 16 args).

- [ ] **Step 7: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest-kind.ts apps/api/src/domain/pest/pest-type.ts apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.kind.spec.ts
git commit -m "feat(pest): discriminant kind (ANIMAL/DISEASE/WEED) + catégories adventice"
```

---

### Task 2: Migration + repo + read-model (`kind`)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_add_kind/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot.kind`, `PestKind` (Task 1).
- Produces: `PestDocument` gains `kind`.

- [ ] **Step 1: Prisma schema — `kind` column with default**

In `apps/api/prisma/schema.prisma`, model `Pest`, add after `type String`:
```prisma
  kind           String   @default("ANIMAL")
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_add_kind
```
Inspect the generated `migration.sql` — must be a single `ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ANIMAL'`. Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
Expected: applied; client regenerated; the existing row gets `kind = 'ANIMAL'`. If Prisma asks to reset/drop, STOP and report BLOCKED.

- [ ] **Step 3: Verify row preserved + kind default**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*), kind FROM "Pest" GROUP BY kind;'
```
Expected: `1|ANIMAL`.

- [ ] **Step 4: Repo — write/read `kind`**

In `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`:

`toRow` — add to the returned object (near `type: p.type`):
```ts
      kind: p.kind,
```

`toSnapshot` — add (near `type: row.type as PestType`):
```ts
      kind: row.kind as PestSnapshot['kind'],
```
(Import `PestKind` is not needed here since we cast via `PestSnapshot['kind']`.)

- [ ] **Step 5: Read-model — expose `kind`**

In `apps/api/src/application/pest/pest-read-model.ts`:

Add to `PestDocument` interface (near `type: PestType`):
```ts
  kind: PestSnapshot['kind'];
```

In `toPestDocument`, add to the returned object (near `type: p.type`):
```ts
    kind: p.kind,
```

- [ ] **Step 6: Read-model test**

Open `apps/api/src/application/pest/pest-read-model.spec.ts`, READ an existing case to match style, then add:
```ts
  it('expose le kind', () => {
    const doc = toPestDocument({ id: 'p1', name: { fr: 'Chiendent' }, type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED, images: [], metadata: {} } as never);
    expect(doc.kind).toBe(PestKind.WEED);
  });
```
Add `import { PestKind } from '../../domain/pest/pest-kind';` at the top of the spec if not present.

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance + read-model du kind (migration défaut ANIMAL)"
```

---

### Task 3: API create/update acceptent `kind`

**Files:**
- Modify: `apps/api/src/application/pest/create-pest.use-case.ts`
- Modify: `apps/api/src/application/pest/update-pest.use-case.ts`
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Test: `apps/api/src/application/pest/create-pest.use-case.spec.ts` (add a case if the file exists; otherwise skip — the domain test covers kind)

**Interfaces:**
- Consumes: `PestKind` (Task 1) ; `Pest.create`/`update` accept `kind` (Task 1).
- Produces: create/update endpoints accept `kind`.

- [ ] **Step 1: `create-pest.use-case`**

In `apps/api/src/application/pest/create-pest.use-case.ts`:
- Import: `import { PestKind } from '../../domain/pest/pest-kind';`
- `CreatePestInput` — add `kind?: PestKind;`
- In `Pest.create({...})`, add `kind: input.kind,` (Pest.create defaults to ANIMAL when undefined).

- [ ] **Step 2: `update-pest.use-case`**

In `apps/api/src/application/pest/update-pest.use-case.ts`:
- Import: `import { PestKind } from '../../domain/pest/pest-kind';`
- `UpdatePestInput` — add `kind?: PestKind;`
- In `.update({...})`, add `kind: input.kind,`.

- [ ] **Step 3: Controller create/update bodies accept `kind`**

In `apps/api/src/presentation/pest/pest.controller.ts`:
- Import: `import { PestKind } from '../../domain/pest/pest-kind';`
- In the `@Post()` create body type, add `kind?: PestKind;`.
- In the `@Patch(':id')` update body type, add `kind?: PestKind;`.
(The `...body` spread already forwards `kind` to the use-cases.)

- [ ] **Step 4: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/create-pest.use-case.ts apps/api/src/application/pest/update-pest.use-case.ts apps/api/src/presentation/pest/pest.controller.ts
git commit -m "feat(pest): create/update acceptent le kind"
```

---

### Task 4: Admin — types, libellés, création avec choix du kind

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (Pest `kind`)
- Modify: `apps/admin/src/lib/actions.ts` (createPest/updatePest `kind`)
- Modify: `apps/admin/src/lib/labels.ts` (`PEST_KIND_LABELS`, `WEED_CATEGORY_LABELS`)
- Modify: `apps/admin/src/app/pests/new/page.tsx`
- Modify: `apps/admin/src/app/pests/PestRowActions.tsx`

**Interfaces:**
- Produces: `Pest.kind?: string` ; `setPestKind` not needed (kind via create/update) ; `PEST_KIND_LABELS`, `WEED_CATEGORY_LABELS`.

- [ ] **Step 1: `api.ts` — `Pest.kind`**

In `apps/admin/src/lib/api.ts`, add `kind?: string;` to the `Pest` interface body (next to `updatedAt?`).

- [ ] **Step 2: `actions.ts` — `kind` on create/update**

In `apps/admin/src/lib/actions.ts`, extend `createPest` and `updatePest` input types with `kind?: string;` (both already spread the input into the request body, so no body change beyond the type).

- [ ] **Step 3: `labels.ts`**

Add to `apps/admin/src/lib/labels.ts`:
```ts
export const PEST_KIND_LABELS: Record<string, string> = { ANIMAL: 'Ravageur', DISEASE: 'Maladie', WEED: 'Adventice' };
export const WEED_CATEGORY_LABELS: Record<string, string> = {
  ANNUAL_GRASS: 'Graminée annuelle', PERENNIAL_GRASS: 'Graminée vivace',
  ANNUAL_BROADLEAF: 'Dicotylédone annuelle', PERENNIAL_BROADLEAF: 'Dicotylédone vivace',
  SEDGE: 'Cypéracée', OTHER: 'Autre',
};
```

- [ ] **Step 4: Création (`pests/new/page.tsx`) — choisir le kind + catégorie scopée**

In `apps/admin/src/app/pests/new/page.tsx`:
- Import `PEST_TYPE_LABELS, WEED_CATEGORY_LABELS, PEST_KIND_LABELS` from `@/lib/labels`.
- Add state `const [kind, setKind] = useState('ANIMAL');` and derive category options:
```tsx
  const categoryLabels = kind === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS;
```
- When kind changes, reset the category (`type`) to the first valid code:
```tsx
  function onKindChange(k: string) {
    setKind(k);
    const first = Object.keys(k === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS)[0];
    setType(first);
  }
```
- Add a « Type de bioagresseur » Select ABOVE the category Select (only Ravageur + Adventice for now — DISEASE arrive plus tard) :
```tsx
            <div className="space-y-1">
              <Label>Type de bioagresseur</Label>
              <Select value={kind} onValueChange={onKindChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANIMAL">Ravageur</SelectItem>
                  <SelectItem value="WEED">Adventice</SelectItem>
                </SelectContent>
              </Select>
            </div>
```
- Change the existing category Select to iterate `categoryLabels` instead of `PEST_TYPE_LABELS`.
- In the `createPest({...})` call, add `kind`.
- Card title → « Nouveau bioagresseur ».

- [ ] **Step 5: Édition (`PestRowActions.tsx`) — kind + catégorie scopée**

In `apps/admin/src/app/pests/PestRowActions.tsx`:
- Extend the `pest` prop type with `kind?: string`.
- Import `WEED_CATEGORY_LABELS, PEST_KIND_LABELS` (alongside the existing `PEST_TYPE_LABELS`).
- Add state `const [kind, setKind] = useState(pest.kind ?? 'ANIMAL');` and derive `const categoryLabels = kind === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS;`.
- Add a « Type de bioagresseur » Select (Ravageur/Adventice) in the edit dialog; on change, reset `type` to the first category code (same helper as Step 4).
- Change the category Select to iterate `categoryLabels`.
- In the `updatePest(...)` call, add `kind`.

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/app/pests/new/page.tsx apps/admin/src/app/pests/PestRowActions.tsx
git commit -m "feat(admin): création/édition bioagresseur — choix du kind + catégories adventice"
```

---

### Task 5: Admin — liste « Bioagresseurs » (badge + filtre)

**Files:**
- Modify: `apps/admin/src/app/pests/page.tsx`

**Interfaces:**
- Consumes: `Pest.kind`, `PEST_KIND_LABELS`, `WEED_CATEGORY_LABELS`, `PEST_TYPE_LABELS`.

- [ ] **Step 1: Titre + badge kind + libellé catégorie scopé + filtre**

In `apps/admin/src/app/pests/page.tsx`:
- Import `PEST_KIND_LABELS, WEED_CATEGORY_LABELS` (alongside `PEST_TYPE_LABELS, labelOf`) and `Badge` from `@/components/ui/badge`.
- Accept `searchParams`: `export default async function PestsPage({ searchParams }: { searchParams: { kind?: string } })`.
- Fetch then filter by kind:
```tsx
  const all = await listPests().catch(() => []);
  const kindFilter = searchParams.kind; // 'ANIMAL' | 'WEED' | undefined
  const pests = kindFilter ? all.filter((p) => (p.kind ?? 'ANIMAL') === kindFilter) : all;
```
- Title → « Bioagresseurs ».
- Add a discreet filter bar (3 liens) below the title:
```tsx
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/pests" className={!kindFilter ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Tous</Link>
        <Link href="/pests?kind=ANIMAL" className={kindFilter === 'ANIMAL' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Ravageurs</Link>
        <Link href="/pests?kind=WEED" className={kindFilter === 'WEED' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Adventices</Link>
      </div>
```
- Add a « Type » (kind) badge column header + cell; and make the category cell use the right label map per kind. In the row (`{pests.map((p) => ...)}`):
```tsx
                <TableCell><Badge variant="secondary">{labelOf(PEST_KIND_LABELS, p.kind ?? 'ANIMAL')}</Badge></TableCell>
```
placed right after the name cell (add a matching `<TableHead>Type</TableHead>` in the header). And change the category cell:
```tsx
                <TableCell>{labelOf((p.kind ?? 'ANIMAL') === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS, p.type)}</TableCell>
```
- Update the empty-state text and the « Nouveau » button label to « Nouveau bioagresseur ».

- [ ] **Step 2: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/app/pests/page.tsx
git commit -m "feat(admin): liste Bioagresseurs — badge kind + filtre Ravageurs/Adventices"
```

- [ ] **Step 3: Vérification manuelle**

Démarrer admin + API. `/pests` : titre « Bioagresseurs », filtre Tous/Ravageurs/Adventices, badge kind par ligne. Créer un bioagresseur en choisissant « Adventice » → les catégories deviennent graminée/dicotylédone… ; enregistrer ; il apparaît avec le badge Adventice, filtrable. Sa fiche `/pests/[id]` s'affiche (rendu animal pour l'instant — l'adaptation adventice = Phase 2). Vérifier qu'un ravageur existant reste « Ravageur ».

---

## Notes de fin

- **Phase 2** (plan séparé) : `nuisanceTypes` sur le bloc dégâts, bloc `_weed` (reproduction, dissémination, profondeur de levée, banque de graines) + `setWeed` + endpoint, `PestWeedEditor`, et le **rendu conscient du kind** sur la fiche + les éditeurs (masquages/relibellés pour WEED).
- **DISEASE** n'est pas proposé à la création tant que son contenu n'existe pas.
- **Dette** notée : le constructeur atteint 16 params — refactor props-object à envisager après la feature.
