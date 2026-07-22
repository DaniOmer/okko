# Ravageurs — Brique 1 (Fondation Pest + fiche) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer l'entité `PestDisease` → `Pest`, la recadrer sur les ravageurs animaux, l'enrichir (famille, description, updatedAt, photos catégorisées), et bâtir une fiche de consultation `/pests/[id]`.

**Architecture:** Entité CRUD (pas d'event-sourcing). Domaine immuable (value object + snapshot). Persistance Prisma/Postgres. Admin Next.js (server components + actions). La fiche réutilise le kit fiche des cultures (`Section`, `PhotoCarousel`).

**Tech Stack:** NestJS, Prisma 5, Postgres, jest (unit), Next.js 14 (app router), Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer la suite de tests complète** (`jest` sans filtre) ni les e2e (`apps/api/test/*.e2e-spec.ts`) : ils touchent et **effacent la base de dev** (pas de `.env.test`). Ne lancer que des specs unitaires ciblées par chemin : `pnpm --filter @okko/api exec jest <chemin-du-spec>`.
- **Migrations Prisma** : additives/renommage uniquement. Toujours générer en `--create-only`, **inspecter le SQL**, puis appliquer. Un renommage de modèle Prisma génère par défaut DROP+CREATE → le corriger en `ALTER TABLE ... RENAME` pour préserver la ligne existante (1 ravageur, 1 lien en base).
- **macOS** : `sed -i ''` (chaîne vide obligatoire après `-i`).
- **UI en français**, composants shadcn `Select` pour tout enum (pas de `<select>` natif), `Calendar` pour les dates.
- **Fichiers focalisés** : la fiche va dans son propre composant `PestFicheView.tsx`, pas dans la page.
- **Commit après chaque tâche.** Typecheck (`npx tsc --noEmit`) vert avant chaque commit.
- Après toute modif de `schema.prisma` : `pnpm --filter @okko/api exec prisma generate`.
- Redémarrer l'API si le `nest --watch` se découple (rien qui écoute sur :3001).

---

### Task 1: Renommer `PestDisease` → `Pest` (code + table)

Renommage mécanique, sans changement de comportement. Le front utilise déjà l'interface `Pest` ; ce renommage aligne le backend.

**Files:**
- Rename (git mv): `apps/api/src/domain/pest/pest-disease.ts` → `pest.ts` ; `pest-disease.spec.ts` → `pest.spec.ts` ; `pest-disease.update.spec.ts` → `pest.update.spec.ts`
- Modify (sed): les 13 autres fichiers contenant `PestDisease` sous `apps/api/src` + `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_rename_pest_table/migration.sql`

**Interfaces:**
- Produces: classe `Pest` (ex-`PestDisease`), type `PestSnapshot` (ex-`PestDiseaseSnapshot`), accès Prisma `prisma.pest`, type Prisma `Pest`. Tous les fichiers pest importent depuis `../../domain/pest/pest`.

- [ ] **Step 1: Renommer les fichiers de domaine**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
git mv apps/api/src/domain/pest/pest-disease.ts apps/api/src/domain/pest/pest.ts
git mv apps/api/src/domain/pest/pest-disease.spec.ts apps/api/src/domain/pest/pest.spec.ts
git mv apps/api/src/domain/pest/pest-disease.update.spec.ts apps/api/src/domain/pest/pest.update.spec.ts
```

- [ ] **Step 2: Remplacer les identifiants dans le code**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
# PestDiseaseSnapshot -> PestSnapshot ; PestDisease -> Pest ; import path pest-disease -> pest
FILES=$(git grep -l 'PestDisease' -- apps/api/src apps/api/prisma/schema.prisma)
echo "$FILES" | xargs sed -i '' 's/PestDiseaseSnapshot/PestSnapshot/g; s/PestDisease/Pest/g'
git grep -l "pest-disease" -- apps/api/src | xargs sed -i '' "s#pest-disease#pest#g"
# accès client Prisma en camelCase : this.prisma.pestDisease -> this.prisma.pest
git grep -l 'prisma.pestDisease' -- apps/api/src | xargs sed -i '' 's/prisma\.pestDisease/prisma.pest/g'
```

- [ ] **Step 3: Renommer le modèle Prisma**

Dans `apps/api/prisma/schema.prisma`, le sed a déjà transformé `model PestDisease {` → `model Pest {`. Vérifier :

```bash
grep -n "model Pest" apps/api/prisma/schema.prisma
```
Expected: `model Pest {`

- [ ] **Step 4: Générer la migration en create-only et la corriger en RENAME**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api
pnpm --filter @okko/api exec prisma migrate dev --create-only --name rename_pest_table
```
Ouvrir le `migration.sql` généré. S'il contient `DROP TABLE "PestDisease"` / `CREATE TABLE "Pest"`, **remplacer tout le contenu** par :

```sql
ALTER TABLE "PestDisease" RENAME TO "Pest";
```

- [ ] **Step 5: Appliquer la migration + regénérer le client**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api
pnpm --filter @okko/api exec prisma migrate dev
```
Expected: migration appliquée, `Prisma Client` regénéré, aucune perte de données (la ligne existante est préservée).

- [ ] **Step 6: Vérifier la ligne préservée**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api
DBURL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//; s/?.*$//')
psql "$DBURL" -At -c 'SELECT count(*) FROM "Pest";'
```
Expected: `1`

- [ ] **Step 7: Typecheck + specs unitaires pest**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/domain/pest src/application/pest
```
Expected: 0 erreur TS ; specs pest au vert.

- [ ] **Step 8: Commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
git add -A apps/api
git commit -m "refactor(pest): renomme PestDisease -> Pest (code + table)"
```

---

### Task 2: Catégorie animale (enum + libellés)

**Files:**
- Modify: `apps/api/src/domain/pest/pest-type.ts`
- Modify: `apps/admin/src/lib/labels.ts:55-63`
- Test: `apps/api/src/domain/pest/pest-type.spec.ts` (create)

**Interfaces:**
- Produces: `enum PestType { INSECT, MITE, NEMATODE, MOLLUSC, BIRD, MAMMAL, OTHER }`

- [ ] **Step 1: Écrire le test qui échoue**

Create `apps/api/src/domain/pest/pest-type.spec.ts`:

```ts
import { PestType } from './pest-type';

describe('PestType (catégories animales)', () => {
  it('contient les catégories animales et pas les pathogènes', () => {
    expect(Object.values(PestType).sort()).toEqual(
      ['BIRD', 'INSECT', 'MAMMAL', 'MITE', 'MOLLUSC', 'NEMATODE', 'OTHER'].sort(),
    );
    expect(Object.values(PestType)).not.toContain('FUNGUS');
    expect(Object.values(PestType)).not.toContain('VIRUS');
  });
});
```

- [ ] **Step 2: Lancer le test → échoue**

```bash
pnpm --filter @okko/api exec jest src/domain/pest/pest-type.spec.ts
```
Expected: FAIL (contient encore FUNGUS/VIRUS…).

- [ ] **Step 3: Mettre à jour l'enum**

Replace `apps/api/src/domain/pest/pest-type.ts` entier :

```ts
export enum PestType {
  INSECT = 'INSECT',
  MITE = 'MITE',
  NEMATODE = 'NEMATODE',
  MOLLUSC = 'MOLLUSC',
  BIRD = 'BIRD',
  MAMMAL = 'MAMMAL',
  OTHER = 'OTHER',
}
```

- [ ] **Step 4: Lancer le test → passe**

```bash
pnpm --filter @okko/api exec jest src/domain/pest/pest-type.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Mettre à jour les libellés admin**

Replace `PEST_TYPE_LABELS` dans `apps/admin/src/lib/labels.ts` :

```ts
export const PEST_TYPE_LABELS: Record<string, string> = {
  INSECT: 'Insecte',
  MITE: 'Acarien',
  NEMATODE: 'Nématode',
  MOLLUSC: 'Mollusque',
  BIRD: 'Oiseau',
  MAMMAL: 'Mammifère',
  OTHER: 'Autre',
};
```

- [ ] **Step 6: Typecheck admin + commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest-type.ts apps/api/src/domain/pest/pest-type.spec.ts apps/admin/src/lib/labels.ts
git commit -m "feat(pest): catégorie animale (insecte, acarien, nématode, mollusque, oiseau, mammifère, autre)"
```

---

### Task 3: Champs `family`, `description`, `updatedAt` (domaine → API)

**Files:**
- Modify: `apps/api/src/domain/pest/pest.ts` (snapshot, create/update/getters/toSnapshot/fromSnapshot)
- Modify: `apps/api/prisma/schema.prisma` (model Pest)
- Create: `apps/api/prisma/migrations/<ts>_pest_add_family_description_updatedat/migration.sql`
- Modify: `apps/api/src/infrastructure/pest/prisma-pest.repository.ts` (toRow/toSnapshot)
- Modify: `apps/api/src/application/pest/pest-read-model.ts` (PestDocument + toPestDocument)
- Modify: `apps/api/src/application/pest/create-pest.use-case.ts` (CreatePestInput + create)
- Modify: `apps/api/src/application/pest/update-pest.use-case.ts` (UpdatePestInput + update)
- Modify: `apps/api/src/presentation/pest/pest.controller.ts` (bodies create/update)
- Test: `apps/api/src/domain/pest/pest.update.spec.ts` (ajout de cas)

**Interfaces:**
- Consumes: classe `Pest`, `PestSnapshot` (Task 1).
- Produces:
  - `PestSnapshot` gagne `family?: string`, `description?: Record<string,string>`, `updatedAt?: string`.
  - `Pest.update(fields)` accepte `{ name, type, scientificName?, family?, description?, images? }`.
  - `PestDocument` gagne `family?: string`, `description?: Record<string,string>`, `updatedAt?: string`.
  - `CreatePestInput`/`UpdatePestInput` gagnent `family?`, `description?: Record<string,string>`.

- [ ] **Step 1: Écrire le test qui échoue (update famille + description)**

Ajouter dans `apps/api/src/domain/pest/pest.update.spec.ts` :

```ts
import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

describe('Pest.update — famille & description', () => {
  it('met à jour family et description', () => {
    const base = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT });
    const updated = base.update({
      name: TranslatableText.create({ fr: 'Chenille légionnaire' }),
      type: PestType.INSECT,
      family: 'Noctuidae',
      description: TranslatableText.create({ fr: 'Ravageur polyphage.' }),
    });
    const snap = updated.toSnapshot();
    expect(snap.family).toBe('Noctuidae');
    expect(snap.description).toEqual({ fr: 'Ravageur polyphage.' });
  });
});
```

- [ ] **Step 2: Lancer → échoue**

```bash
pnpm --filter @okko/api exec jest src/domain/pest/pest.update.spec.ts
```
Expected: FAIL (update n'accepte pas family/description).

- [ ] **Step 3: Enrichir le domaine `Pest`**

Dans `apps/api/src/domain/pest/pest.ts` :

3a. `PestSnapshot` — ajouter après `scientificName?` :
```ts
  family?: string;
  description?: Record<string, string>;
  updatedAt?: string;
