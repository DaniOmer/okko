# Zone agro-écologique — champs descriptifs (Brique 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir la zone agro-écologique avec ses champs descriptifs (identification, climat, saisons, sols), éditables dans l'admin.

**Architecture:** `AgroEcologicalZone` est un agrégat CRUD immuable. On refactore son constructeur privé positionnel (9 params) en **objet de props** (pour absorber ~12 nouveaux champs sans 20 arguments positionnels), on ajoute les champs au snapshot/create/update/fromSnapshot, une migration additive, l'API et des formulaires admin enrichis (composant partagé `ZoneFields`).

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Migration additive uniquement** (`ADD COLUMN` nullable). Inspecter le SQL ; si Prisma propose reset/drop → STOP + BLOCKED. Après `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- `altitude`/`annualRainfall` sont des `RangeValue` = `{ min, optimal, max, unit }` (contrainte `min ≤ optimal ≤ max`). Le formulaire saisit **min/max** et envoie `optimal = round((min+max)/2)`.
- Énumérations (valeurs de code) : climat `TROPICAL_HUMID/TROPICAL_DRY/SAHELIAN/MEDITERRANEAN/TEMPERATE/HIGHLAND` ; fertilité `LOW/MEDIUM/HIGH` ; drainage `POOR/MODERATE/GOOD` ; mois = clés `MONTH_LABELS` (`JAN`…`DEC`). Le domaine ne valide pas ces énums.
- `meanTemperature`/`meanHumidity` = valeurs **uniques** (`number`). Le champ `notes` reste interne (non exposé) ; « description » est un champ distinct.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine — refactor props-object + nouveaux champs

**Files:**
- Modify (rewrite): `apps/api/src/domain/zone/agro-ecological-zone.ts`
- Test: `apps/api/src/domain/zone/agro-ecological-zone.spec.ts` (extend)

**Interfaces:**
- Produces: `ZoneSnapshot` étendu ; `AgroEcologicalZone.create/update/fromSnapshot/toSnapshot` acceptant les nouveaux champs ; constructeur privé à objet de props.

- [ ] **Step 1: Failing test**

Add to `apps/api/src/domain/zone/agro-ecological-zone.spec.ts` (garder les tests existants ; importer ce qu'il faut en tête si absent : `TranslatableText`, `RangeValue`) :
```ts
import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone — champs descriptifs', () => {
  const full = () => AgroEcologicalZone.create({
    id: 'z1', name: TranslatableText.create({ fr: 'Zone Nord' }), country: 'BJ',
    code: 'ZN', region: 'Alibori', description: TranslatableText.create({ fr: 'Savane soudanienne' }),
    climateType: 'SAHELIAN', koppen: 'BSh',
    altitude: RangeValue.create({ min: 200, optimal: 300, max: 400, unit: 'm' }),
    annualRainfall: RangeValue.create({ min: 600, optimal: 800, max: 1000, unit: 'mm' }),
    meanTemperature: 28, meanHumidity: 55,
    rainySeasonStart: 'JUN', rainySeasonEnd: 'OCT', drySeasonStart: 'NOV', drySeasonEnd: 'MAY',
    soilTypes: ['Ferrugineux', 'Sableux'], fertility: 'MEDIUM', drainage: 'GOOD',
  });

  it('create expose tous les champs descriptifs dans le snapshot', () => {
    const s = full().toSnapshot();
    expect(s).toMatchObject({
      code: 'ZN', region: 'Alibori', description: { fr: 'Savane soudanienne' },
      climateType: 'SAHELIAN', koppen: 'BSh', meanTemperature: 28, meanHumidity: 55,
      rainySeasonStart: 'JUN', rainySeasonEnd: 'OCT', drySeasonStart: 'NOV', drySeasonEnd: 'MAY',
      soilTypes: ['Ferrugineux', 'Sableux'], fertility: 'MEDIUM', drainage: 'GOOD',
    });
    expect(s.altitude).toEqual({ min: 200, optimal: 300, max: 400, unit: 'm' });
    expect(s.annualRainfall).toEqual({ min: 600, optimal: 800, max: 1000, unit: 'mm' });
  });

  it('update modifie les champs descriptifs et préserve id/metadata/images', () => {
    const updated = full().update({
      name: TranslatableText.create({ fr: 'Zone Nord' }), country: 'BJ',
      climateType: 'TROPICAL_DRY', fertility: 'HIGH', meanTemperature: 30,
    });
    const s = updated.toSnapshot();
    expect(s.id).toBe('z1');
    expect(s.climateType).toBe('TROPICAL_DRY');
    expect(s.fertility).toBe('HIGH');
    expect(s.meanTemperature).toBe(30);
    expect(s.region).toBeUndefined(); // remplacement : champ non fourni → absent
  });

  it('fromSnapshot round-trip complet', () => {
    const s = full().toSnapshot();
    expect(AgroEcologicalZone.fromSnapshot(s).toSnapshot()).toEqual(s);
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/zone/agro-ecological-zone.spec.ts` → FAIL.

- [ ] **Step 3: Rewrite `agro-ecological-zone.ts`**

Replace the whole file with:
```ts
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { MediaImage, MediaImageJSON } from '../media/media-image';

type RangeJSON = ReturnType<RangeValue['toJSON']>;

export interface ZoneSnapshot {
  id: string;
  name: Record<string, string>;
  country: string;
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  koppen?: string;
  altitude?: RangeJSON;
  annualRainfall?: RangeJSON;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  images: MediaImageJSON[];
}

interface ZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  images: MediaImage[];
}

export interface CreateZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  images?: MediaImageJSON[];
}

