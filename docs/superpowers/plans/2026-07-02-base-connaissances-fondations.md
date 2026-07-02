# Base de connaissances — Plan 1 : Fondations + tranche verticale `Crop` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Établir les fondations techniques d'Okko et une tranche verticale complète permettant de créer, éditer, versionner et publier une fiche culture (identité + cycle), prouvant l'architecture de bout en bout.

**Architecture:** Monorepo avec backend NestJS (clean architecture : domain / application / infrastructure / presentation) et frontend Next.js admin. Domaine pur en TypeScript, testé en TDD. Persistance PostgreSQL via Prisma, confiné à la couche infrastructure derrière des interfaces repository. Read-model dénormalisé pour la sérialisation AI-ready.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, Jest, Next.js, TailwindCSS, shadcn/ui, lucide, Docker Compose, pnpm (monorepo workspaces).

## Global Constraints

- Langage : **TypeScript strict** (`"strict": true`) partout, backend et frontend.
- Méthodologie : **TDD** — test qui échoue avant toute implémentation, pour toute logique de domaine et d'application.
- **Clean architecture** : le domaine (`src/domain`) n'importe **jamais** Prisma, NestJS, ni aucune dépendance d'infrastructure. Dépendances pointant vers l'intérieur uniquement.
- Base de données : **PostgreSQL**, colonnes typées + `JSONB` pour les champs `metadata` et les textes i18n.
- Versionnement : statuts `DRAFT` / `PUBLISHED` / `ARCHIVED` ; table `AuditLog` pour chaque écriture.
- Provenance : toute valeur agronomique porte `{ source, sourceRef, capturedAt, validatedBy, confidence }`.
- i18n : textes traduisibles stockés en JSONB `{ locale: text }` ; locale par défaut `fr`.
- Pas d'event sourcing sur ce socle.
- Gestionnaire de paquets : **pnpm** avec workspaces.

---

## File Structure

```
okko/
├── docker-compose.yml                        # Postgres local
├── pnpm-workspace.yaml
├── package.json                              # racine (scripts)
├── apps/
│   ├── api/                                  # backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── domain/                       # PUR — pas de dépendance externe
│   │   │   │   ├── shared/
│   │   │   │   │   ├── range-value.ts
│   │   │   │   │   ├── translatable-text.ts
│   │   │   │   │   └── provenance.ts
│   │   │   │   └── crop/
│   │   │   │       ├── crop.ts               # agrégat racine
│   │   │   │       ├── crop-status.ts        # enum + transitions
│   │   │   │       └── cycle-type.ts         # enum
│   │   │   ├── application/
│   │   │   │   ├── crop/
│   │   │   │   │   ├── crop.repository.ts     # INTERFACE (port)
│   │   │   │   │   ├── create-crop.use-case.ts
│   │   │   │   │   ├── update-crop.use-case.ts
│   │   │   │   │   ├── publish-crop.use-case.ts
│   │   │   │   │   └── crop-read-model.ts      # projection fiche complète
│   │   │   │   └── audit/
│   │   │   │       └── audit-log.repository.ts # INTERFACE (port)
│   │   │   ├── infrastructure/
│   │   │   │   ├── prisma/prisma.service.ts
│   │   │   │   └── crop/prisma-crop.repository.ts
│   │   │   └── presentation/
│   │   │       └── crop/crop.controller.ts
│   │   └── test/
│   └── admin/                                # frontend Next.js
│       └── src/app/crops/...
```

---

### Task 1: Scaffolding du monorepo + Postgres + outillage de test

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `docker-compose.yml`, `.gitignore`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/jest.config.js`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/test/smoke.spec.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: un monorepo pnpm avec l'app `api` NestJS démarrable, Postgres via Docker, Jest configuré.

- [ ] **Step 1: Initialiser le workspace pnpm**

`pnpm-workspace.yaml` :
```yaml
packages:
  - "apps/*"