```

3b. `CreateProps` — ajouter `family?: string;` et `description?: TranslatableText;`.

3c. Constructeur — ajouter deux paramètres après `_scientificName` :
```ts
    private readonly _family: string | undefined,
    private readonly _description: TranslatableText | undefined,
```

3d. `create()` — passer `props.family, props.description` dans le bon ordre :
```ts
  static create(props: CreateProps): Pest {
    return new Pest(
      props.id, props.name, props.type, props.scientificName,
      props.family, props.description,
      props.symptoms,
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {},
    );
  }
```

3e. Getters — ajouter :
```ts
  get family(): string | undefined { return this._family; }
  get description(): TranslatableText | undefined { return this._description; }
```

3f. `toSnapshot()` — ajouter `family` et `description` :
```ts
      scientificName: this._scientificName,
      family: this._family,
      description: this._description?.toJSON(),
```

3g. `update()` — nouvelle signature et corps :
```ts
  update(fields: { name: TranslatableText; type: PestType; scientificName?: string; family?: string; description?: TranslatableText; images?: MediaImageJSON[] }): Pest {
    return new Pest(
      this._id,
      fields.name,
      fields.type,
      fields.scientificName,
      fields.family,
      fields.description ?? this._description,
      this._symptoms,
      fields.images !== undefined ? fields.images.map(MediaImage.fromJSON) : this._images,
      this._notes,
      this._metadata,
    );
  }
