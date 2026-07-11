# Diff sémantique entre versions publiées (Lot C3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparer deux versions publiées d'une culture et renvoyer un diff sémantique (champs cœur modifiés + items ajoutés/supprimés/modifiés par section à clé), via `GET /crops/:id/diff?from=A&to=B`.

**Architecture :** Une fonction pure `diffCropDocuments` compare les deux documents figés (`PublishedCrop.document`, obtenus par `findRevision` de C1) — aucune mutation, aucun rejeu, aucun changement de schéma. Un endpoint de lecture (comme `/versions`) lit les deux révisions et renvoie le résultat de la fonction.

**Tech Stack :** NestJS 10 + TypeScript + Jest.

## Global Constraints

- **Purement additif** : aucune mutation, aucun événement, aucun changement de schéma. Les endpoints existants sont inchangés.
- **Source** : les deux `PublishedCrop.document` (`CropDocument`) via `PublishedCropRepository.findRevision(cropId, revision)` (C1).
- **Sémantique par item** (identifié par clé, pas par index) ; item modifié = item **avant**/**après** entier (pas de descente dans les sous-champs).
- **Sortie concise** : `fields` = seulement les champs modifiés ; `sections` = seulement les sections à clé ayant un changement.
- **Exclus du diff** (méta/dérivé) : `status`, `version`, `completeness`, `serializedText`, `hasUnpublishedChanges`, `hasPublishedVersion`, `id`.
- **Erreurs** : révision `from`/`to` inexistante ou `NaN` → **404** ; `from == to` → diff vide, **200**.
- **Tests** : TDD (rouge d'abord). Après **chaque tâche**, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`. Suite single-worker ; ⚠️ `deleteMany` vide la base de dev — OK.
- Commits `feat(api):`/`test(api):`. Terminer **chaque** message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Créés :**
- `src/application/crop/crop-diff.ts` — types `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange`, `deepEqual`, `diffCropDocuments`.
- `src/application/crop/crop-diff.spec.ts` — tests unitaires (Task 1).
- `test/crop-diff.e2e-spec.ts` — e2e (Task 2).

**Modifiés :**
- `src/presentation/crop/crop.controller.ts` — endpoint `GET :id/diff` (Task 2).

---

## Task 1 : Fonction pure `diffCropDocuments` (TDD)

**Files:**
- Create: `src/application/crop/crop-diff.ts`
- Create: `src/application/crop/crop-diff.spec.ts`

**Interfaces:**
- Consumes : `CropDocument` (de `./crop-read-model`).
- Produces : `diffCropDocuments(fromRevision: number, toRevision: number, before: CropDocument, after: CropDocument): CropDiff` ; `deepEqual(a: unknown, b: unknown): boolean` ; types `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange`.

- [ ] **Step 1 : Écrire les tests qui échouent** — créer `crop-diff.spec.ts`. Construire un `CropDocument` de base minimal + un helper `doc(overrides)` :
```ts
import { CropDocument } from './crop-read-model';
import { diffCropDocuments, deepEqual } from './crop-diff';

const base: CropDocument = {
  id: 'c1', name: 'Maïs', scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
  status: 'PUBLISHED', version: 1, metadata: {},
  climatic: undefined, edaphic: undefined,
  varieties: [], zones: [], phenology: [], croppingWindows: [], pests: [], nutrition: [], yields: [], prices: [],
  completeness: { categories: {}, filled: 0, total: 0, percent: 0 },
  serializedText: '', hasUnpublishedChanges: false, hasPublishedVersion: true,
};
const doc = (o: Partial<CropDocument>): CropDocument => ({ ...base, ...o });
const variety = (id: string, maturityDays?: number) => ({ id, cropId: 'c1', name: { fr: id }, maturityDays, traits: [] } as any);

describe('diffCropDocuments', () => {
  it('documents identiques -> diff vide', () => {
    const d = diffCropDocuments(1, 2, doc({}), doc({}));
    expect(d).toEqual({ cropId: 'c1', from: 1, to: 2, fields: [], sections: [] });
  });

  it('champ cœur modifié -> fields', () => {
    const d = diffCropDocuments(1, 2, doc({ name: 'Maïs' }), doc({ name: 'Maïs doux' }));
    expect(d.fields).toEqual([{ field: 'name', before: 'Maïs', after: 'Maïs doux' }]);
    expect(d.sections).toEqual([]);
  });

  it('variété ajoutée / supprimée', () => {
    const added = diffCropDocuments(1, 2, doc({ varieties: [] }), doc({ varieties: [variety('Y')] }));
    expect(added.sections).toEqual([{ section: 'varieties', added: [variety('Y')], removed: [], changed: [] }]);
    const removed = diffCropDocuments(1, 2, doc({ varieties: [variety('Y')] }), doc({ varieties: [] }));
    expect(removed.sections).toEqual([{ section: 'varieties', added: [], removed: [variety('Y')], changed: [] }]);
  });

  it('variété modifiée (même id) -> changed', () => {
    const d = diffCropDocuments(1, 2, doc({ varieties: [variety('X', 120)] }), doc({ varieties: [variety('X', 130)] }));
    expect(d.sections).toEqual([{ section: 'varieties', added: [], removed: [],
      changed: [{ key: 'X', before: variety('X', 120), after: variety('X', 130) }] }]);
  });

  it('zone modifiée par zoneId', () => {
    const z = (rating: string) => ({ zoneId: 'z1', zoneName: { fr: 'Zone 1' }, rating } as any);
    const d = diffCropDocuments(1, 2, doc({ zones: [z('SUITABLE')] }), doc({ zones: [z('MARGINAL')] }));
    expect(d.sections).toEqual([{ section: 'zones', added: [], removed: [],
      changed: [{ key: 'z1', before: z('SUITABLE'), after: z('MARGINAL') }] }]);
  });

  it('section sans clé (phenology) comparée comme valeur entière -> fields', () => {
    const p = (order: number) => ({ name: { fr: 'St' }, startDay: 0, endDay: 10, order } as any);
    const d = diffCropDocuments(1, 2, doc({ phenology: [p(1)] }), doc({ phenology: [p(1), p(2)] }));
    expect(d.fields).toEqual([{ field: 'phenology', before: [p(1)], after: [p(1), p(2)] }]);
  });

  it('metadata insensible à l\'ordre des clés', () => {
    const d = diffCropDocuments(1, 2, doc({ metadata: { a: 1, b: 2 } }), doc({ metadata: { b: 2, a: 1 } }));
    expect(d.fields).toEqual([]);
  });

  it('deepEqual gère objets imbriqués et tableaux', () => {
    expect(deepEqual({ x: [1, { y: 2 }] }, { x: [1, { y: 2 }] })).toBe(true);
    expect(deepEqual({ x: 1 }, { x: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});
```
> Vérifier la forme réelle de `CompletenessReport` (dans `crop-read-model.ts` / `crop-completeness.ts`) et ajuster le littéral `completeness` du `base` si nécessaire pour que `base` compile comme un `CropDocument`.

- [ ] **Step 2 : Lancer → échoue.**

Run: `npx jest -- crop-diff`
Expected: FAIL (`crop-diff` inexistant).

- [ ] **Step 3 : Créer `crop-diff.ts`** :
```ts
import { CropDocument } from './crop-read-model';

export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange { key: string; before: unknown; after: unknown; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];
  sections: SectionDiff[];
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}

// Champs cœur + sections-valeur : tout devient un FieldChange (avant/après entier).
const VALUE_FIELDS = ['name', 'scientificName', 'family', 'cycleType', 'climatic', 'edaphic', 'metadata', 'phenology', 'nutrition', 'yields'] as const;
// Sections à clé : added/removed/changed par clé.
const KEYED_SECTIONS: { section: string; key: string }[] = [
  { section: 'varieties', key: 'id' },
  { section: 'zones', key: 'zoneId' },
  { section: 'croppingWindows', key: 'id' },
  { section: 'pests', key: 'pestId' },
  { section: 'prices', key: 'id' },
];

export function diffCropDocuments(
  fromRevision: number,
  toRevision: number,
  before: CropDocument,
  after: CropDocument,
): CropDiff {
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;

  const fields: FieldChange[] = [];
  for (const f of VALUE_FIELDS) {
    if (!deepEqual(b[f], a[f])) fields.push({ field: f, before: b[f], after: a[f] });
  }

  const sections: SectionDiff[] = [];
  for (const { section, key } of KEYED_SECTIONS) {
    const beforeItems = (b[section] as Record<string, unknown>[] | undefined) ?? [];
    const afterItems = (a[section] as Record<string, unknown>[] | undefined) ?? [];
    const beforeByKey = new Map(beforeItems.map((it) => [String(it[key]), it]));
    const afterByKey = new Map(afterItems.map((it) => [String(it[key]), it]));

    const added: unknown[] = [];
    const removed: unknown[] = [];
    const changed: ItemChange[] = [];

    for (const [k, item] of afterByKey) if (!beforeByKey.has(k)) added.push(item);
    for (const [k, item] of beforeByKey) if (!afterByKey.has(k)) removed.push(item);
    for (const [k, beforeItem] of beforeByKey) {
      const afterItem = afterByKey.get(k);
      if (afterItem && !deepEqual(beforeItem, afterItem)) changed.push({ key: k, before: beforeItem, after: afterItem });
    }

    if (added.length || removed.length || changed.length) sections.push({ section, added, removed, changed });
  }

  return { cropId: before.id, from: fromRevision, to: toRevision, fields, sections };
}
```

- [ ] **Step 4 : Lancer → passent.**

Run: `npx jest -- crop-diff && npx tsc --noEmit`
Expected: PASS, zéro erreur TS.

- [ ] **Step 5 : Commit**
```bash
git add src/application/crop/crop-diff.ts src/application/crop/crop-diff.spec.ts
git commit -m "feat(api): diffCropDocuments — diff sémantique pur entre deux documents figés

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Endpoint `GET /crops/:id/diff` + e2e

**Files:**
- Modify: `src/presentation/crop/crop.controller.ts`
- Create: `test/crop-diff.e2e-spec.ts`

**Interfaces:**
- Consumes : `diffCropDocuments` (Task 1), `publishedCrops.findRevision` (existant).
- Produces : `GET /crops/:id/diff?from=A&to=B` → `CropDiff` (404 si révision absente).

- [ ] **Step 1 : Imports** dans `crop.controller.ts` :
  - Ajouter `Query` à l'import existant depuis `@nestjs/common` (la ligne importe déjà `Body, Controller, Get, Param, Patch, Post, Put, NotFoundException, ConflictException, Inject`).
  - Ajouter `import { diffCropDocuments } from '../../application/crop/crop-diff';`.

- [ ] **Step 2 : Endpoint** — ajouter dans la classe (par ex. après le handler `version` de `:id/versions/:revision`) :
```ts
  @Get(':id/diff')
  async diff(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const a = await this.publishedCrops.findRevision(id, Number(from));
    if (!a) throw new NotFoundException(`crop ${id} revision ${from}`);
    const b = await this.publishedCrops.findRevision(id, Number(to));
    if (!b) throw new NotFoundException(`crop ${id} revision ${to}`);
    return diffCropDocuments(Number(from), Number(to), a.document, b.document);
  }
```
> `publishedCrops` est déjà injecté (utilisé par `/published` et `/versions`). Route `:id/diff` : segment littéral distinct, pas de conflit.

- [ ] **Step 3 : Typecheck.**

Run: `npx tsc --noEmit`
Expected: zéro erreur.

- [ ] **Step 4 : e2e** — créer `test/crop-diff.e2e-spec.ts`, en mirrorant le bootstrap de `test/crop-versioning.e2e-spec.ts` (module `AppModule`, `PrismaService`, nettoyage `beforeAll`/`afterAll` **incluant `prisma.publishedCrop.deleteMany()`**, `supertest`).
```ts
  it('compare deux versions publiées (champ cœur + section)', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Manioc' }, scientificName: 'Manihot esculenta', family: 'Euphorbiaceae', cycleType: 'PERENNIAL',
    }).expect(201);
    const id = created.body.id;

    // v1 : nom "Manioc" + variété X
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'X' }, traits: [] }).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    // v2 : renommer + variété Y en plus
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Manioc doux' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'Y' }, traits: [] }).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // diff 1 -> 2
    const d = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=2`).expect(200);
    expect(d.body.from).toBe(1);
    expect(d.body.to).toBe(2);
    const nameChange = d.body.fields.find((f: any) => f.field === 'name');
    expect(nameChange).toEqual({ field: 'name', before: 'Manioc', after: 'Manioc doux' });
    const varieties = d.body.sections.find((s: any) => s.section === 'varieties');
    expect(varieties.added.map((v: any) => v.name.fr)).toEqual(['Y']);
    expect(varieties.removed).toEqual([]);

    // diff inverse 2 -> 1 : Y en removed, nom inversé
    const rev = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=2&to=1`).expect(200);
    const revVar = rev.body.sections.find((s: any) => s.section === 'varieties');
    expect(revVar.removed.map((v: any) => v.name.fr)).toEqual(['Y']);
    expect(rev.body.fields.find((f: any) => f.field === 'name')).toEqual({ field: 'name', before: 'Manioc doux', after: 'Manioc' });

    // from == to -> diff vide
    const same = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=1`).expect(200);
    expect(same.body).toEqual({ cropId: id, from: 1, to: 1, fields: [], sections: [] });

    // révision inexistante -> 404
    await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=99`).expect(404);
  });
```
> Vérifier les codes/champs réels (POST création 201, PATCH 200, POST `/varieties` 201, POST `/publish` 201 ; `varieties[].name.fr`, `fields[].field === 'name'`) via `crop.controller.ts` / un e2e existant ; adapter les `.expect(...)` au réel. `cycleType: 'PERENNIAL'` doit être une valeur valide de l'enum `CycleType` — sinon reprendre `SEASONAL_ANNUAL` comme les autres e2e.

- [ ] **Step 5 : Lancer le nouvel e2e seul.**

Run: `npx jest -- crop-diff.e2e`
Expected: PASS.

- [ ] **Step 6 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (tout — additif, non-régression complète).

- [ ] **Step 7 : Commit**
```bash
git add src/presentation/crop/crop.controller.ts test/crop-diff.e2e-spec.ts
git commit -m "feat(api): endpoint GET /crops/:id/diff?from=A&to=B (diff sémantique)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Diff sémantique par clé** : items identifiés par `id`/`zoneId`/`pestId` (pas par index) → un réordonnancement ne produit pas de faux positif.
- **Symétrie** : `from→to` et `to→from` inversent added/removed et before/after.
- **`from==to`** → diff vide ; révision absente → 404.
- **Purement additif** : aucune mutation, aucun schéma, endpoints existants inchangés ; suite verte.
- **Périmètre** : pas de descente dans les sous-champs ; sections sans clé comparées en valeur entière ; pas d'admin.