export interface UpdateZoneFields {
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  images?: MediaImageJSON[];
}

export class AgroEcologicalZone {
  private constructor(private readonly p: ZoneProps) {}

  static create(props: CreateZoneProps): AgroEcologicalZone {
    return new AgroEcologicalZone({
      ...props,
      metadata: props.metadata ?? {},
      images: (props.images ?? []).map(MediaImage.fromJSON),
    });
  }

  get id(): string { return this.p.id; }
  get name(): TranslatableText { return this.p.name; }
  get country(): string { return this.p.country; }
  get koppen(): string | undefined { return this.p.koppen; }
  get altitude(): RangeValue | undefined { return this.p.altitude; }
  get annualRainfall(): RangeValue | undefined { return this.p.annualRainfall; }
  get notes(): string | undefined { return this.p.notes; }
  get metadata(): Record<string, unknown> { return { ...this.p.metadata }; }
  get images(): MediaImage[] { return [...this.p.images]; }

  toSnapshot(): ZoneSnapshot {
    return {
      id: this.p.id,
      name: this.p.name.toJSON(),
      country: this.p.country,
      code: this.p.code,
      region: this.p.region,
      description: this.p.description?.toJSON(),
      climateType: this.p.climateType,
      koppen: this.p.koppen,
      altitude: this.p.altitude?.toJSON(),
      annualRainfall: this.p.annualRainfall?.toJSON(),
      meanTemperature: this.p.meanTemperature,
      meanHumidity: this.p.meanHumidity,
      rainySeasonStart: this.p.rainySeasonStart,
      rainySeasonEnd: this.p.rainySeasonEnd,
      drySeasonStart: this.p.drySeasonStart,
      drySeasonEnd: this.p.drySeasonEnd,
      soilTypes: this.p.soilTypes,
      fertility: this.p.fertility,
      drainage: this.p.drainage,
      notes: this.p.notes,
      metadata: { ...this.p.metadata },
      images: this.p.images.map((img) => img.toJSON()),
    };
  }

  update(fields: UpdateZoneFields): AgroEcologicalZone {
    return new AgroEcologicalZone({
      id: this.p.id,
      notes: this.p.notes,
      metadata: this.p.metadata,
      name: fields.name,
      country: fields.country,
      code: fields.code,
      region: fields.region,
      description: fields.description,
      climateType: fields.climateType,
      koppen: fields.koppen,
      altitude: fields.altitude,
      annualRainfall: fields.annualRainfall,
      meanTemperature: fields.meanTemperature,
      meanHumidity: fields.meanHumidity,
      rainySeasonStart: fields.rainySeasonStart,
      rainySeasonEnd: fields.rainySeasonEnd,
      drySeasonStart: fields.drySeasonStart,
      drySeasonEnd: fields.drySeasonEnd,
      soilTypes: fields.soilTypes,
      fertility: fields.fertility,
      drainage: fields.drainage,
      images: fields.images !== undefined ? fields.images.map(MediaImage.fromJSON) : this.p.images,
    });
  }