```

3h. `fromSnapshot()` — reconstruire family/description :
```ts
  static fromSnapshot(s: PestSnapshot): Pest {
    return new Pest(
      s.id, TranslatableText.create(s.name), s.type, s.scientificName,
      s.family,
      s.description ? TranslatableText.create(s.description) : undefined,
      s.symptoms ? TranslatableText.create(s.symptoms) : undefined,
      (s.images ?? []).map(MediaImage.fromJSON), s.notes, { ...s.metadata },
    );
  }
```

- [ ] **Step 4: Lancer → passe**

```bash
pnpm --filter @okko/api exec jest src/domain/pest/pest.update.spec.ts src/domain/pest/pest.spec.ts
```
Expected: PASS (corriger les specs existantes si l'ordre des args a bougé).

- [ ] **Step 5: Schéma Prisma + migration additive**

Dans `apps/api/prisma/schema.prisma`, model `Pest`, ajouter après `scientificName String?` :
```prisma
  family         String?
  description    Json?
```
et après `metadata Json` (avant/après `createdAt`) :
```prisma
  updatedAt      DateTime @default(now()) @updatedAt
```

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api
pnpm --filter @okko/api exec prisma migrate dev --name pest_add_family_description_updatedat
```
Expected: migration `ADD COLUMN` appliquée (la colonne `updatedAt` prend `now()` par défaut sur la ligne existante), client regénéré.

