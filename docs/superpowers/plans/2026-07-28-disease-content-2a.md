# Maladies — contenu 2a (symptômes/développement/impacts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le contenu spécifique aux maladies (bloc `_disease` : symptômes détaillés, développement, impacts) + le vent aux conditions favorables, avec éditeur dédié et fiche consciente du kind.

**Architecture:** Nouveau bloc `_disease` sur l'agrégat immuable `Pest` (miroir du bloc `_weed`, 18ᵉ param positionnel), `setDisease()` + `PATCH /pests/:id/disease`. `+wind` s'ajoute au Json `favorableConditions`. La fiche relibelle les sections pour une maladie (Dégâts→Symptômes, Biologie→Développement) et ajoute une section Impacts, en réutilisant `harmfulnessLevel` (Gravité) et `activityPeriods` (Périodes à risque).

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`** (ils effacent la base). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Migration additive** : 7 colonnes sur `Pest` (le vent va DANS le Json `favorableConditions`, pas de colonne). `ADD COLUMN` uniquement ; si Prisma propose reset/drop → STOP + BLOCKED. Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- Le constructeur `Pest` est POSITIONNEL (17 params, finissant par `_weed`). Ce plan ajoute `_disease` en 18ᵉ (dernier). TOUS les sites `new Pest(...)` (`create`, `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources`, `setWeed`, `setDisease`, `fromSnapshot`) passent 18 args ; `create` met `{}`, les setters préservent `this._disease`, `setDisease` le remplace, `fromSnapshot` le reconstruit.
- Champs `_disease` : `firstSymptoms`/`advancedSymptoms`/`confusionRisk`/`pathogen`/`potentialLosses` (`Record<string,string>`), `propagationModes` (`string[]`), `evolutionSpeed` (`string`). Énums non validés par le domaine (Select admin).
- **Périmètre 2a** : symptômes détaillés + développement + impacts. **Hors périmètre** (→ 2b) : prévention détaillée (8 champs) + section Prévention de la fiche.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine — bloc `_disease` + `setDisease` + `+wind`

**Files:**
- Create: `apps/api/src/domain/pest/disease.ts`
- Modify: `apps/api/src/domain/pest/pest.ts`
- Test: `apps/api/src/domain/pest/pest.disease.spec.ts` (create)

**Interfaces:**
- Produces: `DiseaseSnapshot` ; `Pest.setDisease(d)` ; `get disease()` ; `PestSnapshot` gagne les 7 champs ; `FavorableConditionsJSON` gagne `wind?`.

- [ ] **Step 1: Failing test**

Create `apps/api/src/domain/pest/pest.disease.spec.ts`:
```ts
import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Mildiou' }), type: PestType.OOMYCETE, kind: PestKind.DISEASE });

