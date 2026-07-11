# Édition des sous-items (Brique 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pouvoir modifier un item existant dans les sections variété, ravageur, nutrition, rendement, phénologie, zone — via un bouton « Modifier » par item ouvrant l'éditeur pré-rempli.

**Architecture :** API d'abord (variété = nouvel événement `VarietyUpdated` + endpoint `PUT` ; ravageur = exposer `threshold`/`sensitiveStages` sur la vue pour une édition fidèle). Puis admin : les 6 éditeurs gagnent un mode édition (props optionnelles), et `page.tsx` rend un « Modifier » par item. Les sections « Set » (nutrition/rendement/phéno) re-soumettent la liste avec l'item remplacé ; les sections upsert (zone/ravageur) re-`PUT` sur la même clé ; la variété `PUT` par id.

**Tech Stack :** NestJS, Prisma, Jest (API) ; Next.js 14, TypeScript, shadcn/ui (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`. DB actuellement vide.
- **Édition seulement** — pas de suppression (hors périmètre). **Prix** (→ D5) et **fenêtre** (→ D1) : non touchés.
- **Ajout inchangé** : le mode ajout des éditeurs reste le comportement par défaut (props d'édition absentes).
- **Pas de perte de données** en édition upsert : le ravageur ré-émet `controlMethods` (et threshold/sensitiveStages) inchangés pour ne pas les écraser.
- **API** : barrière = `pnpm --filter @okko/api test` vert. **Admin** : barrière = `pnpm --filter @okko/admin build` vert + smoke manuel.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 (API variété) :** `apps/api/src/domain/crop/crop-event.ts`, `crop.ts` ; `apps/api/src/application/crop/update-variety.use-case.ts` (nouveau) ; `apps/api/src/presentation/crop/crop.controller.ts` ; `apps/api/src/crop.module.ts` ; specs.
**Task 2 (API vue ravageur) :** `apps/api/src/application/pest/list-crop-pests.use-case.ts` ; spec/e2e.
**Task 3 (admin variété) :** `apps/admin/src/lib/api.ts`, `.../editors/VarietyEditor.tsx`, `.../crops/[id]/page.tsx`.
**Task 4 (admin Set) :** `.../editors/{NutritionEditor,YieldsEditor,PhenologyEditor}.tsx`, `page.tsx`.
**Task 5 (admin upsert) :** `.../editors/{ZoneSuitabilityEditor,PestControlEditor}.tsx`, `lib/api.ts` (type `CropPest`), `page.tsx`.

---

## Task 1 : API — mise à jour de variété

**Files:**
- Modify: `apps/api/src/domain/crop/crop-event.ts` (union `CropEvent`)
- Modify: `apps/api/src/domain/crop/crop.ts` (`updateVariety` + `apply`)
- Create: `apps/api/src/application/crop/update-variety.use-case.ts`
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (endpoint + `mapCropError`)
- Modify: `apps/api/src/crop.module.ts` (provider)
- Create/Modify tests: `apps/api/src/application/crop/update-variety.use-case.spec.ts`, un e2e

**Interfaces:**
- Produces : `Crop.updateVariety(v: VarietySnapshot): void` ; `UpdateVarietyUseCase.execute({ cropId, varietyId, name, maturityDays?, traits?, actor })` ; `VarietyNotFoundError` ; `PUT /crops/:id/varieties/:varietyId`.

- [ ] **Step 1 : Écrire le test use-case (échoue)** — `apps/api/src/application/crop/update-variety.use-case.spec.ts`. S'inspirer de la structure d'un spec use-case existant (voir `publish-crop.use-case.spec.ts` pour le câblage in-memory + `add-variety`). Cas :
```ts
it('met à jour une variété par id (même count, nouvelles valeurs)', async () => {
  // créer crop + AddVarietyUseCase (id 'v1', name Obatanpa)
  // UpdateVarietyUseCase.execute({ cropId, varietyId: 'v1', name: { fr: 'Obatanpa 2' }, maturityDays: 100, actor: 'a' })
  // => varietyRepo.listByCrop(crop).length === 1 ; [0].id === 'v1' ; [0].name.fr === 'Obatanpa 2' ; maturityDays === 100
});
it('lève VarietyNotFoundError si l\'id n\'existe pas', async () => { /* update 'absent' => throws */ });
```

- [ ] **Step 2 : Run → échoue.** Run: `pnpm --filter @okko/api test -- update-variety.use-case` — Expected: FAIL (module absent).

- [ ] **Step 3 : Événement `VarietyUpdated`** — dans `apps/api/src/domain/crop/crop-event.ts`, ajouter à l'union `CropEvent` (après la ligne `VarietyAdded`) :
```ts
  | { type: 'VarietyUpdated'; variety: VarietySnapshot }
```

- [ ] **Step 4 : Domaine `updateVariety` + apply** — dans `apps/api/src/domain/crop/crop.ts` : ajouter la méthode près de `addVariety` (l. 164) :
```ts
  updateVariety(v: VarietySnapshot): void { this.raise({ type: 'VarietyUpdated', variety: v }); }
```
et le cas d'`apply` (près du `case 'VarietyAdded'`, l. 187) :
```ts
      case 'VarietyUpdated': this._varieties = this._varieties.map((x) => (x.id === e.variety.id ? e.variety : x)); this._hasUnpublishedChanges = true; break;
```

- [ ] **Step 5 : Use-case** — créer `apps/api/src/application/crop/update-variety.use-case.ts`, miroir de `add-variety.use-case.ts` (mêmes dépendances : events, varieties, audit, clock — **pas** d'`ids`) :
```ts
import { Variety, VarietySnapshot } from '../../domain/crop/variety';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from './crop-event-store';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export class VarietyNotFoundError extends Error {
  constructor(id: string) { super(`Variety not found: ${id}`); this.name = 'VarietyNotFoundError'; }
}

export interface UpdateVarietyInput {
  cropId: string; varietyId: string; name: Record<string, string>;
  maturityDays?: number; yieldPotential?: ReturnType<RangeValue['toJSON']>; traits?: string[]; actor: string;
}

export class UpdateVarietyUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateVarietyInput): Promise<VarietySnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.varieties.some((v) => v.id === input.varietyId)) throw new VarietyNotFoundError(input.varietyId);
    const variety = Variety.create({
      id: input.varietyId,
      cropId: input.cropId,
      name: TranslatableText.create(input.name),
      maturityDays: input.maturityDays,
      yieldPotential: input.yieldPotential ? RangeValue.create(input.yieldPotential) : undefined,
      traits: input.traits,
    });
    const snap = variety.toSnapshot();
    crop.updateVariety(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.varieties.save(snap); // upsert par id (Prisma variety.upsert)
    await this.audit.record({ entityType: 'Variety', entityId: input.varietyId, actor: input.actor, at, changes: { updated: snap } });
    return snap;
  }
}
```

- [ ] **Step 6 : Run le test use-case → passe.** Run: `pnpm --filter @okko/api test -- update-variety.use-case` — Expected: PASS.

- [ ] **Step 7 : Endpoint + mapping** — dans `apps/api/src/presentation/crop/crop.controller.ts` : importer `UpdateVarietyUseCase, VarietyNotFoundError` ; injecter `private readonly updateVarietyUC: UpdateVarietyUseCase` dans le constructeur ; ajouter le handler (près des autres routes variété) :
```ts
  @Put(':id/varieties/:varietyId')
  async updateVariety(
    @Param('id') id: string,
    @Param('varietyId') varietyId: string,
    @Body() body: { name: Record<string, string>; maturityDays?: number; traits?: string[] },
  ) {
    try {
      return await this.updateVarietyUC.execute({ cropId: id, varietyId, ...body, actor: ACTOR });
    } catch (e) { mapCropError(e, id); }
  }