- [ ] **Step 6: Dépôt Prisma — persister/relire les nouveaux champs**

Dans `apps/api/src/infrastructure/pest/prisma-pest.repository.ts` :

`toRow` — ajouter dans l'objet retourné :
```ts
      family: p.family ?? null,
      description: (p.description ?? undefined) as Prisma.InputJsonValue | undefined,
```
`toSnapshot` — ajouter :
```ts
      family: row.family ?? undefined,
      description: (row.description ?? undefined) as Record<string, string> | undefined,
      updatedAt: row.updatedAt?.toISOString(),
```

- [ ] **Step 7: Read-model — exposer les champs**

Dans `apps/api/src/application/pest/pest-read-model.ts` :

`PestDocument` — ajouter :
```ts
  family?: string;
  description?: Record<string, string>;
  updatedAt?: string;
```
`toPestDocument` — dans l'objet retourné, ajouter `family: p.family, description: p.description, updatedAt: p.updatedAt,` et enrichir le texte indexé :
```ts
  if (p.family) lines.push(`Famille : ${p.family}`);
  if (p.description) lines.push(p.description[locale] ?? p.description['fr']);
```

- [ ] **Step 8: Use-cases + contrôleur — accepter family/description**

`create-pest.use-case.ts` : `CreatePestInput` ajoute `family?: string; description?: Record<string, string>;` ; dans `execute`, passer à `Pest.create` : `family: input.family, description: input.description ? TranslatableText.create(input.description) : undefined,`.

`update-pest.use-case.ts` : `UpdatePestInput` ajoute `family?: string; description?: Record<string, string>;` ; dans `.update({...})`, ajouter `family: input.family || undefined, description: input.description ? TranslatableText.create(input.description) : undefined,`.

`pest.controller.ts` : dans les bodies `create` et `update`, ajouter `family?: string; description?: Record<string, string>;`.

- [ ] **Step 9: Typecheck + specs**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/api && npx tsc --noEmit
pnpm --filter @okko/api exec jest src/domain/pest src/application/pest
```
Expected: 0 erreur TS ; specs au vert.

- [ ] **Step 10: Commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
git add -A apps/api
git commit -m "feat(pest): champs famille + description + updatedAt (domaine, migration, API)"
```

---

### Task 4: Photos catégorisées (modèle média partagé)

Extension rétro-compatible : `category?` optionnel sur `MediaImage`. Cultures/zones ne le passent pas → inchangées.

**Files:**
- Modify: `apps/api/src/domain/media/media-image.ts`
- Modify: `apps/api/src/presentation/media/image-dto.ts`
- Test: `apps/api/src/domain/media/media-image.spec.ts` (create)

**Interfaces:**
- Produces: `MediaImageJSON = { key; caption?; category? }` ; `ImageDto = { key; url; caption?; category? }`.

- [ ] **Step 1: Test qui échoue (round-trip category)**

Create `apps/api/src/domain/media/media-image.spec.ts`:

```ts
import { MediaImage } from './media-image';

describe('MediaImage — category', () => {
  it('round-trip JSON préserve la catégorie', () => {
    const img = MediaImage.fromJSON({ key: 'k1', caption: 'adulte', category: 'ADULT' });
    expect(img.category).toBe('ADULT');
    expect(img.toJSON()).toEqual({ key: 'k1', caption: 'adulte', category: 'ADULT' });
  });
  it('omet category si absente', () => {
    expect(MediaImage.fromJSON({ key: 'k2' }).toJSON()).toEqual({ key: 'k2' });
  });
});
```