  static fromSnapshot(s: ZoneSnapshot): AgroEcologicalZone {
    return new AgroEcologicalZone({
      id: s.id,
      name: TranslatableText.create(s.name),
      country: s.country,
      code: s.code,
      region: s.region,
      description: s.description ? TranslatableText.create(s.description) : undefined,
      climateType: s.climateType,
      koppen: s.koppen,
      altitude: s.altitude ? RangeValue.create(s.altitude) : undefined,
      annualRainfall: s.annualRainfall ? RangeValue.create(s.annualRainfall) : undefined,
      meanTemperature: s.meanTemperature,
      meanHumidity: s.meanHumidity,
      rainySeasonStart: s.rainySeasonStart,
      rainySeasonEnd: s.rainySeasonEnd,
      drySeasonStart: s.drySeasonStart,
      drySeasonEnd: s.drySeasonEnd,
      soilTypes: s.soilTypes,
      fertility: s.fertility,
      drainage: s.drainage,
      notes: s.notes,
      metadata: { ...s.metadata },
      images: (s.images ?? []).map(MediaImage.fromJSON),
    });
  }
}
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/zone` → all PASS (nouveaux + existants).

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/zone/agro-ecological-zone.ts apps/api/src/domain/zone/agro-ecological-zone.spec.ts
git commit -m "feat(zone): champs descriptifs + constructeur objet de props (AgroEcologicalZone)"
```

---