describe('Pest setDisease', () => {
  it('enregistre les champs maladie et round-trip', () => {
    const s = base().setDisease({
      firstSymptoms: { fr: 'taches huileuses' }, advancedSymptoms: { fr: 'nécroses' }, confusionRisk: { fr: 'alternariose' },
      pathogen: { fr: 'Phytophthora infestans' }, propagationModes: ['WIND', 'WATER'],
      potentialLosses: { fr: '20-40%' }, evolutionSpeed: 'FAST',
    }).toSnapshot();
    expect(s.firstSymptoms).toEqual({ fr: 'taches huileuses' });
    expect(s.pathogen).toEqual({ fr: 'Phytophthora infestans' });
    expect(s.propagationModes).toEqual(['WIND', 'WATER']);
    expect(s.evolutionSpeed).toBe('FAST');
  });
  it('remplace le bloc en entier et préserve kind + autres blocs', () => {
    const p = base().setBiology({ lifeCycle: { fr: 'annuel' } }).setDisease({ evolutionSpeed: 'SLOW' });
    const s = p.setDisease({ pathogen: { fr: 'Botrytis' } }).toSnapshot();
    expect(s.evolutionSpeed).toBeUndefined();          // remplacement complet
    expect(s.pathogen).toEqual({ fr: 'Botrytis' });
    expect(s.lifeCycle).toEqual({ fr: 'annuel' });      // autre bloc préservé
    expect(s.kind).toBe(PestKind.DISEASE);              // kind préservé
  });
  it('setBiology enregistre le vent dans les conditions favorables', () => {
    const s = base().setBiology({ favorableConditions: { wind: { min: 10, max: 30, unit: 'km/h' } } }).toSnapshot();
    expect(s.favorableConditions?.wind).toEqual({ min: 10, max: 30, unit: 'km/h' });
  });
  it('création : bloc disease vide', () => {
    const s = base().toSnapshot();
    expect(s.pathogen).toBeUndefined();
    expect(s.propagationModes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest.disease.spec.ts` → FAIL.

- [ ] **Step 3: Create `DiseaseSnapshot`**

Create `apps/api/src/domain/pest/disease.ts`:
```ts
export interface DiseaseSnapshot {
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
}
```

- [ ] **Step 4: Thread `_disease` + `wind` through `pest.ts`**

In `apps/api/src/domain/pest/pest.ts`:

4a. Import : `import { DiseaseSnapshot } from './disease';`

4b. `FavorableConditionsJSON` — add `wind?: MinMaxRangeJSON;` :
```ts
export interface FavorableConditionsJSON {
  temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; wind?: MinMaxRangeJSON; notes?: Record<string, string>;
}
```

4c. `PestSnapshot` — add the 7 disease fields (près de `sources?`) :
```ts
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
```

4d. Constructor — add `_disease` as the LAST (18ᵉ) param, after `_weed` :
```ts
    private readonly _disease: DiseaseSnapshot,
```

4e. `create()` — append `{}` (after the weed `{}`) so the tail becomes `..., props.kind ?? PestKind.ANIMAL, {}, {},`.

4f. Getter (après `get weed()`) :
```ts
  get disease(): DiseaseSnapshot { return { ...this._disease }; }
```

4g. `toSnapshot()` — add `...this._disease,` after `...this._weed,`.

4h. `setBiology` — dans l'objet `favorableConditions`, ajouter `wind: range(b.favorableConditions.wind),` (à côté de rainfall).

4i. `update`, `setBiology`, `setDamage`, `setDistribution`, `setManagement`, `setSources`, `setWeed` — chaque `new Pest(...)` se termine par `..., this._kind, this._weed,` (ou `weed` pour setWeed). Ajouter `this._disease,` en 18ᵉ arg dans TOUS.

4j. `setDisease` (après `setWeed`) :
```ts
  setDisease(d: DiseaseSnapshot): Pest {
    const disease: DiseaseSnapshot = {
      firstSymptoms: d.firstSymptoms, advancedSymptoms: d.advancedSymptoms, confusionRisk: d.confusionRisk,
      pathogen: d.pathogen, propagationModes: d.propagationModes, potentialLosses: d.potentialLosses, evolutionSpeed: d.evolutionSpeed,
    };
    return new Pest(
      this._id, this._name, this._type, this._scientificName, this._family, this._description,
      this._symptoms, this._images, this._notes, this._metadata, this._biology, this._damage, this._distribution, this._management,
      this._sources, this._kind, this._weed, disease,
    );
  }
```

4k. `fromSnapshot` — append the disease block as the 18ᵉ arg (après le bloc weed) :
```ts
      { reproductionMode: s.reproductionMode, disseminationCapacity: s.disseminationCapacity, emergenceDepth: s.emergenceDepth, seedBankLongevity: s.seedBankLongevity },
      { firstSymptoms: s.firstSymptoms, advancedSymptoms: s.advancedSymptoms, confusionRisk: s.confusionRisk, pathogen: s.pathogen, propagationModes: s.propagationModes, potentialLosses: s.potentialLosses, evolutionSpeed: s.evolutionSpeed },
```

- [ ] **Step 5: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS (18 args partout).

- [ ] **Step 6: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/disease.ts apps/api/src/domain/pest/pest.ts apps/api/src/domain/pest/pest.disease.spec.ts
git commit -m "feat(pest): bloc _disease (symptômes détaillés/développement/impacts) + vent conditions favorables"
```

---

### Task 2: Persistance + read-model

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Pest`)
- Create: migration `<ts>_pest_disease_fields/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts`
- Modify: `apps/api/src/application/pest/pest-read-model.ts`
- Test: `apps/api/src/application/pest/pest-read-model.spec.ts` (add a case)

**Interfaces:**
- Consumes: `PestSnapshot` (Task 1).
- Produces: `PestDocument` gagne les 7 champs disease.

- [ ] **Step 1: Prisma — 7 colonnes**

In `apps/api/prisma/schema.prisma`, model `Pest`, add (près des colonnes weed) :
```prisma
  firstSymptoms     Json?
  advancedSymptoms  Json?
  confusionRisk     Json?
  pathogen          Json?
  propagationModes  Json?
  potentialLosses   Json?
  evolutionSpeed    String?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name pest_disease_fields
```
Inspect `migration.sql` — must be only `ADD COLUMN` (7 colonnes nullable, no default, no drop). Then apply :
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
If Prisma proposes reset/drop → STOP + BLOCKED.

- [ ] **Step 3: Verify existing rows preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Report the count (rows preserved).

- [ ] **Step 4: Repo `toRow` — écrire les 7 champs**

In `prisma-pest.repository.ts`, `toRow`, add (près des champs weed) :
```ts
      firstSymptoms: (p.firstSymptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      advancedSymptoms: (p.advancedSymptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      confusionRisk: (p.confusionRisk ?? undefined) as Prisma.InputJsonValue | undefined,
      pathogen: (p.pathogen ?? undefined) as Prisma.InputJsonValue | undefined,
      propagationModes: (p.propagationModes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      potentialLosses: (p.potentialLosses ?? undefined) as Prisma.InputJsonValue | undefined,
      evolutionSpeed: p.evolutionSpeed ?? null,
```

- [ ] **Step 5: Repo `toSnapshot` — lire les 7 champs**

In `toSnapshot`, add (près des champs weed) :
```ts
      firstSymptoms: (row.firstSymptoms ?? undefined) as Record<string, string> | undefined,
      advancedSymptoms: (row.advancedSymptoms ?? undefined) as Record<string, string> | undefined,
      confusionRisk: (row.confusionRisk ?? undefined) as Record<string, string> | undefined,
      pathogen: (row.pathogen ?? undefined) as Record<string, string> | undefined,
      propagationModes: (row.propagationModes ?? undefined) as string[] | undefined,
      potentialLosses: (row.potentialLosses ?? undefined) as Record<string, string> | undefined,
      evolutionSpeed: row.evolutionSpeed ?? undefined,
```

- [ ] **Step 6: Read-model — exposer + indexer**

In `apps/api/src/application/pest/pest-read-model.ts`:

6a. `PestDocument` — add (près des champs weed) :
```ts
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
```

6b. `toPestDocument` — serializedText (après les lignes weed) :
```ts
  if (p.pathogen) lines.push(`Agent pathogène : ${p.pathogen[locale] ?? p.pathogen['fr']}`);
  if (p.propagationModes?.length) lines.push(`Propagation : ${p.propagationModes.join(', ')}`);
  if (p.firstSymptoms) lines.push(`Premiers symptômes : ${p.firstSymptoms[locale] ?? p.firstSymptoms['fr']}`);
  if (p.advancedSymptoms) lines.push(`Symptômes avancés : ${p.advancedSymptoms[locale] ?? p.advancedSymptoms['fr']}`);
  if (p.confusionRisk) lines.push(`Risque de confusion : ${p.confusionRisk[locale] ?? p.confusionRisk['fr']}`);
  if (p.potentialLosses) lines.push(`Pertes potentielles : ${p.potentialLosses[locale] ?? p.potentialLosses['fr']}`);
  if (p.evolutionSpeed) lines.push(`Vitesse d'évolution : ${p.evolutionSpeed}`);
```

6c. `toPestDocument` return object — add :
```ts
    firstSymptoms: p.firstSymptoms, advancedSymptoms: p.advancedSymptoms, confusionRisk: p.confusionRisk,
    pathogen: p.pathogen, propagationModes: p.propagationModes, potentialLosses: p.potentialLosses, evolutionSpeed: p.evolutionSpeed,
```

- [ ] **Step 7: Read-model test**

In `apps/api/src/application/pest/pest-read-model.spec.ts`, add :
```ts
  it('expose les champs maladie', () => {
    const doc = toPestDocument({
      id: 'p1', name: { fr: 'Mildiou' }, type: PestType.OOMYCETE, kind: PestKind.DISEASE,
      images: [], metadata: {},
      pathogen: { fr: 'Phytophthora infestans' }, propagationModes: ['WIND'],
      firstSymptoms: { fr: 'taches' }, evolutionSpeed: 'FAST', potentialLosses: { fr: '30%' },
    } as never);
    expect(doc.pathogen).toEqual({ fr: 'Phytophthora infestans' });
    expect(doc.propagationModes).toEqual(['WIND']);
    expect(doc.evolutionSpeed).toBe('FAST');
    expect(doc.serializedText).toContain('Agent pathogène');
  });
```
(Ajouter `import { PestKind } from '../../domain/pest/pest-kind';` en tête du spec s'il manque.)

- [ ] **Step 8: Typecheck + spec + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest/pest-read-model.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/pest/prisma-pest.repository.ts apps/api/src/application/pest/pest-read-model.ts apps/api/src/application/pest/pest-read-model.spec.ts
git commit -m "feat(pest): persistance + read-model des champs maladie (migration additive)"
```

---

### Task 3: API — `SetPestDiseaseUseCase` + endpoint + module

**Files:**
- Create: `apps/api/src/application/pest/set-pest-disease.use-case.ts`
- Test: `apps/api/src/application/pest/set-pest-disease.use-case.spec.ts` (create)
- Modify: `apps/api/src/presentation/pest/pest.controller.ts`
- Modify: `apps/api/src/crop.module.ts`

**Interfaces:**
- Consumes: `Pest.setDisease` (Task 1) ; `PestNotFoundError`.
- Produces: `SetPestDiseaseUseCase` ; `PATCH /pests/:id/disease`.

- [ ] **Step 1: Failing test (mirror set-pest-weed.use-case.spec.ts)**

READ `apps/api/src/application/pest/set-pest-weed.use-case.spec.ts` and mirror its harness. Create `apps/api/src/application/pest/set-pest-disease.use-case.spec.ts` with cases: inconnu → `PestNotFoundError` ; set + relecture (`findById` renvoie `pathogen`/`propagationModes`/`evolutionSpeed`) ; remplacement complet (2ᵉ set efface les champs non fournis). Use `SetPestDiseaseUseCase` with input `{ id, actor, firstSymptoms?, advancedSymptoms?, confusionRisk?, pathogen?, propagationModes?, potentialLosses?, evolutionSpeed? }`.

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-disease.use-case.spec.ts` → FAIL.

- [ ] **Step 3: `set-pest-disease.use-case.ts`**
```ts
import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDiseaseInput {
  id: string; actor: string;
  firstSymptoms?: Record<string, string>; advancedSymptoms?: Record<string, string>; confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>; propagationModes?: string[]; potentialLosses?: Record<string, string>; evolutionSpeed?: string;
}

export class SetPestDiseaseUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDiseaseInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDisease({
      firstSymptoms: input.firstSymptoms, advancedSymptoms: input.advancedSymptoms, confusionRisk: input.confusionRisk,
      pathogen: input.pathogen, propagationModes: input.propagationModes, potentialLosses: input.potentialLosses, evolutionSpeed: input.evolutionSpeed,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { disease: { firstSymptoms: input.firstSymptoms, advancedSymptoms: input.advancedSymptoms, confusionRisk: input.confusionRisk, pathogen: input.pathogen, propagationModes: input.propagationModes, potentialLosses: input.potentialLosses, evolutionSpeed: input.evolutionSpeed } },
    });
    return snap;
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/application/pest/set-pest-disease.use-case.spec.ts` → PASS.

- [ ] **Step 5: Controller — endpoint disease**

In `apps/api/src/presentation/pest/pest.controller.ts`:
- Import : `import { SetPestDiseaseUseCase } from '../../application/pest/set-pest-disease.use-case';`
- Inject in constructor (après `setPestWeed`) : `private readonly setPestDisease: SetPestDiseaseUseCase,`
- Add handler (après `weed`) :
```ts
  @Patch(':id/disease')
  async disease(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    firstSymptoms?: Record<string, string>; advancedSymptoms?: Record<string, string>; confusionRisk?: Record<string, string>;
    pathogen?: Record<string, string>; propagationModes?: string[]; potentialLosses?: Record<string, string>; evolutionSpeed?: string;
  }) {
    try {
      const snap = await this.setPestDisease.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
```

- [ ] **Step 6: Module wiring**

In `apps/api/src/crop.module.ts`:
- Import : `import { SetPestDiseaseUseCase } from './application/pest/set-pest-disease.use-case';`
- Add provider (à côté de `SetPestWeedUseCase`) :
```ts
    {
      provide: SetPestDiseaseUseCase,
      useFactory: (p, a, c) => new SetPestDiseaseUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```

- [ ] **Step 7: Typecheck + specs + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/pest src/domain/pest
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/pest/set-pest-disease.use-case.ts apps/api/src/application/pest/set-pest-disease.use-case.spec.ts apps/api/src/presentation/pest/pest.controller.ts apps/api/src/crop.module.ts
git commit -m "feat(pest): SetPestDiseaseUseCase + PATCH /pests/:id/disease + câblage module"
```

---

### Task 4: Admin — plomberie (types, action, libellés)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/labels.ts`

**Interfaces:**
- Produces: `PestDisease` interface + `Pest extends … PestDisease` ; `FavorableConditions.wind?` ; `setPestDisease` ; `PROPAGATION_MODE_LABELS`, `EVOLUTION_SPEED_LABELS`.

- [ ] **Step 1: `api.ts`**

- `FavorableConditions` — add `wind?: MinMaxRangeJSON;` :
```ts
export interface FavorableConditions { temperature?: MinMaxRangeJSON; humidity?: MinMaxRangeJSON; rainfall?: MinMaxRangeJSON; wind?: MinMaxRangeJSON; notes?: Record<string, string>; }
```
- New interface (après `PestWeed`) :
```ts
export interface PestDisease {
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
}
```
- `Pest` extends list — add `PestDisease` :
```ts
export interface Pest extends PestBiology, PestDamage, PestDistribution, PestManagement, PestSources, PestWeed, PestDisease {
```

- [ ] **Step 2: `actions.ts`**

Add after `setPestWeed` :
```ts
export async function setPestDisease(id: string, disease: import('./api').PestDisease): Promise<Pest> {
  const res = await authFetch(`/pests/${id}/disease`, jsonInit('PATCH', disease));
  return res.json();
}
```

- [ ] **Step 3: `labels.ts`**
```ts
export const PROPAGATION_MODE_LABELS: Record<string, string> = {
  WIND: 'Vent', WATER: 'Eau', SOIL: 'Sol', SEEDS: 'Semences', TOOLS: 'Outils', INSECT_VECTORS: 'Insectes vecteurs', CONTACT: 'Contact',
};
export const EVOLUTION_SPEED_LABELS: Record<string, string> = { SLOW: 'Lente', MODERATE: 'Modérée', FAST: 'Rapide' };
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib/api.ts apps/admin/src/lib/actions.ts apps/admin/src/lib/labels.ts
git commit -m "feat(admin): plomberie maladie (PestDisease, wind, action, libellés propagation/vitesse)"
```

---

### Task 5: Admin — `PestDiseaseEditor` + vent dans l'éditeur biologie

**Files:**
- Create: `apps/admin/src/app/pests/[id]/editors/PestDiseaseEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`
- Modify: `apps/admin/src/app/pests/[id]/page.tsx`

**Interfaces:**
- Consumes: `setPestDisease`, `PROPAGATION_MODE_LABELS`, `EVOLUTION_SPEED_LABELS` (Task 4).

- [ ] **Step 1: `PestDiseaseEditor` (nouveau, maladie seulement)**

Create `apps/admin/src/app/pests/[id]/editors/PestDiseaseEditor.tsx` (miroir de `PestWeedEditor`) :
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PROPAGATION_MODE_LABELS, EVOLUTION_SPEED_LABELS } from '@/lib/labels';
import { setPestDisease } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDiseaseEditor({ pest }: { pest: Pest }) {
  const [firstSymptoms, setFirstSymptoms] = useState(pest.firstSymptoms?.fr ?? '');
  const [advancedSymptoms, setAdvancedSymptoms] = useState(pest.advancedSymptoms?.fr ?? '');
  const [confusionRisk, setConfusionRisk] = useState(pest.confusionRisk?.fr ?? '');
  const [pathogen, setPathogen] = useState(pest.pathogen?.fr ?? '');
  const [propagation, setPropagation] = useState<string[]>(pest.propagationModes ?? []);
  const [potentialLosses, setPotentialLosses] = useState(pest.potentialLosses?.fr ?? '');
  const [evolutionSpeed, setEvolutionSpeed] = useState(pest.evolutionSpeed ?? '');

  return (
    <EditorShell label="Modifier les traits maladie">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Agent pathogène</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={pathogen} onChange={(e) => setPathogen(e.target.value)} /></div>
          <div className="space-y-1"><Label>Mode de propagation</Label><ChipMultiSelect options={PROPAGATION_MODE_LABELS} value={propagation} onChange={setPropagation} /></div>
          <div className="space-y-1"><Label>Premiers symptômes</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={firstSymptoms} onChange={(e) => setFirstSymptoms(e.target.value)} /></div>
          <div className="space-y-1"><Label>Symptômes avancés</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={advancedSymptoms} onChange={(e) => setAdvancedSymptoms(e.target.value)} /></div>
          <div className="space-y-1"><Label>Risque de confusion</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={confusionRisk} onChange={(e) => setConfusionRisk(e.target.value)} /></div>
          <div className="space-y-1"><Label>Pertes potentielles</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={potentialLosses} onChange={(e) => setPotentialLosses(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Vitesse d&apos;évolution</Label>
            <Select value={evolutionSpeed} onValueChange={setEvolutionSpeed}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVOLUTION_SPEED_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDisease(pest.id, {
                firstSymptoms: firstSymptoms ? { fr: firstSymptoms } : undefined,
                advancedSymptoms: advancedSymptoms ? { fr: advancedSymptoms } : undefined,
                confusionRisk: confusionRisk ? { fr: confusionRisk } : undefined,
                pathogen: pathogen ? { fr: pathogen } : undefined,
                propagationModes: propagation,
                potentialLosses: potentialLosses ? { fr: potentialLosses } : undefined,
                evolutionSpeed: evolutionSpeed || undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2: `PestBiologyEditor` — champ Vent**

In `apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx`:
- Add state (près de `rainfall`) : `const [wind, setWind] = useState<MinMax | undefined>(pest.favorableConditions?.wind);`
- Add the input after the « Pluie » `MinMaxRangeInput` :
```tsx
            <MinMaxRangeInput label="Vent" unit="km/h" value={wind} onChange={setWind} />
```
- In submit, `favorableConditions` — inclure `wind` :
```tsx
                favorableConditions: (temperature || humidity || rainfall || wind || condNotes)
                  ? { temperature, humidity, rainfall, wind, notes: condNotes ? { fr: condNotes } : undefined }
                  : undefined,
```

- [ ] **Step 3: `page.tsx` — monter `PestDiseaseEditor` (maladie seulement)**

In `apps/admin/src/app/pests/[id]/page.tsx`:
- Import : `import { PestDiseaseEditor } from './editors/PestDiseaseEditor';`
- Après la ligne `{pest.kind === 'WEED' && <PestWeedEditor pest={pest} />}`, ajouter :
```tsx
          {pest.kind === 'DISEASE' && <PestDiseaseEditor pest={pest} />}
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]/editors/PestDiseaseEditor.tsx" "apps/admin/src/app/pests/[id]/editors/PestBiologyEditor.tsx" "apps/admin/src/app/pests/[id]/page.tsx"
git commit -m "feat(admin): PestDiseaseEditor + champ Vent dans l'éditeur biologie"
```

---

### Task 6: Admin — fiche consciente du kind (Symptômes / Développement / Impacts)

**Files:**
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`

**Interfaces:**
- Consumes: les champs disease + `PROPAGATION_MODE_LABELS`, `EVOLUTION_SPEED_LABELS`, `HARMFULNESS_LABELS`, `ATTACKED_ORGAN_LABELS`, `MONTH_LABELS`.

**READ the file first.** Le comportement ravageur/adventice (`isWeed`, générique) doit rester **inchangé** — on ajoute `isDisease` et des blocs `{isDisease && ...}`, plus quelques titres/gardes conscients du kind.

- [ ] **Step 1: Constantes + imports**

1a. Import `@/lib/labels` — ajouter `PROPAGATION_MODE_LABELS, EVOLUTION_SPEED_LABELS`.

1b. Après `const isWeed = pest.kind === 'WEED';` (et `const isDisease` s'il n'existe pas déjà — il a été ajouté en Brique 1, vérifier ; sinon l'ajouter) — s'assurer que `const isDisease = pest.kind === 'DISEASE';` est présent.

1c. Ajouter des drapeaux de présence :
```ts
  const hasDiseaseDev = !!(b.pathogen?.fr || (b.propagationModes?.length));
  const hasImpacts = !!(b.harmfulnessLevel || b.potentialLosses?.fr || b.evolutionSpeed);
```

- [ ] **Step 2: Section Biologie → « Développement » pour une maladie**

Dans la section Biologie :
- Titre : `{isDisease ? 'Développement' : 'Biologie'}`.
- `hasBiology` — étendre avec `|| (isDisease && (hasDiseaseDev || b.activityPeriods?.length || b.favorableConditions?.wind))`.
- Masquer pour maladie les lignes cycle de vie / durée du cycle / stades / générations : envelopper chacune dans `{!isDisease && ...}` (la ligne « Générations/an » est déjà `!isWeed && …` → devient `!isWeed && !isDisease && …`).
- Ligne « Activité » : libellé conscient — `{isDisease ? 'Périodes à risque' : 'Activité'}`.
- Dans la ligne « Conditions favorables », ajouter le vent : ajouter `range(b.favorableConditions?.wind) && \`Vent ${range(b.favorableConditions?.wind)}\`` au tableau joint par ` · `, et étendre la garde d'affichage du bloc avec `|| range(b.favorableConditions?.wind)`.
- Après le bloc conditions favorables (toujours dans le `<div className="space-y-2 text-sm">` de la biologie), ajouter les traits maladie :
```tsx
              {isDisease && b.pathogen?.fr && <p><span className="text-muted-foreground">Agent pathogène : </span>{b.pathogen.fr}</p>}
              {isDisease && (b.propagationModes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Propagation : </span>
                  {b.propagationModes!.map((m) => <span key={m} className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{labelOf(PROPAGATION_MODE_LABELS, m)}</span>)}
                </div>
              )}
```

- [ ] **Step 3: Section Dégâts → « Symptômes » pour une maladie**

Dans la section Dégâts :
- Titre : `{isWeed ? 'Nuisibilité' : isDisease ? 'Symptômes' : 'Dégâts'}`.
- Badge « niveau » dans l'en-tête (`{b.harmfulnessLevel && (<span…>)}`) : le masquer pour maladie → `{!isDisease && b.harmfulnessLevel && (<span…>)}` (la gravité maladie ira dans Impacts).
- `hasDamage` — étendre avec `|| (isDisease && (b.firstSymptoms?.fr || b.advancedSymptoms?.fr || b.confusionRisk?.fr))`.
- « Types de dégâts » (`{!isWeed && (b.damageTypes?.length …)}`) → `{!isWeed && !isDisease && …}` (masqué pour maladie). « Organes attaqués » (`{!isWeed && …}`) reste affiché pour une maladie (organes atteints). Le libellé « Organes attaqués » reste tel quel.
- Après la ligne symptoms, ajouter les champs symptômes maladie :
```tsx
              {isDisease && b.firstSymptoms?.fr && <p><span className="text-muted-foreground">Premiers symptômes : </span>{b.firstSymptoms.fr}</p>}
              {isDisease && b.advancedSymptoms?.fr && <p><span className="text-muted-foreground">Symptômes avancés : </span>{b.advancedSymptoms.fr}</p>}
              {isDisease && b.confusionRisk?.fr && <p><span className="text-muted-foreground">Risque de confusion : </span>{b.confusionRisk.fr}</p>}
```

- [ ] **Step 4: Nouvelle section « Impacts » (maladie seulement)**

Juste après la section Dégâts (avant Répartition), ajouter :
```tsx
        {isDisease && hasImpacts && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f6efe6] text-[#8a5a2c]"><Bug className="h-4 w-4" /></span>
              Impacts
            </h2>
            <div className="space-y-2 text-sm">
              {b.harmfulnessLevel && <p><span className="text-muted-foreground">Gravité : </span>{labelOf(HARMFULNESS_LABELS, b.harmfulnessLevel)}</p>}
              {b.potentialLosses?.fr && <p><span className="text-muted-foreground">Pertes potentielles : </span>{b.potentialLosses.fr}</p>}
              {b.evolutionSpeed && <p><span className="text-muted-foreground">Vitesse d&apos;évolution : </span>{labelOf(EVOLUTION_SPEED_LABELS, b.evolutionSpeed)}</p>}
            </div>
          </section>
        )}
```

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/pests/[id]/PestFicheView.tsx"
git commit -m "feat(admin): fiche maladie consciente du kind (Symptômes/Développement/Impacts)"
```

- [ ] **Step 6: Vérification manuelle**

Démarrer admin + API. Créer/ouvrir une **maladie** :
- Bouton « Modifier les traits maladie » présent (absent pour ravageur/adventice) ; renseigner agent pathogène, propagation, premiers/avancés symptômes, risque de confusion, pertes, vitesse → visibles sur la fiche.
- Section « Développement » (au lieu de Biologie) : agent pathogène + propagation + conditions favorables (avec **Vent**, saisi via l'éditeur biologie) + « Périodes à risque » ; pas de cycle de vie/stades/générations.
- Section « Symptômes » (au lieu de Dégâts) : symptômes + organes atteints (dont **Collet**) + premiers/avancés + risque de confusion ; pas de types de dégâts.
- Nouvelle section « Impacts » : Gravité + pertes potentielles + vitesse d'évolution.
- Un **ravageur** et une **adventice** existants : rendu **inchangé**.

---

## Notes de fin

- **Brique 2b** (plan suivant) : prévention détaillée (rotation, variétés résistantes, prophylaxie, irrigation, désinfection, chimique, culturale, curative) — 8 champs qui étendront le bloc `_disease` + section « Prévention » de la fiche.
- **Dette** : constructeur `Pest` à 18 params — refactor props-object à envisager après la trilogie.