- [ ] **Step 2: Lancer → échoue**

```bash
pnpm --filter @okko/api exec jest src/domain/media/media-image.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Étendre `MediaImage`**

Replace `apps/api/src/domain/media/media-image.ts` :

```ts
export interface MediaImageJSON { key: string; caption?: string; category?: string; }
interface CreateProps { key: string; caption?: string; category?: string; }

export class MediaImage {
  private constructor(
    private readonly _key: string,
    private readonly _caption?: string,
    private readonly _category?: string,
  ) {}
  static create(props: CreateProps): MediaImage { return new MediaImage(props.key, props.caption, props.category); }
  get key(): string { return this._key; }
  get caption(): string | undefined { return this._caption; }
  get category(): string | undefined { return this._category; }
  toJSON(): MediaImageJSON {
    return {
      key: this._key,
      ...(this._caption ? { caption: this._caption } : {}),
      ...(this._category ? { category: this._category } : {}),
    };
  }
  static fromJSON(json: MediaImageJSON): MediaImage { return new MediaImage(json.key, json.caption, json.category); }
}
```

- [ ] **Step 4: Carry category dans le DTO**

Replace `apps/api/src/presentation/media/image-dto.ts` :

```ts
import { MediaImageJSON } from '../../domain/media/media-image';
import { StoragePort } from '../../application/media/storage.port';

export interface ImageDto { key: string; url: string; caption?: string; category?: string; }

export function toImageDto(img: MediaImageJSON, storage: StoragePort): ImageDto {
  return {
    key: img.key,
    url: storage.publicUrl(img.key),
    ...(img.caption ? { caption: img.caption } : {}),
    ...(img.category ? { category: img.category } : {}),
  };
}
```

- [ ] **Step 5: Contrôleur pest — accepter category à l'entrée**

Dans `apps/api/src/presentation/pest/pest.controller.ts`, remplacer les types d'images des bodies `create` et `update` de `{ key: string; caption?: string }[]` → `{ key: string; caption?: string; category?: string }[]`.

- [ ] **Step 6: Lancer → passe + typecheck**

```bash
pnpm --filter @okko/api exec jest src/domain/media/media-image.spec.ts
cd /Users/scalens_01/Documents/personal-project/okko/apps/api && npx tsc --noEmit
```
Expected: PASS ; 0 erreur TS.

- [ ] **Step 7: Commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
git add -A apps/api
git commit -m "feat(media): catégorie optionnelle par image (adulte/larve/œufs/dégâts)"
```

---

### Task 5: Admin — types, libellés, formulaires

**Files:**
- Modify: `apps/admin/src/lib/api.ts:7` (ImageRef) et `:118` (interface Pest)
- Modify: `apps/admin/src/lib/labels.ts` (ajout PEST_PHOTO_CATEGORY_LABELS)
- Modify: `apps/admin/src/lib/actions.ts:144-152` (createPest/updatePest)
- Modify: `apps/admin/src/components/ImageGalleryUploader.tsx` (prop optionnelle `categories`)
- Modify: `apps/admin/src/app/pests/new/page.tsx`
- Modify: `apps/admin/src/app/pests/PestRowActions.tsx`

**Interfaces:**
- Consumes: shapes API de la Task 3/4.
- Produces:
  - `ImageRef = { key; url; caption?; category? }`.
  - `interface Pest { id; name; type; scientificName?; family?; description?: Record<string,string>; images: ImageRef[]; updatedAt?: string }`.
  - `PEST_PHOTO_CATEGORY_LABELS: Record<string,string>`.
  - `ImageGalleryUploader` accepte `categories?: { value: string; label: string }[]`.

- [ ] **Step 1: Types + libellés**

`apps/admin/src/lib/api.ts` :
- ligne `ImageRef` → `export interface ImageRef { key: string; url: string; caption?: string; category?: string; }`
- interface `Pest` → `export interface Pest { id: string; name: string; type: string; scientificName?: string; family?: string; description?: Record<string, string>; images: ImageRef[]; updatedAt?: string; }`
- ajouter l'action de lecture unitaire :
```ts
export async function getPest(id: string): Promise<Pest> {
  const res = await authFetch(`/pests/${id}`, { cache: 'no-store' });
  return res.json();
}
```

`apps/admin/src/lib/labels.ts` — ajouter :
```ts
export const PEST_PHOTO_CATEGORY_LABELS: Record<string, string> = {
  ADULT: 'Adulte', LARVA: 'Larve', EGG: 'Œufs', DAMAGE: 'Dégâts', OTHER: 'Autre',
};
```