```

`package.json` (racine) :
```json
{
  "name": "okko",
  "private": true,
  "scripts": {
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 2: Déclarer Postgres**

`docker-compose.yml` :
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: okko
      POSTGRES_PASSWORD: okko
      POSTGRES_DB: okko
    ports:
      - "5432:5432"
    volumes:
      - okko_pgdata:/var/lib/postgresql/data
volumes:
  okko_pgdata:
```

`.gitignore` :
```
node_modules/
dist/
.env
apps/api/prisma/*.db
```

- [ ] **Step 3: Scaffolder l'app NestJS `api`**

`apps/api/package.json` :
```json
{
  "name": "@okko/api",
  "scripts": {
    "start:dev": "nest start --watch",
    "test": "jest",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "prisma": "^5.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.4.0"
  }
}
```

`apps/api/tsconfig.json` (extrait clé) :
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "strict": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "baseUrl": "./src"
  }
}
```

`apps/api/jest.config.js` :
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
};
```

`apps/api/src/app.module.ts` :
```ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

`apps/api/src/main.ts` :
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
}
bootstrap();
```

- [ ] **Step 4: Écrire un test de fumée**

`apps/api/test/smoke.spec.ts` :
```ts
describe('toolchain', () => {
  it('runs jest with ts-jest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Installer et vérifier**

Run: `pnpm install && pnpm --filter @okko/api test`
Expected: le test `toolchain` PASSE.

Run: `pnpm db:up && docker compose ps`
Expected: le service `db` est `running` (healthy).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo, NestJS api app, Postgres, jest"
```

---

### Task 2: Value object `RangeValue` (domaine pur, TDD)

**Files:**
- Create: `apps/api/src/domain/shared/range-value.ts`
- Test: `apps/api/src/domain/shared/range-value.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `class RangeValue` avec constructeur statique `RangeValue.create({ min, optimal, max, unit }): RangeValue`, getters `min/optimal/max/unit`, méthode `toJSON()`. Lève `RangeValueError` si `min ≤ optimal ≤ max` est violé.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/api/src/domain/shared/range-value.spec.ts` :
```ts
import { RangeValue, RangeValueError } from './range-value';

describe('RangeValue', () => {
  it('crée une plage valide et expose ses bornes', () => {
    const r = RangeValue.create({ min: 5, optimal: 6.5, max: 7.5, unit: 'pH' });
    expect(r.min).toBe(5);
    expect(r.optimal).toBe(6.5);
    expect(r.max).toBe(7.5);
    expect(r.unit).toBe('pH');
  });

  it('rejette min > optimal', () => {
    expect(() => RangeValue.create({ min: 7, optimal: 6, max: 8, unit: 'pH' }))
      .toThrow(RangeValueError);
  });

  it('rejette optimal > max', () => {
    expect(() => RangeValue.create({ min: 5, optimal: 9, max: 8, unit: 'pH' }))
      .toThrow(RangeValueError);
  });

  it('sérialise en objet plat', () => {
    const r = RangeValue.create({ min: 400, optimal: 800, max: 1200, unit: 'mm' });
    expect(r.toJSON()).toEqual({ min: 400, optimal: 800, max: 1200, unit: 'mm' });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test range-value`
Expected: FAIL — module `./range-value` introuvable.

- [ ] **Step 3: Implémenter le minimum**

`apps/api/src/domain/shared/range-value.ts` :
```ts
export class RangeValueError extends Error {}

interface RangeValueProps {
  min: number;
  optimal: number;
  max: number;
  unit: string;
}

export class RangeValue {
  private constructor(private readonly props: RangeValueProps) {}

  static create(props: RangeValueProps): RangeValue {
    if (!(props.min <= props.optimal && props.optimal <= props.max)) {
      throw new RangeValueError(
        `Invalid range: expected min <= optimal <= max, got ${props.min}/${props.optimal}/${props.max}`,
      );
    }
    return new RangeValue(props);
  }

  get min(): number { return this.props.min; }
  get optimal(): number { return this.props.optimal; }
  get max(): number { return this.props.max; }
  get unit(): string { return this.props.unit; }

  toJSON(): RangeValueProps {
    return { ...this.props };
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @okko/api test range-value`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/shared/range-value.ts apps/api/src/domain/shared/range-value.spec.ts
git commit -m "feat(domain): add RangeValue value object with min<=optimal<=max invariant"
```

---

### Task 3: Value objects `TranslatableText` et `Provenance` (domaine pur, TDD)

**Files:**
- Create: `apps/api/src/domain/shared/translatable-text.ts`, `apps/api/src/domain/shared/provenance.ts`
- Test: `apps/api/src/domain/shared/translatable-text.spec.ts`, `apps/api/src/domain/shared/provenance.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `class TranslatableText` : `TranslatableText.create(map: Record<string,string>, defaultLocale = 'fr')`, `get(locale)`, `getOrDefault(locale)`, `toJSON(): Record<string,string>`. Lève `TranslatableTextError` si la locale par défaut est absente.
  - `enum ProvenanceSource { MANUAL, EXTERNAL }` et `class Provenance` : `Provenance.manual(author: string)`, `Provenance.external({ sourceRef, capturedAt, confidence })`, getters, `toJSON()`.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/src/domain/shared/translatable-text.spec.ts` :
```ts
import { TranslatableText, TranslatableTextError } from './translatable-text';

describe('TranslatableText', () => {
  it('retourne la valeur d’une locale existante', () => {
    const t = TranslatableText.create({ fr: 'Carotte', en: 'Carrot' });
    expect(t.get('en')).toBe('Carrot');
  });

  it('retombe sur la locale par défaut si absente', () => {
    const t = TranslatableText.create({ fr: 'Carotte' });
    expect(t.getOrDefault('wo')).toBe('Carotte');
  });

  it('exige la présence de la locale par défaut', () => {
    expect(() => TranslatableText.create({ en: 'Carrot' }, 'fr'))
      .toThrow(TranslatableTextError);
  });
});
```

`apps/api/src/domain/shared/provenance.spec.ts` :
```ts
import { Provenance, ProvenanceSource } from './provenance';

describe('Provenance', () => {
  it('crée une provenance manuelle validée', () => {
    const p = Provenance.manual('expert:omer');
    expect(p.source).toBe(ProvenanceSource.MANUAL);
    expect(p.validatedBy).toBe('expert:omer');
  });

  it('crée une provenance externe avec référence', () => {
    const p = Provenance.external({
      sourceRef: 'https://isda-africa.com',
      capturedAt: '2026-07-02',
      confidence: 'medium',
    });
    expect(p.source).toBe(ProvenanceSource.EXTERNAL);
    expect(p.sourceRef).toBe('https://isda-africa.com');
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @okko/api test translatable-text provenance`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter le minimum**

`apps/api/src/domain/shared/translatable-text.ts` :
```ts
export class TranslatableTextError extends Error {}

export class TranslatableText {
  private constructor(
    private readonly map: Record<string, string>,
    private readonly defaultLocale: string,
  ) {}

  static create(map: Record<string, string>, defaultLocale = 'fr'): TranslatableText {
    if (!map[defaultLocale]) {
      throw new TranslatableTextError(`Missing default locale "${defaultLocale}"`);
    }
    return new TranslatableText({ ...map }, defaultLocale);
  }

  get(locale: string): string | undefined {
    return this.map[locale];
  }

  getOrDefault(locale: string): string {
    return this.map[locale] ?? this.map[this.defaultLocale];
  }

  toJSON(): Record<string, string> {
    return { ...this.map };
  }
}
```

`apps/api/src/domain/shared/provenance.ts` :
```ts
export enum ProvenanceSource {
  MANUAL = 'MANUAL',
  EXTERNAL = 'EXTERNAL',
}

type Confidence = 'low' | 'medium' | 'high';

interface ProvenanceProps {
  source: ProvenanceSource;
  sourceRef?: string;
  capturedAt: string;
  validatedBy?: string;
  confidence?: Confidence;
}

export class Provenance {
  private constructor(private readonly props: ProvenanceProps) {}

  static manual(author: string, capturedAt = new Date(0).toISOString()): Provenance {
    return new Provenance({
      source: ProvenanceSource.MANUAL,
      validatedBy: author,
      capturedAt,
      confidence: 'high',
    });
  }

  static external(props: { sourceRef: string; capturedAt: string; confidence?: Confidence }): Provenance {
    return new Provenance({ source: ProvenanceSource.EXTERNAL, ...props });
  }

  get source(): ProvenanceSource { return this.props.source; }
  get sourceRef(): string | undefined { return this.props.sourceRef; }
  get validatedBy(): string | undefined { return this.props.validatedBy; }

  toJSON(): ProvenanceProps { return { ...this.props }; }
}
```

> Note : `capturedAt` est une chaîne ISO fournie par l'appelant (jamais `Date.now()` dans le domaine, pour garder la pureté et la testabilité). Les use-cases injecteront l'horloge.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm --filter @okko/api test translatable-text provenance`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/shared/translatable-text.* apps/api/src/domain/shared/provenance.*
git commit -m "feat(domain): add TranslatableText and Provenance value objects"
```

---

### Task 4: Enums de domaine `CycleType` et `CropStatus` avec transitions (TDD)

**Files:**
- Create: `apps/api/src/domain/crop/cycle-type.ts`, `apps/api/src/domain/crop/crop-status.ts`
- Test: `apps/api/src/domain/crop/crop-status.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `enum CycleType { SEASONAL_ANNUAL, BIENNIAL, PERENNIAL_HERBACEOUS, PERENNIAL_WOODY_FRUIT, FORESTRY_WOOD }`.
  - `enum CropStatus { DRAFT, PUBLISHED, ARCHIVED }` + `function assertCanTransition(from: CropStatus, to: CropStatus): void` levant `CropStatusError` sur transition invalide. Transitions autorisées : `DRAFT→PUBLISHED`, `PUBLISHED→ARCHIVED`, `ARCHIVED→DRAFT`.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/api/src/domain/crop/crop-status.spec.ts` :
```ts
import { CropStatus, assertCanTransition, CropStatusError } from './crop-status';

describe('CropStatus transitions', () => {
  it('autorise DRAFT -> PUBLISHED', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.PUBLISHED)).not.toThrow();
  });

  it('autorise PUBLISHED -> ARCHIVED', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.ARCHIVED)).not.toThrow();
  });

  it('interdit DRAFT -> ARCHIVED', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.ARCHIVED)).toThrow(CropStatusError);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test crop-status`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le minimum**

`apps/api/src/domain/crop/cycle-type.ts` :
```ts
export enum CycleType {
  SEASONAL_ANNUAL = 'SEASONAL_ANNUAL',
  BIENNIAL = 'BIENNIAL',
  PERENNIAL_HERBACEOUS = 'PERENNIAL_HERBACEOUS',
  PERENNIAL_WOODY_FRUIT = 'PERENNIAL_WOODY_FRUIT',
  FORESTRY_WOOD = 'FORESTRY_WOOD',
}
```

`apps/api/src/domain/crop/crop-status.ts` :
```ts
export class CropStatusError extends Error {}

export enum CropStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

const ALLOWED: Record<CropStatus, CropStatus[]> = {
  [CropStatus.DRAFT]: [CropStatus.PUBLISHED],
  [CropStatus.PUBLISHED]: [CropStatus.ARCHIVED],
  [CropStatus.ARCHIVED]: [CropStatus.DRAFT],
};

export function assertCanTransition(from: CropStatus, to: CropStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new CropStatusError(`Illegal transition ${from} -> ${to}`);
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @okko/api test crop-status`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/cycle-type.ts apps/api/src/domain/crop/crop-status.*
git commit -m "feat(domain): add CycleType and CropStatus with transition rules"
```

---

### Task 5: Agrégat `Crop` (identité + cycle + versionnement) (TDD)

**Files:**
- Create: `apps/api/src/domain/crop/crop.ts`
- Test: `apps/api/src/domain/crop/crop.spec.ts`

**Interfaces:**
- Consumes: `TranslatableText`, `CycleType`, `CropStatus`, `assertCanTransition`.
- Produces: `class Crop` avec :
  - `Crop.create({ id, commonNames: TranslatableText, scientificName: string, family: string, cycleType: CycleType }): Crop` — statut initial `DRAFT`, `version = 1`.
  - getters `id`, `commonNames`, `scientificName`, `family`, `cycleType`, `status`, `version`, `metadata`.
  - `rename(commonNames: TranslatableText): void` et `setMetadata(key, value): void` (incrémentent `version`).
  - `publish(): void` et `archive(): void` (délèguent à `assertCanTransition`).
  - `toSnapshot(): CropSnapshot` (objet plat pour la persistance) et `Crop.fromSnapshot(s: CropSnapshot): Crop`.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/api/src/domain/crop/crop.spec.ts` :
```ts
import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus } from './crop-status';
import { CropStatusError } from './crop-status';

const base = () => Crop.create({
  id: 'crop-1',
  commonNames: TranslatableText.create({ fr: 'Carotte', en: 'Carrot' }),
  scientificName: 'Daucus carota',
  family: 'Apiaceae',
  cycleType: CycleType.SEASONAL_ANNUAL,
});

describe('Crop', () => {
  it('naît en DRAFT version 1', () => {
    const c = base();
    expect(c.status).toBe(CropStatus.DRAFT);
    expect(c.version).toBe(1);
    expect(c.commonNames.getOrDefault('fr')).toBe('Carotte');
  });

  it('se publie depuis DRAFT', () => {
    const c = base();
    c.publish();
    expect(c.status).toBe(CropStatus.PUBLISHED);
  });

  it('refuse d’archiver un DRAFT', () => {
    const c = base();
    expect(() => c.archive()).toThrow(CropStatusError);
  });

  it('incrémente la version au renommage', () => {
    const c = base();
    c.rename(TranslatableText.create({ fr: 'Carotte potagère' }));
    expect(c.version).toBe(2);
  });

  it('stocke des spécificités dans metadata sans schéma', () => {
    const c = base();
    c.setMetadata('rusticite', 'élevée');
    expect(c.metadata.rusticite).toBe('élevée');
  });

  it('fait un aller-retour snapshot sans perte', () => {
    const c = base();
    c.publish();
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.status).toBe(CropStatus.PUBLISHED);
    expect(restored.scientificName).toBe('Daucus carota');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: FAIL — module `./crop` introuvable.

- [ ] **Step 3: Implémenter le minimum**

`apps/api/src/domain/crop/crop.ts` :
```ts
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, assertCanTransition } from './crop-status';

export interface CropSnapshot {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  status: CropStatus;
  version: number;
  metadata: Record<string, unknown>;
}

interface CreateCropProps {
  id: string;
  commonNames: TranslatableText;
  scientificName: string;
  family: string;
  cycleType: CycleType;
}

export class Crop {
  private constructor(
    private readonly _id: string,
    private _commonNames: TranslatableText,
    private readonly _scientificName: string,
    private readonly _family: string,
    private readonly _cycleType: CycleType,
    private _status: CropStatus,
    private _version: number,
    private _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateCropProps): Crop {
    return new Crop(
      props.id, props.commonNames, props.scientificName, props.family,
      props.cycleType, CropStatus.DRAFT, 1, {},
    );
  }

  get id(): string { return this._id; }
  get commonNames(): TranslatableText { return this._commonNames; }
  get scientificName(): string { return this._scientificName; }
  get family(): string { return this._family; }
  get cycleType(): CycleType { return this._cycleType; }
  get status(): CropStatus { return this._status; }
  get version(): number { return this._version; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  rename(commonNames: TranslatableText): void {
    this._commonNames = commonNames;
    this._version += 1;
  }

  setMetadata(key: string, value: unknown): void {
    this._metadata = { ...this._metadata, [key]: value };
    this._version += 1;
  }

  publish(): void {
    assertCanTransition(this._status, CropStatus.PUBLISHED);
    this._status = CropStatus.PUBLISHED;
  }

  archive(): void {
    assertCanTransition(this._status, CropStatus.ARCHIVED);
    this._status = CropStatus.ARCHIVED;
  }

  toSnapshot(): CropSnapshot {
    return {
      id: this._id,
      commonNames: this._commonNames.toJSON(),
      scientificName: this._scientificName,
      family: this._family,
      cycleType: this._cycleType,
      status: this._status,
      version: this._version,
      metadata: { ...this._metadata },
    };
  }

  static fromSnapshot(s: CropSnapshot): Crop {
    return new Crop(
      s.id, TranslatableText.create(s.commonNames), s.scientificName, s.family,
      s.cycleType, s.status, s.version, { ...s.metadata },
    );
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @okko/api test crop.spec`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/crop/crop.ts apps/api/src/domain/crop/crop.spec.ts
git commit -m "feat(domain): add Crop aggregate with identity, cycle, versioning, metadata"
```

---

### Task 6: Interfaces de repository + schéma Prisma + migration

**Files:**
- Create: `apps/api/src/application/crop/crop.repository.ts`, `apps/api/src/application/audit/audit-log.repository.ts`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/infrastructure/prisma/prisma.service.ts`
- Create: `apps/api/.env`

**Interfaces:**
- Consumes: `CropSnapshot`.
- Produces:
  - `interface CropRepository { save(snapshot: CropSnapshot): Promise<void>; findById(id: string): Promise<CropSnapshot | null>; list(): Promise<CropSnapshot[]>; }` + token d'injection `CROP_REPOSITORY`.
  - `interface AuditLogRepository { record(entry: AuditEntry): Promise<void>; }` avec `interface AuditEntry { entityType: string; entityId: string; actor: string; at: string; changes: Record<string, unknown>; }` + token `AUDIT_LOG_REPOSITORY`.
  - `class PrismaService` (connexion Prisma, cycle de vie NestJS).

- [ ] **Step 1: Définir les ports (interfaces application)**

`apps/api/src/application/crop/crop.repository.ts` :
```ts
import { CropSnapshot } from '../../domain/crop/crop';

export const CROP_REPOSITORY = Symbol('CROP_REPOSITORY');

export interface CropRepository {
  save(snapshot: CropSnapshot): Promise<void>;
  findById(id: string): Promise<CropSnapshot | null>;
  list(): Promise<CropSnapshot[]>;
}
```

`apps/api/src/application/audit/audit-log.repository.ts` :
```ts
export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditEntry {
  entityType: string;
  entityId: string;
  actor: string;
  at: string;
  changes: Record<string, unknown>;
}

export interface AuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
}
```

- [ ] **Step 2: Définir le schéma Prisma**

`apps/api/prisma/schema.prisma` :
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Crop {
  id             String   @id
  commonNames    Json
  scientificName String
  family         String
  cycleType      String
  status         String
  version        Int
  metadata       Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(uuid())
  entityType String
  entityId   String
  actor      String
  at         DateTime
  changes    Json
}
```

`apps/api/.env` :
```
DATABASE_URL="postgresql://okko:okko@localhost:5432/okko?schema=public"
```

- [ ] **Step 3: Générer la migration**

Run: `pnpm db:up && pnpm --filter @okko/api prisma:migrate -- --name init_crop`
Expected: migration `init_crop` créée, tables `Crop` et `AuditLog` créées, client Prisma généré.

- [ ] **Step 4: Écrire le service Prisma**

`apps/api/src/infrastructure/prisma/prisma.service.ts` :
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application apps/api/prisma apps/api/src/infrastructure/prisma
git commit -m "feat(infra): add repository ports, Prisma schema, init migration, PrismaService"
```

---

### Task 7: Implémentation Prisma des repositories (test d'intégration)

**Files:**
- Create: `apps/api/src/infrastructure/crop/prisma-crop.repository.ts`, `apps/api/src/infrastructure/audit/prisma-audit-log.repository.ts`
- Test: `apps/api/test/prisma-crop.repository.int-spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `AuditLogRepository`, `PrismaService`, `CropSnapshot`.
- Produces: `class PrismaCropRepository implements CropRepository`, `class PrismaAuditLogRepository implements AuditLogRepository`.

- [ ] **Step 1: Écrire le test d'intégration qui échoue**

`apps/api/test/prisma-crop.repository.int-spec.ts` :
```ts
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCropRepository } from '../src/infrastructure/crop/prisma-crop.repository';
import { CropStatus } from '../src/domain/crop/crop-status';
import { CycleType } from '../src/domain/crop/cycle-type';

describe('PrismaCropRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCropRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.crop.deleteMany(); await prisma.$disconnect(); });

  it('sauvegarde puis relit un snapshot', async () => {
    await repo.save({
      id: 'itest-1',
      commonNames: { fr: 'Coton' },
      scientificName: 'Gossypium',
      family: 'Malvaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      status: CropStatus.DRAFT,
      version: 1,
      metadata: {},
    });
    const found = await repo.findById('itest-1');
    expect(found?.scientificName).toBe('Gossypium');
    expect(found?.commonNames.fr).toBe('Coton');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test prisma-crop.repository`
Expected: FAIL — `PrismaCropRepository` introuvable.

- [ ] **Step 3: Implémenter les repositories**

`apps/api/src/infrastructure/crop/prisma-crop.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CropRepository } from '../../application/crop/crop.repository';
import { CropSnapshot, Crop } from '../../domain/crop/crop';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

@Injectable()
export class PrismaCropRepository implements CropRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(s: CropSnapshot): Promise<void> {
    await this.prisma.crop.upsert({
      where: { id: s.id },
      create: { ...s, commonNames: s.commonNames, metadata: s.metadata },
      update: { ...s, commonNames: s.commonNames, metadata: s.metadata },
    });
  }

  async findById(id: string): Promise<CropSnapshot | null> {
    const row = await this.prisma.crop.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<CropSnapshot[]> {
    const rows = await this.prisma.crop.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toSnapshot(row: any): CropSnapshot {
    return {
      id: row.id,
      commonNames: row.commonNames as Record<string, string>,
      scientificName: row.scientificName,
      family: row.family,
      cycleType: row.cycleType as CycleType,
      status: row.status as CropStatus,
      version: row.version,
      metadata: row.metadata as Record<string, unknown>,
    };
  }
}
```

`apps/api/src/infrastructure/audit/prisma-audit-log.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry, AuditLogRepository } from '../../application/audit/audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        actor: entry.actor,
        at: new Date(entry.at),
        changes: entry.changes,
      },
    });
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm db:up && pnpm --filter @okko/api test prisma-crop.repository`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/crop apps/api/src/infrastructure/audit apps/api/test/prisma-crop.repository.int-spec.ts
git commit -m "feat(infra): implement Prisma crop and audit-log repositories"
```

---

### Task 8: Use-cases `CreateCrop`, `UpdateCrop`, `PublishCrop` avec audit (TDD, repository en mémoire)

**Files:**
- Create: `apps/api/src/application/crop/create-crop.use-case.ts`, `update-crop.use-case.ts`, `publish-crop.use-case.ts`
- Create: `apps/api/src/application/shared/clock.ts` (port horloge)
- Test: `apps/api/src/application/crop/create-crop.use-case.spec.ts`, `publish-crop.use-case.spec.ts`

**Interfaces:**
- Consumes: `CropRepository`, `AuditLogRepository`, `Crop`, `CropSnapshot`.
- Produces:
  - `interface Clock { nowIso(): string }` + token `CLOCK`.
  - `class CreateCropUseCase` : `execute(input: { id; commonNames: Record<string,string>; scientificName; family; cycleType: CycleType; actor: string }): Promise<CropSnapshot>`.
  - `class PublishCropUseCase` : `execute(input: { id: string; actor: string }): Promise<CropSnapshot>` (charge, publie, sauve, audit ; lève `CropNotFoundError` si absent).
  - `class UpdateCropUseCase` : `execute(input: { id; commonNames?: Record<string,string>; metadata?: Record<string,unknown>; actor: string }): Promise<CropSnapshot>`.

- [ ] **Step 1: Écrire le port horloge et un repository en mémoire pour les tests**

`apps/api/src/application/shared/clock.ts` :
```ts
export const CLOCK = Symbol('CLOCK');
export interface Clock { nowIso(): string; }
```

`apps/api/src/application/crop/in-memory-crop.repository.ts` (utilitaire de test, mais dans src pour réutilisation) :
```ts
import { CropRepository } from './crop.repository';
import { CropSnapshot } from '../../domain/crop/crop';

export class InMemoryCropRepository implements CropRepository {
  private store = new Map<string, CropSnapshot>();
  async save(s: CropSnapshot): Promise<void> { this.store.set(s.id, s); }
  async findById(id: string): Promise<CropSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<CropSnapshot[]> { return [...this.store.values()]; }
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`apps/api/src/application/crop/create-crop.use-case.spec.ts` :
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';

const fixedClock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('CreateCropUseCase', () => {
  it('crée une culture DRAFT et l’enregistre', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const uc = new CreateCropUseCase(repo, audit, fixedClock);

    const out = await uc.execute({
      id: 'c1', commonNames: { fr: 'Carotte' }, scientificName: 'Daucus carota',
      family: 'Apiaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'expert:omer',
    });

    expect(out.status).toBe(CropStatus.DRAFT);
    expect(await repo.findById('c1')).not.toBeNull();
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});
```

`apps/api/src/application/crop/publish-crop.use-case.spec.ts` :
```ts
import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('PublishCropUseCase', () => {
  it('publie une culture existante', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(repo, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Carotte' }, scientificName: 'Daucus carota',
      family: 'Apiaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const out = await new PublishCropUseCase(repo, audit, clock).execute({ id: 'c1', actor: 'a' });
    expect(out.status).toBe(CropStatus.PUBLISHED);
  });

  it('lève CropNotFoundError si absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new PublishCropUseCase(repo, audit, clock).execute({ id: 'x', actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @okko/api test create-crop publish-crop`
Expected: FAIL — use-cases introuvables.

- [ ] **Step 4: Implémenter les use-cases**

`apps/api/src/application/crop/create-crop.use-case.ts` :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface CreateCropInput {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  actor: string;
}

export class CreateCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateCropInput): Promise<CropSnapshot> {
    const crop = Crop.create({
      id: input.id,
      commonNames: TranslatableText.create(input.commonNames),
      scientificName: input.scientificName,
      family: input.family,
      cycleType: input.cycleType,
    });
    const snapshot = crop.toSnapshot();
    await this.crops.save(snapshot);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snapshot },
    });
    return snapshot;
  }
}
```

`apps/api/src/application/crop/publish-crop.use-case.ts` :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class CropNotFoundError extends Error {}

export class PublishCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    crop.publish();
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { status: 'PUBLISHED' },
    });
    return next;
  }
}
```

`apps/api/src/application/crop/update-crop.use-case.ts` :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface UpdateCropInput {
  id: string;
  commonNames?: Record<string, string>;
  metadata?: Record<string, unknown>;
  actor: string;
}

export class UpdateCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCropInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    if (input.commonNames) crop.rename(TranslatableText.create(input.commonNames));
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) crop.setMetadata(k, v);
    }
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: input },
    });
    return next;
  }
}
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm --filter @okko/api test create-crop publish-crop`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/crop apps/api/src/application/shared/clock.ts
git commit -m "feat(application): add create/update/publish crop use-cases with audit and clock port"
```

---

### Task 9: Read-model « fiche complète » sérialisable AI-ready (TDD)

**Files:**
- Create: `apps/api/src/application/crop/crop-read-model.ts`
- Test: `apps/api/src/application/crop/crop-read-model.spec.ts`

**Interfaces:**
- Consumes: `CropSnapshot`.
- Produces: `function toCropDocument(snapshot: CropSnapshot, locale = 'fr'): CropDocument` où `CropDocument` est un objet plat, lisible, avec labels résolus dans la locale + champ `serializedText` (markdown prêt pour un LLM). C'est l'unité que consommeront l'API et le futur RAG.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/api/src/application/crop/crop-read-model.spec.ts` :
```ts
import { toCropDocument } from './crop-read-model';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

const snap = {
  id: 'c1', commonNames: { fr: 'Carotte', en: 'Carrot' },
  scientificName: 'Daucus carota', family: 'Apiaceae',
  cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED,
  version: 3, metadata: { rusticite: 'élevée' },
};

describe('toCropDocument', () => {
  it('résout le nom dans la locale demandée', () => {
    const doc = toCropDocument(snap, 'en');
    expect(doc.name).toBe('Carrot');
  });

  it('retombe sur fr si la locale manque', () => {
    const doc = toCropDocument(snap, 'wo');
    expect(doc.name).toBe('Carotte');
  });

  it('produit un texte markdown sérialisé pour un LLM', () => {
    const doc = toCropDocument(snap, 'fr');
    expect(doc.serializedText).toContain('Carotte');
    expect(doc.serializedText).toContain('Daucus carota');
    expect(doc.serializedText).toContain('SEASONAL_ANNUAL');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le read-model**

`apps/api/src/application/crop/crop-read-model.ts` :
```ts
import { CropSnapshot } from '../../domain/crop/crop';

export interface CropDocument {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  cycleType: string;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toCropDocument(s: CropSnapshot, locale = 'fr'): CropDocument {
  const name = s.commonNames[locale] ?? s.commonNames['fr'];
  const serializedText = [
    `# ${name} (${s.scientificName})`,
    `Famille : ${s.family}`,
    `Type de cycle : ${s.cycleType}`,
    `Statut : ${s.status} (version ${s.version})`,
  ].join('\n');
  return {
    id: s.id, name, scientificName: s.scientificName, family: s.family,
    cycleType: s.cycleType, status: s.status, version: s.version,
    metadata: s.metadata, serializedText,
  };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @okko/api test crop-read-model`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/crop/crop-read-model.*
git commit -m "feat(application): add AI-ready crop read-model (document projection)"
```

---

### Task 10: Module NestJS + contrôleur REST (test e2e)

**Files:**
- Create: `apps/api/src/presentation/crop/crop.controller.ts`, `apps/api/src/crop.module.ts`, `apps/api/src/infrastructure/system-clock.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/crop.e2e-spec.ts`

**Interfaces:**
- Consumes: use-cases, read-model, tokens `CROP_REPOSITORY`/`AUDIT_LOG_REPOSITORY`/`CLOCK`.
- Produces: endpoints REST `POST /crops`, `GET /crops`, `GET /crops/:id`, `PATCH /crops/:id`, `POST /crops/:id/publish`.

- [ ] **Step 1: Écrire le test e2e qui échoue**

`apps/api/test/crop.e2e-spec.ts` :
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Crop e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => { await prisma.crop.deleteMany(); await app.close(); });

  it('crée puis publie une culture', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Ananas' }, scientificName: 'Ananas comosus',
              family: 'Bromeliaceae', cycleType: 'PERENNIAL_HERBACEOUS' })
      .expect(201);
    const id = created.body.id;

    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const got = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(got.body.status).toBe('PUBLISHED');
    expect(got.body.name).toBe('Ananas');
  });
});
```

Ajouter `supertest` et `@types/supertest` en devDependencies (`pnpm --filter @okko/api add -D supertest @types/supertest`).

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @okko/api test crop.e2e`
Expected: FAIL — routes inexistantes / module non câblé.

- [ ] **Step 3: Implémenter l'horloge système, le contrôleur et le module**

`apps/api/src/infrastructure/system-clock.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { Clock } from '../application/shared/clock';

@Injectable()
export class SystemClock implements Clock {
  nowIso(): string { return new Date().toISOString(); }
}
```

`apps/api/src/presentation/crop/crop.controller.ts` :
```ts
import { Body, Controller, Get, Param, Patch, Post, NotFoundException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateCropUseCase } from '../../application/crop/create-crop.use-case';
import { UpdateCropUseCase } from '../../application/crop/update-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from '../../application/crop/publish-crop.use-case';
import { CROP_REPOSITORY, CropRepository } from '../../application/crop/crop.repository';
import { toCropDocument } from '../../application/crop/crop-read-model';
import { CycleType } from '../../domain/crop/cycle-type';

const ACTOR = 'admin'; // v1 : rôle unique, auth simple à ajouter plus tard

@Controller('crops')
export class CropController {
  constructor(
    private readonly createCrop: CreateCropUseCase,
    private readonly updateCrop: UpdateCropUseCase,
    private readonly publishCrop: PublishCropUseCase,
    @Inject(CROP_REPOSITORY) private readonly crops: CropRepository,
  ) {}

  @Post()
  async create(@Body() body: { commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType }) {
    const snap = await this.createCrop.execute({ id: randomUUID(), actor: ACTOR, ...body });
    return toCropDocument(snap);
  }

  @Get()
  async list() {
    return (await this.crops.list()).map((s) => toCropDocument(s));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toCropDocument(snap);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { commonNames?: Record<string, string>; metadata?: Record<string, unknown> }) {
    try {
      const snap = await this.updateCrop.execute({ id, actor: ACTOR, ...body });
      return toCropDocument(snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    try {
      const snap = await this.publishCrop.execute({ id, actor: ACTOR });
      return toCropDocument(snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
}
```

`apps/api/src/crop.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { PrismaCropRepository } from './infrastructure/crop/prisma-crop.repository';
import { PrismaAuditLogRepository } from './infrastructure/audit/prisma-audit-log.repository';
import { CROP_REPOSITORY } from './application/crop/crop.repository';
import { AUDIT_LOG_REPOSITORY } from './application/audit/audit-log.repository';
import { CLOCK } from './application/shared/clock';
import { CreateCropUseCase } from './application/crop/create-crop.use-case';
import { UpdateCropUseCase } from './application/crop/update-crop.use-case';
import { PublishCropUseCase } from './application/crop/publish-crop.use-case';
import { CropController } from './presentation/crop/crop.controller';

@Module({
  controllers: [CropController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: CROP_REPOSITORY, useClass: PrismaCropRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    {
      provide: CreateCropUseCase,
      useFactory: (r, a, c) => new CreateCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateCropUseCase,
      useFactory: (r, a, c) => new UpdateCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: PublishCropUseCase,
      useFactory: (r, a, c) => new PublishCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
  ],
})
export class CropModule {}
```

`apps/api/src/app.module.ts` (modifier) :
```ts
import { Module } from '@nestjs/common';
import { CropModule } from './crop.module';

@Module({ imports: [CropModule] })
export class AppModule {}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm db:up && pnpm --filter @okko/api test crop.e2e`
Expected: PASS — création puis publication OK.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/presentation apps/api/src/crop.module.ts apps/api/src/app.module.ts apps/api/src/infrastructure/system-clock.ts apps/api/test/crop.e2e-spec.ts
git commit -m "feat(api): wire CropModule with REST controller and e2e test"
```

---

### Task 11: Frontend admin Next.js — liste + création + publication d'une fiche

**Files:**
- Create: `apps/admin/package.json`, `apps/admin/next.config.js`, `apps/admin/tailwind.config.ts`, `apps/admin/src/app/layout.tsx`, `apps/admin/src/app/crops/page.tsx`, `apps/admin/src/app/crops/new/page.tsx`, `apps/admin/src/lib/api.ts`

**Interfaces:**
- Consumes: l'API REST `/crops` de la Task 10.
- Produces: une UI admin minimale (liste des fiches + formulaire de création identité/cycle + bouton publier).

- [ ] **Step 1: Scaffolder l'app Next.js**

`apps/admin/package.json` :
```json
{
  "name": "@okko/admin",
  "scripts": { "dev": "next dev -p 3000", "build": "next build", "start": "next start" },
  "dependencies": {
    "next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0", "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0", "tailwindcss": "^3.4.0", "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0", "typescript": "^5.4.0"
  }
}
```

Configurer Tailwind (`tailwind.config.ts` scannant `./src/**/*.{ts,tsx}`) et initialiser shadcn/ui (`npx shadcn@latest init`) — bouton et input de base.

- [ ] **Step 2: Client API**

`apps/admin/src/lib/api.ts` :
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
}

export async function listCrops(): Promise<CropDocument[]> {
  const res = await fetch(`${BASE}/crops`, { cache: 'no-store' });
  return res.json();
}

export async function createCrop(input: {
  commonNames: Record<string, string>; scientificName: string; family: string; cycleType: string;
}): Promise<CropDocument> {
  const res = await fetch(`${BASE}/crops`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return res.json();
}

export async function publishCrop(id: string): Promise<void> {
  await fetch(`${BASE}/crops/${id}/publish`, { method: 'POST' });
}
```

- [ ] **Step 3: Page liste**

`apps/admin/src/app/crops/page.tsx` :
```tsx
import Link from 'next/link';
import { listCrops, publishCrop } from '../../lib/api';

export default async function CropsPage() {
  const crops = await listCrops();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <Link href="/crops/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouvelle culture</Link>
      </div>
      <ul className="divide-y">
        {crops.map((c) => (
          <li key={c.id} className="py-3 flex justify-between">
            <span>{c.name} — <em>{c.scientificName}</em> · {c.cycleType}</span>
            <span className="text-sm">{c.status} (v{c.version})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Page création**

`apps/admin/src/app/crops/new/page.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCrop } from '../../../lib/api';

const CYCLE_TYPES = ['SEASONAL_ANNUAL', 'BIENNIAL', 'PERENNIAL_HERBACEOUS', 'PERENNIAL_WOODY_FRUIT', 'FORESTRY_WOOD'];

export default function NewCropPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [scientificName, setSci] = useState('');
  const [family, setFamily] = useState('');
  const [cycleType, setCycle] = useState(CYCLE_TYPES[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await createCrop({ commonNames: { fr }, scientificName, family, cycleType });
    router.push('/crops');
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouvelle culture</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Nom scientifique" value={scientificName} onChange={(e) => setSci(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Famille" value={family} onChange={(e) => setFamily(e.target.value)} required />
        <select className="w-full border p-2" value={cycleType} onChange={(e) => setCycle(e.target.value)}>
          {CYCLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
```

`apps/admin/src/app/layout.tsx` :
```tsx
import './globals.css';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
```

- [ ] **Step 5: Vérification manuelle end-to-end**

Run (3 terminaux) : `pnpm db:up` · `pnpm --filter @okko/api start:dev` · `pnpm --filter @okko/admin dev`
Ouvrir `http://localhost:3000/crops`, créer une culture, vérifier qu'elle apparaît dans la liste avec statut `DRAFT`.
Expected: la fiche est créée et listée.

- [ ] **Step 6: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): Next.js crop list and creation form"
```

---

## Self-Review

**1. Couverture du spec (Plan 1) :**
- Stack (Postgres/NestJS/Prisma/Next/Tailwind/shadcn/lucide) → Tasks 1, 6, 11. ✅
- Clean architecture (4 couches, domaine pur) → structure de fichiers + Tasks 2-10. ✅
- Value object `RangeValue` → Task 2. ✅ ; `TranslatableText`, `Provenance` → Task 3. ✅
- `cycleType` + principe « annuel = 1 phase » → Task 4/5 (enum + agrégat ; les `LifecyclePhase`/`CroppingWindow` complets sont des plans ultérieurs, voir ci-dessous). ✅ (partiel, voir note)
- Versionnement (statuts + version) + audit → Tasks 4, 5, 6, 8. ✅
- Provenance (value object + prêt à l'emploi) → Task 3 ; câblage complet par catégorie → plans ultérieurs. ✅ (fondation)
- AI-readiness (read-model sérialisable) → Task 9. ✅
- i18n JSONB → Task 3, 5, 9. ✅
- `metadata` JSONB sans migration → Task 5 (test dédié). ✅
- Admin CRUD minimal → Tasks 10, 11. ✅

**2. Scan placeholders :** aucun TBD/TODO ; chaque étape de code contient le code réel ; commandes et sorties attendues fournies. ✅

**3. Cohérence des types :** `CropSnapshot` identique partout ; `CropRepository`/`AuditLogRepository`/`Clock` cohérents entre ports, use-cases, implémentations et module ; `toCropDocument` signature stable ; `CropNotFoundError` défini dans `publish-crop.use-case.ts` et réutilisé par `update-crop`. ✅

**Note de périmètre (assumée) :** ce Plan 1 livre la tranche verticale prouvant l'architecture (identité + cycle + versionnement + provenance + read-model + admin). Les catégories agronomiques restantes — variétés, exigences climatiques/édaphiques, zones agro-écologiques (catalogue partagé), fenêtres de production, phénologie & itinéraire, nutrition, phytosanitaire (catalogue partagé), rendement, prix — suivent **exactement le même patron** (domaine TDD → port → Prisma → use-case → contrôleur → UI) et feront l'objet des **Plans 2 à N**, chacun livrable et testable seul.

---

## Prochains plans (aperçu, à détailler ensuite)
- **Plan 2** — Variétés + exigences climatiques/édaphiques (`RangeValue` en action, provenance par valeur).
- **Plan 3** — Catalogue `AgroEcologicalZone` + relation d'adéquation culture ↔ zone.
- **Plan 4** — Fenêtres de production (Zone × saison) + phénologie + itinéraire technique.
- **Plan 5** — Catalogue `PestDisease` partagé + liaison culture-spécifique.
- **Plan 6** — Nutrition, rendement, prix + enrichissement du read-model.
- **Plan 7** — Historique/audit consultable dans l'admin + indicateur de complétude.