### Task 2: Migration + repo + read-model

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `AgroEcologicalZone`)
- Create: migration `<ts>_zone_descriptive_fields/migration.sql`
- Modify: `apps/api/src/infrastructure/zone/prisma-zone.repository.ts`
- Modify: `apps/api/src/application/zone/zone-read-model.ts`
- Test: `apps/api/src/application/zone/zone-read-model.spec.ts` (add a case if the file exists ; sinon s'appuyer sur tsc)

**Interfaces:**
- Consumes: `ZoneSnapshot` (Task 1).
- Produces: `ZoneDocument` étendu.

- [ ] **Step 1: Prisma schema — colonnes additives**

In `apps/api/prisma/schema.prisma`, model `AgroEcologicalZone`, add after `koppen String?` (avant `altitude`) :
```prisma
  code             String?
  region           String?
  description      Json?
  climateType      String?
  meanTemperature  Float?
  meanHumidity     Float?
  rainySeasonStart String?
  rainySeasonEnd   String?
  drySeasonStart   String?
  drySeasonEnd     String?
  soilTypes        Json?
  fertility        String?
  drainage         String?
```

- [ ] **Step 2: Generate + apply migration**
```bash
cd apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name zone_descriptive_fields
```
Inspect the generated `migration.sql` — must be only `ADD COLUMN` statements (all nullable, no default, no drop). Then apply:
```bash
pnpm --filter @okko/api exec prisma migrate dev
```
If Prisma proposes reset/drop → STOP + report BLOCKED.

- [ ] **Step 3: Verify existing rows preserved**
```bash
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "AgroEcologicalZone";'
```
Report the count (must be unchanged; existing rows preserved).

- [ ] **Step 4: Repo `toRow` — écrire les nouveaux champs**

In `prisma-zone.repository.ts`, `toRow`, add (près de `koppen`) :
```ts
      code: z.code ?? null,
      region: z.region ?? null,
      description: (z.description ?? undefined) as Prisma.InputJsonValue | undefined,
      climateType: z.climateType ?? null,
      meanTemperature: z.meanTemperature ?? null,
      meanHumidity: z.meanHumidity ?? null,
      rainySeasonStart: z.rainySeasonStart ?? null,
      rainySeasonEnd: z.rainySeasonEnd ?? null,
      drySeasonStart: z.drySeasonStart ?? null,
      drySeasonEnd: z.drySeasonEnd ?? null,
      soilTypes: (z.soilTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      fertility: z.fertility ?? null,
      drainage: z.drainage ?? null,
```

- [ ] **Step 5: Repo `toSnapshot` — lire les nouveaux champs**

In `toSnapshot`, add (près de `koppen`) :
```ts
      code: row.code ?? undefined,
      region: row.region ?? undefined,
      description: (row.description ?? undefined) as Record<string, string> | undefined,
      climateType: row.climateType ?? undefined,
      meanTemperature: row.meanTemperature ?? undefined,
      meanHumidity: row.meanHumidity ?? undefined,
      rainySeasonStart: row.rainySeasonStart ?? undefined,
      rainySeasonEnd: row.rainySeasonEnd ?? undefined,
      drySeasonStart: row.drySeasonStart ?? undefined,
      drySeasonEnd: row.drySeasonEnd ?? undefined,
      soilTypes: (row.soilTypes ?? undefined) as string[] | undefined,
      fertility: row.fertility ?? undefined,
      drainage: row.drainage ?? undefined,
```

- [ ] **Step 6: Read-model — exposer + indexer**

In `apps/api/src/application/zone/zone-read-model.ts`:

6a. `ZoneDocument` — add (après `koppen?`) :
```ts
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
```

6b. `toZoneDocument` — serializedText lines (après la ligne `Köppen`) :
```ts
  if (z.climateType) lines.push(`Climat : ${z.climateType}`);
  if (z.region) lines.push(`Région : ${z.region}`);
  if (z.description) lines.push(z.description[locale] ?? z.description['fr']);
  if (z.meanTemperature != null) lines.push(`Température moyenne : ${z.meanTemperature} °C`);
  if (z.soilTypes?.length) lines.push(`Sols : ${z.soilTypes.join(', ')}`);
```

6c. `toZoneDocument` return object — add :
```ts
    code: z.code, region: z.region, description: z.description, climateType: z.climateType,
    meanTemperature: z.meanTemperature, meanHumidity: z.meanHumidity,
    rainySeasonStart: z.rainySeasonStart, rainySeasonEnd: z.rainySeasonEnd,
    drySeasonStart: z.drySeasonStart, drySeasonEnd: z.drySeasonEnd,
    soilTypes: z.soilTypes, fertility: z.fertility, drainage: z.drainage,
```

- [ ] **Step 7: Typecheck + (spec si présent) + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/zone
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/prisma apps/api/src/infrastructure/zone/prisma-zone.repository.ts apps/api/src/application/zone/zone-read-model.ts
git commit -m "feat(zone): persistance + read-model des champs descriptifs (migration additive)"
```

---

### Task 3: API — use-cases create/update + controller

**Files:**
- Modify: `apps/api/src/application/zone/create-zone.use-case.ts`
- Modify: `apps/api/src/application/zone/update-zone.use-case.ts`
- Modify: `apps/api/src/presentation/zone/zone.controller.ts`

**Interfaces:**
- Consumes: `AgroEcologicalZone.create/update` (Task 1), `RangeValue`.
- Produces: create/update acceptent tous les champs descriptifs.

- [ ] **Step 1: `create-zone.use-case.ts`**

Extend `CreateZoneInput` with (après `country`) :
```ts
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
```
In `AgroEcologicalZone.create({...})`, add:
```ts
      code: input.code,
      region: input.region,
      description: input.description ? TranslatableText.create(input.description) : undefined,
      climateType: input.climateType,
      meanTemperature: input.meanTemperature,
      meanHumidity: input.meanHumidity,
      rainySeasonStart: input.rainySeasonStart,
      rainySeasonEnd: input.rainySeasonEnd,
      drySeasonStart: input.drySeasonStart,
      drySeasonEnd: input.drySeasonEnd,
      soilTypes: input.soilTypes,
      fertility: input.fertility,
      drainage: input.drainage,
```

- [ ] **Step 2: `update-zone.use-case.ts`**

Add `import { RangeValue } from '../../domain/shared/range-value';`. Extend `UpdateZoneInput` (mirror the create additions: same 13 fields) PLUS make it accept `altitude?`/`annualRainfall?` as `ReturnType<RangeValue['toJSON']>` :
```ts
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  code?: string; region?: string; description?: Record<string, string>;
  climateType?: string; meanTemperature?: number; meanHumidity?: number;
  rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
  soilTypes?: string[]; fertility?: string; drainage?: string;
```
In `.update({...})`, replace the current 4-field object with the full set:
```ts
    const updated = AgroEcologicalZone.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      country: input.country,
      code: input.code || undefined,
      region: input.region || undefined,
      description: input.description ? TranslatableText.create(input.description) : undefined,
      climateType: input.climateType || undefined,
      koppen: input.koppen || undefined,
      altitude: input.altitude ? RangeValue.create(input.altitude) : undefined,
      annualRainfall: input.annualRainfall ? RangeValue.create(input.annualRainfall) : undefined,
      meanTemperature: input.meanTemperature,
      meanHumidity: input.meanHumidity,
      rainySeasonStart: input.rainySeasonStart || undefined,
      rainySeasonEnd: input.rainySeasonEnd || undefined,
      drySeasonStart: input.drySeasonStart || undefined,
      drySeasonEnd: input.drySeasonEnd || undefined,
      soilTypes: input.soilTypes,
      fertility: input.fertility || undefined,
      drainage: input.drainage || undefined,
      images: input.images,
    });