- [ ] **Step 2: Actions createPest/updatePest**

Dans `apps/admin/src/lib/actions.ts`, remplacer les signatures :
```ts
export async function createPest(input: { name: Record<string, string>; type: string; scientificName?: string; family?: string; description?: Record<string, string>; images?: { key: string; caption?: string; category?: string }[] }): Promise<Pest> {
  const res = await authFetch('/pests', jsonInit('POST', input));
  return res.json();
}
export async function updatePest(id: string, input: { name: Record<string, string>; type: string; scientificName?: string; family?: string; description?: Record<string, string>; images?: { key: string; caption?: string; category?: string }[] }): Promise<Pest> {
  const res = await authFetch(`/pests/${id}`, jsonInit('PATCH', input));
  return res.json();
}
```

- [ ] **Step 3: `ImageGalleryUploader` — sélecteur de catégorie optionnel**

Dans `apps/admin/src/components/ImageGalleryUploader.tsx` :

3a. Importer le Select shadcn en tête :
```ts
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
```
3b. Signature :
```ts
export function ImageGalleryUploader({ value, onChange, categories }: { value: ImageRef[]; onChange: (v: ImageRef[]) => void; categories?: { value: string; label: string }[] }) {
```
3c. Ajouter un setter catégorie près de `setCaption` :
```ts
  const setCategory = (i: number, category: string) => onChange(value.map((img, k) => (k === i ? { ...img, category } : img)));
```
3d. Dans la carte photo, sous l'`Input` légende, ajouter (rendu seulement si `categories` fourni) :
```tsx
            {categories && (
              <Select value={img.category ?? ''} onValueChange={(v) => setCategory(i, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="catégorie" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
```

- [ ] **Step 4: Formulaire création `pests/new`**

Dans `apps/admin/src/app/pests/new/page.tsx` :
- importer `PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS` depuis `@/lib/labels`.
- états supplémentaires : `const [family, setFamily] = useState('');` et `const [description, setDescription] = useState('');`.
- `type` initial : garder `'INSECT'`.
- `createPest({...})` : ajouter `family: family || undefined, description: description ? { fr: description } : undefined,` et `images: images.map((i) => ({ key: i.key, caption: i.caption, category: i.category }))`.
- titre de carte → `Nouveau ravageur`.
- ajouter après le champ Nom scientifique :
```tsx
            <div className="space-y-1">
              <Label htmlFor="pest-family">Famille taxonomique (optionnel)</Label>
              <Input id="pest-family" placeholder="ex. Noctuidae" value={family} onChange={(e) => setFamily(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pest-desc">Description (optionnel)</Label>
              <textarea id="pest-desc" className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
```
- passer les catégories à l'uploader :
```tsx
<ImageGalleryUploader value={images} onChange={setImages} categories={Object.entries(PEST_PHOTO_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
```

- [ ] **Step 5: Édition `PestRowActions`**