```
et dans `mapCropError`, ajouter : `if (e instanceof VarietyNotFoundError) throw new NotFoundException((e as Error).message);` (`NotFoundException` est déjà importé ; importer `VarietyNotFoundError`).

- [ ] **Step 8 : Provider module** — dans `apps/api/src/crop.module.ts`, importer `UpdateVarietyUseCase` et ajouter un provider miroir de `AddVarietyUseCase` (sans `ids`) :
```ts
    {
      provide: UpdateVarietyUseCase,
      useFactory: (es, vr, a, c) => new UpdateVarietyUseCase(es, vr, a, c),
      inject: [CROP_EVENT_STORE, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
```
(et l'ajouter au contrôleur qui l'injecte — vérifier que le contrôleur est bien listé dans ce module.)

- [ ] **Step 9 : e2e PUT variété** — ajouter à un e2e existant (`variety-requirements.e2e-spec.ts`) : créer crop → `POST` variété (récupérer son id via `GET /crops/:id`) → `PUT /crops/:id/varieties/:vid` `{ name: { fr: 'Modifié' }, maturityDays: 99 }` → `GET /crops/:id` : `varieties.length` inchangé, la variété a `name.fr==='Modifié'`, `maturityDays===99`. Cas 404 : `PUT` sur un varietyId inexistant → 404.

- [ ] **Step 10 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 11 : Commit**
```bash
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/application/crop/update-variety.use-case.ts apps/api/src/application/crop/update-variety.use-case.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/variety-requirements.e2e-spec.ts
git commit -m "feat(api): mise à jour d'une variété (VarietyUpdated + PUT /crops/:id/varieties/:varietyId)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : API — exposer threshold & sensitiveStages sur la vue ravageur

**But :** l'édition d'un ravageur (upsert qui remplace tout l'enregistrement) doit pouvoir pré-remplir et ré-émettre `threshold`/`sensitiveStages` — or `CropPestView` ne les expose pas (ils seraient perdus). La projection les stocke déjà ; c'est un ajout de mapping (améliore aussi la vue de lecture).

**Files:**
- Modify: `apps/api/src/application/pest/list-crop-pests.use-case.ts`
- Modify/Create: un test e2e/spec couvrant la vue ravageur

**Interfaces:**
- Produces : `CropPestView` gagne `threshold?: string` et `sensitiveStages: string[]`.

- [ ] **Step 1 : Écrire/étendre un test (échoue)** — dans un e2e ravageur existant (`zone-pest-crud.e2e-spec.ts` ou `crop-sections-event-sourcing.e2e-spec.ts`), après avoir rattaché un ravageur avec `threshold` et `sensitiveStages`, asserter que `GET /crops/:id` `pests[0].threshold` et `pests[0].sensitiveStages` sont renvoyés. (Avant le fix : `undefined`.)

- [ ] **Step 2 : Run → échoue** (champs absents de la vue).

- [ ] **Step 3 : Étendre la vue** — dans `apps/api/src/application/pest/list-crop-pests.use-case.ts` : ajouter à l'interface `CropPestView` :
```ts
  sensitiveStages: string[];
  threshold?: string;
```
et au `views.push({ … })` du mapping :
```ts
        sensitiveStages: c.sensitiveStages,
        threshold: c.threshold,
```

- [ ] **Step 4 : Run → passe.**

- [ ] **Step 5 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 6 : Commit**
```bash
git add apps/api/src/application/pest/list-crop-pests.use-case.ts apps/api/test/
git commit -m "feat(api): expose threshold & sensitiveStages sur la vue ravageur (édition fidèle)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Admin — édition de variété

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (`updateVariety`)
- Modify: `apps/admin/src/app/crops/[id]/editors/VarietyEditor.tsx` (mode édition)
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (bouton « Modifier » par variété)

**Interfaces:**
- Produces : `updateVariety(cropId, varietyId, input): Promise<void>` ; `VarietyEditor` accepte `initial?`.

- [ ] **Step 1 : `updateVariety` dans `lib/api.ts`** — près de `addVariety` :
```ts
export async function updateVariety(cropId: string, varietyId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[] }): Promise<void> {
  const res = await fetch(`${BASE}/crops/${cropId}/varieties/${varietyId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}
```

- [ ] **Step 2 : Mode édition dans `VarietyEditor.tsx`** — ajouter la prop `initial?`, initialiser les champs depuis elle, adapter label/bouton/submission :
  - Signature : `export function VarietyEditor({ cropId, initial }: { cropId: string; initial?: { id: string; name: Record<string, string>; maturityDays?: number; traits: string[] } })`.
  - `const editing = !!initial;`
  - États : `useState(initial?.name.fr ?? '')`, `useState(initial?.maturityDays != null ? String(initial.maturityDays) : '')`, `useState(initial?.traits?.join(', ') ?? '')`.
  - `EditorShell label={editing ? 'Modifier' : '+ Ajouter une variété'}`.
  - Dans le `submit(async () => { … })` :
```tsx
const body = {
  name: { fr: name },
  maturityDays: maturityDays ? Number(maturityDays) : undefined,
  traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
};
if (editing) {
  await updateVariety(cropId, initial!.id, body);
} else {
  await addVariety(cropId, body);
  setName(''); setMaturityDays(''); setTraits('');
}
```
  - Bouton submit : `{editing ? 'Enregistrer' : 'Ajouter'}`.
  - Importer `updateVariety` en plus de `addVariety`.
  > En mode édition on ne réinitialise pas les champs (la réouverture repré-remplit depuis `initial`).

- [ ] **Step 3 : Bouton « Modifier » par variété dans `page.tsx`** — importer `updateVariety` n'est pas nécessaire ici ; dans la Card Variétés, rendre l'éditeur en mode édition à côté de chaque item :
```tsx
{crop.varieties.map((v) => (
  <li key={v.id} className="flex items-center gap-2">
    <span>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</span>
    <VarietyEditor cropId={params.id} initial={v} />
  </li>
))}
```
> `v` porte `id`, `name`, `maturityDays`, `traits` (VarietySnapshot). Retirer `list-disc`/`pl-5` de ce `<ul>` si le layout flex l'exige, ou garder — au choix, sans casser le build.

- [ ] **Step 4 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/VarietyEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): édition d'une variété (mode édition + bouton Modifier)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : Admin — édition des sections « Set » (Nutrition, Rendement, Phénologie)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/NutritionEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PhenologyEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (boutons « Modifier » pour ces 3 sections)

**Interfaces:**
- Produces : chaque éditeur accepte `editIndex?: number` (remplace `current[editIndex]` au lieu d'append).

**Patron commun (appliquer à chacun) :** ajouter `editIndex?: number` à la prop ; `const editing = editIndex != null;` ; initialiser les `useState` depuis `current[editIndex]` quand `editing` (sinon valeurs par défaut actuelles) ; label `EditorShell` = `editing ? 'Modifier' : <label actuel>` ; dans `onSubmit`, construire `next` :
`const next = editing ? current.map((it, i) => i === editIndex ? nouvelItem : it) : [...current, nouvelItem];`
puis `submit` : en édition, appeler le `set…(cropId, next)` **sans** reset des champs ; en ajout, comportement actuel (avec reset). Bouton submit `{editing ? 'Enregistrer' : 'Ajouter'}`.

- [ ] **Step 1 : `NutritionEditor.tsx`** — `editIndex?: number`. Init : `nutrient(current[editIndex]?.nutrient ?? '')`, `amount(String(current[editIndex]?.amount ?? ''))`, `unit(current[editIndex]?.unit ?? 'kg/ha')`, `basis(current[editIndex]?.basis ?? 'PER_HECTARE')`, `stage(current[editIndex]?.stage ?? '')`. `nouvelItem = { nutrient, amount: Number(amount), unit, basis, stage: stage || undefined }`. `next` = map/replace si `editing`, sinon append. Reset seulement en ajout.

- [ ] **Step 2 : `YieldsEditor.tsx`** — `editIndex?: number`. Init depuis `current[editIndex]` : `level(?.inputLevel ?? 'MEDIUM')`, `min(String(?.min ?? ''))`, `avg(String(?.average ?? ''))`, `pot(String(?.potential ?? ''))`, `unit(?.unit ?? 't/ha')`. `nouvelItem = { inputLevel: level, min: Number(min), average: Number(avg), potential: Number(pot), unit }`. `next` map/replace si editing.

- [ ] **Step 3 : `PhenologyEditor.tsx`** — `editIndex?: number`. Init : `name(current[editIndex]?.name.fr ?? '')`, `start(String(?.startDay ?? ''))`, `end(String(?.endDay ?? ''))`. `nouvelItem = { name: { fr: name }, startDay: Number(start), endDay: Number(end), order: editing ? current[editIndex].order : current.length + 1 }`. `next` map/replace si editing (préserver `order`).

- [ ] **Step 4 : `page.tsx` — boutons « Modifier »** — dans les Cards Nutrition, Rendement, Phénologie, rendre l'éditeur en mode édition par item :
```tsx
{crop.nutrition.map((n, i) => (
  <li key={i} className="flex items-center gap-2">
    <span>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${n.stage})` : ''}</span>
    <NutritionEditor cropId={params.id} current={crop.nutrition} editIndex={i} />
  </li>
))}
```
(idem `YieldsEditor` avec `current={crop.yields} editIndex={i}` et `PhenologyEditor` avec `current={crop.phenology} editIndex={i}`, en gardant le texte d'item existant.)

- [ ] **Step 5 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/editors/NutritionEditor.tsx apps/admin/src/app/crops/\[id\]/editors/YieldsEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PhenologyEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): édition des sections Set (nutrition, rendement, phénologie)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : Admin — édition des sections upsert (Zone, Ravageur)

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (type `CropPest` gagne `threshold?`, `sensitiveStages`)
- Modify: `apps/admin/src/app/crops/[id]/editors/ZoneSuitabilityEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PestControlEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx` (boutons « Modifier » Zone & Ravageur)

**Interfaces:**
- Consumes : `CropPestView.threshold/sensitiveStages` (Task 2). `setZoneSuitability`/`setPestControl` (existants) acceptent déjà la clé + les champs (`setPestControl` accepte `controlMethods?`).
- Produces : `ZoneSuitabilityEditor`/`PestControlEditor` acceptent `initial?`.

- [ ] **Step 1 : Type `CropPest`** — dans `apps/admin/src/lib/api.ts`, ajouter à l'interface `CropPest` : `sensitiveStages: string[];` et `threshold?: string;` (pour typer `initial` et pré-remplir).

- [ ] **Step 2 : `ZoneSuitabilityEditor.tsx` — mode édition** — prop `initial?: { zoneId: string; rating: string; justification?: string }`. `const editing = !!initial;` Init : `zoneId(initial?.zoneId ?? '')`, `rating(initial?.rating ?? 'SUITABLE')`, `justification(initial?.justification ?? '')`. Label `editing ? 'Modifier' : '+ Rattacher une zone'`. Le `<Select>` zone : ajouter `disabled={editing}` (clé verrouillée). Submission inchangée (`setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })`) — l'upsert sur la même clé remplace. Bouton `{editing ? 'Enregistrer' : 'Rattacher'}`. (Garder le garde `if (zones.length === 0)` ; en édition `zones` contient au moins la zone concernée.)

- [ ] **Step 3 : `PestControlEditor.tsx` — mode édition (sans perte)** — prop `initial?: { pestId: string; susceptibility: string; threshold?: string; sensitiveStages: string[]; controlMethods: { category: string; description: Record<string,string>; inputs: string[] }[] }`. `const editing = !!initial;` Init : `pestId(initial?.pestId ?? '')`, `susceptibility(initial?.susceptibility ?? 'MEDIUM')`, `threshold(initial?.threshold ?? '')`, `stages((initial?.sensitiveStages ?? []).join(', '))`. Label `editing ? 'Modifier' : '+ Rattacher un ravageur / une maladie'`. Le `<Select>` ravageur : `disabled={editing}`. **Préserver `controlMethods`** : dans la soumission, passer `controlMethods: initial?.controlMethods` (inchangés) pour ne pas les écraser :
```tsx
await setPestControl(cropId, pestId, {
  susceptibility,
  threshold: threshold || undefined,
  sensitiveStages: stages ? stages.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
  ...(editing ? { controlMethods: initial!.controlMethods } : {}),
});
```
Bouton `{editing ? 'Enregistrer' : 'Rattacher'}`. Reset des champs seulement en ajout.

- [ ] **Step 4 : `page.tsx` — boutons « Modifier » Zone & Ravageur** :
```tsx
{crop.zones.map((z) => (
  <li key={z.zoneId} className="flex items-center gap-2">
    <span>{z.zoneName.fr} — <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>{z.justification ? ` (${z.justification})` : ''}</span>
    <ZoneSuitabilityEditor cropId={params.id} zones={zones} initial={{ zoneId: z.zoneId, rating: z.rating, justification: z.justification }} />
  </li>
))}
```
et pour le ravageur, dans le `<div key={p.pestId}>` existant, ajouter à côté du titre :
```tsx
<PestControlEditor cropId={params.id} pests={pests} initial={{ pestId: p.pestId, susceptibility: p.susceptibility, threshold: p.threshold, sensitiveStages: p.sensitiveStages, controlMethods: p.controlMethods }} />
```

- [ ] **Step 5 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 6 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Pour chaque section (variété, nutrition, rendement, phéno, zone, ravageur) : « Modifier » un item change bien sa valeur ; l'ajout marche toujours ; en édition zone/ravageur le sélecteur de clé est verrouillé ; l'édition d'un ravageur avec des méthodes de lutte ne les efface pas.

- [ ] **Step 7 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/ZoneSuitabilityEditor.tsx apps/admin/src/app/crops/\[id\]/editors/PestControlEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): édition des sections upsert (zone, ravageur) avec clé verrouillée

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **API** : `VarietyUpdated` + `UpdateVarietyUseCase` + `PUT /crops/:id/varieties/:varietyId` (upsert par id, 404 si absent) ; `CropPestView` expose `threshold`/`sensitiveStages`. Suite verte.
- **Admin** : 6 éditeurs avec mode édition ; « Modifier » par item pour les 6 sections. Set → remplace à l'index ; upsert → clé verrouillée + re-`PUT` ; variété → `PUT` par id. Ravageur : `controlMethods` préservés en édition (pas de perte). Ajout inchangé.
- **Hors périmètre** respecté : pas de suppression ; prix/fenêtre intacts. Build admin vert.

## Self-review (couverture spec)

- §4 API variété (événement, use-case, endpoint, tests) → Task 1. ✅
- §2/§5.2 édition ravageur fidèle (threshold/sensitiveStages exposés + controlMethods préservés) → Task 2 (API) + Task 5 (admin). ✅
- §5.1 Set (nutrition/rendement/phéno) → Task 4. §5.2 upsert (zone/ravageur) → Task 5. §5.3 variété → Task 3. ✅
- §5.4 « Modifier » par item → Tasks 3/4/5 (page.tsx). ✅
- §3 hors périmètre (suppression, prix, fenêtre) → Global Constraints + Notes. ✅
- §7 vérification (API test, admin build, smoke) → chaque tâche. ✅