```

- [ ] **Step 3: `zone.controller.ts` — corps create/update**

Extend the `@Post()` body type and the `@Patch(':id')` body type with the new fields. The `@Post()` already has `altitude`/`annualRainfall`/`koppen`; add to BOTH bodies:
```ts
    code?: string; region?: string; description?: Record<string, string>;
    climateType?: string; meanTemperature?: number; meanHumidity?: number;
    rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
    soilTypes?: string[]; fertility?: string; drainage?: string;
```
For the `@Patch(':id')` body, ALSO add `altitude?` / `annualRainfall?` / `koppen?` (it currently only has name/country/koppen/images — add the two ranges):
```ts
    koppen?: string; altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>;
```
(`RangeValue` is already imported in the controller.) The `...body` spread already forwards everything to the use-cases.

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/application/zone src/domain/zone
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/application/zone/create-zone.use-case.ts apps/api/src/application/zone/update-zone.use-case.ts apps/api/src/presentation/zone/zone.controller.ts
git commit -m "feat(zone): create/update acceptent les champs descriptifs"
```

---

### Task 4: Admin — plomberie (type, actions, libellés)

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (interface `Zone`)
- Modify: `apps/admin/src/lib/actions.ts` (`createZone`/`updateZone`)
- Modify: `apps/admin/src/lib/labels.ts`

**Interfaces:**
- Produces: `Zone` étendu ; `createZone`/`updateZone` élargis ; `CLIMATE_TYPE_LABELS`, `FERTILITY_LABELS`, `DRAINAGE_LABELS`.

- [ ] **Step 1: `api.ts` — interface `Zone`**