Dans `apps/admin/src/app/pests/PestRowActions.tsx` :
- élargir le type prop `pest` : ajouter `family?: string; description?: Record<string, string>;`.
- importer `PEST_PHOTO_CATEGORY_LABELS`.
- états : `const [family, setFamily] = useState(pest.family ?? '');` et `const [description, setDescription] = useState(pest.description?.fr ?? '');`.
- ajouter les champs Famille + Description (mêmes markups qu'en Step 4) dans le dialog.
- `updatePest(...)` : ajouter `family: family || undefined, description: description ? { fr: description } : undefined,` et `images: images.map((i) => ({ key: i.key, caption: i.caption, category: i.category }))`.
- passer `categories={...}` à l'`ImageGalleryUploader` (comme Step 4).

- [ ] **Step 6: Typecheck admin + commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib apps/admin/src/components/ImageGalleryUploader.tsx apps/admin/src/app/pests
git commit -m "feat(admin): formulaires ravageur — famille, description, photos catégorisées"
```

---

### Task 6: Fiche ravageur `/pests/[id]` + lien liste

**Files:**
- Create: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`
- Create: `apps/admin/src/app/pests/[id]/page.tsx`
- Modify: `apps/admin/src/app/pests/page.tsx` (lien nom → fiche)

**Interfaces:**
- Consumes: `getPest(id)` (Task 5), `Pest` (avec family/description/images.category), `PhotoCarousel`, `Section`, `PEST_TYPE_LABELS`, `PEST_PHOTO_CATEGORY_LABELS`, `labelOf`.

- [ ] **Step 1: Composant `PestFicheView`**

Create `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

```tsx
'use client';

import type { Pest } from '../../../lib/api';
import { labelOf, PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS } from '@/lib/labels';
import { PhotoCarousel } from '@/components/fiche/PhotoCarousel';
import { Images } from 'lucide-react';

export function PestFicheView({ pest }: { pest: Pest }) {
  const photos = (pest.images ?? []).map((img) => ({
    ...img,
    caption: [img.category ? labelOf(PEST_PHOTO_CATEGORY_LABELS, img.category) : '', img.caption]
      .filter(Boolean).join(' — ') || undefined,
  }));

  return (
    <div>
      {/* Hero */}
      <div className="flex gap-5 rounded-xl px-6 py-7" style={{ background: 'linear-gradient(135deg,#fdf0f0,#fbfdfb)' }}>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{pest.name}</h1>
          {pest.scientificName && <p className="mt-0.5 text-sm italic text-muted-foreground">{pest.scientificName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-block rounded-full bg-[#f4e6e6] px-3 py-1 text-[13px] font-semibold text-[#8a2c2c]">
              🐛 {labelOf(PEST_TYPE_LABELS, pest.type)}
            </span>
            {pest.family && (
              <span className="inline-block rounded-full bg-[#eee] px-3 py-1 text-[13px] text-[#475569]">
                Famille : {pest.family}
              </span>
            )}
          </div>
          {pest.description?.fr && (
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#374151]">{pest.description.fr}</p>
          )}
        </div>
        {photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0].url} alt={photos[0].caption ?? pest.name} className="h-28 w-28 shrink-0 rounded-2xl border border-[#e8dddd] object-cover" />
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div className="px-6">
          <section id="photos" className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f4e6e6] text-[#8a2c2c]">
                <Images className="h-4 w-4" />
              </span>
              Photos
              <span className="font-normal text-muted-foreground">({photos.length})</span>
            </h2>
            <PhotoCarousel images={photos} />
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Page fiche `/pests/[id]`**

Create `apps/admin/src/app/pests/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPest } from '../../../lib/api';
import { PestFicheView } from './PestFicheView';

export default async function PestFichePage({ params }: { params: { id: string } }) {
  const pest = await getPest(params.id).catch(() => null);
  if (!pest) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <PestFicheView pest={pest} />
      <Link href="/pests" className="mt-6 inline-block text-xs text-muted-foreground hover:underline">
        ← Retour à la liste
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Lien depuis la liste**

Dans `apps/admin/src/app/pests/page.tsx`, remplacer la cellule nom :
```tsx
                <TableCell>{p.name}</TableCell>
```
par :
```tsx
                <TableCell>
                  <Link href={`/pests/${p.id}`} className="text-primary hover:underline">{p.name}</Link>
                </TableCell>
```
(`Link` est déjà importé.)

- [ ] **Step 4: Typecheck admin**

```bash
cd /Users/scalens_01/Documents/personal-project/okko/apps/admin && npx tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Step 5: Vérification manuelle**

Démarrer l'admin (`pnpm --filter @okko/admin dev`) et l'API si besoin. Créer/éditer un ravageur avec famille, description, photos catégorisées ; ouvrir `/pests/<id>` → hero (nom, scientifique, badge catégorie, famille, description) + carrousel avec catégories en légende ; vérifier le lien depuis la liste.

- [ ] **Step 6: Commit**

```bash
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/app/pests
git commit -m "feat(admin): fiche de consultation ravageur /pests/[id]"
```

---

## Notes de fin

- **Migration Task 1** : si `prisma migrate dev` refuse le renommage manuel (drift), utiliser `prisma migrate resolve` ou recréer le dossier de migration à la main avec le seul `ALTER TABLE ... RENAME`. Ne jamais laisser Prisma DROP la table.
- **`symptoms` et `notes`** restent en base et dans le domaine mais ne sont pas exposés en Brique 1 (symptoms → Brique 3 Dégâts).
- **Après la Brique 1**, la fiche n'a que hero + photos ; les sections Biologie/Dégâts/Répartition/Gestion/Sources s'ajouteront brique par brique en réutilisant le même `PestFicheView` et le kit `Section`.