Replace the `Zone` interface with:
```ts
export interface Zone {
  id: string; name: string; country: string;
  code?: string; region?: string; description?: Record<string, string>;
  climateType?: string; koppen?: string;
  altitude?: MinMaxRangeJSON; annualRainfall?: MinMaxRangeJSON;
  meanTemperature?: number; meanHumidity?: number;
  rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
  soilTypes?: string[]; fertility?: string; drainage?: string;
  images: ImageRef[];
}
```
(`MinMaxRangeJSON` = `{ min; max; unit? }` here is a superset-compatible view of the API's `{min,optimal,max,unit}` for display — the admin only reads min/max/unit.)

- [ ] **Step 2: `actions.ts` — élargir create/update**

Define a shared payload type at the top of the two functions' region:
```ts
type ZonePayload = {
  name: Record<string, string>; country: string;
  code?: string; region?: string; description?: Record<string, string>;
  climateType?: string; koppen?: string;
  altitude?: { min: number; optimal: number; max: number; unit: string };
  annualRainfall?: { min: number; optimal: number; max: number; unit: string };
  meanTemperature?: number; meanHumidity?: number;
  rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
  soilTypes?: string[]; fertility?: string; drainage?: string;
  images?: { key: string; caption?: string }[];
};
```
Change signatures to:
```ts
export async function createZone(input: ZonePayload): Promise<Zone> {
  const res = await authFetch('/zones', jsonInit('POST', input));
  return res.json();
}
export async function updateZone(id: string, input: ZonePayload): Promise<Zone> {
  const res = await authFetch(`/zones/${id}`, jsonInit('PATCH', input));
  return res.json();
}
```

- [ ] **Step 3: `labels.ts`**
```ts
export const CLIMATE_TYPE_LABELS: Record<string, string> = {
  TROPICAL_HUMID: 'Tropical humide', TROPICAL_DRY: 'Tropical sec', SAHELIAN: 'Sahélien',
  MEDITERRANEAN: 'Méditerranéen', TEMPERATE: 'Tempéré', HIGHLAND: 'Montagnard',
};
export const FERTILITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };
export const DRAINAGE_LABELS: Record<string, string> = { POOR: 'Faible', MODERATE: 'Modéré', GOOD: 'Bon' };
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib/api.ts apps/admin/src/lib/actions.ts apps/admin/src/lib/labels.ts
git commit -m "feat(admin): plomberie zone (type Zone enrichi, actions, libellés climat/fertilité/drainage)"
```

---

### Task 5: Admin — composant partagé `ZoneFields` + helper payload

**Files:**
- Create: `apps/admin/src/app/zones/ZoneFields.tsx`

**Interfaces:**
- Consumes: `CLIMATE_TYPE_LABELS`, `FERTILITY_LABELS`, `DRAINAGE_LABELS`, `MONTH_LABELS` ; `MinMaxRangeInput`/`MinMax`, `TagListInput`, `ImageGalleryUploader`.
- Produces: `ZoneFormValue` (type), `emptyZoneForm()`, `zoneFormFromZone(z)`, `zoneFormToPayload(v)`, `<ZoneFields value onChange />`.

- [ ] **Step 1: Create `ZoneFields.tsx`**
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { TagListInput } from '@/components/TagListInput';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import { CLIMATE_TYPE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, MONTH_LABELS } from '@/lib/labels';
import type { ImageRef, Zone } from '@/lib/api';

export interface ZoneFormValue {
  name: string; country: string; code: string; region: string; description: string;
  climateType: string; koppen: string;
  altitude?: MinMax; annualRainfall?: MinMax;
  meanTemperature: string; meanHumidity: string;
  rainySeasonStart: string; rainySeasonEnd: string; drySeasonStart: string; drySeasonEnd: string;
  soilTypes: string[]; fertility: string; drainage: string;
  images: ImageRef[];
}

export function emptyZoneForm(): ZoneFormValue {
  return {
    name: '', country: '', code: '', region: '', description: '', climateType: '', koppen: '',
    altitude: undefined, annualRainfall: undefined, meanTemperature: '', meanHumidity: '',
    rainySeasonStart: '', rainySeasonEnd: '', drySeasonStart: '', drySeasonEnd: '',
    soilTypes: [], fertility: '', drainage: '', images: [],
  };
}

export function zoneFormFromZone(z: Zone): ZoneFormValue {
  const mm = (r?: { min: number; max: number; unit?: string }): MinMax | undefined =>
    r ? { min: r.min, max: r.max, unit: r.unit } : undefined;
  return {
    name: z.name ?? '', country: z.country ?? '', code: z.code ?? '', region: z.region ?? '',
    description: z.description?.fr ?? '', climateType: z.climateType ?? '', koppen: z.koppen ?? '',
    altitude: mm(z.altitude), annualRainfall: mm(z.annualRainfall),
    meanTemperature: z.meanTemperature != null ? String(z.meanTemperature) : '',
    meanHumidity: z.meanHumidity != null ? String(z.meanHumidity) : '',
    rainySeasonStart: z.rainySeasonStart ?? '', rainySeasonEnd: z.rainySeasonEnd ?? '',
    drySeasonStart: z.drySeasonStart ?? '', drySeasonEnd: z.drySeasonEnd ?? '',
    soilTypes: z.soilTypes ?? [], fertility: z.fertility ?? '', drainage: z.drainage ?? '',
    images: z.images ?? [],
  };
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const rng = (r: MinMax | undefined, unit: string) =>
  r ? { min: r.min, optimal: Math.round((r.min + r.max) / 2), max: r.max, unit } : undefined;

export function zoneFormToPayload(v: ZoneFormValue) {
  return {
    name: { fr: v.name },
    country: v.country,
    code: v.code || undefined,
    region: v.region || undefined,
    description: v.description ? { fr: v.description } : undefined,
    climateType: v.climateType || undefined,
    koppen: v.koppen || undefined,
    altitude: rng(v.altitude, 'm'),
    annualRainfall: rng(v.annualRainfall, 'mm'),
    meanTemperature: num(v.meanTemperature),
    meanHumidity: num(v.meanHumidity),
    rainySeasonStart: v.rainySeasonStart || undefined,
    rainySeasonEnd: v.rainySeasonEnd || undefined,
    drySeasonStart: v.drySeasonStart || undefined,
    drySeasonEnd: v.drySeasonEnd || undefined,
    soilTypes: v.soilTypes.length ? v.soilTypes : undefined,
    fertility: v.fertility || undefined,
    drainage: v.drainage || undefined,
    images: v.images.map((i) => ({ key: i.key, caption: i.caption })),
  };
}

function MonthSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="— mois —" /></SelectTrigger>
        <SelectContent>
          {Object.entries(MONTH_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ZoneFields({ value, onChange }: { value: ZoneFormValue; onChange: (v: ZoneFormValue) => void }) {
  const set = <K extends keyof ZoneFormValue>(k: K, val: ZoneFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-sm font-semibold">Identification</p>
        <div className="space-y-1"><Label>Nom (fr) *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="space-y-1"><Label>Pays *</Label><Input placeholder="ex. BJ" value={value.country} onChange={(e) => set('country', e.target.value)} required /></div>
        <div className="space-y-1"><Label>Code (optionnel)</Label><Input value={value.code} onChange={(e) => set('code', e.target.value)} /></div>
        <div className="space-y-1"><Label>Région administrative</Label><Input value={value.region} onChange={(e) => set('region', e.target.value)} /></div>
        <div className="space-y-1"><Label>Description</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.description} onChange={(e) => set('description', e.target.value)} /></div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Climat</p>
        <div className="space-y-1">
          <Label>Type de climat</Label>
          <Select value={value.climateType} onValueChange={(v) => set('climateType', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(CLIMATE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Classification de Köppen (optionnel)</Label><Input value={value.koppen} onChange={(e) => set('koppen', e.target.value)} /></div>
        <MinMaxRangeInput label="Altitude" unit="m" value={value.altitude} onChange={(v) => set('altitude', v)} />
        <MinMaxRangeInput label="Pluviométrie annuelle" unit="mm" value={value.annualRainfall} onChange={(v) => set('annualRainfall', v)} />
        <div className="space-y-1"><Label>Température moyenne (°C)</Label><Input type="number" className="w-32" value={value.meanTemperature} onChange={(e) => set('meanTemperature', e.target.value)} /></div>
        <div className="space-y-1"><Label>Humidité moyenne (%) (optionnel)</Label><Input type="number" className="w-32" value={value.meanHumidity} onChange={(e) => set('meanHumidity', e.target.value)} /></div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Saisons</p>
        <div className="grid grid-cols-2 gap-2">
          <MonthSelect label="Début saison des pluies" value={value.rainySeasonStart} onChange={(v) => set('rainySeasonStart', v)} />
          <MonthSelect label="Fin saison des pluies" value={value.rainySeasonEnd} onChange={(v) => set('rainySeasonEnd', v)} />
          <MonthSelect label="Début saison sèche" value={value.drySeasonStart} onChange={(v) => set('drySeasonStart', v)} />
          <MonthSelect label="Fin saison sèche" value={value.drySeasonEnd} onChange={(v) => set('drySeasonEnd', v)} />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Sols dominants</p>
        <div className="space-y-1"><Label>Types de sols principaux</Label><TagListInput value={value.soilTypes} onChange={(v) => set('soilTypes', v)} placeholder="ex. Ferrugineux" /></div>
        <div className="space-y-1">
          <Label>Fertilité générale</Label>
          <Select value={value.fertility} onValueChange={(v) => set('fertility', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FERTILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Drainage</Label>
          <Select value={value.drainage} onValueChange={(v) => set('drainage', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(DRAINAGE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Photos</p>
        <ImageGalleryUploader value={value.images} onChange={(v) => set('images', v)} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/app/zones/ZoneFields.tsx
git commit -m "feat(admin): composant partagé ZoneFields + helpers de payload zone"
```

---

### Task 6: Admin — câbler `ZoneFields` (création + édition) + badge climat

**Files:**
- Modify (rewrite): `apps/admin/src/app/zones/new/page.tsx`
- Modify: `apps/admin/src/app/zones/ZoneRowActions.tsx`
- Modify: `apps/admin/src/app/zones/page.tsx`

**Interfaces:**
- Consumes: `ZoneFields`, `ZoneFormValue`, `emptyZoneForm`, `zoneFormFromZone`, `zoneFormToPayload` (Task 5) ; `createZone`/`updateZone` (Task 4) ; `CLIMATE_TYPE_LABELS`, `labelOf`.

- [ ] **Step 1: `zones/new/page.tsx` — utiliser `ZoneFields`**

Replace the whole file with:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createZone } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoneFields, emptyZoneForm, zoneFormToPayload, type ZoneFormValue } from '../ZoneFields';

export default function NewZonePage() {
  const router = useRouter();
  const [form, setForm] = useState<ZoneFormValue>(emptyZoneForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await createZone(zoneFormToPayload(form));
      router.refresh();
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setBusy(false); }
  }

  return (
    <main className="p-8 max-w-lg">
      <Card>
        <CardHeader><CardTitle>Nouvelle zone</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <ZoneFields value={form} onChange={setForm} />
            <Button type="submit" disabled={busy}>Créer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: `ZoneRowActions.tsx` — utiliser `ZoneFields` en édition**

Replace the imports block + the edit `<Dialog>` content. Full new file:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateZone, deleteZone } from '@/lib/actions';
import { ZoneFields, zoneFormFromZone, zoneFormToPayload, type ZoneFormValue } from './ZoneFields';
import type { Zone } from '@/lib/api';

export function ZoneRowActions({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [form, setForm] = useState<ZoneFormValue>(zoneFormFromZone(zone));
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
          <ZoneFields value={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateZone(zone.id, zoneFormToPayload(form)), () => setEditOpen(false))}>Enregistrer</Button>
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
Note: the list page must pass the full `Zone` object to `ZoneRowActions` (it likely already passes a zone-shaped object; verify in Step 3 the `zone` prop carries the new fields — the read-model now returns them, so `listZones` provides them).

- [ ] **Step 3: `zones/page.tsx` — badge type de climat**

In `apps/admin/src/app/zones/page.tsx`:
- Import: add `CLIMATE_TYPE_LABELS` and `labelOf` from `@/lib/labels`, and `Badge` from `@/components/ui/badge`.
- Replace the `<TableHead>Köppen</TableHead>` header with `<TableHead>Climat</TableHead>`.
- Replace the corresponding cell (the one rendering `z.koppen`) with:
```tsx
                <TableCell>{z.climateType ? <Badge variant="secondary">{labelOf(CLIMATE_TYPE_LABELS, z.climateType)}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
```
- Confirm `<ZoneRowActions zone={z} />` passes the whole `z` (the list items are `Zone` from `listZones()`); if it currently spreads a subset, pass `z` directly.

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add "apps/admin/src/app/zones/new/page.tsx" "apps/admin/src/app/zones/ZoneRowActions.tsx" "apps/admin/src/app/zones/page.tsx"
git commit -m "feat(admin): formulaires zone enrichis (ZoneFields) + badge climat en liste"
```

- [ ] **Step 5: Vérification manuelle**

Démarrer admin + API. `/zones/new` : les sections Identification / Climat / Saisons / Sols / Photos s'affichent ; créer une zone en remplissant type de climat, altitude (min/max), pluviométrie, température moyenne, saisons, sols, fertilité, drainage → enregistrée. La liste montre le badge climat. « Modifier » ré-ouvre la zone pré-remplie (altitude/pluvio en min/max, saisons, sols…) ; modifier + enregistrer conserve les valeurs. Une zone existante (avant migration) s'ouvre sans erreur (champs vides).

---

## Notes de fin

- **Aucune relation** ici (cultures adaptées / bioagresseurs fréquents) → Brique 2.
- `altitude`/`annualRainfall` : saisies en min/max, `optimal` = milieu calculé (contrainte `RangeValue`).
- Le champ `notes` domaine reste interne (non exposé) ; « description » est distinct.
- Refactor du constructeur `AgroEcologicalZone` en objet de props (contenu au fichier domaine ; `create`/`update`/`fromSnapshot`/getters/`toSnapshot` inchangés côté signatures publiques).
